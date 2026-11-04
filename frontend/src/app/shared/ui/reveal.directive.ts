import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';
import { MotionService } from '../../core/motion/motion.service';

/** Hydration later than this after navigation start means a slow device: no entrance choreography. */
const FAST_HYDRATION_MS = 1800;

/**
 * Reveals the host when it scrolls into view. With `revealSplit="words"` the text is wrapped
 * word by word so each one rises from a masked line (Awwwards-style).
 *
 * Server-rendered HTML stays fully visible until the app hydrates (the `js` class on <html> is
 * added by the root component). Elements already in the viewport at that moment play their
 * entrance only when hydration was quick; on slow devices they are shown as-is so the largest
 * contentful paint is never delayed by an animation.
 */
@Directive({
  selector: '[appReveal]',
  host: {
    'data-reveal': '',
    '[style.--reveal-delay]': 'revealDelay() + "ms"',
  },
})
export class RevealDirective {
  readonly revealDelay = input(0);
  readonly revealSplit = input<'words' | 'none'>('none');
  readonly revealOnce = input(true);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly motion = inject(MotionService);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.el.nativeElement;
      if (this.motion.reduced() || typeof IntersectionObserver === 'undefined') {
        el.classList.add('is-in', 'no-anim');
        return;
      }
      if (this.revealSplit() === 'words') {
        this.splitWords(el);
      }

      const rect = el.getBoundingClientRect();
      const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
      if (inViewport) {
        if (performance.now() > FAST_HYDRATION_MS) {
          el.classList.add('is-in', 'no-anim');
        } else {
          // let the hidden state apply for one frame so the entrance animation plays
          requestAnimationFrame(() => el.classList.add('is-in'));
        }
        if (this.revealOnce()) return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              el.classList.add('is-in');
              if (this.revealOnce()) observer.disconnect();
            } else if (!this.revealOnce()) {
              el.classList.remove('is-in');
            }
          }
        },
        { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
      );
      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private splitWords(root: HTMLElement): void {
    root.classList.add('split');
    let index = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.textContent && node.textContent.trim()) textNodes.push(node);
    }
    for (const node of textNodes) {
      // Gradient text (background-clip: text) cannot sit on a composited, transform-animated
      // element in Chromium: for those words the mask animates and the inner span stays static.
      const gradient = !!node.parentElement?.closest('.gradient-text');
      const parts = node.textContent!.split(/(\s+)/);
      const frag = document.createDocumentFragment();
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(' '));
          continue;
        }
        const mask = document.createElement('span');
        mask.className = gradient ? 'w w-mask-anim' : 'w';
        const inner = document.createElement('span');
        inner.textContent = part;
        const i = String(index++);
        inner.style.setProperty('--i', i);
        mask.style.setProperty('--i', i);
        mask.appendChild(inner);
        frag.appendChild(mask);
      }
      node.replaceWith(frag);
    }
  }
}
