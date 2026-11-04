package fr.mbonnici.portfolio.seo;

import fr.mbonnici.portfolio.article.ArticleDtos;
import fr.mbonnici.portfolio.article.ArticleService;
import fr.mbonnici.portfolio.config.AppProperties;
import fr.mbonnici.portfolio.profile.ProfileDtos.EducationDto;
import fr.mbonnici.portfolio.profile.ProfileDtos.ExperienceDto;
import fr.mbonnici.portfolio.profile.ProfileDtos.Profile;
import fr.mbonnici.portfolio.profile.ProfileService;
import fr.mbonnici.portfolio.project.ProjectDtos.Card;
import fr.mbonnici.portfolio.project.ProjectDtos.Detail;
import fr.mbonnici.portfolio.project.ProjectService;
import fr.mbonnici.portfolio.settings.SettingsDtos.PublicSettings;
import fr.mbonnici.portfolio.settings.SettingsService;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Machine-readable feeds served at the site root (the reverse proxy forwards these paths here):
 * sitemap.xml with hreflang alternates, robots.txt that welcomes AI crawlers, and llms.txt /
 * llms-full.txt (https://llmstxt.org) so assistants can answer questions about this portfolio.
 */
@RestController
public class SeoController {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ISO_LOCAL_DATE.withZone(ZoneOffset.UTC);
    private static final MediaType TEXT_MARKDOWN = new MediaType("text", "markdown", java.nio.charset.StandardCharsets.UTF_8);

    private final AppProperties props;
    private final SettingsService settings;
    private final ProjectService projects;
    private final ProfileService profile;
    private final ArticleService articles;

    public SeoController(AppProperties props, SettingsService settings, ProjectService projects,
            ProfileService profile, ArticleService articles) {
        this.props = props;
        this.settings = settings;
        this.projects = projects;
        this.profile = profile;
        this.articles = articles;
    }

    private String base() {
        String url = props.url();
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    // ── sitemap ──────────────────────────────────────────────────────────────

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> sitemap() {
        PublicSettings s = settings.get();
        List<Card> cards = projects.listPublished();
        StringBuilder xml = new StringBuilder(8_192);
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
                .append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" ")
                .append("xmlns:xhtml=\"http://www.w3.org/1999/xhtml\">\n");

        for (String page : SiteRoutes.PAGES) {
            for (String lang : SiteRoutes.LANGS) {
                String priority = page.equals("home") ? "1.0" : page.equals("projects") ? "0.9"
                        : (page.equals("legal") || page.equals("privacy") || page.equals("terms")) ? "0.2" : "0.7";
                appendUrl(xml, SiteRoutes.path(lang, page), s.updatedAt(), priority,
                        SiteRoutes.path("fr", page), SiteRoutes.path("en", page));
            }
        }
        for (Card c : cards) {
            Instant lastmod = c == null ? null : projectLastMod(c.slug());
            for (String lang : SiteRoutes.LANGS) {
                appendUrl(xml, SiteRoutes.projectPath(lang, c.slug()), lastmod, "0.8",
                        SiteRoutes.projectPath("fr", c.slug()), SiteRoutes.projectPath("en", c.slug()));
            }
        }
        List<ArticleDtos.Card> notes = articles.listPublished();
        if (!notes.isEmpty()) {
            Instant newest = notes.getFirst().publishedAt();
            for (String lang : SiteRoutes.LANGS) {
                appendUrl(xml, SiteRoutes.path(lang, "notes"), newest, "0.7",
                        SiteRoutes.path("fr", "notes"), SiteRoutes.path("en", "notes"));
            }
            for (ArticleDtos.Card n : notes) {
                for (String lang : SiteRoutes.LANGS) {
                    appendUrl(xml, SiteRoutes.notePath(lang, n.slug()), n.publishedAt(), "0.6",
                            SiteRoutes.notePath("fr", n.slug()), SiteRoutes.notePath("en", n.slug()));
                }
            }
        }
        xml.append("</urlset>\n");
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
                .body(xml.toString());
    }

    private Instant projectLastMod(String slug) {
        try {
            Detail d = projects.getPublished(slug);
            return d.updatedAt();
        } catch (RuntimeException e) {
            return null;
        }
    }

    private void appendUrl(StringBuilder xml, String path, Instant lastmod, String priority, String fr, String en) {
        String b = base();
        xml.append("  <url>\n")
                .append("    <loc>").append(escape(b + path)).append("</loc>\n");
        if (lastmod != null) {
            xml.append("    <lastmod>").append(DAY.format(lastmod)).append("</lastmod>\n");
        }
        xml.append("    <priority>").append(priority).append("</priority>\n")
                .append("    <xhtml:link rel=\"alternate\" hreflang=\"fr\" href=\"").append(escape(b + fr)).append("\"/>\n")
                .append("    <xhtml:link rel=\"alternate\" hreflang=\"en\" href=\"").append(escape(b + en)).append("\"/>\n")
                .append("    <xhtml:link rel=\"alternate\" hreflang=\"x-default\" href=\"").append(escape(b + en)).append("\"/>\n")
                .append("  </url>\n");
    }

    // ── robots ───────────────────────────────────────────────────────────────

    @GetMapping(value = "/robots.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> robots() {
        String b = base();
        String body = """
                # mbonnici.fr — crawl policy
                User-agent: *
                Allow: /
                Allow: /api/media/
                Allow: /api/og/
                Allow: /api/cv
                Disallow: /admin
                Disallow: /api/

                # AI assistants and answer engines are welcome. A summary of this site is at /llms.txt
                User-agent: GPTBot
                User-agent: OAI-SearchBot
                User-agent: ChatGPT-User
                User-agent: ClaudeBot
                User-agent: Claude-SearchBot
                User-agent: Claude-User
                User-agent: anthropic-ai
                User-agent: PerplexityBot
                User-agent: Perplexity-User
                User-agent: Google-Extended
                User-agent: Applebot-Extended
                User-agent: Amazonbot
                User-agent: DuckAssistBot
                User-agent: Meta-ExternalAgent
                User-agent: CCBot
                Allow: /
                Allow: /api/media/
                Allow: /api/og/
                Allow: /api/cv
                Disallow: /admin
                Disallow: /api/

                Sitemap: %s/sitemap.xml
                """.formatted(b);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic())
                .body(body);
    }

    // ── llms.txt ─────────────────────────────────────────────────────────────

    @GetMapping(value = "/llms.txt")
    public ResponseEntity<String> llms() {
        return ResponseEntity.ok()
                .contentType(TEXT_MARKDOWN)
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
                .body(buildLlms(false));
    }

    @GetMapping(value = "/llms-full.txt")
    public ResponseEntity<String> llmsFull() {
        return ResponseEntity.ok()
                .contentType(TEXT_MARKDOWN)
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
                .body(buildLlms(true));
    }

    private String buildLlms(boolean full) {
        PublicSettings s = settings.get();
        Profile p = profile.get();
        List<Card> cards = projects.listPublished();
        String b = base();
        StringBuilder md = new StringBuilder(8_192);

        md.append("# ").append(s.ownerName()).append("\n\n");
        md.append("> ").append(s.headline().en()).append(". ").append(s.seoDescription().en()).append("\n\n");
        md.append(full ? s.bio().en() : firstParagraph(s.bio().en())).append("\n\n");
        md.append("- Location: ").append(nz(s.location())).append("\n");
        md.append("- Site: ").append(b).append(" (French: ").append(b).append("/fr, English: ").append(b).append("/en)\n");
        if (s.githubUrl() != null) {
            md.append("- GitHub: ").append(s.githubUrl()).append("\n");
        }
        if (s.linkedinUrl() != null) {
            md.append("- LinkedIn: ").append(s.linkedinUrl()).append("\n");
        }
        md.append("- Contact: ").append(b).append(SiteRoutes.path("en", "contact")).append("\n\n");

        md.append("## Projects\n\n");
        for (Card c : cards) {
            md.append("- [").append(c.title().en()).append("](").append(b).append(SiteRoutes.projectPath("en", c.slug()))
                    .append("): ").append(c.tagline().en());
            if (!c.stack().isEmpty()) {
                md.append(" (").append(String.join(", ", c.stack())).append(")");
            }
            if (c.liveUrl() != null) {
                md.append(" — live: ").append(c.liveUrl());
            }
            if (c.repoUrl() != null) {
                md.append(" — code: ").append(c.repoUrl());
            }
            md.append("\n");
            if (full) {
                try {
                    Detail d = projects.getPublished(c.slug());
                    md.append("\n").append(indent(d.description().en())).append("\n\n");
                } catch (RuntimeException ignored) {
                    // unpublished in between; skip
                }
            }
        }

        md.append("\n## Experience\n\n");
        for (ExperienceDto e : p.experiences()) {
            md.append("- ").append(e.role().en()).append(" at ").append(e.company()).append(" (")
                    .append(e.startDate().getYear()).append(" – ")
                    .append(e.endDate() == null ? "present" : String.valueOf(e.endDate().getYear())).append(")");
            if (full && !e.description().en().isBlank()) {
                md.append(": ").append(e.description().en());
            }
            md.append("\n");
        }

        md.append("\n## Education\n\n");
        for (EducationDto e : p.education()) {
            md.append("- ").append(e.degree().en()).append(", ").append(e.school()).append(" (")
                    .append(e.startDate().getYear()).append(" – ")
                    .append(e.endDate() == null ? "present" : String.valueOf(e.endDate().getYear())).append(")\n");
        }

        List<ArticleDtos.Card> notes = articles.listPublished();
        if (!notes.isEmpty()) {
            md.append("\n## Notes\n\n");
            for (ArticleDtos.Card n : notes) {
                md.append("- [").append(n.title().en()).append("](").append(b).append(SiteRoutes.notePath("en", n.slug()))
                        .append(")");
                if (!n.summary().en().isBlank()) {
                    md.append(": ").append(n.summary().en());
                }
                md.append("\n");
                if (full) {
                    try {
                        md.append("\n").append(indent(articles.getPublished(n.slug()).body().en())).append("\n\n");
                    } catch (RuntimeException ignored) {
                        // unpublished in between; skip
                    }
                }
            }
        }

        md.append("\n## Skills\n\n");
        md.append(p.skills().stream().map(sk -> sk.name()).reduce((a, c) -> a + ", " + c).orElse("")).append("\n");

        md.append("\n## Pages\n\n");
        for (String page : SiteRoutes.PAGES) {
            md.append("- ").append(b).append(SiteRoutes.path("en", page)).append(" (fr: ").append(b)
                    .append(SiteRoutes.path("fr", page)).append(")\n");
        }
        md.append("- ").append(b).append("/llms-full.txt (full descriptions)\n");
        if (!notes.isEmpty()) {
            md.append("- ").append(b).append("/en/rss.xml (notes feed, fr: ").append(b).append("/fr/rss.xml)\n");
        }
        md.append("- ").append(b).append("/sitemap.xml\n");
        return md.toString();
    }

    // ── RSS (notes) ──────────────────────────────────────────────────────────

    private static final DateTimeFormatter RFC_1123 = DateTimeFormatter.RFC_1123_DATE_TIME.withZone(ZoneOffset.UTC);

    @GetMapping(value = {"/fr/rss.xml", "/en/rss.xml"})
    public ResponseEntity<String> rss(HttpServletRequest request) {
        String lang = request.getRequestURI().startsWith("/en/") ? "en" : "fr";
        PublicSettings s = settings.get();
        List<ArticleDtos.Card> notes = articles.listPublished();
        String b = base();
        String self = b + "/" + lang + "/rss.xml";
        StringBuilder xml = new StringBuilder(4_096);
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
                .append("<rss version=\"2.0\" xmlns:atom=\"http://www.w3.org/2005/Atom\">\n<channel>\n")
                .append("  <title>").append(escape((lang.equals("en") ? "Notes — " : "Notes — ") + s.ownerName())).append("</title>\n")
                .append("  <link>").append(escape(b + SiteRoutes.path(lang, "notes"))).append("</link>\n")
                .append("  <description>").append(escape(lang.equals("en")
                        ? "Notes by " + s.ownerName() + ": web development, self-hosting and tools"
                        : "Les notes de " + s.ownerName() + " : développement web, auto-hébergement et outils")).append("</description>\n")
                .append("  <language>").append(lang.equals("en") ? "en" : "fr").append("</language>\n")
                .append("  <atom:link href=\"").append(escape(self)).append("\" rel=\"self\" type=\"application/rss+xml\"/>\n");
        if (!notes.isEmpty() && notes.getFirst().publishedAt() != null) {
            xml.append("  <lastBuildDate>").append(RFC_1123.format(notes.getFirst().publishedAt())).append("</lastBuildDate>\n");
        }
        for (ArticleDtos.Card n : notes) {
            String link = b + SiteRoutes.notePath(lang, n.slug());
            xml.append("  <item>\n")
                    .append("    <title>").append(escape(n.title().get(lang))).append("</title>\n")
                    .append("    <link>").append(escape(link)).append("</link>\n")
                    .append("    <guid isPermaLink=\"true\">").append(escape(link)).append("</guid>\n");
            if (n.publishedAt() != null) {
                xml.append("    <pubDate>").append(RFC_1123.format(n.publishedAt())).append("</pubDate>\n");
            }
            if (!n.summary().get(lang).isBlank()) {
                xml.append("    <description>").append(escape(n.summary().get(lang))).append("</description>\n");
            }
            for (String tag : n.tags()) {
                xml.append("    <category>").append(escape(tag)).append("</category>\n");
            }
            xml.append("  </item>\n");
        }
        xml.append("</channel>\n</rss>\n");
        return ResponseEntity.ok()
                .contentType(new MediaType("application", "rss+xml", java.nio.charset.StandardCharsets.UTF_8))
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
                .body(xml.toString());
    }

    private static String firstParagraph(String text) {
        if (text == null) {
            return "";
        }
        int i = text.indexOf("\n\n");
        return i > 0 ? text.substring(0, i) : text;
    }

    private static String indent(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        return "  " + text.strip().replace("\n", "\n  ");
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
