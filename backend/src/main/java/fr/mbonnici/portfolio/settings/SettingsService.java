package fr.mbonnici.portfolio.settings;

import fr.mbonnici.portfolio.common.ApiException;
import fr.mbonnici.portfolio.common.Localized;
import fr.mbonnici.portfolio.settings.SettingsDtos.PublicSettings;
import fr.mbonnici.portfolio.settings.SettingsDtos.UpdateSettings;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {

    public static final String CACHE = "settings";

    private final SettingsRepository repository;
    private final fr.mbonnici.portfolio.media.MediaRepository media;
    public SettingsService(SettingsRepository repository, fr.mbonnici.portfolio.media.MediaRepository media) {
        this.repository = repository;
        this.media = media;
    }

    @Cacheable(CACHE)
    @Transactional(readOnly = true)
    public PublicSettings get() {
        return PublicSettings.from(load());
    }

    /** Back office: texts as stored, without the fallback to the other language. */
    @Transactional(readOnly = true)
    public PublicSettings getRaw() {
        return PublicSettings.raw(load());
    }

    @CacheEvict(value = CACHE, allEntries = true)
    @Transactional
    public PublicSettings update(UpdateSettings in) {
        if (in.headline().isBlank()) {
            throw ApiException.badRequest("headline is required in at least one language");
        }
        SiteSettings s = load();
        s.setOwnerName(in.ownerName().trim());
        s.setHeadline(Localized.clean(in.headline()));
        s.setBio(Localized.clean(in.bio()));
        s.setLocation(blankToNull(in.location()));
        s.setPublicEmail(blankToNull(in.publicEmail()));
        s.setGithubUrl(blankToNull(in.githubUrl()));
        s.setLinkedinUrl(blankToNull(in.linkedinUrl()));
        String booking = blankToNull(in.bookingUrl());
        if (booking != null && !booking.matches("^https://[^\\s]+$")) {
            throw ApiException.badRequest("bookingUrl must be an https URL");
        }
        s.setBookingUrl(booking);
        s.setAvailability(in.availability());
        s.setSeoTitle(Localized.clean(in.seoTitle()));
        s.setSeoDescription(Localized.clean(in.seoDescription()));
        s.setLegalName(blankToNull(in.legalName()));
        s.setLegalAddress(blankToNull(in.legalAddress()));
        s.setLegalHost(blankToNull(in.legalHost()));
        s.setLegalContactEmail(blankToNull(in.legalContactEmail()));
        var avatar = in.avatarMediaId() == null ? null
                : media.findById(in.avatarMediaId())
                        .orElseThrow(() -> new fr.mbonnici.portfolio.common.NotFoundException("Avatar media"));
        if (avatar != null && avatar.getContentType().startsWith("video/")) {
            throw ApiException.badRequest("the avatar must be a picture");
        }
        s.setAvatar(avatar);
        s.touch();
        return PublicSettings.raw(repository.save(s));
    }

    private SiteSettings load() {
        return repository.findById((short) 1)
                .orElseThrow(() -> new IllegalStateException("site_settings row is missing; run migrations"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
