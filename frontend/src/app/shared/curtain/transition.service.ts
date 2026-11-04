import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { MotionService } from '../../core/motion/motion.service';

export type CurtainState = 'idle' | 'covering' | 'covered' | 'revealing';

const COVER_MS = 760;
const REVEAL_MS = 820;

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const frames = (n: number): Promise<void> =>
  new Promise((resolve) => {
    const step = (): void => {
      if (n-- <= 0) {
        resolve();
      } else {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  });

/**
 * Cinematic page transitions: the curtain closes over the old page, the router navigates while
 * the viewport is covered, the new page gets a frame to render, then the curtain opens.
 */
@Injectable({ providedIn: 'root' })
export class TransitionService {
  private readonly router = inject(Router);
  private readonly motion = inject(MotionService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly state = signal<CurtainState>('idle');
  readonly label = signal('');
  private ours = false;
  /** the very first navigation is the server-rendered page itself: nothing to cover */
  private first = true;

  async navigate(url: string, label = ''): Promise<void> {
    if (!this.browser || this.motion.reduced() || this.state() !== 'idle') {
      await this.router.navigateByUrl(url);
      return;
    }
    if (this.router.url === url) return;
    this.ours = true;
    this.label.set(label);
    this.state.set('covering');
    await wait(COVER_MS);
    this.state.set('covered');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    try {
      await this.router.navigateByUrl(url);
    } finally {
      await frames(2);
      this.state.set('revealing');
      await wait(REVEAL_MS);
      this.state.set('idle');
      this.ours = false;
    }
  }

  /** Called by the root component: back/forward navigations get a quick reveal only. */
  onNavigationEnd(): void {
    if (this.first) {
      this.first = false;
      return;
    }
    if (!this.browser || this.ours || this.motion.reduced()) return;
    if (this.state() !== 'idle') return;
    this.label.set('');
    this.state.set('covered');
    frames(2).then(() => {
      this.state.set('revealing');
      wait(REVEAL_MS).then(() => this.state.set('idle'));
    });
  }
}
