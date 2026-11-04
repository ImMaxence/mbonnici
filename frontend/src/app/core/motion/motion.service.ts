import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Device capabilities that decide which effects are enabled (all false during SSR). */
@Injectable({ providedIn: 'root' })
export class MotionService {
  readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** prefers-reduced-motion: cursor, curtain, parallax and scenes fall back to static states. */
  readonly reduced = signal(false);
  /** A mouse / trackpad is present: custom cursor and magnetic effects make sense. */
  readonly finePointer = signal(false);
  /** Primary input is touch. */
  readonly touch = signal(false);
  /** Narrow viewport: the dock becomes a tab bar, scenes lower their particle counts. */
  readonly mobile = signal(false);

  constructor() {
    if (!this.browser) {
      return;
    }
    this.bind('(prefers-reduced-motion: reduce)', this.reduced);
    this.bind('(hover: hover) and (pointer: fine)', this.finePointer);
    this.bind('(hover: none) and (pointer: coarse)', this.touch);
    this.bind('(max-width: 719px)', this.mobile);
  }

  /** Effects budget: 1 on desktop, lower on phones, 0 when motion is reduced. */
  quality(): number {
    if (this.reduced()) return 0;
    if (this.mobile()) return 0.45;
    if (this.touch()) return 0.7;
    return 1;
  }

  private bind(query: string, target: { set(v: boolean): void }): void {
    const mq = window.matchMedia(query);
    target.set(mq.matches);
    mq.addEventListener('change', (e) => target.set(e.matches));
  }
}
