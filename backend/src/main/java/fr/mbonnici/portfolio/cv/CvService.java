package fr.mbonnici.portfolio.cv;

import com.openhtmltopdf.outputdevice.helper.BaseRendererBuilder.FontStyle;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import fr.mbonnici.portfolio.common.ApiException;
import fr.mbonnici.portfolio.config.AppProperties;
import fr.mbonnici.portfolio.profile.ProfileDtos.EducationDto;
import fr.mbonnici.portfolio.profile.ProfileDtos.ExperienceDto;
import fr.mbonnici.portfolio.profile.ProfileDtos.Profile;
import fr.mbonnici.portfolio.profile.ProfileDtos.SkillDto;
import fr.mbonnici.portfolio.profile.ProfileService;
import fr.mbonnici.portfolio.profile.Skill;
import fr.mbonnici.portfolio.project.ProjectDtos.Card;
import fr.mbonnici.portfolio.project.ProjectService;
import fr.mbonnici.portfolio.settings.SettingsDtos.PublicSettings;
import fr.mbonnici.portfolio.settings.SettingsService;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * The CV as a PDF, generated from the back-office content (settings, experience, education,
 * skills, featured projects): always up to date, nothing to upload. Rendered from XHTML + CSS by
 * OpenHTMLtoPDF with the site's fonts embedded; cached until the content changes.
 */
@Service
public class CvService {

    private static final Logger log = LoggerFactory.getLogger(CvService.class);
    private static final Pattern LINK = Pattern.compile("\\[([^\\]]+)\\]\\((https?://[^\\s)]+)\\)");
    private static final Pattern BOLD = Pattern.compile("\\*\\*([^*]+)\\*\\*");

    /** A rendered CV and the fingerprint of the content it was made from (ETag). */
    public record Rendered(byte[] pdf, String fingerprint, String fileName) {}

    private final SettingsService settings;
    private final ProfileService profile;
    private final ProjectService projects;
    private final AppProperties props;
    private final Map<String, Rendered> cache = new ConcurrentHashMap<>();

    public CvService(SettingsService settings, ProfileService profile, ProjectService projects, AppProperties props) {
        this.settings = settings;
        this.profile = profile;
        this.projects = projects;
        this.props = props;
    }

