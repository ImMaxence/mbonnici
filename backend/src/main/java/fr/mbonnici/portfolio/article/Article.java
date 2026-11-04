package fr.mbonnici.portfolio.article;

import fr.mbonnici.portfolio.common.Localized;
import fr.mbonnici.portfolio.media.Media;
import jakarta.persistence.AttributeOverride;
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
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A note: a short Markdown article in French and English. */
@Entity
@Table(name = "article")
public class Article {

    public enum Status { DRAFT, PUBLISHED }

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
    @AttributeOverride(name = "fr", column = @Column(name = "summary_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "summary_en", nullable = false))
    private Localized summary = Localized.EMPTY;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "body_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "body_en", nullable = false))
    private Localized body = Localized.EMPTY;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.DRAFT;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cover_media_id")
    private Media coverMedia;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private List<String> tags = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "published_at")
    private Instant publishedAt;

    protected Article() {}

    public static Article create(String slug) {
        Article a = new Article();
        a.slug = slug;
        return a;
    }

    public UUID getId() { return id; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public Localized getTitle() { return title; }
    public void setTitle(Localized title) { this.title = title; }
    public Localized getSummary() { return summary; }
    public void setSummary(Localized summary) { this.summary = summary == null ? Localized.EMPTY : summary; }
    public Localized getBody() { return body; }
    public void setBody(Localized body) { this.body = body == null ? Localized.EMPTY : body; }
    public Status getStatus() { return status; }
    public Media getCoverMedia() { return coverMedia; }
    public void setCoverMedia(Media coverMedia) { this.coverMedia = coverMedia; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags == null ? new ArrayList<>() : new ArrayList<>(tags); }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getPublishedAt() { return publishedAt; }

    /** @param publishedAt keeps a chosen date (back-dated notes); the first publication otherwise */
    public void setStatus(Status status, Instant publishedAt) {
        if (publishedAt != null) {
            this.publishedAt = publishedAt;
        } else if (status == Status.PUBLISHED && this.publishedAt == null) {
            this.publishedAt = Instant.now();
        }
        this.status = status;
    }

    public void touch() {
        this.updatedAt = Instant.now();
    }
}
