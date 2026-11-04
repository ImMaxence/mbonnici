import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from './icon.component';
import type { Visual } from './shots';

/**
 * Image slider built on native horizontal scrolling with scroll-snap: touch swipes, trackpads and
 * keyboard work out of the box; mouse users can also drag, use the arrows or the counter dots.
 */
@Component({
  selector: 'app-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  template: `
    <div class="slider" role="region" [attr.aria-roledescription]="'project.carousel' | t" [attr.aria-label]="label()">
      <div
        class="track"
        #track
        tabindex="0"
        (scroll)="onScroll()"
        (pointerdown)="down($event)"
        (pointermove)="move($event)"
        (pointerup)="up($event)"
        (pointercancel)="up($event)"
        (keydown.arrowRight)="$event.preventDefault(); go(index() + 1)"
        (keydown.arrowLeft)="$event.preventDefault(); go(index() - 1)"
      >
        @for (img of images(); track img.src; let i = $index) {
          <figure class="slide" role="group" [attr.aria-roledescription]="'project.slide' | t" [attr.aria-label]="'project.slideOf' | t: { n: i + 1, total: images().length }">
            <button type="button" class="open" (click)="clicked(i)" [attr.aria-label]="('common.open' | t) + ' — ' + img.alt" tabindex="-1">
              <img [src]="img.src" [alt]="img.alt" [width]="img.w" [height]="img.h" loading="lazy" decoding="async" draggable="false" />
            </button>
          </figure>
        }
      </div>
      @if (images().length > 1) {
        <div class="controls">
          <span class="count mono" aria-live="polite">{{ pad(index() + 1) }} <i>/</i> {{ pad(images().length) }}</span>
          <div class="bar" aria-hidden="true"><i [style.--p]="(index() + 1) / images().length"></i></div>
          <div class="arrows">
            <button type="button" class="arrow" (click)="go(index() - 1)" [disabled]="index() === 0" [attr.aria-label]="'common.previous' | t">
              <app-icon name="arrow-right" [size]="18" style="transform: scaleX(-1)" />
            </button>
            <button type="button" class="arrow" (click)="go(index() + 1)" [disabled]="index() === images().length - 1" [attr.aria-label]="'common.next' | t">
              <app-icon name="arrow-right" [size]="18" />
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .track {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: min(86%, 1100px);
      gap: clamp(0.75rem, 2vw, 1.5rem);
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scroll-padding-inline: var(--gutter);
      padding-inline: var(--gutter);
      scrollbar-width: none;
      cursor: grab;
      outline: none;
      overscroll-behavior-x: contain;
    }
    .track::-webkit-scrollbar {
      display: none;
    }
    .track:focus-visible {
      box-shadow: inset 0 0 0 2px var(--accent);
    }
    .track.is-dragging {
      cursor: grabbing;
      scroll-snap-type: none;
    }
    .slide {
      scroll-snap-align: start;
      margin: 0;
    }
    .open {
      display: block;
      width: 100%;
      border-radius: var(--radius-m);
      overflow: hidden;
      background: var(--bg-3);
      box-shadow: 0 0 0 1px var(--line);
    }
    .open img {
      width: 100%;
      height: auto;
      aspect-ratio: 16 / 10;
      object-fit: cover;
      object-position: top center;
      user-select: none;
      transition: transform 1.2s var(--ease-out);
    }
    .open:hover img {
      transform: scale(1.02);
    }
    .controls {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: var(--space-5);
      width: min(100% - 2 * var(--gutter), var(--container));
      margin: var(--space-5) auto 0;
    }
    .count {
      font-size: var(--fs-small);
      color: var(--fg-2);
    }
    .count i {
      font-style: normal;
      opacity: 0.4;
      margin: 0 0.3em;
    }
    .bar {
      height: 1px;
      background: var(--line-strong);
      overflow: hidden;
    }
    .bar i {
      display: block;
      height: 100%;
      background: var(--fg);
      transform-origin: 0 50%;
      transform: scaleX(var(--p));
      transition: transform 0.6s var(--ease-out);
    }
    .arrows {
      display: flex;
      gap: 0.5rem;
    }
    .arrow {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 1px solid var(--line-strong);
      transition:
        background-color var(--dur-1),
        color var(--dur-1),
        opacity var(--dur-1);
    }
    .arrow:hover:not([disabled]) {
      background: var(--fg);
      color: var(--bg);
    }
    .arrow[disabled] {
      opacity: 0.35;
    }
  `,
})
export class SliderComponent {
  readonly images = input.required<Visual[]>();
  readonly label = input('');
  readonly opened = output<number>();

  readonly index = signal(0);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private drag: { x: number; left: number; id: number; moved: boolean } | null = null;
  private suppressClick = false;

  constructor() {
    afterNextRender(() => this.onScroll());
    inject(DestroyRef).onDestroy(() => (this.drag = null));
  }

  pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  go(i: number): void {
    const el = this.track().nativeElement;
    const slides = el.querySelectorAll<HTMLElement>('.slide');
    const target = slides[Math.max(0, Math.min(slides.length - 1, i))];
    if (!target) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: target.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft), behavior: reduced ? 'auto' : 'smooth' });
  }

  onScroll(): void {
    const el = this.track().nativeElement;
    const slides = Array.from(el.querySelectorAll<HTMLElement>('.slide'));
    if (!slides.length) return;
    const pad = parseFloat(getComputedStyle(el).paddingLeft);
    let best = 0;
    let dist = Infinity;
    slides.forEach((s, i) => {
      const d = Math.abs(s.offsetLeft - el.offsetLeft - pad - el.scrollLeft);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) best = slides.length - 1;
    if (best !== this.index()) this.index.set(best);
  }

  down(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    this.drag = { x: e.clientX, left: this.track().nativeElement.scrollLeft, id: e.pointerId, moved: false };
  }

  move(e: PointerEvent): void {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const dx = e.clientX - this.drag.x;
    const el = this.track().nativeElement;
    if (!this.drag.moved && Math.abs(dx) > 5) {
      this.drag.moved = true;
      el.classList.add('is-dragging');
      el.setPointerCapture(e.pointerId);
    }
    if (this.drag.moved) el.scrollLeft = this.drag.left - dx;
  }

  up(e: PointerEvent): void {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const el = this.track().nativeElement;
    const moved = this.drag.moved;
    this.drag = null;
    if (!moved) return;
    el.classList.remove('is-dragging');
    this.suppressClick = true;
    setTimeout(() => (this.suppressClick = false), 50);
    // snap to the slide closest to where the drag ended
    this.onScroll();
    this.go(this.index());
  }

  clicked(i: number): void {
    if (this.suppressClick) return;
    this.opened.emit(i);
  }
}
