package fr.mbonnici.portfolio.settings;

import fr.mbonnici.portfolio.common.Localized;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public final class SettingsDtos {

    private SettingsDtos() {}

    /** What the public site needs (no legal/admin internals). */
    public record PublicSettings(
            String ownerName,
            Localized headline,
            Localized bio,
            String location,
            String publicEmail,
            String githubUrl,
            String linkedinUrl,
            String bookingUrl,
            SiteSettings.Availability availability,
            Localized seoTitle,
            Localized seoDescription,
            Legal legal,
            fr.mbonnici.portfolio.media.MediaDto avatar,
            Instant updatedAt,
            /** the uploaded resumes (none: no download button) */
            Cv cv,
            /** public reCAPTCHA key of the contact form (none: no captcha) */
            String captchaSiteKey) {

        public static PublicSettings from(SiteSettings s, String captchaSiteKey) {
            return new PublicSettings(s.getOwnerName(), s.getHeadline().filled(), s.getBio().filled(), s.getLocation(),
                    s.getPublicEmail(), s.getGithubUrl(), s.getLinkedinUrl(), s.getBookingUrl(), s.getAvailability(),
                    s.getSeoTitle() == null ? Localized.EMPTY : s.getSeoTitle().filled(),
                    s.getSeoDescription() == null ? Localized.EMPTY : s.getSeoDescription().filled(),
                    new Legal(s.getLegalName(), s.getLegalAddress(), s.getLegalHost(), s.getLegalContactEmail()),
                    fr.mbonnici.portfolio.media.MediaDto.from(s.getAvatar()), s.getUpdatedAt(), Cv.of(s), captchaSiteKey);
        }

        /** as stored (back office): an empty language stays empty */
        public static PublicSettings raw(SiteSettings s) {
            return new PublicSettings(s.getOwnerName(), s.getHeadline(), s.getBio(), s.getLocation(),
                    s.getPublicEmail(), s.getGithubUrl(), s.getLinkedinUrl(), s.getBookingUrl(), s.getAvailability(),
                    s.getSeoTitle() == null ? Localized.EMPTY : s.getSeoTitle(),
                    s.getSeoDescription() == null ? Localized.EMPTY : s.getSeoDescription(),
                    new Legal(s.getLegalName(), s.getLegalAddress(), s.getLegalHost(), s.getLegalContactEmail()),
                    fr.mbonnici.portfolio.media.MediaDto.from(s.getAvatar()), s.getUpdatedAt(), Cv.of(s), null);
        }
    }

    /** A resume PDF: its size and when it was uploaded. */
    public record CvFile(int size, Instant uploadedAt) {

        static CvFile of(SiteSettings s, String lang) {
            return s.getCvKey(lang) == null ? null
                    : new CvFile(s.getCvSize(lang) == null ? 0 : s.getCvSize(lang), s.getCvAt(lang));
        }
    }

    /** The resumes per language (null: none in that language). */
    public record Cv(CvFile fr, CvFile en) {

        public static Cv of(SiteSettings s) {
            return new Cv(CvFile.of(s, "fr"), CvFile.of(s, "en"));
        }
    }

    /** Legal identity shown on the "mentions légales" page. */
    public record Legal(String name, String address, String host, String contactEmail) {}

    public record UpdateSettings(
            @NotBlank @Size(max = 120) String ownerName,
            @NotNull Localized headline,
            @NotNull Localized bio,
            @Size(max = 120) String location,
            @Email @Size(max = 200) String publicEmail,
            @Size(max = 300) String githubUrl,
            @Size(max = 300) String linkedinUrl,
            @Size(max = 300) String bookingUrl,
            @NotNull SiteSettings.Availability availability,
            Localized seoTitle,
            Localized seoDescription,
            @Size(max = 200) String legalName,
            @Size(max = 500) String legalAddress,
            @Size(max = 500) String legalHost,
            @Email @Size(max = 200) String legalContactEmail,
            java.util.UUID avatarMediaId) {}
}
