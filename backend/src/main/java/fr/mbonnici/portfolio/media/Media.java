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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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

    /** widths of the smaller WebP copies stored next to the original (see {@link #variantKey}) */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "variant_widths", nullable = false, columnDefinition = "integer[]")
    private List<Integer> variantWidths = new ArrayList<>();

    /** point to keep in view when a frame crops the picture, 0..1 from the left / top */
    @Column(name = "focal_x", nullable = false)
    private double focalX = 0.5;

    @Column(name = "focal_y", nullable = false)
    private double focalY = 0;

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
    public List<Integer> getVariantWidths() { return variantWidths; }
    public void setVariantWidths(List<Integer> widths) { this.variantWidths = widths == null ? new ArrayList<>() : new ArrayList<>(widths); }
    public double getFocalX() { return focalX; }
    public double getFocalY() { return focalY; }

    public void setFocal(double x, double y) {
        this.focalX = Math.clamp(x, 0, 1);
        this.focalY = Math.clamp(y, 0, 1);
    }

    /** Object key of the copy that is {@code width} px wide: {@code 2026/11/<uuid>-w640.webp}. */
    public String variantKey(int width) {
        return variantKey(objectKey, width);
    }

    public static String variantKey(String objectKey, int width) {
        int dot = objectKey.lastIndexOf('.');
        return objectKey.substring(0, dot) + "-w" + width + objectKey.substring(dot);
    }

    /** {@code srcset} for the browser (copies + original), or null when there is no copy. */
    public String srcset() {
        if (variantWidths.isEmpty() || width == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (int w : variantWidths.stream().sorted().toList()) {
            if (w < width) {
                sb.append("/api/media/").append(variantKey(w)).append(' ').append(w).append("w, ");
            }
        }
        return sb.append(url()).append(' ').append(width).append('w').toString();
    }

    /** Public URL, served (and cached) by {@code MediaController}. */
    public String url() {
        return "/api/media/" + objectKey;
    }
}
