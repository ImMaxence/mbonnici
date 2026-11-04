/** What a mock-up shows: a media of the back office (or a placeholder). */
export interface Visual {
  src: string;
  w: number;
  h: number;
  alt: string;
  /** phone capture without a status bar: the mock-up draws one */
  bare?: boolean;
  /** smaller copies ("url 640w, …") for the browser to pick from */
  srcset?: string | null;
  /** object-position from the focal point chosen in the back office ("50% 0%") */
  pos?: string;
}

interface MediaLike {
  url: string;
  width: number | null;
  height: number | null;
  srcset?: string | null;
  focalX?: number;
  focalY?: number;
}

export function fromMedia(m: MediaLike | null | undefined, alt: string): Visual | null {
  return m
    ? { src: m.url, w: m.width ?? 1600, h: m.height ?? 1000, alt, srcset: m.srcset ?? null, pos: focalPosition(m) }
    : null;
}

/** CSS object-position of a media's focal point (top centre by default). */
export function focalPosition(m: { focalX?: number; focalY?: number } | null | undefined): string {
  const x = m?.focalX ?? 0.5;
  const y = m?.focalY ?? 0;
  return `${Math.round(x * 100)}% ${Math.round(y * 100)}%`;
}
