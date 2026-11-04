import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import type { MediaDto } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MotionService } from '../../core/motion/motion.service';
import { Spring, Spring2, clamp } from '../../core/motion/physics';
import { RafService } from '../../core/motion/raf.service';
import { ImgComponent } from '../ui/img.component';

/**
 * iPhone Pro simulator in pure CSS: titanium frame, Dynamic Island, live status bar, side buttons.
 * The screen shows the real site in an iframe, a swipeable screenshot carousel (drag physics with
 * momentum and snapping), or an accent-coloured splash. The whole device tilts towards the pointer.
 */
@Component({
  selector: 'app-iphone',
  imports: [ImgComponent, TranslatePipe],
  template: `
    <div class="wrap" #wrap [style.--accent]="accent()">
      <div class="phone" #phone>
        <i class="btn action"></i>
        <i class="btn vol up"></i>
        <i class="btn vol down"></i>
        <i class="btn power"></i>
        <div class="frame">
          <div class="screen">
            <div class="status" aria-hidden="true">
              <span class="time">{{ time() }}</span>
              <span class="icons">
                <i class="cell"><b></b><b></b><b></b><b></b></i>
                <i class="wifi"></i>
                <i class="battery"><b></b></i>
              </span>
            </div>
            <div class="island" aria-hidden="true"></div>

            <div class="content">
              @if (safeSrc(); as url) {
                <iframe
                  [src]="url"
                  [title]="title()"
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                  referrerpolicy="no-referrer"
                ></iframe>
              } @else if (images().length) {
                <div
                  class="carousel"
                  #carousel
                  (pointerdown)="dragStart($event)"
                  (pointermove)="dragMove($event)"
                  (pointerup)="dragEnd($event)"
                  (pointercancel)="dragEnd($event)"
                  (lostpointercapture)="dragEnd($event)"
                >
                  <div class="track" #track>
                    @for (img of images(); track img.id; let i = $index) {
                      <div class="slide">
                        <app-img [media]="img" sizes="320px" [priority]="i === 0" />
                      </div>
                    }
                  </div>
                  @if (images().length > 1) {
                    <div class="dots" role="tablist">
                      @for (img of images(); track img.id; let i = $index) {
                        <button
                          type="button"
                          role="tab"
                          [attr.aria-selected]="index() === i"
                          [attr.aria-label]="'project.screenshot' | t: { n: i + 1 }"
                          (click)="goTo(i)"
                        ></button>
                      }
                    </div>
                  }
                </div>
              } @else {
                <div class="splash">
                  <span class="logo">{{ initials() }}</span>
                  <strong>{{ title() }}</strong>
                  @if (tagline()) {
                    <p>{{ tagline() }}</p>
                  }
                </div>
              }
            </div>
            <div class="home" aria-hidden="true"></div>
          </div>
        </div>
        <div class="reflection" #reflection aria-hidden="true"></div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      --phone-w: 300px;
    }
    .wrap {
      perspective: 1400px;
      display: grid;
      place-items: center;
      padding: 10px;
    }
    .phone {
      position: relative;
      width: var(--phone-w);
      aspect-ratio: 300 / 614;
      transform-style: preserve-3d;
      will-change: transform;
      filter: drop-shadow(0 40px 60px rgba(0, 0, 0, 0.45));
    }
    .frame {
      position: absolute;
      inset: 0;
      border-radius: 16.5% / 8%;
      background: linear-gradient(160deg, #6d6d72, #2c2c30 40%, #1a1a1d 60%, #4a4a4f);
      padding: 4px;
      box-shadow:
        inset 0 0 0 1.5px rgba(255, 255, 255, 0.25),
        inset 0 0 0 4px #0b0b0c;
    }
    .screen {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 14.5% / 7%;
      background: #000;
      overflow: hidden;
      border: 7px solid #0b0b0c;
      color: #fff;
    }
    .status {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 3;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 24px 10px 28px;
      font: 600 14px/1 var(--font-body);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      /* keeps the clock readable over light sites loaded in the iframe */
      background: linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.25) 70%, transparent);
    }
    .icons {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cell {
      display: inline-flex;
      align-items: flex-end;
      gap: 1.5px;
      height: 11px;
    }
    .cell b {
      width: 3px;
      background: #fff;
      border-radius: 1px;
      height: 25%;
    }
    .cell b:nth-child(2) { height: 50%; }
    .cell b:nth-child(3) { height: 75%; }
    .cell b:nth-child(4) { height: 100%; }
    .wifi {
      width: 14px;
      height: 11px;
      border-radius: 50% 50% 0 0;
      background:
        radial-gradient(circle at 50% 100%, #fff 0 2px, transparent 2.5px),
        radial-gradient(circle at 50% 100%, transparent 0 4px, #fff 4.5px 6px, transparent 6.5px),
        radial-gradient(circle at 50% 100%, transparent 0 8px, #fff 8.5px 10px, transparent 10.5px);
    }
    .battery {
      width: 24px;
      height: 11px;
      border: 1.5px solid rgba(255, 255, 255, 0.5);
      border-radius: 4px;
      padding: 1.5px;
      position: relative;
    }
    .battery::after {
      content: '';
      position: absolute;
      right: -4px;
      top: 2.5px;
      width: 2px;
      height: 4px;
      border-radius: 0 2px 2px 0;
      background: rgba(255, 255, 255, 0.5);
    }
    .battery b {
      display: block;
      width: 82%;
      height: 100%;
      border-radius: 2px;
      background: #fff;
    }
    .island {
      position: absolute;
      top: 11px;
      left: 50%;
      z-index: 4;
      width: 36%;
      height: 24px;
      transform: translateX(-50%);
      border-radius: 20px;
      background: #000;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    }
    .island::after {
      content: '';
      position: absolute;
      right: 10px;
      top: 7px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #2a3a55, #050810 70%);
    }
    .content {
      position: absolute;
      inset: 0;
      background: #0a0a0c;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      background: #fff;
    }
    .carousel {
      position: absolute;
      inset: 0;
      overflow: hidden;
      touch-action: pan-y;
      cursor: grab;
    }
    .carousel:active {
      cursor: grabbing;
    }
    .track {
      display: flex;
      height: 100%;
      will-change: transform;
    }
    .slide {
      flex: 0 0 100%;
      height: 100%;
    }
    .slide app-img {
      height: 100%;
    }
    .dots {
      position: absolute;
      bottom: 26px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      gap: 6px;
    }
    .dots button {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.4);
      transition: transform 0.3s var(--ease-spring), background-color 0.2s;
    }
    .dots button[aria-selected='true'] {
      background: #fff;
      transform: scale(1.4);
    }
    .splash {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 12px;
      padding: 32px;
      text-align: center;
      background:
        radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, var(--accent) 55%, transparent), transparent 70%),
        linear-gradient(180deg, #121216, #050507);
    }
    .splash .logo {
      width: 76px;
      height: 76px;
      display: grid;
      place-items: center;
      border-radius: 22px;
      background: var(--accent);
      color: #fff;
      font: 700 28px/1 var(--font-display);
      letter-spacing: -0.04em;
      box-shadow: 0 20px 40px color-mix(in srgb, var(--accent) 40%, transparent);
    }
    .splash strong {
      font: 700 20px/1.1 var(--font-display);
      letter-spacing: -0.02em;
    }
    .splash p {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.4;
    }
    .home {
      position: absolute;
      bottom: 8px;
      left: 50%;
      z-index: 3;
      width: 38%;
      height: 5px;
      transform: translateX(-50%);
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.85);
      mix-blend-mode: difference;
      pointer-events: none;
    }
    .btn {
      position: absolute;
      width: 3px;
      background: linear-gradient(90deg, #3a3a3e, #1a1a1d);
      border-radius: 2px;
      left: -3px;
    }
    .btn.action { top: 16%; height: 5%; }
    .btn.vol.up { top: 24%; height: 9%; }
    .btn.vol.down { top: 35%; height: 9%; }
    .btn.power {
      left: auto;
      right: -3px;
      top: 27%;
      height: 14%;
      background: linear-gradient(90deg, #1a1a1d, #3a3a3e);
    }
    .reflection {
      position: absolute;
      inset: 0;
      border-radius: 16.5% / 8%;
      background: linear-gradient(var(--ra, 115deg), transparent 30%, rgba(255, 255, 255, 0.14) 45%, transparent 60%);
      pointer-events: none;
      mix-blend-mode: screen;
      opacity: 0.8;
    }
    @media (max-width: 719px) {
      :host {
        --phone-w: min(260px, 70vw);
      }
    }
  `,
})
export class IphoneComponent {
  readonly images = input<MediaDto[]>([]);
  readonly src = input<string | null>(null);
  readonly title = input('');
  readonly tagline = input('');
  readonly accent = input('#5b9dff');

