import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { MotionService } from '../../core/motion/motion.service';

export type CurtainState = 'idle' | 'covering' | 'covered' | 'revealing';

const COVER_MS = 760;
const REVEAL_MS = 820;
/** phones use a short fade instead of the sliding sheet (see CurtainComponent) */
const COVER_MS_PHONE = 320;
const REVEAL_MS_PHONE = 420;
const phone = (): boolean => matchMedia('(max-width: 719px)').matches;

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
    await wait(phone() ? COVER_MS_PHONE : COVER_MS);
    this.state.set('covered');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    try {
      await this.router.navigateByUrl(url);
    } finally {
      await frames(2);
      this.state.set('revealing');
      await wait(phone() ? REVEAL_MS_PHONE : REVEAL_MS);
      this.state.set('idle');
      this.ours = false;
    }
  }

  /**
   * From a project card to its page: instead of the curtain, the card's visual lifts off the page,
   * the rest fades to the paper colour, and the visual glides into the place of the big visual at
   * the top of the project page, which then takes over. Falls back to the curtain when the card is
   * off screen or the target is not found.
   *
   * @param source the card's <app-showcase> (cloned: its scoped styles come with its attributes)
   */
  async navigateMorph(url: string, label: string, source: HTMLElement | null): Promise<void> {
    const from = source?.getBoundingClientRect();
    if (
      !this.browser ||
      !source ||
      !from ||
      this.motion.reduced() ||
      this.state() !== 'idle' ||
      this.morphing ||
      from.bottom < 0 ||
      from.top > innerHeight ||
      typeof source.animate !== 'function'
    ) {
      return this.navigate(url, label);
    }
    if (this.router.url === url) return;
    this.morphing = true;
    this.ours = true;
    const doc = source.ownerDocument;
    const shade = doc.createElement('div');
    shade.className = 'morph-shade';
    Object.assign(shade.style, { position: 'fixed', inset: '0', zIndex: '155', background: 'var(--bg)', opacity: '0', pointerEvents: 'none' });
    const frame = doc.createElement('div');
    frame.className = 'morph-frame';
    Object.assign(frame.style, {
      position: 'fixed',
      zIndex: '156',
      left: from.left + 'px',
      top: from.top + 'px',
      width: from.width + 'px',
      height: from.height + 'px',
      overflow: 'hidden',
      pointerEvents: 'none',
      borderRadius: 'var(--radius-m)',
    });
    const clone = source.cloneNode(true) as HTMLElement;
    clone.style.width = '100%';
    clone.querySelectorAll('iframe, video').forEach((el) => el.remove());
    frame.append(clone);
    doc.body.append(shade, frame);
    const cleanup = (): void => {
      shade.remove();
      frame.remove();
      this.morphing = false;
      this.ours = false;
    };
    try {
      await shade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out', fill: 'forwards' }).finished;
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      await this.router.navigateByUrl(url);
      await frames(2);
      const target = doc.querySelector<HTMLElement>('.hero-shot app-showcase');
      const to = target?.getBoundingClientRect();
      if (!target || !to || !to.width) {
        await frame.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).finished;
      } else {
        target.style.visibility = 'hidden';
        await frame.animate(
          [
            { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' },
            { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' },
          ],
          { duration: 680, easing: 'cubic-bezier(0.65, 0, 0.2, 1)', fill: 'forwards' },
        ).finished;
        target.style.visibility = '';
        frame.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out', fill: 'forwards' });
      }
      await shade.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-out', fill: 'forwards' }).finished;
    } finally {
      cleanup();
    }
  }

  private morphing = false;

  /**
   * Navigates without the curtain because something else already covers the viewport (the phone
   * menu): the new page renders underneath and the cover is lifted afterwards by its owner.
   */
  async navigateUnder(url: string): Promise<void> {
    if (this.router.url === url) return;
    this.ours = true;
    try {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      await this.router.navigateByUrl(url);
      await frames(2);
    } finally {
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
      wait(phone() ? REVEAL_MS_PHONE : REVEAL_MS).then(() => this.state.set('idle'));
    });
  }
}
