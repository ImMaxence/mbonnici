package fr.mbonnici.portfolio.og;

import fr.mbonnici.portfolio.article.ArticleDtos;
import fr.mbonnici.portfolio.article.ArticleService;
import fr.mbonnici.portfolio.config.AppProperties;
import fr.mbonnici.portfolio.media.MediaDto;
import fr.mbonnici.portfolio.media.MediaService;
import fr.mbonnici.portfolio.media.WebpEncoder;
import fr.mbonnici.portfolio.project.ProjectDtos;
import fr.mbonnici.portfolio.project.ProjectService;
import fr.mbonnici.portfolio.settings.SettingsService;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontFormatException;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.Shape;
import java.awt.font.TextAttribute;
import java.awt.geom.Ellipse2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import org.springframework.stereotype.Service;

/**
 * Share pictures (Open Graph / Twitter cards, 1200 × 630 JPEG) for projects and notes, drawn with
 * Java2D in the site's style: paper background, Inter Tight title, the cover in a browser window
 * bleeding off the right edge. WebP covers are decoded with dwebp: social networks do not all read
 * WebP, a JPEG they all do. Cached in memory until the content changes.
 */
@Service
public class OgImageService {

    public static final int W = 1200;
    public static final int H = 630;
    private static final int PAD = 64;
    private static final Color PAPER = new Color(0xef, 0xed, 0xe7);
    private static final Color INK = new Color(0x12, 0x12, 0x11);
    private static final Color INK_2 = new Color(0x45, 0x44, 0x3f);
    private static final Color INK_3 = new Color(0x6b, 0x69, 0x60);
    private static final Color LINE = new Color(0xd6, 0xd3, 0xc9);
    private static final Color ACCENT = new Color(0x2b, 0x3b, 0xea);
    private static final int MAX_CACHED = 200;

    public record Rendered(byte[] jpeg, String fingerprint) {}

    private final ProjectService projects;
    private final ArticleService articles;
    private final SettingsService settings;
    private final MediaService media;
    private final WebpEncoder webp;
    private final AppProperties props;
    private final Map<String, Rendered> cache = new ConcurrentHashMap<>();
    private final Font display;
    private final Font body;
    private final Font bodyBold;
    private final Font mono;
    private final Font serif;

    public OgImageService(ProjectService projects, ArticleService articles, SettingsService settings, MediaService media,
            WebpEncoder webp, AppProperties props) {
        this.projects = projects;
        this.articles = articles;
        this.settings = settings;
        this.media = media;
        this.webp = webp;
        this.props = props;
        this.display = font("InterTight-SemiBold.ttf");
        this.body = font("Inter-Regular.ttf");
        this.bodyBold = font("Inter-SemiBold.ttf");
        this.mono = font("JetBrainsMono-Regular.ttf");
        this.serif = font("InstrumentSerif-Italic.ttf");
    }

    private static Font font(String file) {
        try (InputStream in = OgImageService.class.getResourceAsStream("/cv/fonts/" + file)) {
            if (in == null) {
                throw new IllegalStateException("missing font " + file);
            }
            return Font.createFont(Font.TRUETYPE_FONT, in);
        } catch (IOException | FontFormatException e) {
            throw new IllegalStateException("cannot load font " + file, e);
        }
    }

    // ── entry points ─────────────────────────────────────────────────────────

    public Rendered project(String slug, String language) {
        String lang = lang(language);
        ProjectDtos.Detail p = projects.getPublished(slug);
        String eyebrow = (lang.equals("en") ? "PROJECT" : "PROJET") + " · " + category(p.category().name(), lang)
                + (p.year() == null ? "" : " · " + p.year());
        String site = p.liveUrl() != null ? host(p.liveUrl())
                : p.repoUrl() != null ? p.repoUrl().replaceFirst("^https?://(www\\.)?", "").replaceFirst("/$", "") : host(props.url());
        Card card = new Card(eyebrow, p.title().get(lang), p.tagline().get(lang), p.cover(), true, site, accent(p.accentColor()));
        return render("project|" + slug + "|" + lang, card);
    }

