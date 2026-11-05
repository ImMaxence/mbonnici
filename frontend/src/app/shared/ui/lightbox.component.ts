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
import { AutoplayDirective } from './autoplay.directive';

/** finds the thumbnail of image i in the page; `align` scrolls it into place first (on close) */
export type ThumbResolver = (index: number, align: boolean) => HTMLElement | null;

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/** corner radius of the picture in the viewer, px */
const RADIUS = 10;
/** corner radius of the slider thumbnails, px */
const THUMB_RADIUS = 14;
/** largest zoom, and the one a double tap / double click jumps to */
const MAX_ZOOM = 5;
const TAP_ZOOM = 2.5;

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/**
 * Full-screen image viewer (a modal <dialog>: focus trap, Escape, inert page).
 *
 * The picture grows out of the thumbnail that was clicked (the crop of the thumbnail opens up into
 * the whole picture) and shrinks back into the thumbnail of the image being viewed on close.
 * Previous / next buttons, ← → Home End, swipe or drag, counter and caption. Clicking outside the
 * picture closes it. No motion with reduced motion.
 *
 * Zoom (the stage takes every gesture, so the browser's own pinch cannot work here): pinch, double
 * tap / double click, mouse wheel, the magnifier button or + − 0. A zoomed picture is panned with
 * one finger, the mouse or the arrows; swiping to another picture waits until it is fitted again.
 */
