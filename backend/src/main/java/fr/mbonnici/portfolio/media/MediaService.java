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
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MediaService {

    private static final Logger log = LoggerFactory.getLogger(MediaService.class);
    private static final long MAX_BYTES = 10L * 1024 * 1024;
    private static final int MAX_PIXELS = 40_000_000;
    private static final int MAX_WIDTH = 2560;
    private static final java.util.Set<String> ACCEPTED = java.util.Set.of("image/png", "image/jpeg");
    private static final Pattern KEY = Pattern.compile("^\\d{4}/\\d{2}/[0-9a-f-]{36}\\.[a-z0-9]{3,4}$");

    private final MediaRepository repository;
    private final StorageService storage;
    private final CacheManager cacheManager;
    private final WebpEncoder webpEncoder;

    public MediaService(MediaRepository repository, StorageService storage, CacheManager cacheManager,
            WebpEncoder webpEncoder) {
        this.repository = repository;
        this.storage = storage;
        this.cacheManager = cacheManager;
        this.webpEncoder = webpEncoder;
    }

    @Transactional
    public MediaDto upload(MultipartFile file, Localized alt) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("file is required");
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
            throw ApiException.badRequest("unsupported file type: PNG or JPEG only");
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

        Media media = repository.save(Media.create(key, contentType, bytes.length, width, height, blur,
                safeName(file.getOriginalFilename()), alt == null ? Localized.EMPTY : alt.filled()));
        log.info("Uploaded media {} ({} bytes, {}x{}, {})", key, bytes.length, width, height, contentType);
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
    public void delete(UUID id) {
        Media m = repository.findById(id).orElseThrow(() -> new NotFoundException("Media"));
        repository.delete(m);
        repository.flush();
        try {
            storage.delete(m.getObjectKey());
        } catch (Exception e) {
            log.warn("Object {} could not be deleted from storage: {}", m.getObjectKey(), e.getMessage());
        }
        evictProjects();
    }

    /** Resolves a public object key to its bytes; unknown or malformed keys yield empty. */
    @Transactional(readOnly = true)
    public Optional<Served> serve(String key) {
        if (key == null || !KEY.matcher(key).matches()) {
            return Optional.empty();
        }
        return repository.findByObjectKey(key)
                .flatMap(m -> storage.get(key).map(o -> new Served(m, o.bytes())));
    }

    public record Served(Media media, byte[] bytes) {}

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
