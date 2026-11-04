/** What a mock-up shows: a media of the back office (or a placeholder). */
export interface Visual {
  src: string;
  w: number;
  h: number;
  alt: string;
  /** phone capture without a status bar: the mock-up draws one */
  bare?: boolean;
}

export function fromMedia(m: { url: string; width: number | null; height: number | null } | null | undefined, alt: string): Visual | null {
  return m ? { src: m.url, w: m.width ?? 1600, h: m.height ?? 1000, alt } : null;
}