    public Rendered note(String slug, String language) {
        String lang = lang(language);
        ArticleDtos.Detail a = articles.getPublished(slug);
        int minutes = lang.equals("en") ? a.minutes().en() : a.minutes().fr();
        String eyebrow = "NOTE · " + minutes + (lang.equals("en") ? " MIN READ" : " MIN DE LECTURE");
        Card card = new Card(eyebrow, a.title().get(lang), a.summary().get(lang), a.cover(), false, host(props.url()), ACCENT);
        return render("note|" + slug + "|" + lang, card);
    }

    // ── drawing ──────────────────────────────────────────────────────────────

    /** @param browser the cover is a website capture: shown in a browser window */
    private record Card(String eyebrow, String title, String text, MediaDto cover, boolean browser, String site, Color accent) {}

    private Rendered render(String key, Card c) {
        String owner = settings.get().ownerName();
        String fingerprint = fingerprint(key, c, owner);
        Rendered hit = cache.get(key);
        if (hit != null && hit.fingerprint().equals(fingerprint)) {
            return hit;
        }
        BufferedImage img = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setColor(PAPER);
            g.fillRect(0, 0, W, H);

            BufferedImage cover = cover(c.cover()).orElse(null);
            int textWidth = 560;
            if (cover != null && c.browser()) {
                browserWindow(g, cover, c.site(), focalY(c.cover()));
            } else if (cover != null) {
                photo(g, cover, focalY(c.cover()));
            } else {
                mark(g, c);
            }

            // eyebrow
            g.setColor(c.accent());
            g.fill(new Ellipse2D.Double(PAD, 82, 10, 10));
            g.setColor(INK_3);
            g.setFont(tracked(mono, 19f, 0.1f));
            g.drawString(c.eyebrow().toUpperCase(Locale.ROOT), PAD + 22, 93);

            // title: as large as fits in three lines
            float size = 92f;
            List<String> lines;
            Font titleFont;
            do {
                titleFont = tracked(display, size, -0.035f);
                lines = wrap(g, titleFont, c.title(), textWidth);
                size -= 4f;
            } while (lines.size() > 3 && size > 50f);
            lines = clamp(g, titleFont, lines, 3, textWidth);
            g.setColor(INK);
            g.setFont(titleFont);
            int y = 150 + Math.round(titleFont.getSize2D() * 0.82f);
            int lineHeight = Math.round(titleFont.getSize2D() * 0.98f);
            for (String l : lines) {
                g.drawString(l, PAD - 3, y);
                y += lineHeight;
            }

            // text under the title
            if (c.text() != null && !c.text().isBlank()) {
                Font textFont = tracked(body, 26f, -0.005f);
                List<String> t = clamp(g, textFont, wrap(g, textFont, strip(c.text()), textWidth), y > 380 ? 2 : 3, textWidth);
                g.setFont(textFont);
                g.setColor(INK_2);
                y += 14;
                for (String l : t) {
                    g.drawString(l, PAD, y);
                    y += 36;
                }
            }

            // signature
            g.setColor(LINE);
            g.setStroke(new BasicStroke(1.2f));
            g.drawLine(PAD, H - 98, PAD + textWidth, H - 98);
            g.setColor(INK);
            g.setFont(tracked(bodyBold, 23f, -0.01f));
            g.drawString(owner, PAD, H - 56);
            int ow = g.getFontMetrics().stringWidth(owner);
            g.setColor(INK_3);
            g.setFont(tracked(mono, 17f, 0.04f));
            g.drawString(host(props.url()), PAD + ow + 18, H - 57);
        } finally {
            g.dispose();
        }
        Rendered r = new Rendered(jpeg(img), fingerprint);
        if (cache.size() >= MAX_CACHED) {
            cache.clear();
        }
        cache.put(key, r);
        return r;
    }

    /**
     * The capture in a browser window bleeding off the right edge: the page keeps its width ratio
     * and its left side (logo, headline), like the frame of the site.
     */
    private void browserWindow(Graphics2D g, BufferedImage cover, String site, double focalY) {
        int x = 664;
        int y = 92;
        int w = 760;
        int bar = 38;
        double scale = w / (double) cover.getWidth();
        int pageH = (int) Math.round(cover.getHeight() * scale);
        // a tall page is cut at the bottom of the picture, a short one makes a shorter window
        int h = Math.min(H + 40 - y, bar + pageH);
        shadow(g, x, y, w, h, 18);
        Shape frame = new RoundRectangle2D.Double(x, y, w, h, 28, 28);
        g.setColor(new Color(0xf7, 0xf6, 0xf2));
        g.fill(frame);
        Shape old = g.getClip();
        g.clip(frame);
        int visible = h - bar;
        int dy = y + bar - (int) Math.round(Math.max(0, pageH - visible) * Math.clamp(focalY, 0, 1));
        g.drawImage(cover, x, dy, w, pageH, null);
        g.setColor(new Color(0xe8, 0xe6, 0xdf));
        g.fillRect(x, y, w, bar);
        g.setColor(LINE);
        g.drawLine(x, y + bar, x + w, y + bar);
        g.setClip(old);
        Color[] lights = {new Color(0xff, 0x5f, 0x57), new Color(0xfe, 0xbc, 0x2e), new Color(0x28, 0xc8, 0x40)};
        for (int i = 0; i < 3; i++) {
            g.setColor(lights[i]);
            g.fill(new Ellipse2D.Double(x + 18 + i * 20, y + 13, 12, 12));
        }
        g.setColor(new Color(0xfb, 0xfa, 0xf7));
        g.fill(new RoundRectangle2D.Double(x + 96, y + 8, 340, 22, 11, 11));
        g.setColor(INK_3);
        g.setFont(tracked(mono, 13f, 0f));
        g.drawString(site, x + 110, y + 24);
        g.setColor(LINE);
        g.draw(frame);
    }

    /** a note cover: a rounded photo on the right */
    private void photo(Graphics2D g, BufferedImage cover, double focalY) {
        int x = 680;
        int y = 64;
        int w = 456;
        int h = H - 128;
        shadow(g, x, y, w, h, 14);
        Shape frame = new RoundRectangle2D.Double(x, y, w, h, 28, 28);
        Shape old = g.getClip();
        g.clip(frame);
        drawCover(g, cover, x, y, w, h, focalY);
        g.setClip(old);
    }

    /** no picture: a big serif quote mark (notes) or the initial in the project colour */
    private void mark(Graphics2D g, Card c) {
        int x = 720;
        int y = 64;
        int w = 416;
        int h = H - 128;
        g.setColor(c.accent());
        g.fill(new RoundRectangle2D.Double(x, y, w, h, 28, 28));
        g.setColor(PAPER);
        String glyph = c.browser() ? c.title().substring(0, 1).toUpperCase(Locale.ROOT) : "“";
        g.setFont(serif.deriveFont(c.browser() ? 320f : 420f));
        int gw = g.getFontMetrics().stringWidth(glyph);
        g.drawString(glyph, x + (w - gw) / 2, y + (c.browser() ? h / 2 + 110 : h / 2 + 230));
    }

    /** cover-fit (width first), cropped around the focal point vertically */
    private static void drawCover(Graphics2D g, BufferedImage img, int x, int y, int w, int h, double focalY) {
        double scale = Math.max(w / (double) img.getWidth(), h / (double) img.getHeight());
        int dw = (int) Math.ceil(img.getWidth() * scale);
        int dh = (int) Math.ceil(img.getHeight() * scale);
        int dx = x + (w - dw) / 2;
        int dy = y - (int) Math.round((dh - h) * Math.clamp(focalY, 0, 1));
        g.drawImage(img, dx, dy, dw, dh, null);
    }

    private static void shadow(Graphics2D g, int x, int y, int w, int h, int spread) {
        for (int i = spread; i > 0; i--) {
            g.setColor(new Color(10, 10, 20, 3));
            g.fill(new RoundRectangle2D.Double(x - i, y - i / 2.0 + 10, w + 2 * i, h + 2 * i, 28 + i, 28 + i));
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Optional<BufferedImage> cover(MediaDto m) {
        if (m == null || m.url() == null) {
            return Optional.empty();
        }
        String key = m.url().replaceFirst("^/api/media/", "");
        // the 1280 px copy is plenty for a 640 px window
        if (m.srcset() != null && m.srcset().contains("-w1280.")) {
            key = key.replaceFirst("(\\.[a-z0-9]+)$", "-w1280$1");
        }
        return media.serve(key).flatMap(s -> {
            if ("image/webp".equals(s.contentType())) {
                return webp.decode(s.bytes());
            }
            try {
                return Optional.ofNullable(ImageIO.read(new java.io.ByteArrayInputStream(s.bytes())));
            } catch (IOException e) {
                return Optional.empty();
            }
        });
    }

    private static double focalY(MediaDto m) {
        return m == null ? 0 : m.focalY();
    }

    private static Font tracked(Font f, float size, float tracking) {
        return f.deriveFont(Map.of(TextAttribute.SIZE, size, TextAttribute.TRACKING, tracking,
                TextAttribute.KERNING, TextAttribute.KERNING_ON, TextAttribute.LIGATURES, TextAttribute.LIGATURES_ON));
    }

    private static List<String> wrap(Graphics2D g, Font f, String text, int width) {
        var fm = g.getFontMetrics(f);
        text = text.replaceAll(" ([%:;?!»])", "\u00a0$1").replace("« ", "«\u00a0");
        List<String> out = new ArrayList<>();
        StringBuilder line = new StringBuilder();
        for (String word : text.strip().split("\\s+")) {
            String next = line.isEmpty() ? word : line + " " + word;
            if (fm.stringWidth(next) <= width || line.isEmpty()) {
                line.setLength(0);
                line.append(next);
            } else {
                out.add(line.toString());
                line.setLength(0);
                line.append(word);
            }
        }
        if (!line.isEmpty()) {
            out.add(line.toString());
        }
        return out;
    }

    /** at most n lines, the last one ending with an ellipsis when text was cut */
    private static List<String> clamp(Graphics2D g, Font f, List<String> lines, int n, int width) {
        if (lines.size() <= n) {
            return lines;
        }
        List<String> out = new ArrayList<>(lines.subList(0, n));
        var fm = g.getFontMetrics(f);
        String last = out.get(n - 1);
        while (!last.isEmpty() && fm.stringWidth(last + "…") > width) {
            last = last.substring(0, last.length() - 1);
        }
        out.set(n - 1, last.stripTrailing() + "…");
        return out;
    }

    /** Markdown marks out of a one-line text */
    private static String strip(String s) {
        return s.replaceAll("\\[([^\\]]+)\\]\\([^)]+\\)", "$1").replaceAll("[*_`#>]", "").replaceAll("\\s+", " ").strip();
    }

    private static byte[] jpeg(BufferedImage img) {
        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream(160_000);
                MemoryCacheImageOutputStream out = new MemoryCacheImageOutputStream(bytes)) {
            ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(0.9f);
            writer.setOutput(out);
            writer.write(null, new IIOImage(img, null, null), param);
            writer.dispose();
            out.flush();
            return bytes.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("JPEG encoding failed", e);
        }
    }

    private static Color accent(String hex) {
        try {
            return Color.decode(hex);
        } catch (RuntimeException e) {
            return ACCENT;
        }
    }

    private static String host(String url) {
        return url == null ? "" : url.replaceFirst("^https?://(www\\.)?", "").replaceFirst("/.*$", "");
    }

    private static String lang(String l) {
        return "en".equalsIgnoreCase(l) ? "en" : "fr";
    }

    private static String category(String c, String lang) {
        boolean en = lang.equals("en");
        return switch (c) {
            case "WEB" -> "WEB";
            case "MOBILE" -> "MOBILE";
            case "GAME" -> en ? "GAME" : "JEU";
            case "TOOL" -> en ? "TOOL" : "OUTIL";
            case "DESIGN" -> "DESIGN";
            case "DATA" -> en ? "DATA" : "DONNÉES";
            default -> en ? "OTHER" : "AUTRE";
        };
    }

    private static String fingerprint(String key, Card c, String owner) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            String cover = c.cover() == null ? "" : c.cover().id() + "@" + c.cover().focalY();
            md.update((key + "|" + c + "|" + cover + "|" + owner).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(md.digest(), 0, 12);
        } catch (Exception e) {
            return Integer.toHexString((key + c).hashCode());
        }
    }
}