    public Rendered render(String language) {
        String lang = "en".equalsIgnoreCase(language) ? "en" : "fr";
        PublicSettings s = settings.get();
        Profile p = profile.get();
        List<Card> featured = projects.listPublished().stream().filter(Card::featured).limit(3).toList();
        String fingerprint = fingerprint(lang, s, p, featured);
        Rendered hit = cache.get(lang);
        if (hit != null && hit.fingerprint().equals(fingerprint)) {
            return hit;
        }
        String html = html(lang, s, p, featured);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream(64 * 1024)) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            font(builder, "Inter-Regular.ttf", "Inter", 400, FontStyle.NORMAL);
            font(builder, "Inter-SemiBold.ttf", "Inter", 600, FontStyle.NORMAL);
            font(builder, "InterTight-SemiBold.ttf", "Inter Tight", 600, FontStyle.NORMAL);
            font(builder, "JetBrainsMono-Regular.ttf", "JetBrains Mono", 400, FontStyle.NORMAL);
            font(builder, "InstrumentSerif-Italic.ttf", "Instrument Serif", 400, FontStyle.ITALIC);
            builder.withHtmlContent(html, base());
            builder.toStream(out);
            builder.run();
            String name = slug(s.ownerName()) + (lang.equals("en") ? "-resume" : "-cv") + ".pdf";
            Rendered r = new Rendered(out.toByteArray(), fingerprint, name);
            cache.put(lang, r);
            log.info("Rendered CV ({}, {} bytes)", lang, r.pdf().length);
            return r;
        } catch (Exception e) {
            log.error("CV rendering failed", e);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "CV could not be generated");
        }
    }

    private static void font(PdfRendererBuilder b, String file, String family, int weight, FontStyle style) {
        b.useFont(() -> CvService.class.getResourceAsStream("/cv/fonts/" + file), family, weight, style, true);
    }

    // ── document ─────────────────────────────────────────────────────────────

    private String html(String lang, PublicSettings s, Profile p, List<Card> featured) {
        boolean en = lang.equals("en");
        String site = base().replaceFirst("^https?://", "");
        StringBuilder h = new StringBuilder(16_384);
        h.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<html xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"")
                .append(lang).append("\"><head><meta charset=\"UTF-8\"/>")
                .append("<title>").append(esc(s.ownerName() + " — " + (en ? "Resume" : "CV"))).append("</title>")
                .append("<meta name=\"author\" content=\"").append(esc(s.ownerName())).append("\"/>")
                .append("<meta name=\"subject\" content=\"").append(esc(s.headline().get(lang))).append("\"/>")
                .append("<style>").append(css(en, site)).append("</style></head><body>");

        // header
        h.append("<div class=\"head\"><table class=\"head-t\"><tr><td class=\"who\">")
                .append("<h1>").append(esc(s.ownerName())).append("</h1>");
        if (!s.headline().get(lang).isBlank()) {
            h.append("<p class=\"headline\">").append(esc(s.headline().get(lang))).append("</p>");
        }
        h.append("</td><td class=\"reach\">");
        if (s.publicEmail() != null) {
            h.append("<a href=\"mailto:").append(esc(s.publicEmail())).append("\">").append(esc(s.publicEmail())).append("</a><br/>");
        }
        h.append("<a href=\"").append(esc(base())).append("\">").append(esc(site)).append("</a><br/>");
        if (s.location() != null) {
            h.append(esc(s.location())).append("<br/>");
        }
        if (s.githubUrl() != null) {
            h.append("<a href=\"").append(esc(s.githubUrl())).append("\">").append(esc(s.githubUrl().replaceFirst("^https?://(www\\.)?", "")))
                    .append("</a><br/>");
        }
        if (s.linkedinUrl() != null) {
            h.append("<a href=\"").append(esc(s.linkedinUrl())).append("\">")
                    .append(esc(s.linkedinUrl().replaceFirst("^https?://(www\\.)?", "").replaceFirst("/$", "")))
                    .append("</a>");
        }
        h.append("</td></tr></table></div>");

        String bio = firstParagraph(s.bio().get(lang));
        if (!bio.isBlank()) {
            h.append("<p class=\"bio\">").append(inline(bio)).append("</p>");
        }

        h.append("<table class=\"cols\"><tr><td class=\"main\">");

        // experience
        if (!p.experiences().isEmpty()) {
            h.append("<h2>").append(en ? "Experience" : "Expérience").append("</h2>");
            for (ExperienceDto e : p.experiences()) {
                h.append("<div class=\"item\"><table class=\"line\"><tr><td><span class=\"role\">").append(esc(e.role().get(lang)))
                        .append("</span></td><td class=\"when\">").append(range(e.startDate(), e.endDate(), lang)).append("</td></tr></table>")
                        .append("<p class=\"org\">").append(esc(e.company()));
                if (e.location() != null && !e.location().isBlank()) {
                    h.append(" · ").append(esc(e.location()));
                }
                h.append(" · ").append(contract(e.contractType().name(), en)).append("</p>");
                h.append(block(e.description().get(lang)));
                if (!e.skills().isEmpty()) {
                    h.append("<p class=\"tags\">").append(esc(String.join(" · ", e.skills()))).append("</p>");
                }
                h.append("</div>");
            }
        }

        // projects
        if (!featured.isEmpty()) {
            h.append("<h2>").append(en ? "Selected projects" : "Projets choisis").append("</h2>");
            for (Card c : featured) {
                String url = c.liveUrl() != null ? c.liveUrl() : c.repoUrl();
                h.append("<div class=\"item small\"><p><span class=\"role\">").append(esc(c.title().get(lang))).append("</span>");
                if (url != null) {
                    h.append(" <a class=\"url\" href=\"").append(esc(url)).append("\">")
                            .append(esc(url.replaceFirst("^https?://(www\\.)?", "").replaceFirst("/$", ""))).append("</a>");
                }
                h.append("</p>");
                if (!c.tagline().get(lang).isBlank()) {
                    h.append("<p class=\"desc\">").append(esc(c.tagline().get(lang))).append("</p>");
                }
                if (!c.stack().isEmpty()) {
                    h.append("<p class=\"tags\">").append(esc(String.join(" · ", c.stack()))).append("</p>");
                }
                h.append("</div>");
            }
        }

        h.append("</td><td class=\"side\">");

        // skills
        if (!p.skills().isEmpty()) {
            h.append("<h2>").append(en ? "Skills" : "Compétences").append("</h2>");
            for (Skill.Category cat : Skill.Category.values()) {
                List<SkillDto> group = p.skills().stream().filter(sk -> sk.category() == cat).toList();
                if (group.isEmpty()) {
                    continue;
                }
                h.append("<p class=\"cat\">").append(esc(category(cat, en))).append("</p><p class=\"skills\">");
                for (SkillDto sk : group) {
                    h.append("<span class=\"chip").append(sk.level() >= 5 ? " strong" : "").append("\">").append(esc(sk.name()))
                            .append("</span> ");
                }
                h.append("</p>");
            }
        }

        // education
        if (!p.education().isEmpty()) {
            h.append("<h2>").append(en ? "Education" : "Formation").append("</h2>");
            for (EducationDto e : p.education()) {
                h.append("<div class=\"item small\"><p class=\"role\">").append(esc(e.degree().get(lang))).append("</p>")
                        .append("<p class=\"org\">").append(esc(e.school())).append("</p>")
                        .append("<p class=\"when-l\">").append(range(e.startDate(), e.endDate(), lang)).append("</p></div>");
            }
        }

        h.append("</td></tr></table></body></html>");
        return h.toString();
    }

    private static String css(boolean en, String site) {
        String footer = (en ? "Generated from " : "Généré depuis ") + site + " · "
                + LocalDate.now().format(DateTimeFormatter.ofPattern(en ? "d MMMM yyyy" : "d MMMM yyyy", en ? Locale.ENGLISH : Locale.FRENCH));
        return """
                @page { size: A4; margin: 15mm 15mm 17mm 15mm;
                  @bottom-left { content: "%s"; font-family: 'JetBrains Mono'; font-size: 6.8pt; color: #8a877d; }
                  @bottom-right { content: counter(page) " / " counter(pages); font-family: 'JetBrains Mono'; font-size: 6.8pt; color: #8a877d; } }
                body { font-family: 'Inter'; font-size: 8.6pt; line-height: 1.4; color: #121211; margin: 0; }
                a { color: #121211; text-decoration: none; }
                p { margin: 0; }
                table { border-collapse: collapse; width: 100%%; }
                td { vertical-align: top; padding: 0; }
                .head { border-bottom: 0.8pt solid #121211; padding-bottom: 4mm; margin-bottom: 4mm; }
                h1 { font-family: 'Inter Tight'; font-weight: 600; font-size: 27pt; letter-spacing: -0.8pt; line-height: 1; margin: 0; }
                .headline { font-family: 'Instrument Serif'; font-style: italic; font-size: 15pt; color: #2b3bea; margin-top: 2mm; }
                .reach { width: 34%%; text-align: right; font-family: 'JetBrains Mono'; font-size: 7.4pt; line-height: 1.7; color: #4a4943; }
                .bio { font-size: 9.2pt; line-height: 1.45; color: #2a2a27; margin-bottom: 2mm; }
                .main { width: 64%%; padding-right: 7mm; }
                .side { width: 36%%; padding-left: 6mm; border-left: 0.5pt solid #d6d3c9; }
                h2 { font-family: 'JetBrains Mono'; font-weight: 400; font-size: 7pt; letter-spacing: 1.1pt; text-transform: uppercase;
                     color: #6b6960; border-bottom: 0.5pt solid #d6d3c9; padding-bottom: 1.6mm; margin: 4.6mm 0 2.4mm 0; page-break-after: avoid; }
                .item { margin-bottom: 3.4mm; page-break-inside: avoid; }
                .item.small { margin-bottom: 2.6mm; }
                .line td { vertical-align: baseline; }
                .role { font-weight: 600; font-size: 10pt; }
                .when { text-align: right; white-space: nowrap; font-family: 'JetBrains Mono'; font-size: 7.2pt; color: #6b6960; width: 30%%; }
                .when-l { font-family: 'JetBrains Mono'; font-size: 7.2pt; color: #6b6960; margin-top: 0.6mm; }
                .org { color: #4a4943; margin: 0.4mm 0 1.2mm 0; }
                .desc { color: #2a2a27; margin-top: 0.6mm; }
                ul { margin: 0.8mm 0 0 0; padding-left: 3.6mm; }
                li { margin-bottom: 0.6mm; }
                .tags { font-family: 'JetBrains Mono'; font-size: 6.9pt; color: #6b6960; margin-top: 1.2mm; }
                .url { font-family: 'JetBrains Mono'; font-size: 7pt; color: #2b3bea; }
                .cat { font-weight: 600; font-size: 7.8pt; margin: 1.8mm 0 0.8mm 0; }
                .skills { line-height: 1.9; }
                .chip { border: 0.5pt solid #cfccc2; border-radius: 2.4pt; padding: 0.4mm 1.4mm; font-size: 7.2pt; white-space: nowrap; }
                .chip.strong { border-color: #121211; }
                """.formatted(footer.replace("\"", ""));
    }

    // ── text helpers ─────────────────────────────────────────────────────────

    /** Markdown subset → XHTML: paragraphs and "- " lists, bold, links (shown as their text). */
    private static String block(String md) {
        if (md == null || md.isBlank()) {
            return "";
        }
        StringBuilder out = new StringBuilder();
        boolean list = false;
        StringBuilder para = new StringBuilder();
        for (String raw : md.replace("\r", "").split("\n")) {
            String line = raw.strip();
            boolean item = line.startsWith("- ") || line.startsWith("* ") || line.startsWith("• ");
            if (line.isEmpty() || item) {
                if (!para.isEmpty()) {
                    out.append("<p class=\"desc\">").append(inline(para.toString())).append("</p>");
                    para.setLength(0);
                }
            }
            if (item) {
                if (!list) {
                    out.append("<ul>");
                    list = true;
                }
                out.append("<li>").append(inline(line.substring(2).strip())).append("</li>");
                continue;
            }
            if (list && !line.isEmpty()) {
                out.append("</ul>");
                list = false;
            }
            if (!line.isEmpty()) {
                para.append(para.isEmpty() ? "" : " ").append(line);
            }
        }
        if (!para.isEmpty()) {
            out.append("<p class=\"desc\">").append(inline(para.toString())).append("</p>");
        }
        if (list) {
            out.append("</ul>");
        }
        return out.toString();
    }

    private static String inline(String text) {
        String t = esc(text.replace("`", ""));
        Matcher link = LINK.matcher(t);
        t = link.replaceAll("$1");
        Matcher bold = BOLD.matcher(t);
        return bold.replaceAll("<b>$1</b>");
    }

    private static String range(LocalDate start, LocalDate end, String lang) {
        return month(start, lang) + " — " + (end == null ? ("en".equals(lang) ? "now" : "aujourd’hui") : month(end, lang));
    }

    private static String month(LocalDate d, String lang) {
        Locale l = "en".equals(lang) ? Locale.ENGLISH : Locale.FRENCH;
        return d.getMonth().getDisplayName(TextStyle.SHORT, l).replace(".", "") + " " + d.getYear();
    }

    private static String contract(String type, boolean en) {
        return switch (type) {
            case "ALTERNANCE" -> en ? "Work-study" : "Alternance";
            case "STAGE" -> en ? "Internship" : "Stage";
            case "FREELANCE" -> "Freelance";
            case "CDD" -> en ? "Fixed-term" : "CDD";
            default -> en ? "Permanent" : "CDI";
        };
    }

    private static String category(Skill.Category c, boolean en) {
        return switch (c) {
            case LANGUAGE -> en ? "Languages" : "Langages";
            case FRAMEWORK -> "Frameworks";
            case DATABASE -> en ? "Data" : "Données";
            case DEVOPS -> en ? "DevOps & cloud" : "DevOps & cloud";
            case NETWORK -> en ? "Network & security" : "Réseau & sécurité";
            case TOOL -> en ? "Tools" : "Outils";
            case PRACTICE -> en ? "Practices" : "Méthodes";
        };
    }

    private static String firstParagraph(String text) {
        if (text == null) {
            return "";
        }
        int i = text.indexOf("\n\n");
        return (i > 0 ? text.substring(0, i) : text).strip();
    }

    private static String esc(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private static String slug(String s) {
        String n = java.text.Normalizer.normalize(s == null ? "cv" : s, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return n.isEmpty() ? "cv" : n;
    }

    private String base() {
        String url = props.url();
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    private static String fingerprint(String lang, PublicSettings s, Profile p, List<Card> featured) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update((lang + "|" + LocalDate.now() + "|" + s + "|" + p + "|" + featured).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(md.digest(), 0, 12);
        } catch (Exception e) {
            return String.valueOf((lang + s + p + featured).hashCode());
        }
    }
}
