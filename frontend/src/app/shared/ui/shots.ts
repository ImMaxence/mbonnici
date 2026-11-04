import { SHOTS } from './shots.generated';

export interface Shot {
  src: string;
  w: number;
  h: number;
}

/** Default visuals of a project, captured from its README or live site (scripts/project-shots.mjs). */
export interface ProjectShots {
  desktop?: Shot;
  mobile?: Shot;
  gallery: Shot[];
  /** the desktop image is already a composed presentation (no device frame around it) */
  poster?: boolean;
}

export function shotsFor(slug: string): ProjectShots {
  return SHOTS[slug] ?? { gallery: [] };
}

/** What a mock-up shows: an uploaded media (back office) wins over the default capture. */
export interface Visual {
  src: string;
  w: number;
  h: number;
  alt: string;
}

export function fromMedia(m: { url: string; width: number | null; height: number | null } | null | undefined, alt: string): Visual | null {
  return m ? { src: m.url, w: m.width ?? 1600, h: m.height ?? 1000, alt } : null;
}

export function fromShot(s: Shot | undefined, alt: string): Visual | null {
  return s ? { ...s, alt } : null;
}

/** A default capture dressed as a media, for components that take back-office media (iPhone carousel). */
export function shotAsMedia(s: Shot, alt: string): import('../../core/api/models').MediaDto {
  return {
    id: s.src,
    url: s.src,
    contentType: 'image/webp',
    width: s.w,
    height: s.h,
    blurDataUrl: null,
    alt: { fr: alt, en: alt },
    sizeBytes: 0,
    originalFilename: null,
    createdAt: '',
  };
}
