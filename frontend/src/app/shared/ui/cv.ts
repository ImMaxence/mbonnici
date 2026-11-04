import type { Settings } from '../../core/api/models';
import type { Lang } from '../../core/i18n/routes';

/** The resume a visitor gets: the one in their language, else the other one (see CvService). */
export interface CvLink {
  href: string;
  /** "182 ko", "1,4 Mo" */
  size: string;
  /** language of the file served */
  lang: Lang;
}

export function cvLink(settings: Settings | null | undefined, lang: Lang, locale: string, download = true): CvLink | null {
  const cv = settings?.cv;
  const served: Lang | null = cv?.[lang] != null ? lang : cv?.[lang === 'fr' ? 'en' : 'fr'] != null ? (lang === 'fr' ? 'en' : 'fr') : null;
  if (served == null) return null;
  const bytes = cv![served]!.size;
  const mega = bytes >= 1_000_000;
  const size = new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: mega ? 'megabyte' : 'kilobyte',
    maximumFractionDigits: mega ? 1 : 0,
  }).format(mega ? bytes / 1_000_000 : Math.max(1, bytes / 1000));
  return { href: `/api/cv?lang=${lang}${download ? '&download=true' : ''}`, size, lang: served };
}
