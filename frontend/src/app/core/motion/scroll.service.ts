import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RafService } from './raf.service';
import { damp } from './physics';

/**
 * Native scrolling stays untouched (accessibility, find-in-page, keyboard), but we expose a
 * smoothed scroll value, velocity and progress for parallax and scroll-linked scenes.
 */
@Injectable({ providedIn: 'root' })
export class ScrollService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly raf = inject(RafService);

  /** instantaneous window.scrollY */
  y = 0;
  /** damped scrollY, lags a little behind for a Locomotive-like feel */
  smooth = 0;
  /** px per second, signed */
  velocity = 0;
  /** 0 … 1 across the whole document */
  progress = 0;
  direction: 1 | -1 = 1;

  /** Signal for the few places that need change detection (scroll indicator, header). */
  readonly scrolled = signal(false);
  /** the header slides away while reading downwards and comes back as soon as the visitor scrolls up */
  readonly headerHidden = signal(false);

  private started = false;
  private lastY = 0;
  private stop: (() => void) | null = null;

  start(): void {
    if (!this.browser || this.started) {
      return;
    }
    this.started = true;
    this.y = window.scrollY;
    this.smooth = this.y;
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.stop = this.raf.add((dt) => {
      this.smooth = damp(this.smooth, this.y, 10, dt);
      this.velocity = damp(this.velocity, (this.y - this.lastY) / Math.max(dt, 0.001), 10, dt);
      this.lastY = this.y;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      this.progress = Math.min(1, Math.max(0, this.y / max));
    });
  }

  destroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    this.stop?.();
    this.started = false;
  }

  /** forces the header back (menu opened, navigation…) */
  setHidden(hidden: boolean): void {
    if (hidden !== this.headerHidden()) this.headerHidden.set(hidden);
  }

  private readonly onScroll = (): void => {
    const y = window.scrollY;
    this.direction = y >= this.y ? 1 : -1;
    const delta = y - this.y;
    this.y = y;
    if (y < 160) {
      this.setHidden(false);
    } else if (delta > 4) {
      this.setHidden(true);
    } else if (delta < -4) {
      this.setHidden(false);
    }
    const scrolled = y > 24;
    if (scrolled !== this.scrolled()) {
      this.scrolled.set(scrolled);
    }
  };
}
