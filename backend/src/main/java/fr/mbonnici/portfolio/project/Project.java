package fr.mbonnici.portfolio.project;

import fr.mbonnici.portfolio.common.Localized;
import fr.mbonnici.portfolio.media.Media;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "project")
public class Project {

    public enum Status { DRAFT, PUBLISHED }
    public enum Category { WEB, MOBILE, GAME, TOOL, DESIGN, DATA, OTHER }
    /** Which interactive 3D scene the frontend renders for this project. */

    /** How the project is staged on the site: browser + phone, phone only, or browser only. */
    public enum DisplayMode { BOTH, MOBILE, DESKTOP }

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true)
    private String slug;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "title_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "title_en", nullable = false))
    private Localized title;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "tagline_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "tagline_en", nullable = false))
    private Localized tagline = Localized.EMPTY;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "description_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "description_en", nullable = false))
    private Localized description = Localized.EMPTY;

    // ── case study (Markdown): context, role, challenges, results ──
    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "context_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "context_en", nullable = false))
    private Localized context = Localized.EMPTY;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "role_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "role_en", nullable = false))
    private Localized role = Localized.EMPTY;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "challenges_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "challenges_en", nullable = false))
    private Localized challenges = Localized.EMPTY;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "results_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "results_en", nullable = false))
    private Localized results = Localized.EMPTY;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.DRAFT;

    @Column(nullable = false)
    private boolean featured;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    private Integer year;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Category category = Category.WEB;

    @Enumerated(EnumType.STRING)
    @Column(name = "display_mode", nullable = false)
    private DisplayMode displayMode = DisplayMode.BOTH;

    @Column(name = "accent_color", nullable = false)
    private String accentColor = "#0a84ff";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cover_media_id")
    private Media coverMedia;

    /** optional loop played in the browser frame (the cover is its poster and the share image) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cover_video_media_id")
    private Media coverVideo;

    @Column(name = "repo_url")
    private String repoUrl;

    @Column(name = "live_url")
    private String liveUrl;

    @Column(name = "allow_iframe", nullable = false)
    private boolean allowIframe;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private List<String> stack = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "published_at")
    private Instant publishedAt;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("sortOrder ASC")
    private List<ProjectMedia> media = new ArrayList<>();

    protected Project() {}

    public static Project create(String slug) {
        Project p = new Project();
        p.slug = slug;
        return p;
    }

    public UUID getId() { return id; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public Localized getTitle() { return title; }
    public void setTitle(Localized title) { this.title = title; }
    public Localized getTagline() { return tagline; }
    public void setTagline(Localized tagline) { this.tagline = tagline; }
    public Localized getDescription() { return description; }
    public void setDescription(Localized description) { this.description = description; }
    public Localized getContext() { return context; }
    public void setContext(Localized v) { this.context = v == null ? Localized.EMPTY : v; }
    public Localized getRole() { return role; }
    public void setRole(Localized v) { this.role = v == null ? Localized.EMPTY : v; }
    public Localized getChallenges() { return challenges; }
    public void setChallenges(Localized v) { this.challenges = v == null ? Localized.EMPTY : v; }
    public Localized getResults() { return results; }
    public void setResults(Localized v) { this.results = v == null ? Localized.EMPTY : v; }
    public Status getStatus() { return status; }
    public boolean isFeatured() { return featured; }
    public void setFeatured(boolean featured) { this.featured = featured; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }
    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }
    public DisplayMode getDisplayMode() { return displayMode; }
    public void setDisplayMode(DisplayMode displayMode) { this.displayMode = displayMode; }
    public String getAccentColor() { return accentColor; }
    public void setAccentColor(String accentColor) { this.accentColor = accentColor; }
    public Media getCoverMedia() { return coverMedia; }
    public void setCoverMedia(Media coverMedia) { this.coverMedia = coverMedia; }
    public Media getCoverVideo() { return coverVideo; }
    public void setCoverVideo(Media coverVideo) { this.coverVideo = coverVideo; }
    public String getRepoUrl() { return repoUrl; }
    public void setRepoUrl(String repoUrl) { this.repoUrl = repoUrl; }
    public String getLiveUrl() { return liveUrl; }
    public void setLiveUrl(String liveUrl) { this.liveUrl = liveUrl; }
    public boolean isAllowIframe() { return allowIframe; }
    public void setAllowIframe(boolean allowIframe) { this.allowIframe = allowIframe; }
    public List<String> getStack() { return stack; }
    public void setStack(List<String> stack) { this.stack = stack == null ? new ArrayList<>() : new ArrayList<>(stack); }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public List<ProjectMedia> getMedia() { return media; }

    public void setStatus(Status status) {
        if (status == Status.PUBLISHED && this.status != Status.PUBLISHED) {
            this.publishedAt = Instant.now();
        }
        this.status = status;
    }

    public void touch() {
        this.updatedAt = Instant.now();
    }
}
