import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from './icon.component';
import type { Visual } from './shots';

/** finds the thumbnail of image i in the page; `align` scrolls it into place first (on close) */
export type ThumbResolver = (index: number, align: boolean) => HTMLElement | null;

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/** corner radius of the picture in the viewer, px */
const RADIUS = 10;
/** corner radius of the slider thumbnails, px */
const THUMB_RADIUS = 14;

/**
 * Full-screen image viewer (a modal <dialog>: focus trap, Escape, inert page).
 *
 * The picture grows out of the thumbnail that was clicked (the crop of the thumbnail opens up into
 * the whole picture) and shrinks back into the thumbnail of the image being viewed on close.
 * Previous / next buttons, ← → Home End, swipe or drag, counter and caption. Clicking outside the
 * picture closes it. No motion with reduced motion.
 */
@Component({
  selector: 'app-lightbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe],
  template: `
    <dialog class="viewer" #dialog [attr.aria-label]="label()" (cancel)="$event.preventDefault(); close()" (keydown)="key($event)">
      <div class="shade" #shade></div>
      <div
        class="stage"
        [class.can-swipe]="images().length > 1"
        (click)="stageClick($event)"
        (pointerdown)="down($event)"
        (pointermove)="move($event)"
        (pointerup)="up($event)"
        (pointercancel)="up($event)"
      >
        @if (shown(); as img) {
          @for (v of [img]; track v.src) {
            <img #pic class="pic" [src]="v.src" [attr.srcset]="v.srcset || null" [attr.sizes]="v.srcset ? '92vw' : null" [alt]="v.alt" [width]="v.w" [height]="v.h" draggable="false" />
          }
        }
      </div>
      <div class="chrome" #chrome>
        <div class="top">
          <span class="lb-count mono" aria-live="polite">{{ pad(index() + 1) }} <i>/</i> {{ pad(images().length) }}</span>
          <button type="button" class="ctl" (click)="close()" [attr.aria-label]="'common.close' | t"><app-icon name="close" [size]="20" /></button>
        </div>
        @if (images().length > 1) {
          <button type="button" class="ctl side prev" (click)="go(index() - 1)" [disabled]="index() === 0" [attr.aria-label]="'common.previous' | t">
            <app-icon name="chevron-left" [size]="22" />
          </button>
          <button type="button" class="ctl side next" (click)="go(index() + 1)" [disabled]="index() === images().length - 1" [attr.aria-label]="'common.next' | t">
            <app-icon name="chevron-right" [size]="22" />
          </button>
        }
        @if (shown()?.alt; as alt) {
          <p class="caption">{{ alt }}</p>
        }
      </div>
    </dialog>
  `,
  styles: `
    .viewer {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      max-width: none;
      max-height: none;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: #f4f2ec;
      overflow: hidden;
      outline: none;
      cursor: default;
    }
    .viewer::backdrop {
      background: transparent;
    }
    .shade {
      position: absolute;
      inset: 0;
      background: rgba(9, 9, 10, 0.92);
      backdrop-filter: blur(16px);
    }
    .stage {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 76px clamp(16px, 7vw, 132px);
      cursor: zoom-out;
      touch-action: none;
    }
    .pic {
      display: block;
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      border-radius: ${RADIUS}px;
      box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.6);
      user-select: none;
      -webkit-user-drag: none;
      cursor: default;
    }
    .can-swipe .pic {
      cursor: grab;
    }
    .can-swipe .pic:active {
      cursor: grabbing;
    }
    .chrome {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .chrome > *,
    .top > * {
      pointer-events: auto;
    }
    .top {
      position: absolute;
      inset: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px clamp(14px, 3vw, 32px);
      pointer-events: none;
    }
    .lb-count {
      font-size: 0.8rem;
      letter-spacing: 0.08em;
      color: rgba(244, 242, 236, 0.75);
    }
    .lb-count i {
      font-style: normal;
      opacity: 0.45;
      margin: 0 0.2em;
    }
    .ctl {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
      backdrop-filter: blur(8px);
      cursor: pointer;
      transition:
        background-color 0.2s,
        border-color 0.2s,
        opacity 0.2s,
        transform 0.35s var(--ease-out);
    }
    .ctl:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.18);
      border-color: rgba(255, 255, 255, 0.32);
    }
    .ctl:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 3px;
    }
    .ctl:disabled {
      opacity: 0.25;
      cursor: default;
    }
    .side {
      position: absolute;
      top: 50%;
      width: 56px;
      height: 56px;
      margin-top: -28px;
    }
    .prev {
      left: clamp(10px, 2vw, 32px);
    }
    .next {
      right: clamp(10px, 2vw, 32px);
    }
    .prev:hover:not(:disabled) {
      transform: translateX(-3px);
    }
    .next:hover:not(:disabled) {
      transform: translateX(3px);
    }
    .caption {
      position: absolute;
      left: 50%;
      bottom: 22px;
      transform: translateX(-50%);
      width: max-content;
      max-width: min(70ch, calc(100% - 180px));
      margin: 0;
      font-size: 0.85rem;
      text-align: center;
      color: rgba(244, 242, 236, 0.7);
    }
    @media (max-width: 640px) {
      .stage {
        padding: 64px 12px 104px;
      }
      .side {
        top: auto;
        bottom: 18px;
        margin-top: 0;
        width: 50px;
        height: 50px;
      }
      .caption {
        bottom: 84px;
        max-width: calc(100% - 32px);
      }
    }
  `,
})
export class LightboxComponent {
  readonly images = input.required<Visual[]>();
  readonly label = input('');

