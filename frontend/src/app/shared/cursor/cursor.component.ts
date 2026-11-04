import { DOCUMENT, Component, DestroyRef, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { damp } from '../../core/motion/physics';
import { PointerService } from '../../core/motion/pointer.service';
import { RafService } from '../../core/motion/raf.service';
import { CursorService } from './cursor.service';

/**
 * Two-layer custom cursor: a crisp dot that tracks the pointer tightly and a soft ring that lags,
 * grows on links, morphs into a label pill ("View", "Drag") and snaps around magnetic elements.
 * Only instantiated on devices with a fine pointer and without reduced-motion.
 */
@Component({
  selector: 'app-cursor',
  template: `
    <div class="dot" #dot></div>
    <div class="ring" #ring>
      <span class="label">{{ cursor.label() }}</span>
    </div>
  `,
  host: {
    '[attr.data-mode]': 'cursor.mode()',
    'aria-hidden': 'true',
  },
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      pointer-events: none;
      contain: strict;
    }
    .dot,
    .ring {
      position: absolute;
      top: 0;
      left: 0;
      will-change: transform, width, height, opacity;
    }
    .dot {
      width: 8px;
      height: 8px;
      margin: -4px 0 0 -4px;
      border-radius: 50%;
      background: var(--fg);
      mix-blend-mode: difference;
      transition: opacity 0.2s, transform 0.2s var(--ease-out);
    }
    .ring {
      width: 40px;
      height: 40px;
      margin: -20px 0 0 -20px;
      border-radius: 999px;
      border: 1.5px solid var(--fg);
      opacity: 0.55;
      display: grid;
      place-items: center;
      transition:
        width 0.35s var(--ease-spring),
        height 0.35s var(--ease-spring),
        margin 0.35s var(--ease-spring),
        opacity 0.25s,
        background-color 0.25s,
        border-color 0.25s,
        border-radius 0.35s var(--ease-out);
    }
    .label {
      font: 600 11px/1 var(--font-body);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--bg);
      opacity: 0;
      transform: scale(0.6);
      transition: opacity 0.2s, transform 0.3s var(--ease-spring);
      white-space: nowrap;
    }
    :host([data-mode='hidden']) .dot,
    :host([data-mode='hidden']) .ring {
      opacity: 0;
    }
    :host([data-mode='link']) .ring {
      width: 56px;
      height: 56px;
      margin: -28px 0 0 -28px;
      opacity: 0.9;
      background: color-mix(in srgb, var(--fg) 8%, transparent);
    }
    :host([data-mode='text']) .dot {
      transform: scaleX(0.3) scaleY(2.6);
    }
    :host([data-mode='text']) .ring {
      opacity: 0;
    }
    :host([data-mode='label']) .ring,
    :host([data-mode='drag']) .ring {
      width: 84px;
      height: 84px;
      margin: -42px 0 0 -42px;
      background: var(--fg);
      border-color: var(--fg);
      opacity: 1;
    }
    :host([data-mode='label']) .label,
    :host([data-mode='drag']) .label {
      opacity: 1;
      transform: scale(1);
    }
    :host([data-mode='label']) .dot,
    :host([data-mode='drag']) .dot {
      opacity: 0;
    }
    :host(.is-magnet) .ring {
      transition: none;
      border-radius: var(--magnet-radius, 14px);
      opacity: 0.9;
      background: color-mix(in srgb, var(--fg) 6%, transparent);
    }
    :host(.is-down) .ring {
      transform: scale(0.85);
    }
  `,
})
export class CursorComponent {
  readonly cursor = inject(CursorService);
  private readonly pointer = inject(PointerService);
  private readonly raf = inject(RafService);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dot = viewChild.required<ElementRef<HTMLDivElement>>('dot');
  private readonly ring = viewChild.required<ElementRef<HTMLDivElement>>('ring');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.document.documentElement.classList.add('has-cursor');
      let rx = this.pointer.x;
      let ry = this.pointer.y;
      let rw = 40;
      let rh = 40;
      const dot = this.dot().nativeElement;
      const ring = this.ring().nativeElement;
      const host = this.host.nativeElement;
      const stop = this.raf.add((dt) => {
        if (!this.pointer.active) {
          if (this.cursor.mode() !== 'hidden') this.cursor.mode.set('hidden');
          return;
        }
        if (this.cursor.mode() === 'hidden') this.cursor.mode.set('default');

        dot.style.transform = `translate3d(${this.pointer.x}px, ${this.pointer.y}px, 0)`;

        const magnet = this.cursor.magnet;
        if (magnet) {
          rx = damp(rx, magnet.x, 22, dt);
          ry = damp(ry, magnet.y, 22, dt);
          rw = damp(rw, magnet.w, 22, dt);
          rh = damp(rh, magnet.h, 22, dt);
          host.classList.add('is-magnet');
          host.style.setProperty('--magnet-radius', `${magnet.radius}px`);
          ring.style.width = `${rw}px`;
          ring.style.height = `${rh}px`;
          ring.style.margin = `${-rh / 2}px 0 0 ${-rw / 2}px`;
        } else {
          if (host.classList.contains('is-magnet')) {
            host.classList.remove('is-magnet');
            ring.style.width = '';
            ring.style.height = '';
            ring.style.margin = '';
            rw = 40;
            rh = 40;
          }
          rx = damp(rx, this.pointer.x, 16, dt);
          ry = damp(ry, this.pointer.y, 16, dt);
        }
        ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
        host.classList.toggle('is-down', this.pointer.down);
      });

      const onOver = (e: Event): void => {
        const target = e.target as HTMLElement | null;
        if (!target || this.cursor.magnet) return;
        if (target.closest('[data-cursor]')) return; // handled by appCursor directive
        if (target.closest('input, textarea, [contenteditable="true"]')) {
          this.cursor.set('text');
        } else if (target.closest('a, button, [role="button"], label, select, summary')) {
          this.cursor.set('link');
        } else if (this.cursor.mode() === 'link' || this.cursor.mode() === 'text') {
          this.cursor.reset();
        }
      };
      this.document.addEventListener('pointerover', onOver, { passive: true });

      destroyRef.onDestroy(() => {
        stop();
        this.document.removeEventListener('pointerover', onOver);
        this.document.documentElement.classList.remove('has-cursor');
      });
    });
  }
}