@Component({
  selector: 'app-lightbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslatePipe, AutoplayDirective],
  template: `
    <dialog class="viewer" #dialog [class.is-zoomed]="zoomed()" [attr.aria-label]="label()" (cancel)="$event.preventDefault(); close()" (keydown)="key($event)">
      <div class="shade" #shade></div>
      <div
        class="stage"
        [class.can-swipe]="images().length > 1"
        (click)="stageClick($event)"
        (pointerdown)="down($event)"
        (pointermove)="move($event)"
        (pointerup)="up($event)"
        (pointercancel)="up($event)"
        (wheel)="wheel($event)"
        (dblclick)="dbl($event)"
        [class.zoomed]="zoomed()"
      >
        @if (shown(); as img) {
          @for (v of [img]; track v.src) {
            @if (v.video) {
              <video #pic class="pic" appAutoplay loop preload="auto" [src]="v.src" [attr.poster]="v.poster || null" [attr.aria-label]="v.alt" [attr.width]="v.w" [attr.height]="v.h"></video>
            } @else {
              <img #pic class="pic" [src]="v.src" [attr.srcset]="v.srcset || null" [attr.sizes]="v.srcset ? '92vw' : null" [alt]="v.alt" [width]="v.w" [height]="v.h" draggable="false" />
            }
          }
        }
      </div>
      <div class="chrome" #chrome>
        <div class="top">
          <span class="lb-count mono" aria-live="polite">{{ pad(index() + 1) }} <i>/</i> {{ pad(images().length) }}</span>
          <span class="top-actions">
            <button type="button" class="ctl" (click)="toggleZoom()" [attr.aria-label]="(zoomed() ? 'project.zoomOut' : 'project.zoomIn') | t">
              <app-icon [name]="zoomed() ? 'zoom-out' : 'zoom-in'" [size]="20" />
            </button>
            <button type="button" class="ctl" (click)="close()" [attr.aria-label]="'common.close' | t"><app-icon name="close" [size]="20" /></button>
          </span>
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
    .pic {
      transform-origin: 0 0;
    }
    .zoomed .pic {
      cursor: grab;
    }
    .zoomed .pic:active {
      cursor: grabbing;
    }
    .top-actions {
      display: flex;
      gap: 0.5rem;
    }
    .chrome {
      position: absolute;
      z-index: 1;
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
    /* over a zoomed picture the counter and the caption sit on a dark pill too */
    .is-zoomed .lb-count,
    .is-zoomed .caption {
      padding: 0.35rem 0.7rem;
      border-radius: 99px;
      background: rgba(16, 16, 18, 0.72);
      backdrop-filter: blur(8px);
      color: rgba(244, 242, 236, 0.92);
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
      /* dark and nearly opaque: readable over the shade and over a zoomed picture alike */
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: rgba(16, 16, 18, 0.72);
      color: inherit;
      backdrop-filter: blur(8px);
      cursor: pointer;
      transition:
        background-color 0.2s,
        border-color 0.2s,
        opacity 0.2s,
        transform 0.35s var(--ease-out);
    }
    @media (hover: hover) {
      .ctl:hover:not(:disabled) {
        background: rgba(44, 44, 48, 0.86);
        border-color: rgba(255, 255, 255, 0.32);
      }
    }
    .ctl:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 3px;
    }
    /* dimmed icon, solid knob: still reads as a button over a light picture */
    .ctl:disabled {
      color: rgba(244, 242, 236, 0.3);
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
    @media (hover: hover) {
      .prev:hover:not(:disabled) {
        transform: translateX(-3px);
      }
    }
    @media (hover: hover) {
      .next:hover:not(:disabled) {
        transform: translateX(3px);
      }
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
  private readonly pic = viewChild<ElementRef<HTMLElement>>('pic');
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  private thumb: ThumbResolver | null = null;
  private closing = false;
  private drag: { x: number; id: number; dx: number; captured: boolean } | null = null;
  private suppressClick = false;

  /** zoom: scale and translation of the picture (transform-origin top left), 1 = fitted */
  private z = { s: 1, x: 0, y: 0 };
  readonly zoomed = signal(false);
  /** fingers / pointers currently on the stage */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinch: { d: number; s: number; u: { x: number; y: number } } | null = null;
  private pan: { id: number; x: number; y: number; zx: number; zy: number; moved: boolean } | null = null;
  private lastTap = { t: 0, x: 0, y: 0 };

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
    this.resetZoom(false);
    this.pointers.clear();
    this.pinch = this.pan = null;
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
    this.resetZoom(false);
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
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      return this.zoomAt(this.z.s * 1.5, null, true);
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      return this.zoomAt(this.z.s / 1.5, null, true);
    }
    if (e.key === '0') return this.resetZoom(true);
    // arrows pan a zoomed picture instead of changing it
    if (this.zoomed() && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = 80;
      const dx = e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0;
      const dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
      return this.apply({ s: this.z.s, x: this.z.x + dx, y: this.z.y + dy }, true);
    }
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

  // ── pointers: swipe between pictures, or pinch / pan / double tap to zoom ──
  down(e: PointerEvent): void {
    if (e.button !== 0 || this.closing) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      // a second finger: pinch (a swipe in progress is dropped)
      this.cancelSwipe();
      this.pan = null;
      const [p, q] = [...this.pointers.values()];
      const base = this.base();
      if (!base) return;
      const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
      this.pinch = {
        d: Math.hypot(p.x - q.x, p.y - q.y) || 1,
        s: this.z.s,
        u: { x: (m.x - base.left - this.z.x) / this.z.s, y: (m.y - base.top - this.z.y) / this.z.s },
      };
      return;
    }
    if (this.pointers.size > 2) return;
    if (this.zoomed()) {
      this.pan = { id: e.pointerId, x: e.clientX, y: e.clientY, zx: this.z.x, zy: this.z.y, moved: false };
      return;
    }
    if (this.images().length < 2) return;
    this.drag = { x: e.clientX, id: e.pointerId, dx: 0, captured: false };
  }

  move(e: PointerEvent): void {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.pointers.size === 2) {
      const [p, q] = [...this.pointers.values()];
      const base = this.base();
      if (!base) return;
      const s = clamp(this.pinch.s * (Math.hypot(p.x - q.x, p.y - q.y) / this.pinch.d), 1, MAX_ZOOM);
      const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
      // the point between the fingers stays between the fingers
      this.apply({ s, x: m.x - base.left - this.pinch.u.x * s, y: m.y - base.top - this.pinch.u.y * s }, false);
      return;
    }
    const pan = this.pan;
    if (pan && e.pointerId === pan.id) {
      const dx = e.clientX - pan.x;
      const dy = e.clientY - pan.y;
      if (!pan.moved && Math.hypot(dx, dy) > 4) {
        pan.moved = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
      if (pan.moved) this.apply({ s: this.z.s, x: pan.zx + dx, y: pan.zy + dy }, false);
      return;
    }
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    d.dx = e.clientX - d.x;
    if (!d.captured && Math.abs(d.dx) > 6) {
      d.captured = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    const pic = this.pic()?.nativeElement;
    if (pic) pic.style.transition = '';
    if (d.captured && pic) {
      // resist at both ends
      const edge = (d.dx > 0 && this.index() === 0) || (d.dx < 0 && this.index() === this.images().length - 1);
      const x = edge ? d.dx * 0.25 : d.dx;
      pic.style.transform = `translateX(${x}px)`;
      pic.style.opacity = String(1 - Math.min(0.5, Math.abs(x) / 900));
    }
  }

  up(e: PointerEvent): void {
    const known = this.pointers.delete(e.pointerId);
    if (this.pinch) {
      if (this.pointers.size < 2) {
        this.pinch = null;
        this.swallowClick();
        // almost back to fitted: snap to it
        if (this.z.s < 1.05) this.resetZoom(true);
        // the finger left on the glass carries on panning
        const rest = [...this.pointers.entries()][0];
        if (rest && this.zoomed()) this.pan = { id: rest[0], x: rest[1].x, y: rest[1].y, zx: this.z.x, zy: this.z.y, moved: true };
      }
      return;
    }
    const pan = this.pan;
    if (pan && e.pointerId === pan.id) {
      this.pan = null;
      if (pan.moved) return this.swallowClick();
    }
    if (known && e.pointerType === 'touch' && e.type === 'pointerup' && this.tap(e)) {
      this.cancelSwipe();
      return;
    }

    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    if (!d.captured) return;
    this.swallowClick();
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

  /** mouse wheel, or a trackpad pinch (which browsers send as ctrl + wheel), zooms around the pointer */
  wheel(e: WheelEvent): void {
    if (this.closing) return;
    e.preventDefault();
    const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
    this.zoomAt(this.z.s * k, { x: e.clientX, y: e.clientY }, false);
  }

  /** double click: zoom in on that point, or back to fitted (touch has its own double tap) */
  dbl(e: MouseEvent): void {
    if (this.lastTouch && performance.now() - this.lastTouch < 600) return;
    if (!(e.target as HTMLElement).closest('.pic')) return;
    this.toggleZoom({ x: e.clientX, y: e.clientY });
  }

  toggleZoom(at: { x: number; y: number } | null = null): void {
    if (this.zoomed()) this.resetZoom(true);
    else this.zoomAt(TAP_ZOOM, at, true);
  }

  private lastTouch = 0;

  /** double tap: same as a double click. True when the tap was used */
  private tap(e: PointerEvent): boolean {
    const now = performance.now();
    this.lastTouch = now;
    const near = Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < 30;
    if (now - this.lastTap.t < 320 && near) {
      this.lastTap.t = 0;
      this.swallowClick();
      this.toggleZoom({ x: e.clientX, y: e.clientY });
      return true;
    }
    this.lastTap = { t: now, x: e.clientX, y: e.clientY };
    return false;
  }

  private zoomAt(target: number, at: { x: number; y: number } | null, animate: boolean): void {
    const base = this.base();
    if (!base) return;
    const s = clamp(target, 1, MAX_ZOOM);
    const p = at ?? { x: base.left + base.width / 2, y: base.top + base.height / 2 };
    // the point under the pointer stays where it is
    const u = { x: (p.x - base.left - this.z.x) / this.z.s, y: (p.y - base.top - this.z.y) / this.z.s };
    this.apply({ s, x: p.x - base.left - u.x * s, y: p.y - base.top - u.y * s }, animate);
  }

  private resetZoom(animate: boolean): void {
    this.apply({ s: 1, x: 0, y: 0 }, animate);
  }

  /** applies a zoom within the screen's bounds */
  private apply(z: { s: number; x: number; y: number }, animate: boolean): void {
    const pic = this.pic()?.nativeElement;
    if (!pic) {
      this.z = { s: 1, x: 0, y: 0 };
      this.zoomed.set(false);
      return;
    }
    const s = clamp(z.s, 1, MAX_ZOOM);
    const base = this.base();
    const view = this.dialog().nativeElement;
    let x = 0;
    let y = 0;
    if (base && s > 1.001) {
      // the zoomed picture may use the whole screen: smaller than the screen on an axis, it is
      // centred on it; larger, it can be panned until its edge meets the screen's edge
      const axis = (t: number, start: number, size: number, screen: number): number => {
        const scaled = size * s;
        return scaled <= screen ? (screen - scaled) / 2 - start : clamp(t, screen - scaled - start, -start);
      };
      x = axis(z.x, base.left, base.width, view.clientWidth);
      y = axis(z.y, base.top, base.height, view.clientHeight);
    }
    this.z = { s, x, y };
    this.zoomed.set(s > 1.001);
    pic.style.transition = animate && !this.reduced ? `transform 0.35s ${EASE}` : '';
    pic.style.transform = s > 1.001 ? `translate(${x}px, ${y}px) scale(${s})` : '';
  }

  /** the picture's fitted box on screen (zoom removed) */
  private base(): { left: number; top: number; width: number; height: number } | null {
    const pic = this.pic()?.nativeElement;
    if (!pic) return null;
    const r = pic.getBoundingClientRect();
    return { left: r.left - this.z.x, top: r.top - this.z.y, width: r.width / this.z.s, height: r.height / this.z.s };
  }

  private cancelSwipe(): void {
    const d = this.drag;
    this.drag = null;
    const pic = this.pic()?.nativeElement;
    if (d?.captured && pic) {
      pic.style.transform = '';
      pic.style.opacity = '';
    }
  }

  private swallowClick(): void {
    this.suppressClick = true;
    setTimeout(() => (this.suppressClick = false), 60);
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
      // pictures only: a video loads when it is shown
      if (v && !v.video) {
        const im = new Image();
        im.decoding = 'async';
        im.src = v.src;
      }
    }
  }
}
