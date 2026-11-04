import { DOCUMENT, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type FrameCallback = (dt: number, time: number) => void;

/**
 * One requestAnimationFrame loop for the whole app. Subscribers get a clamped dt (seconds) and
 * the loop stops itself when nobody is listening or the tab is hidden.
 */
@Injectable({ providedIn: 'root' })
export class RafService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private readonly callbacks = new Set<FrameCallback>();
  private handle = 0;
  private last = 0;
  private paused = false;

  constructor() {
    if (this.browser) {
      this.document.addEventListener('visibilitychange', () => {
        this.paused = this.document.hidden;
        if (this.paused) {
          this.stop();
        } else {
          this.last = 0;
          this.start();
        }
      });
    }
  }

  /** Registers a per-frame callback and returns its unsubscribe function. */
  add(callback: FrameCallback): () => void {
    if (!this.browser) {
      return () => {};
    }
    this.callbacks.add(callback);
    this.start();
    return () => {
      this.callbacks.delete(callback);
      if (this.callbacks.size === 0) {
        this.stop();
      }
    };
  }

  private start(): void {
    if (this.handle || this.paused || this.callbacks.size === 0) {
      return;
    }
    this.handle = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (this.handle) {
      cancelAnimationFrame(this.handle);
      this.handle = 0;
    }
  }

  private readonly tick = (now: number): void => {
    this.handle = 0;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    const time = now / 1000;
    for (const cb of this.callbacks) {
      try {
        cb(dt, time);
      } catch (error) {
        console.error('[raf]', error);
      }
    }
    if (this.callbacks.size > 0 && !this.paused) {
      this.handle = requestAnimationFrame(this.tick);
    }
  };
}
