import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import type { Localized } from '../api/models';
import { en } from './locales/en';
import { fr, type Dictionary } from './locales/fr';
import { DEFAULT_LANG, Lang, PageKey, pagePath, parsePath } from './routes';

type Params = Record<string, string | number>;

/** Runtime i18n built on signals: the active language drives every template through the `t` pipe. */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);

  readonly lang = signal<Lang>(DEFAULT_LANG);
  readonly dict = computed<Dictionary>(() => (this.lang() === 'en' ? en : (fr as unknown as Dictionary)));
  readonly locale = computed(() => (this.lang() === 'fr' ? 'fr-FR' : 'en-GB'));
  readonly other = computed<Lang>(() => (this.lang() === 'fr' ? 'en' : 'fr'));

  setLang(lang: Lang): void {
    if (this.lang() !== lang) {
      this.lang.set(lang);
    }
    if (this.document.documentElement.lang !== lang) {
      this.document.documentElement.lang = lang;
    }
  }

  /** Translates a dotted key with {placeholder} interpolation; unknown keys return the key itself. */
  t(key: string, params?: Params): string {
    const value = this.get<unknown>(key);
    if (typeof value !== 'string') {
      return key;
    }
    return params ? interpolate(value, params) : value;
  }

  /** Raw access for structured entries (arrays of sections, nested maps). */
  get<T>(key: string): T {
    return key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), this.dict()) as T;
  }

  /** Picks the current language from a {fr, en} pair, falling back to the other one. */
  l(text: Localized | null | undefined): string {
    if (!text) return '';
    const v = text[this.lang()];
    return v && v.trim() ? v : text[this.other()] ?? '';
  }

  path(page: PageKey, slug?: string): string {
    return pagePath(this.lang(), page, slug);
  }

  /** Same page, other language — used by the language switch so the visitor never loses their place. */
  alternatePath(currentUrl: string, lang: Lang): string {
    const parsed = parsePath(currentUrl);
    if (!parsed) return `/${lang}`;
    return pagePath(lang, parsed.page, parsed.slug);
  }

  formatDate(iso: string | null | undefined, options: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' }): string {
    if (!iso) return '';
    const date = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    return new Intl.DateTimeFormat(this.locale(), options).format(date);
  }

  formatRange(start: string, end: string | null | undefined): string {
    const a = this.formatDate(start);
    const b = end ? this.formatDate(end) : this.t('common.present');
    return `${a} — ${b}`;
  }

  formatNumber(n: number): string {
    return new Intl.NumberFormat(this.locale()).format(n);
  }
}

export function interpolate(template: string, params: Params): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}
