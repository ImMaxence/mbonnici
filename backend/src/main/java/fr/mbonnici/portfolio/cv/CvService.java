package fr.mbonnici.portfolio.cv;

import fr.mbonnici.portfolio.common.ApiException;
import fr.mbonnici.portfolio.settings.SettingsDtos.Cv;
import fr.mbonnici.portfolio.settings.SettingsRepository;
import fr.mbonnici.portfolio.settings.SettingsService;
import fr.mbonnici.portfolio.settings.SiteSettings;
import fr.mbonnici.portfolio.storage.StorageService;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The resume the owner uploads (a PDF per language, both optional), stored in the bucket next to the
 * pictures, so backups carry it. Visitors get the file of their language, or the other one.
 */
@Service
public class CvService {

    private static final Logger log = LoggerFactory.getLogger(CvService.class);
    public static final int MAX_BYTES = 10 * 1024 * 1024;
    private static final byte[] PDF_MAGIC = "%PDF-".getBytes(StandardCharsets.US_ASCII);

    /** the file a visitor downloads */
    public record Download(byte[] pdf, String key, String fileName) {}

    private final SettingsRepository repository;
    private final StorageService storage;

    public CvService(SettingsRepository repository, StorageService storage) {
        this.repository = repository;
        this.storage = storage;
    }

    @Transactional(readOnly = true)
    public Cv status() {
        return Cv.of(load());
    }

    @CacheEvict(value = SettingsService.CACHE, allEntries = true)
    @Transactional
    public Cv upload(String language, byte[] bytes) {
        String lang = lang(language);
        if (bytes == null || bytes.length == 0) {
            throw ApiException.badRequest("the file is empty");
        }
        if (bytes.length > MAX_BYTES) {
            throw ApiException.badRequest("the resume is larger than 10 MB");
        }
        if (bytes.length < PDF_MAGIC.length || !Arrays.equals(bytes, 0, PDF_MAGIC.length, PDF_MAGIC, 0, PDF_MAGIC.length)) {
            throw ApiException.badRequest("only PDF files are accepted");
        }
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        String key = String.format("%d/%02d/%s.pdf", today.getYear(), today.getMonthValue(), UUID.randomUUID());
        storage.put(key, "application/pdf", bytes);
        SiteSettings s = load();
        String previous = s.getCvKey(lang);
        s.setCv(lang, key, bytes.length, Instant.now());
        repository.save(s);
        if (previous != null) {
            drop(previous);
        }
        return Cv.of(s);
    }

    @CacheEvict(value = SettingsService.CACHE, allEntries = true)
    @Transactional
    public Cv remove(String language) {
        String lang = lang(language);
        SiteSettings s = load();
        String previous = s.getCvKey(lang);
        s.setCv(lang, null, null, null);
        repository.save(s);
        if (previous != null) {
            drop(previous);
        }
        return Cv.of(s);
    }

    /** the resume in that language, else the one in the other language */
    @Transactional(readOnly = true)
    public Optional<Download> download(String language) {
        String lang = lang(language);
        SiteSettings s = load();
        String served = s.getCvKey(lang) != null ? lang : lang.equals("fr") ? "en" : "fr";
        String key = s.getCvKey(served);
        if (key == null) {
            return Optional.empty();
        }
        return storage.get(key).map(o -> new Download(o.bytes(), key, fileName(s.getOwnerName(), served)));
    }

    /** "CV-Maxence-Bonnici.pdf", "Resume-Maxence-Bonnici.pdf" */
    static String fileName(String owner, String lang) {
        String name = Normalizer.normalize(owner == null ? "" : owner, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("[^A-Za-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        return (lang.equals("en") ? "Resume" : "CV") + (name.isEmpty() ? "" : "-" + name) + ".pdf";
    }

    private void drop(String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException e) {
            log.warn("Could not delete the previous resume {}: {}", key, e.getMessage());
        }
    }

    private static String lang(String language) {
        if ("fr".equals(language) || "en".equals(language)) {
            return language;
        }
        throw ApiException.badRequest("lang must be fr or en");
    }

    private SiteSettings load() {
        return repository.findById((short) 1)
                .orElseThrow(() -> new IllegalStateException("site_settings row is missing; run migrations"));
    }
}
