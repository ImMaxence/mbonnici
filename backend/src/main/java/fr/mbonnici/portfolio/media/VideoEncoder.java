package fr.mbonnici.portfolio.media;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Re-encodes uploaded videos with {@code ffmpeg} (package ffmpeg in the backend image) so they weigh
 * little and start at once: H.264 in MP4 (plays everywhere, Safari included), no sound, no metadata,
 * at most 1280 px wide and 1600 px high, 30 seconds at most, and the index at the front of the file
 * ("faststart": playback begins before the download ends). It also reads the real size with
 * {@code ffprobe} and draws a 24 px first frame for the blurred placeholder.
 *
 * <p>Like {@link WebpEncoder}: no shell, private temp files, the process is killed after a timeout.
 * Without the binaries (a dev machine) videos are stored as sent.
 */
@Component
public class VideoEncoder {

    private static final Logger log = LoggerFactory.getLogger(VideoEncoder.class);

    public record Encoded(byte[] bytes, int width, int height, String blurDataUrl) {}

    private final String ffmpeg;
    private final String ffprobe;
    private final int crf;
    private volatile Boolean available;

    public VideoEncoder(@Value("${app.media.ffmpeg:ffmpeg}") String ffmpeg, @Value("${app.media.ffprobe:ffprobe}") String ffprobe,
            @Value("${app.media.video-crf:27}") int crf) {
        this.ffmpeg = ffmpeg;
        this.ffprobe = ffprobe;
        this.crf = Math.clamp(crf, 18, 36);
    }

    public boolean available() {
        Boolean a = available;
        if (a == null) {
            a = runs(ffmpeg) && runs(ffprobe);
            if (!a) {
                log.warn("ffmpeg / ffprobe not found: videos are stored as they are sent");
            }
            available = a;
        }
        return a;
    }

    private static boolean runs(String binary) {
        try {
            Process p = new ProcessBuilder(binary, "-version").redirectErrorStream(true).start();
            p.getInputStream().readAllBytes();
            return p.waitFor(5, TimeUnit.SECONDS) && p.exitValue() == 0;
        } catch (IOException e) {
            return false;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    /** @param extension the source container (mp4, webm, mov), for the temp file name */
    public Optional<Encoded> encode(byte[] source, String extension) {
        if (!available()) {
            return Optional.empty();
        }
        Path dir = null;
        try {
            dir = Files.createTempDirectory("video-");
            Path in = dir.resolve("in." + extension);
            Path out = dir.resolve("out.mp4");
            Files.write(in, source);
            List<String> cmd = new ArrayList<>(List.of(ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", in.toString(),
                    "-t", "30", "-an", "-sn", "-dn", "-map_metadata", "-1",
                    "-vf", "scale=w='min(iw,1280)':h='min(ih,1600)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=fps='min(source_fps,30)'",
                    "-c:v", "libx264", "-preset", "medium", "-crf", Integer.toString(crf), "-pix_fmt", "yuv420p",
                    "-profile:v", "high", "-movflags", "+faststart", out.toString()));
            if (!run(cmd, 180)) {
                return Optional.empty();
            }
            int[] size = probe(out);
            if (size == null) {
                return Optional.empty();
            }
            String blur = firstFrame(out, dir.resolve("poster.png"));
            return Optional.of(new Encoded(Files.readAllBytes(out), size[0], size[1], blur));
        } catch (IOException e) {
            log.warn("video encoding failed: {}", e.getMessage());
            return Optional.empty();
        } finally {
            delete(dir);
        }
    }

    /** width and height of the first video stream, or null */
    private int[] probe(Path file) throws IOException {
        Process p = new ProcessBuilder(ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                "-of", "csv=p=0:s=x", file.toString()).redirectErrorStream(true).start();
        String out = new String(p.getInputStream().readAllBytes(), StandardCharsets.US_ASCII).trim();
        try {
            if (!p.waitFor(20, TimeUnit.SECONDS) || p.exitValue() != 0) {
                p.destroyForcibly();
                return null;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        }
        String[] wh = out.split("x");
        try {
            return wh.length == 2 ? new int[] {Integer.parseInt(wh[0].trim()), Integer.parseInt(wh[1].trim())} : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** a 24 px wide PNG of the first frame, as a data URL (the blurred placeholder), or null */
    private String firstFrame(Path video, Path png) throws IOException {
        boolean ok = run(List.of(ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", video.toString(), "-frames:v", "1",
                "-vf", "scale=24:-2", png.toString()), 30);
        return ok && Files.exists(png) ? "data:image/png;base64," + Base64.getEncoder().encodeToString(Files.readAllBytes(png)) : null;
    }

    private boolean run(List<String> cmd, int seconds) throws IOException {
        // the output goes to a file: reading the pipe would block past the timeout
        Path log = Files.createTempFile("ffmpeg-", ".log");
        try {
            return run(cmd, seconds, log);
        } finally {
            Files.deleteIfExists(log);
        }
    }

    private boolean run(List<String> cmd, int seconds, Path logFile) throws IOException {
        Process p = new ProcessBuilder(cmd).redirectErrorStream(true).redirectOutput(logFile.toFile()).start();
        try {
            if (!p.waitFor(seconds, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                log.warn("ffmpeg timed out after {} s", seconds);
                return false;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            p.destroyForcibly();
            return false;
        }
        if (p.exitValue() != 0) {
            String output = Files.readString(logFile, StandardCharsets.UTF_8).strip();
            log.warn("ffmpeg failed ({}): {}", p.exitValue(), output.length() > 500 ? output.substring(0, 500) : output);
            return false;
        }
        return true;
    }

    private static void delete(Path dir) {
        if (dir == null) {
            return;
        }
        try (var files = Files.list(dir)) {
            files.forEach(f -> f.toFile().delete());
        } catch (IOException ignored) {
            // best effort
        }
        dir.toFile().delete();
    }
}
