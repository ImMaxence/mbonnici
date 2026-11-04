/**
 * Localised URL segments. Mirrors backend/src/main/java/fr/mbonnici/portfolio/seo/SiteRoutes.java —
 * keep the two in sync (the sitemap is generated from the Java copy).
 */
export type Lang = 'fr' | 'en';
export type PageKey =
  | 'home'
  | 'projects'
  | 'project'
  | 'about'
  | 'contact'
  | 'legal'
  | 'privacy'
  | 'terms'
  | 'accessibility';

export const LANGS: readonly Lang[] = ['fr', 'en'] as const;
export const DEFAULT_LANG: Lang = 'fr';

export const SEGMENTS: Record<Lang, Record<Exclude<PageKey, 'project'>, string>> = {
  fr: {
    home: '',
    projects: 'projets',
    about: 'a-propos',
    contact: 'contact',
    legal: 'mentions-legales',
    privacy: 'confidentialite',
    terms: 'conditions-utilisation',
    accessibility: 'accessibilite',
  },
  en: {
    home: '',
    projects: 'projects',
    about: 'about',
    contact: 'contact',
    legal: 'legal-notice',
    privacy: 'privacy-policy',
    terms: 'terms-of-use',
    accessibility: 'accessibility',
  },
};

export function isLang(value: unknown): value is Lang {
  return value === 'fr' || value === 'en';
}

/** Absolute path for a page in a language, e.g. pagePath('fr', 'projects', 'meowtrix') → /fr/projets/meowtrix */
export function pagePath(lang: Lang, page: PageKey, slug?: string): string {
  if (page === 'project') {
    return `/${lang}/${SEGMENTS[lang].projects}/${slug ?? ''}`;
  }
  const segment = SEGMENTS[lang][page];
  return segment ? `/${lang}/${segment}` : `/${lang}`;
}

export interface ParsedPath {
  lang: Lang;
  page: PageKey;
  slug?: string;
}

/** Inverse of pagePath; returns null for admin and unknown URLs. */
export function parsePath(url: string): ParsedPath | null {
  const clean = url.split(/[?#]/)[0];
  const parts = clean.split('/').filter(Boolean);
  const lang = parts[0];
  if (!isLang(lang)) {
    return null;
  }
  if (parts.length === 1) {
    return { lang, page: 'home' };
  }
  const segment = parts[1];
  const pages = SEGMENTS[lang];
  for (const key of Object.keys(pages) as (keyof typeof pages)[]) {
    if (pages[key] === segment) {
      if (key === 'projects' && parts[2]) {
        return { lang, page: 'project', slug: parts[2] };
      }
      return { lang, page: key };
    }
  }
  return null;
}