  readonly index = signal(0);
  private readonly isOpen = signal(false);
  readonly shown = computed(() => (this.isOpen() ? (this.images()[this.index()] ?? null) : null));

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly shade = viewChild.required<ElementRef<HTMLElement>>('shade');
  private readonly chrome = viewChild.required<ElementRef<HTMLElement>>('chrome');
  private readonly pic = viewChild<ElementRef<HTMLImageElement>>('pic');
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  private thumb: ThumbResolver | null = null;
  private closing = false;
  private drag: { x: number; id: number; dx: number; captured: boolean } | null = null;
  private suppressClick = false;

  private get reduced(): boolean {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  open(index: number, thumb?: ThumbResolver): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open || !this.images()[index]) return;
    this.thumb = thumb ?? null;
    this.index.set(index);
    this.isOpen.set(true);
    // no page scroll behind; the gutter stays so nothing shifts under the picture
    this.document.documentElement.classList.add('viewer-open');
    dialog.showModal();
    this.preload();
    afterNextRender(() => this.enter(), { injector: this.injector });
  }

  close(): void {
    const dialog = this.dialog().nativeElement;
    if (!dialog.open || this.closing) return;
    this.closing = true;
    const pic = this.pic()?.nativeElement;
    const shade = this.shade().nativeElement;
    const chrome = this.chrome().nativeElement;
    const finish = (): void => {
      dialog.close();
      this.isOpen.set(false);
      this.closing = false;
      this.document.documentElement.classList.remove('viewer-open');
      [shade, chrome].forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    };
    if (this.reduced || !pic) return finish();

    pic.getAnimations().forEach((a) => a.cancel());
    // shrink back into the thumbnail of the image being viewed (the slider jumps to it first)
    const target = this.thumb?.(this.index(), true);
    const morph = target ? this.morph(pic, target) : null;
    shade.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
    chrome.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out', fill: 'forwards' });
    const anim = morph
      ? pic.animate([{ transform: 'none', clipPath: `inset(0 0 0 0 round ${RADIUS}px)`, transformOrigin: '0 0' }, morph], {
          duration: 440,
          easing: EASE,
          fill: 'forwards',
        })
      : pic.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 240, easing: 'ease-in', fill: 'forwards' });
    anim.finished.then(finish, finish);
  }

  go(i: number): void {
    const n = this.images().length;
    if (i < 0 || i >= n || i === this.index()) return;
    const dir = i > this.index() ? 1 : -1;
    this.index.set(i);
    this.preload();
    afterNextRender(
      () => {
        const pic = this.pic()?.nativeElement;
        if (!pic || this.reduced) return;
        pic.animate([{ opacity: 0, transform: `translateX(${dir * 56}px)` }, { opacity: 1, transform: 'none' }], { duration: 360, easing: EASE });
      },
      { injector: this.injector },
    );
  }

  key(e: KeyboardEvent): void {
    const n = this.images().length;
    const to =
      e.key === 'ArrowRight' ? this.index() + 1 : e.key === 'ArrowLeft' ? this.index() - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
    if (to === null) return;
    e.preventDefault();
    this.go(Math.max(0, Math.min(n - 1, to)));
  }

  stageClick(e: MouseEvent): void {
    if (this.suppressClick) return;
    // outside the picture
    if (e.target === e.currentTarget) this.close();
  }

  // ── swipe / drag ─────────────────────────────────────────────────────────
  down(e: PointerEvent): void {
    if (e.button !== 0 || this.images().length < 2 || this.closing) return;
    this.drag = { x: e.clientX, id: e.pointerId, dx: 0, captured: false };
  }

  move(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    d.dx = e.clientX - d.x;
    if (!d.captured && Math.abs(d.dx) > 6) {
      d.captured = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    const pic = this.pic()?.nativeElement;
    if (d.captured && pic) {
      // resist at both ends
      const edge = (d.dx > 0 && this.index() === 0) || (d.dx < 0 && this.index() === this.images().length - 1);
      const x = edge ? d.dx * 0.25 : d.dx;
      pic.style.transform = `translateX(${x}px)`;
      pic.style.opacity = String(1 - Math.min(0.5, Math.abs(x) / 900));
    }
  }

  up(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    if (!d.captured) return;
    this.suppressClick = true;
    setTimeout(() => (this.suppressClick = false), 60);
    const pic = this.pic()?.nativeElement;
    const from = pic?.style.transform ?? '';
    if (pic) {
      pic.style.transform = '';
      pic.style.opacity = '';
    }
    const n = this.images().length;
    if (d.dx < -70 && this.index() < n - 1) return this.go(this.index() + 1);
    if (d.dx > 70 && this.index() > 0) return this.go(this.index() - 1);
    if (pic && from && !this.reduced) {
      pic.animate([{ transform: from }, { transform: 'none' }], { duration: 300, easing: EASE });
    }
  }

  // ── internals ────────────────────────────────────────────────────────────
  private enter(): void {
    const pic = this.pic()?.nativeElement;
    if (!pic || this.reduced) return;
    this.shade().nativeElement.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: 'ease-out' });
    this.chrome().nativeElement.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 220, easing: 'ease-out', fill: 'backwards' });
    const origin = this.thumb?.(this.index(), false);
    const morph = origin ? this.morph(pic, origin) : null;
    if (morph) {
      pic.animate([morph, { transform: 'none', clipPath: `inset(0 0 0 0 round ${RADIUS}px)`, transformOrigin: '0 0' }], { duration: 560, easing: EASE });
    } else {
      pic.animate([{ opacity: 0, transform: 'scale(0.94)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: EASE });
    }
  }

  /**
   * Keyframe that lays the picture exactly over a thumbnail showing it with object-fit: cover
   * (anchored top centre): scaled to the thumbnail, clipped to the part the thumbnail shows.
   */
  private morph(pic: HTMLElement, thumb: HTMLElement): Keyframe | null {
    const to = pic.getBoundingClientRect();
    const from = thumb.getBoundingClientRect();
    if (!to.width || !to.height || !from.width || !from.height) return null;
    if (from.bottom < 0 || from.top > innerHeight || from.right < 0 || from.left > innerWidth) return null;
    const r = to.width / to.height;
    const t = from.width / from.height;
    const fx = r > t ? t / r : 1; // visible share of the width (wide pictures are cropped on both sides)
    const fy = r > t ? 1 : r / t; // visible share of the height (tall pictures are cropped at the bottom)
    const s = from.width / (to.width * fx);
    const side = ((1 - fx) / 2) * 100;
    const tx = from.left - to.left - ((to.width * (1 - fx)) / 2) * s;
    const ty = from.top - to.top;
    return {
      transform: `translate(${tx}px, ${ty}px) scale(${s})`,
      clipPath: `inset(0 ${side}% ${(1 - fy) * 100}% ${side}% round ${THUMB_RADIUS / s}px)`,
      transformOrigin: '0 0',
    };
  }

  private preload(): void {
    const imgs = this.images();
    for (const j of [this.index() - 1, this.index() + 1]) {
      const v = imgs[j];
      if (v) {
        const im = new Image();
        im.decoding = 'async';
        im.src = v.src;
      }
    }
  }
}
