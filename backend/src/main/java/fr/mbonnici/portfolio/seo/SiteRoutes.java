package fr.mbonnici.portfolio.seo;

import java.util.List;
import java.util.Map;

/** Localised URL segments. Must stay in sync with {@code frontend/src/app/core/i18n/routes.ts}. */
public final class SiteRoutes {

    private SiteRoutes() {}

    public static final List<String> LANGS = List.of("fr", "en");
    public static final String DEFAULT_LANG = "fr";
    public static final List<String> PAGES = List.of("home", "projects", "about", "contact", "legal", "privacy", "terms", "accessibility");

    private static final Map<String, Map<String, String>> SEGMENTS = Map.of(
            "fr", Map.of(
                    "home", "",
                    "projects", "projets",
                    "about", "a-propos",
                    "contact", "contact",
                    "legal", "mentions-legales",
                    "privacy", "confidentialite",
                    "terms", "conditions-utilisation",
                    "accessibility", "accessibilite"),
            "en", Map.of(
                    "home", "",
                    "projects", "projects",
                    "about", "about",
                    "contact", "contact",
                    "legal", "legal-notice",
                    "privacy", "privacy-policy",
                    "terms", "terms-of-use",
                    "accessibility", "accessibility"));

    public static String path(String lang, String page) {
        String seg = SEGMENTS.get(lang).get(page);
        return "/" + lang + (seg.isEmpty() ? "" : "/" + seg);
    }

    public static String projectPath(String lang, String slug) {
        return path(lang, "projects") + "/" + slug;
    }
}
