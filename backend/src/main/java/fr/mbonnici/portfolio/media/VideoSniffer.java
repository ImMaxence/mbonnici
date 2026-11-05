package fr.mbonnici.portfolio.media;

import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Recognises short loop videos from their first bytes (the client's content type is never trusted):
 * QuickTime MOV, MP4 (an ISO base media file whose brand is a video one, not an AVIF or HEIF picture) and WebM (an
 * EBML document of type "webm").
 */
final class VideoSniffer {

    /** ftyp brands of still images, refused here */
    private static final Set<String> PICTURE_BRANDS = Set.of("avif", "avis", "heic", "heix", "heim", "heis", "mif1", "msf1");

    private VideoSniffer() {}

    record Detected(String contentType, String extension) {}

    static Detected detect(byte[] b) {
        if (b == null || b.length < 16) {
            return null;
        }
        if (b[4] == 'f' && b[5] == 't' && b[6] == 'y' && b[7] == 'p') {
            String brand = new String(b, 8, 4, StandardCharsets.US_ASCII);
            if (PICTURE_BRANDS.contains(brand)) {
                return null;
            }
            // QuickTime (an iPhone screen recording): accepted only when it can be re-encoded
            return "qt  ".equals(brand) ? new Detected("video/quicktime", "mov") : new Detected("video/mp4", "mp4");
        }
        if ((b[0] & 0xFF) == 0x1A && (b[1] & 0xFF) == 0x45 && (b[2] & 0xFF) == 0xDF && (b[3] & 0xFF) == 0xA3) {
            String head = new String(b, 0, Math.min(b.length, 64), StandardCharsets.ISO_8859_1);
            return head.contains("webm") ? new Detected("video/webm", "webm") : null;
        }
        return null;
    }
}
