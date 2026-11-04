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
            SiteSettings.Availability availability,
            Localized seoTitle,
            Localized seoDescription,
            Legal legal,
            Instant updatedAt) {

        public static PublicSettings from(SiteSettings s) {
            return new PublicSettings(s.getOwnerName(), s.getHeadline().filled(), s.getBio().filled(), s.getLocation(),
                    s.getPublicEmail(), s.getGithubUrl(), s.getLinkedinUrl(), s.getAvailability(),
                    s.getSeoTitle() == null ? Localized.EMPTY : s.getSeoTitle().filled(),
                    s.getSeoDescription() == null ? Localized.EMPTY : s.getSeoDescription().filled(),
                    new Legal(s.getLegalName(), s.getLegalAddress(), s.getLegalHost(), s.getLegalContactEmail()),
                    s.getUpdatedAt());
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
            @NotNull SiteSettings.Availability availability,
            Localized seoTitle,
            Localized seoDescription,
            @Size(max = 200) String legalName,
            @Size(max = 500) String legalAddress,
            @Size(max = 500) String legalHost,
            @Email @Size(max = 200) String legalContactEmail) {}
}
