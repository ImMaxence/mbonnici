package fr.mbonnici.portfolio.media;

import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/** Detects the real image type from magic bytes; the client-provided content type is never trusted. */
final class ImageSniffer {

    private static final Pattern SVG_DANGER = Pattern.compile(
            "(<script|javascript:|\\son[a-z]+\\s*=|<foreignobject|<iframe|<embed|<object|xlink:href\\s*=\\s*[\"']\\s*(?!#|data:image/))",
            Pattern.CASE_INSENSITIVE);

    private ImageSniffer() {}

    record Detected(String contentType, String extension) {}

    static Detected detect(byte[] b) {
        if (b == null || b.length < 12) {
            return null;
        }
        if ((b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
            return new Detected("image/png", "png");
        }
        if ((b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return new Detected("image/jpeg", "jpg");
        }
        if (b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') {
            return new Detected("image/gif", "gif");
        }
        if (b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B'
                && b[11] == 'P') {
            return new Detected("image/webp", "webp");
        }
        if (isAvif(b)) {
            return new Detected("image/avif", "avif");
        }
        if (looksLikeSvg(b)) {
            return new Detected("image/svg+xml", "svg");
        }
        return null;
    }

    /** SVG can carry scripts: only plain vector drawings are accepted. */
    static boolean svgIsSafe(byte[] b) {
        String text = new String(b, StandardCharsets.UTF_8);
        return !SVG_DANGER.matcher(text).find();
    }

    private static boolean isAvif(byte[] b) {
        return b.length >= 12 && b[4] == 'f' && b[5] == 't' && b[6] == 'y' && b[7] == 'p'
                && b[8] == 'a' && b[9] == 'v' && b[10] == 'i' && (b[11] == 'f' || b[11] == 's');
    }

    private static boolean looksLikeSvg(byte[] b) {
        int len = Math.min(b.length, 512);
        String head = new String(b, 0, len, StandardCharsets.UTF_8).replace("\uFEFF", "").stripLeading().toLowerCase();
        return head.startsWith("<svg") || (head.startsWith("<?xml") && head.contains("<svg"));
    }
}
