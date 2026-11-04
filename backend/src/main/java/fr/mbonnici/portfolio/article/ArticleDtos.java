package fr.mbonnici.portfolio.article;

import fr.mbonnici.portfolio.common.Localized;
import fr.mbonnici.portfolio.media.MediaDto;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ArticleDtos {

    private ArticleDtos() {}

    /** Reading time in minutes, per language. */
    public record Minutes(int fr, int en) {

        static Minutes of(Localized body) {
            return new Minutes(minutes(body.fr()), minutes(body.en()));
        }

        private static int minutes(String text) {
            if (text == null || text.isBlank()) {
                return 1;
            }
            int words = text.strip().split("\\s+").length;
            return Math.max(1, Math.round(words / 220f));
        }
    }

    /** Listing (public). */
    public record Card(UUID id, String slug, Localized title, Localized summary, List<String> tags, MediaDto cover,
            Instant publishedAt, Minutes minutes) {

        static Card from(Article a) {
            Localized body = a.getBody().filled();
            return new Card(a.getId(), a.getSlug(), a.getTitle().filled(), a.getSummary().filled(), List.copyOf(a.getTags()),
                    MediaDto.from(a.getCoverMedia()), a.getPublishedAt(), Minutes.of(body));
        }
    }

    /** Full note (public). */
    public record Detail(UUID id, String slug, Localized title, Localized summary, Localized body, List<String> tags,
            MediaDto cover, Instant publishedAt, Instant updatedAt, Minutes minutes, Card previous, Card next) {}

    /** Everything, for the back office. */
    public record Admin(UUID id, String slug, Localized title, Localized summary, Localized body, Article.Status status,
            List<String> tags, UUID coverMediaId, MediaDto cover, Instant createdAt, Instant updatedAt,
            Instant publishedAt) {

        static Admin from(Article a) {
            return new Admin(a.getId(), a.getSlug(), a.getTitle(), a.getSummary(), a.getBody(), a.getStatus(),
                    List.copyOf(a.getTags()), a.getCoverMedia() == null ? null : a.getCoverMedia().getId(),
                    MediaDto.from(a.getCoverMedia()), a.getCreatedAt(), a.getUpdatedAt(), a.getPublishedAt());
        }
    }

    public record Upsert(
            @Size(max = 80) String slug,
            @NotNull Localized title,
            Localized summary,
            Localized body,
            @NotNull Article.Status status,
            @Size(max = 12) List<@Size(max = 40) String> tags,
            UUID coverMediaId,
            /** publication date to show (back-dating); the first publication otherwise */
            Instant publishedAt) {}
}
