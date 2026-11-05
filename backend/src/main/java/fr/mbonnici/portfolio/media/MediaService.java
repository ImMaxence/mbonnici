package fr.mbonnici.portfolio.media;

import fr.mbonnici.portfolio.common.ApiException;
import fr.mbonnici.portfolio.common.Localized;
import fr.mbonnici.portfolio.common.NotFoundException;
import fr.mbonnici.portfolio.storage.StorageService;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.UUID;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.cache.CacheManager;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MediaService {

    private static final Logger log = LoggerFactory.getLogger(MediaService.class);
    private static final long MAX_BYTES = 10L * 1024 * 1024;
    /** short muted loops (an interaction, a few seconds): stored as sent without ffmpeg… */
    private static final long MAX_VIDEO_BYTES = 25L * 1024 * 1024;
    /** …or re-encoded (much smaller) with it, so a raw phone recording is fine */
    private static final long MAX_VIDEO_SOURCE_BYTES = 80L * 1024 * 1024;
    private static final int MAX_VIDEO_SIDE = 4096;
    private static final int MAX_PIXELS = 40_000_000;
    private static final int MAX_WIDTH = 2560;
    private static final java.util.Set<String> ACCEPTED = java.util.Set.of("image/png", "image/jpeg");
    /** original object, optionally a smaller copy ("-w640") */
    private static final Pattern KEY = Pattern.compile("^(\\d{4}/\\d{2}/[0-9a-f-]{36})(?:-w(\\d{3,4}))?(\\.[a-z0-9]{3,4})$");
    /** widths of the responsive copies (only those narrower than the original are made) */
    static final List<Integer> VARIANT_WIDTHS = List.of(640, 1280, 1920);

    private final MediaRepository repository;
    private final StorageService storage;
    private final CacheManager cacheManager;
    private final WebpEncoder webpEncoder;
    private final VideoEncoder videoEncoder;
    private final AtomicBoolean backfilling = new AtomicBoolean();

    public MediaService(MediaRepository repository, StorageService storage, CacheManager cacheManager,
            WebpEncoder webpEncoder, VideoEncoder videoEncoder) {
        this.repository = repository;
        this.storage = storage;
        this.cacheManager = cacheManager;
        this.webpEncoder = webpEncoder;
        this.videoEncoder = videoEncoder;
    }

    @Transactional
    public MediaDto upload(MultipartFile file, Localized alt) {
        return upload(file, alt, null, null);
    }

    /**
     * @param videoWidth  for a video, its size as the back office's browser read it (the server has no
     *                    decoder); ignored for pictures
     */
    @Transactional
    public MediaDto upload(MultipartFile file, Localized alt, Integer videoWidth, Integer videoHeight) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("file is required");
        }
        byte[] head;
        try (var in = file.getInputStream()) {
            head = in.readNBytes(64);
        } catch (IOException e) {
            throw ApiException.badRequest("could not read file");
        }
        VideoSniffer.Detected video = VideoSniffer.detect(head);
        if (video != null) {
            return uploadVideo(file, video, alt, videoWidth, videoHeight);
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE, "file exceeds 10 MB");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("could not read file");
        }
        // 1. the real type comes from the magic bytes; only PNG and JPEG are accepted
        ImageSniffer.Detected detected = ImageSniffer.detect(bytes);
        if (detected == null || !ACCEPTED.contains(detected.contentType())) {
            throw ApiException.badRequest("unsupported file type: PNG, JPEG, MP4 or WebM only");
        }
        // 2. the extension must agree with the content (a .png that is really a JPEG is refused)
        String ext = extension(file.getOriginalFilename());
        if (ext != null && !ext.equals(detected.extension()) && !("jpeg".equals(ext) && "jpg".equals(detected.extension()))) {
            throw ApiException.badRequest("unsupported file type: the ." + ext + " extension does not match the content");
        }
        if (ext == null || !(ext.equals("png") || ext.equals("jpg") || ext.equals("jpeg"))) {
            throw ApiException.badRequest("unsupported file type: .png, .jpg or .jpeg only");
        }
        // 3. dimensions from the header before decoding anything (decompression bombs)
        int[] dims = dimensions(bytes);
        if (dims == null) {
            throw ApiException.badRequest("unsupported file type: the image cannot be read");
        }
        if ((long) dims[0] * dims[1] > MAX_PIXELS) {
            throw ApiException.badRequest("image is too large (max 40 megapixels)");
        }
        BufferedImage img = decode(bytes);
        if (img == null) {
            throw ApiException.badRequest("unsupported file type: the image is corrupted");
        }
        String blur = lqip(img);
        byte[] source = bytes;
        int width = img.getWidth();
        int height = img.getHeight();

        // 4. stored as WebP (metadata stripped, at most 2560 px wide) when the encoder is available
        String contentType = detected.contentType();
        String extension = detected.extension();
        var webp = webpEncoder.encode(bytes, detected.extension(), width, height, MAX_WIDTH);
        if (webp.isPresent()) {
            bytes = webp.get().bytes();
            width = webp.get().width();
            height = webp.get().height();
            contentType = "image/webp";
            extension = "webp";
        }

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        String key = String.format("%d/%02d/%s.%s", today.getYear(), today.getMonthValue(), UUID.randomUUID(), extension);
        storage.put(key, contentType, bytes);

        Media media = Media.create(key, contentType, bytes.length, width, height, blur,
                safeName(file.getOriginalFilename()), alt == null ? Localized.EMPTY : alt.filled());
        // 5. smaller copies for phones and laptops, from the original pixels
        if (webp.isPresent()) {
            media.setVariantWidths(makeVariants(key, source, detected.extension(), img.getWidth(), img.getHeight(), width));
        }
        media = repository.save(media);
        log.info("Uploaded media {} ({} bytes, {}x{}, {})", key, bytes.length, width, height, contentType);
        return MediaDto.from(media);
    }

    /**
     * A video is re-encoded with ffmpeg (small H.264 MP4 that starts at once, real size, blurred first
     * frame); without ffmpeg it is stored as sent, with the size the back office read.
     */
    private MediaDto uploadVideo(MultipartFile file, VideoSniffer.Detected detected, Localized alt, Integer width,
            Integer height) {
        boolean encode = videoEncoder.available();
        long max = encode ? MAX_VIDEO_SOURCE_BYTES : MAX_VIDEO_BYTES;
        if (file.getSize() > max) {
            throw new ApiException(org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE,
                    "video exceeds " + (max / (1024 * 1024)) + " MB");
        }
        String ext = extension(file.getOriginalFilename());
        if (ext == null || !ext.equals(detected.extension())) {
            throw ApiException.badRequest("unsupported file type: the extension does not match the video (." + detected.extension() + ")");
        }
        if (!encode && "mov".equals(detected.extension())) {
            throw ApiException.badRequest("unsupported file type: MOV needs re-encoding, which is not available here (MP4 or WebM)");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("could not read file");
        }
        String contentType = detected.contentType();
        String extension = detected.extension();
        String blur = null;
        if (encode) {
            var encoded = videoEncoder.encode(bytes, detected.extension());
            if (encoded.isEmpty()) {
                throw ApiException.badRequest("this video cannot be read (damaged file or unknown codec)");
            }
            log.info("Video re-encoded: {} → {} bytes", bytes.length, encoded.get().bytes().length);
            bytes = encoded.get().bytes();
            width = encoded.get().width();
            height = encoded.get().height();
            blur = encoded.get().blurDataUrl();
            contentType = "video/mp4";
            extension = "mp4";
        } else if (width == null || height == null || width < 16 || height < 16 || width > MAX_VIDEO_SIDE
                || height > MAX_VIDEO_SIDE) {
            throw ApiException.badRequest("video width and height are required (16 to 4096 px)");
        }
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        String key = String.format("%d/%02d/%s.%s", today.getYear(), today.getMonthValue(), UUID.randomUUID(), extension);
        storage.put(key, contentType, bytes);
        Media media = repository.save(Media.create(key, contentType, bytes.length, width, height, blur,
                safeName(file.getOriginalFilename()), alt == null ? Localized.EMPTY : alt.filled()));
        log.info("Uploaded video {} ({} bytes, {}x{}, {})", key, bytes.length, width, height, contentType);
        return MediaDto.from(media);
    }

    @Transactional(readOnly = true)
    public Page<MediaDto> list(int page, int size) {
        return repository.findAllByOrderByCreatedAtDesc(PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100)))
                .map(MediaDto::from);
    }

    @Transactional
    public MediaDto updateAlt(UUID id, Localized alt) {
        Media m = repository.findById(id).orElseThrow(() -> new NotFoundException("Media"));
        m.setAlt(alt == null ? Localized.EMPTY : alt.filled());
        evictProjects();
        return MediaDto.from(repository.save(m));
    }

    @Transactional
    public MediaDto updateFocal(UUID id, double x, double y) {
        Media m = repository.findById(id).orElseThrow(() -> new NotFoundException("Media"));
        m.setFocal(x, y);
        evictProjects();
        return MediaDto.from(repository.save(m));
    }

    @Transactional
    public void delete(UUID id) {
        Media m = repository.findById(id).orElseThrow(() -> new NotFoundException("Media"));
        repository.delete(m);
        repository.flush();
        deleteObjects(m);
        evictProjects();
    }

    /** Images no project or setting points to. */
    @Transactional(readOnly = true)
    public List<UUID> unused() {
        return repository.findUnusedIds();
    }

    /** Deletes every unused image; returns how many went. */
    @Transactional
    public int deleteUnused() {
        List<Media> gone = repository.findAllById(repository.findUnusedIds());
        repository.deleteAll(gone);
        repository.flush();
        gone.forEach(this::deleteObjects);
        evictProjects();
        log.info("Deleted {} unused media", gone.size());
        return gone.size();
    }

    private void deleteObjects(Media m) {
        List<String> keys = new ArrayList<>(List.of(m.getObjectKey()));
        m.getVariantWidths().forEach(w -> keys.add(m.variantKey(w)));
        for (String k : keys) {
            try {
                storage.delete(k);
            } catch (Exception e) {
                log.warn("Object {} could not be deleted from storage: {}", k, e.getMessage());
            }
        }
    }

    // ── responsive copies ────────────────────────────────────────────────────

    /** Encodes and stores the copies narrower than the stored picture; returns their widths. */
    private List<Integer> makeVariants(String key, byte[] source, String sourceExt, int sourceW, int sourceH, int storedW) {
        List<Integer> made = new ArrayList<>();
        for (int w : VARIANT_WIDTHS) {
            if (w >= storedW) {
                continue;
            }
            var copy = webpEncoder.encode(source, sourceExt, sourceW, sourceH, w);
            if (copy.isPresent()) {
                storage.put(Media.variantKey(key, w), "image/webp", copy.get().bytes());
                made.add(w);
            }
        }
        return made;
    }

    /**
     * Makes the missing copies of pictures stored before responsive images existed (or restored
     * without them). Runs in the background at start-up and after a restore; safe to call twice.
     * @return true when a run was started
     */
    public boolean backfillVariants() {
        if (!webpEncoder.available() || !backfilling.compareAndSet(false, true)) {
            return false;
        }
        Thread.ofVirtual().name("media-variants").start(() -> {
            int done = 0;
            try {
                for (Media m : repository.findAll()) {
                    if (fillVariants(m)) {
                        done++;
                    }
                }
            } catch (RuntimeException e) {
                log.warn("Responsive copies stopped: {}", e.getMessage());
            } finally {
                backfilling.set(false);
                if (done > 0) {
                    evictProjects();
                    log.info("Made responsive copies for {} media", done);
                }
            }
        });
        return true;
    }

    public boolean isBackfilling() {
        return backfilling.get();
    }

    @EventListener(ApplicationReadyEvent.class)
    void onReady() {
        backfillVariants();
    }

    private boolean fillVariants(Media m) {
        if (m.getWidth() == null || m.getHeight() == null || !"image/webp".equals(m.getContentType())) {
            return false;
        }
        List<Integer> expected = VARIANT_WIDTHS.stream().filter(w -> w < m.getWidth()).toList();
        boolean complete = m.getVariantWidths().containsAll(expected)
                && expected.stream().allMatch(w -> storage.get(m.variantKey(w)).isPresent());
        if (complete) {
            return false;
        }
        var stored = storage.get(m.getObjectKey());
        if (stored.isEmpty()) {
            return false;
        }
        List<Integer> made = makeVariants(m.getObjectKey(), stored.get().bytes(), "webp", m.getWidth(), m.getHeight(), m.getWidth());
        if (made.isEmpty()) {
            return false;
        }
        repository.findById(m.getId()).ifPresent(fresh -> {
            fresh.setVariantWidths(made);
            repository.save(fresh);
        });
        return true;
    }

    /** Resolves a public object key to its bytes; unknown or malformed keys yield empty. */
    @Transactional(readOnly = true)
    public Optional<Served> serve(String key) {
        var match = key == null ? null : KEY.matcher(key);
        if (match == null || !match.matches()) {
            return Optional.empty();
        }
        String original = match.group(1) + match.group(3);
        Integer width = match.group(2) == null ? null : Integer.valueOf(match.group(2));
        return repository.findByObjectKey(original)
                .filter(m -> width == null || m.getVariantWidths().contains(width))
                .flatMap(m -> storage.get(key).map(o -> new Served(m, width == null ? m.getContentType() : "image/webp",
                        o.bytes(), width == null ? "" : "-w" + width)));
    }

    /** @param variant "" for the original, "-w640" for a copy (part of the ETag) */
    public record Served(Media media, String contentType, byte[] bytes, String variant) {}

    private void evictProjects() {
        for (String name : new String[] {"projects", "settings"}) {
            var cache = cacheManager.getCache(name);
            if (cache != null) {
                cache.clear();
            }
        }
    }

    /** width and height read from the image header, without decoding the pixels */
    private static int[] dimensions(byte[] bytes) {
        try (var in = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                return null;
            }
            var reader = readers.next();
            try {
                reader.setInput(in, true, true);
                return new int[] {reader.getWidth(0), reader.getHeight(0)};
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    private static String extension(String name) {
        if (name == null || name.lastIndexOf('.') < 0) {
            return null;
        }
        return name.substring(name.lastIndexOf('.') + 1).toLowerCase(java.util.Locale.ROOT);
    }

    private static BufferedImage decode(byte[] bytes) {
        try {
            return ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (IOException e) {
            return null;
        }
    }

    /** Tiny (≤ 24 px) PNG, base64-encoded, used as a blurred placeholder while the real image loads. */
    private static String lqip(BufferedImage src) {
        try {
            int w = Math.max(1, Math.min(24, src.getWidth()));
            int h = Math.max(1, Math.round(w * (float) src.getHeight() / src.getWidth()));
            BufferedImage tiny = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
            Graphics2D g = tiny.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(src, 0, 0, w, h, null);
            g.dispose();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(tiny, "png", out);
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(out.toByteArray());
        } catch (Exception e) {
            return null;
        }
    }

    private static String safeName(String name) {
        if (name == null) {
            return null;
        }
        String cleaned = name.replaceAll("[^A-Za-z0-9._ -]", "_");
        return cleaned.length() > 120 ? cleaned.substring(0, 120) : cleaned;
    }
}
