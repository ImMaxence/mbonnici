package fr.mbonnici.portfolio.project;

import fr.mbonnici.portfolio.common.Localized;
import fr.mbonnici.portfolio.media.MediaDto;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ProjectDtos {

    private ProjectDtos() {}

    /** Listing card (public). */
    public record Card(
            UUID id,
            String slug,
            Localized title,
            Localized tagline,
            Project.Category category,
            Project.SceneType sceneType,
            String accentColor,
            Integer year,
            List<String> stack,
            List<String> tags,
            boolean featured,
            MediaDto cover,
            String liveUrl,
            String repoUrl) {

        static Card from(Project p) {
            return new Card(p.getId(), p.getSlug(), p.getTitle().filled(), p.getTagline().filled(), p.getCategory(),
                    p.getSceneType(), p.getAccentColor(), p.getYear(), List.copyOf(p.getStack()), List.copyOf(p.getTags()),
                    p.isFeatured(), MediaDto.from(p.getCoverMedia()), p.getLiveUrl(), p.getRepoUrl());
        }
    }

    /** Full page (public). */
    public record Detail(
            UUID id,
            String slug,
            Localized title,
            Localized tagline,
            Localized description,
            Project.Category category,
            Project.SceneType sceneType,
            String accentColor,
            Integer year,
            List<String> stack,
            List<String> tags,
            boolean featured,
            MediaDto cover,
            String liveUrl,
            String repoUrl,
            boolean allowIframe,
            List<MediaDto> gallery,
            List<MediaDto> mobile,
            Instant publishedAt,
            Instant updatedAt,
            Card previous,
            Card next) {}

    public record MediaItem(MediaDto media, ProjectMedia.Kind kind, int sortOrder) {}

    /** Everything, for the back office. */
    public record Admin(
            UUID id,
            String slug,
            Localized title,
            Localized tagline,
            Localized description,
            Project.Status status,
            boolean featured,
            int sortOrder,
            Integer year,
            Project.Category category,
            Project.SceneType sceneType,
            String accentColor,
            UUID coverMediaId,
            MediaDto cover,
            String repoUrl,
            String liveUrl,
            boolean allowIframe,
            List<String> stack,
            List<String> tags,
            List<MediaItem> media,
            Instant createdAt,
            Instant updatedAt,
            Instant publishedAt) {}

    public record MediaRef(@NotNull UUID mediaId, @NotNull ProjectMedia.Kind kind, int sortOrder) {}

    public record Upsert(
            @Size(max = 80) String slug,
            @NotNull Localized title,
            Localized tagline,
            Localized description,
            @NotNull Project.Status status,
            Boolean featured,
            Integer sortOrder,
            @Min(1990) @Max(2100) Integer year,
            @NotNull Project.Category category,
            @NotNull Project.SceneType sceneType,
            @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "accentColor must be a #rrggbb colour") String accentColor,
            @Size(max = 300) String repoUrl,
            @Size(max = 300) String liveUrl,
            Boolean allowIframe,
            @Size(max = 30) List<@Size(max = 60) String> stack,
            @Size(max = 30) List<@Size(max = 40) String> tags,
            UUID coverMediaId,
            @Size(max = 60) List<MediaRef> media) {}

    public record Reorder(@NotNull List<UUID> ids) {}
}
