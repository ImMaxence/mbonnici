import { DOCUMENT, InjectionToken, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { I18nService } from '../i18n/i18n.service';
import { LANGS, PageKey, pagePath } from '../i18n/routes';

/** Public origin of the site (https://mbonnici.fr). Provided from APP_URL on the server. */
export const SITE_URL = new InjectionToken<string>('SITE_URL', { factory: () => '' });

export interface SeoInput {
  title: string;
  description: string;
  page: PageKey;
  slug?: string;
  image?: string | null;
  type?: 'website' | 'article' | 'profile';
  jsonLd?: object | object[];
  noindex?: boolean;
}

/**
 * Title, meta, canonical, hreflang alternates and JSON-LD for every page, rendered on the
 * server so crawlers (search engines and AI assistants alike) see the full head.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly i18n = inject(I18nService);
  private readonly configuredOrigin = inject(SITE_URL);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  get origin(): string {
    if (this.configuredOrigin) return this.configuredOrigin.replace(/\/$/, '');
    if (this.browser) return this.document.location.origin;
    return 'https://mbonnici.fr';
  }

  set(input: SeoInput): void {
    const siteName = this.i18n.t('meta.siteName');
    const lang = this.i18n.lang();
    const fullTitle = input.page === 'home' ? input.title : `${input.title} — ${siteName}`;
    const path = pagePath(lang, input.page, input.slug);
    const url = this.origin + path;
    const image = input.image ? this.absolute(input.image) : `${this.origin}/og-default.png`;

    this.title.setTitle(fullTitle);
    this.document.documentElement.lang = lang;

    this.tag('description', input.description);
    this.tag('robots', input.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    this.tag('author', siteName);
    this.property('og:site_name', siteName);
    this.property('og:type', input.type ?? 'website');
    this.property('og:title', fullTitle);
    this.property('og:description', input.description);
    this.property('og:url', url);
    this.property('og:image', image);
    this.property('og:locale', lang === 'fr' ? 'fr_FR' : 'en_GB');
    this.property('og:locale:alternate', lang === 'fr' ? 'en_GB' : 'fr_FR');
    this.tag('twitter:card', 'summary_large_image');
    this.tag('twitter:title', fullTitle);
    this.tag('twitter:description', input.description);
    this.tag('twitter:image', image);

    this.link('canonical', url);
    for (const l of LANGS) {
      this.link('alternate', this.origin + pagePath(l, input.page, input.slug), l);
    }
    this.link('alternate', this.origin + pagePath('en', input.page, input.slug), 'x-default');

    this.jsonLd(input.jsonLd);
  }

  /** Person + WebSite graph shared by every page. */
  siteGraph(owner: string, headline: string, sameAs: (string | null)[]): object[] {
    const origin = this.origin;
    return [
      {
        '@type': 'Person',
        '@id': `${origin}/#person`,
        name: owner,
        jobTitle: headline,
        url: origin,
        sameAs: sameAs.filter(Boolean),
        address: { '@type': 'PostalAddress', addressLocality: 'Aix-en-Provence', addressCountry: 'FR' },
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: origin,
        name: owner,
        inLanguage: ['fr', 'en'],
        publisher: { '@id': `${origin}/#person` },
      },
    ];
  }

  private absolute(url: string): string {
    return url.startsWith('http') ? url : this.origin + url;
  }

  private tag(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private property(property: string, content: string): void {
    this.meta.updateTag({ property, content });
  }

  private link(rel: string, href: string, hreflang?: string): void {
    const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]`;
    let el = this.document.head.querySelector<HTMLLinkElement>(selector);
    if (!el) {
      el = this.document.createElement('link');
      el.rel = rel;
      if (hreflang) el.hreflang = hreflang;
      this.document.head.appendChild(el);
    }
    el.href = href;
  }

  private jsonLd(data: object | object[] | undefined): void {
    const existing = this.document.head.querySelector('script[data-seo="jsonld"]');
    if (!data) {
      existing?.remove();
      return;
    }
    const graph = Array.isArray(data) ? data : [data];
    const payload = { '@context': 'https://schema.org', '@graph': graph };
    const script = existing ?? this.document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-seo', 'jsonld');
    // "</" would close the tag early inside HTML
    script.textContent = JSON.stringify(payload).replace(/<\//g, '<\\/');
    if (!existing) this.document.head.appendChild(script);
  }
}
