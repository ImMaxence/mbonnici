package fr.mbonnici.portfolio.media;

import fr.mbonnici.portfolio.common.Localized;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "media")
public class Media {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "object_key", nullable = false, unique = true)
    private String objectKey;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    private Integer width;
    private Integer height;

    @Column(name = "blur_data_url")
    private String blurDataUrl;

    @Column(name = "original_filename")
    private String originalFilename;

    @Embedded
    @AttributeOverride(name = "fr", column = @Column(name = "alt_fr", nullable = false))
    @AttributeOverride(name = "en", column = @Column(name = "alt_en", nullable = false))
    private Localized alt = Localized.EMPTY;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Media() {}

    public static Media create(String objectKey, String contentType, long sizeBytes, Integer width, Integer height,
            String blurDataUrl, String originalFilename, Localized alt) {
        Media m = new Media();
        m.objectKey = objectKey;
        m.contentType = contentType;
        m.sizeBytes = sizeBytes;
        m.width = width;
        m.height = height;
        m.blurDataUrl = blurDataUrl;
        m.originalFilename = originalFilename;
        m.alt = alt == null ? Localized.EMPTY : alt;
        return m;
    }

    public UUID getId() { return id; }
    public String getObjectKey() { return objectKey; }
    public String getContentType() { return contentType; }
    public long getSizeBytes() { return sizeBytes; }
    public Integer getWidth() { return width; }
    public Integer getHeight() { return height; }
    public String getBlurDataUrl() { return blurDataUrl; }
    public String getOriginalFilename() { return originalFilename; }
    public Localized getAlt() { return alt; }
    public void setAlt(Localized alt) { this.alt = alt == null ? Localized.EMPTY : alt; }
    public Instant getCreatedAt() { return createdAt; }

    /** Public URL, served (and cached) by {@code MediaController}. */
    public String url() {
        return "/api/media/" + objectKey;
    }
}
