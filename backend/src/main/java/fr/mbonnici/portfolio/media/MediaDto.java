package fr.mbonnici.portfolio.media;

import fr.mbonnici.portfolio.common.Localized;
import java.time.Instant;
import java.util.UUID;

public record MediaDto(
        UUID id,
        String url,
        String contentType,
        Integer width,
        Integer height,
        String blurDataUrl,
        Localized alt,
        long sizeBytes,
        String originalFilename,
        Instant createdAt,
        /** smaller copies for responsive images ("url 640w, …"), null when there is none */
        String srcset,
        /** point to keep in view when cropped, 0..1 */
        double focalX,
        double focalY) {

    public static MediaDto from(Media m) {
        if (m == null) {
            return null;
        }
        return new MediaDto(m.getId(), m.url(), m.getContentType(), m.getWidth(), m.getHeight(), m.getBlurDataUrl(),
                m.getAlt().filled(), m.getSizeBytes(), m.getOriginalFilename(), m.getCreatedAt(), m.srcset(),
                m.getFocalX(), m.getFocalY());
    }
}
