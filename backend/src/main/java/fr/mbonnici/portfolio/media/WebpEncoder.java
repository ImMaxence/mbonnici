package fr.mbonnici.portfolio.media;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Converts uploads to WebP with Google's reference encoder ({@code cwebp}, package libwebp-tools in
 * the backend image). Running the binary keeps the JVM free of native code; there is no shell, the
 * input and output are private temp files and the process is killed after 30 s. When the binary is
 * missing (a dev machine without libwebp) uploads are stored as they are and a warning is logged.
 */
@Component
public class WebpEncoder {

    private static final Logger log = LoggerFactory.getLogger(WebpEncoder.class);

    public record Encoded(byte[] bytes, int width, int height) {}

    private final String binary;
    private final int quality;
    private volatile Boolean available;

    public WebpEncoder(@Value("${app.media.cwebp:cwebp}") String binary, @Value("${app.media.webp-quality:82}") int quality) {
        this.binary = binary;
        this.quality = Math.clamp(quality, 40, 100);
    }

    public boolean available() {
        Boolean a = available;
        if (a == null) {
            try {
                Process p = new ProcessBuilder(binary, "-version").redirectErrorStream(true).start();
                a = p.waitFor(5, TimeUnit.SECONDS) && p.exitValue() == 0;
                p.getInputStream().readAllBytes();
            } catch (IOException e) {
                a = false;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                a = false;
            }
            if (!a) {
                log.warn("cwebp not found ({}): uploads are kept in their original format", binary);
            }
            available = a;
        }
        return a;
    }

    /**
     * @param source   PNG or JPEG bytes (already validated)
     * @param width    source width
     * @param height   source height
     * @param maxWidth wider images are scaled down to this width
     */
    public Optional<Encoded> encode(byte[] source, String extension, int width, int height, int maxWidth) {
        if (!available()) {
            return Optional.empty();
        }
        Path in = null;
        Path out = null;
        try {
            in = Files.createTempFile("upload-", "." + extension);
            out = Files.createTempFile("upload-", ".webp");
            Files.write(in, source);
            List<String> cmd = new ArrayList<>(List.of(binary, "-quiet", "-mt", "-metadata", "none", "-q", String.valueOf(quality)));
            int w = width;
            int h = height;
            if (width > maxWidth) {
                w = maxWidth;
                h = Math.max(1, Math.round(height * (maxWidth / (float) width)));
                cmd.addAll(List.of("-resize", String.valueOf(w), String.valueOf(h)));
            }
            cmd.addAll(List.of(in.toString(), "-o", out.toString()));
            Process p = new ProcessBuilder(cmd).redirectErrorStream(true).start();
            boolean done = p.waitFor(30, TimeUnit.SECONDS);
            String output = new String(p.getInputStream().readNBytes(2000));
            if (!done) {
                p.destroyForcibly();
                log.warn("cwebp timed out");
                return Optional.empty();
            }
            if (p.exitValue() != 0) {
                log.warn("cwebp failed ({}): {}", p.exitValue(), output.strip());
                return Optional.empty();
            }
            byte[] webp = Files.readAllBytes(out);
            return webp.length == 0 ? Optional.empty() : Optional.of(new Encoded(webp, w, h));
        } catch (IOException e) {
            log.warn("WebP conversion failed: {}", e.getMessage());
            return Optional.empty();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } finally {
            deleteQuietly(in);
            deleteQuietly(out);
        }
    }

    /**
     * WebP → pixels, with the reference decoder ({@code dwebp}, same package), for the server-side
     * drawings (share pictures). Empty when the binary is missing or the data is not WebP.
     */
    public Optional<java.awt.image.BufferedImage> decode(byte[] webp) {
        if (!available()) {
            return Optional.empty();
        }
        Path in = null;
        Path out = null;
        try {
            in = Files.createTempFile("decode-", ".webp");
            out = Files.createTempFile("decode-", ".png");
            Files.write(in, webp);
            String dwebp = binary.endsWith("cwebp") ? binary.substring(0, binary.length() - "cwebp".length()) + "dwebp" : "dwebp";
            Process p = new ProcessBuilder(dwebp, "-quiet", in.toString(), "-o", out.toString()).redirectErrorStream(true).start();
            boolean done = p.waitFor(20, TimeUnit.SECONDS);
            p.getInputStream().readNBytes(2000);
            if (!done) {
                p.destroyForcibly();
                return Optional.empty();
            }
            if (p.exitValue() != 0) {
                return Optional.empty();
            }
            return Optional.ofNullable(javax.imageio.ImageIO.read(out.toFile()));
        } catch (IOException e) {
            log.debug("WebP decoding failed: {}", e.getMessage());
            return Optional.empty();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } finally {
            deleteQuietly(in);
            deleteQuietly(out);
        }
    }

    private static void deleteQuietly(Path p) {
        if (p != null) {
            try {
                Files.deleteIfExists(p);
            } catch (IOException ignored) {
                // temp file
            }
        }
    }
}