  private readonly sanitizer = inject(DomSanitizer);
  private readonly i18n = inject(I18nService);
  private readonly raf = inject(RafService);
  private readonly motion = inject(MotionService);
  private readonly wrap = viewChild.required<ElementRef<HTMLElement>>('wrap');
  private readonly phone = viewChild.required<ElementRef<HTMLElement>>('phone');
  private readonly reflection = viewChild.required<ElementRef<HTMLElement>>('reflection');
  private readonly track = viewChild<ElementRef<HTMLElement>>('track');
  private readonly carousel = viewChild<ElementRef<HTMLElement>>('carousel');

  readonly time = signal('9:41');
  readonly index = signal(0);
  readonly initials = computed(() =>
    this.title()
      .split(/\s+/)
      .map((w) => w[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  );
  readonly safeSrc = computed<SafeResourceUrl | null>(() => {
    const url = this.src();
    if (!url || !/^https:\/\//i.test(url)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  // tilt
  private readonly tilt = new Spring2(110, 15);
  private tiltLoop: (() => void) | null = null;
  private hovering = false;
  // carousel physics
  private readonly slide = new Spring(0, 160, 24);
  private dragging = false;
  private dragStartX = 0;
  private dragOrigin = 0;
  private lastX = 0;
  private lastT = 0;
  private velocity = 0;
  private carouselLoop: (() => void) | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const tick = (): void =>
        this.time.set(
          new Intl.DateTimeFormat(this.i18n.locale(), { hour: 'numeric', minute: '2-digit' }).format(new Date()),
        );
      tick();
      const clock = setInterval(tick, 30_000);

      const wrap = this.wrap().nativeElement;
      const onMove = (e: PointerEvent): void => {
        if (this.motion.reduced()) return;
        const r = wrap.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
        const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
        this.tilt.setTarget(-ny * 9, nx * 11);
        this.reflection().nativeElement.style.setProperty('--ra', `${115 + nx * 35}deg`);
        this.hovering = true;
        this.ensureTilt();
      };
      const onLeave = (): void => {
        this.hovering = false;
        this.tilt.setTarget(0, 0);
        this.ensureTilt();
      };
      wrap.addEventListener('pointermove', onMove, { passive: true });
      wrap.addEventListener('pointerleave', onLeave);

      destroyRef.onDestroy(() => {
        clearInterval(clock);
        wrap.removeEventListener('pointermove', onMove);
        wrap.removeEventListener('pointerleave', onLeave);
        this.tiltLoop?.();
        this.carouselLoop?.();
      });
    });
  }

  // ── tilt ───────────────────────────────────────────────────────────────────
  private ensureTilt(): void {
    if (this.tiltLoop) return;
    const phone = this.phone().nativeElement;
    this.tiltLoop = this.raf.add((dt) => {
      this.tilt.update(dt);
      phone.style.transform = `rotateX(${this.tilt.x.value.toFixed(2)}deg) rotateY(${this.tilt.y.value.toFixed(2)}deg)`;
      if (!this.hovering && this.tilt.settled()) {
        phone.style.transform = '';
        this.tiltLoop?.();
        this.tiltLoop = null;
      }
    });
  }

  // ── carousel ───────────────────────────────────────────────────────────────
  private width(): number {
    return this.carousel()?.nativeElement.clientWidth ?? 1;
  }

  goTo(i: number): void {
    const n = this.images().length;
    const target = clamp(i, 0, n - 1);
    this.index.set(target);
    this.slide.target = -target * this.width();
    this.ensureCarousel();
  }

  dragStart(e: PointerEvent): void {
    if (this.images().length < 2) return;
    this.dragging = true;
    this.dragStartX = e.clientX;
    this.dragOrigin = this.slide.value;
    this.lastX = e.clientX;
    this.lastT = performance.now();
    this.velocity = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.ensureCarousel();
  }

  dragMove(e: PointerEvent): void {
    if (!this.dragging) return;
    const now = performance.now();
    const dt = Math.max(1, now - this.lastT) / 1000;
    this.velocity = (e.clientX - this.lastX) / dt;
    this.lastX = e.clientX;
    this.lastT = now;
    const n = this.images().length;
    const w = this.width();
    let x = this.dragOrigin + (e.clientX - this.dragStartX);
    // rubber band at the ends
    const min = -(n - 1) * w;
    if (x > 0) x = x * 0.35;
    if (x < min) x = min + (x - min) * 0.35;
    this.slide.set(x);
  }

  dragEnd(e: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    const w = this.width();
    const projected = this.slide.value + this.velocity * 0.18;
    const target = Math.round(-projected / w);
    this.goTo(target);
    const el = e.currentTarget as HTMLElement | null;
    if (el?.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }

  private ensureCarousel(): void {
    if (this.carouselLoop) return;
    this.carouselLoop = this.raf.add((dt) => {
      const track = this.track()?.nativeElement;
      if (!track) return;
      if (!this.dragging) this.slide.update(dt);
      track.style.transform = `translate3d(${this.slide.value.toFixed(1)}px, 0, 0)`;
      if (!this.dragging && this.slide.settled(0.2)) {
        this.carouselLoop?.();
        this.carouselLoop = null;
      }
    });
  }
}
