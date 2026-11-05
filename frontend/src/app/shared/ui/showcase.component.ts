import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import type { DisplayMode, MediaDto } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { PhoneComponent } from './phone.component';
import { AutoplayDirective } from './autoplay.directive';
import { MotionService } from '../../core/motion/motion.service';
import { Visual, fromMedia } from './shots';

const PLACEHOLDER: Visual = { src: '/img/project-placeholder.svg', w: 1600, h: 1000, alt: '' };
const PLACEHOLDER_MOBILE: Visual = { src: '/img/project-placeholder-mobile.svg', w: 390, h: 844, alt: '' };

/**
 * The real product, staged: the landing page in a macOS-style browser window and/or the phone
 * version in an iPhone. Images come from the back office (cover, mobile captures); a neutral
 * illustration fills in when a project has none. Modes: BOTH (browser + phone), MOBILE (phones only), DESKTOP (browser only).
 * On the project page the browser can load the live site (scaled 1440 px viewport).
 */
@Component({
  selector: 'app-showcase',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhoneComponent, AutoplayDirective],
  template: `
    <div class="stage" #stage [attr.data-mode]="effectiveMode()" [class.has-phone]="phones().length > 0" [class.enter-on-scroll]="scrollEntry()" [style.--accent]="accent()">
        @if (effectiveMode() !== 'MOBILE') {
          <figure class="browser">
            <div class="chrome" aria-hidden="true">
              <span class="lights"><i class="r"></i><i class="y"></i><i class="g"></i></span>
              <span class="url">{{ host() }}</span>
            </div>
            <div class="screen" #screen>
              @if (liveUrl(); as url) {
                <iframe
                  class="live"
                  [src]="url"
                  [title]="title()"
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                  referrerpolicy="no-referrer"
                ></iframe>
              } @else if (desktopVideo(); as v) {
                <video appAutoplay loop preload="metadata" [src]="v.src" [attr.poster]="desktop().src" [attr.aria-label]="desktop().alt" [attr.width]="v.w" [attr.height]="v.h"></video>
              } @else {
                @let d = desktop();
                <img [src]="d.src" [attr.srcset]="d.srcset || null" [attr.sizes]="d.srcset ? sizes() : null" [style.object-position]="d.pos" [alt]="d.alt" [width]="d.w" [height]="d.h" [attr.loading]="priority() ? 'eager' : 'lazy'" [attr.fetchpriority]="priority() ? 'high' : null" decoding="async" />
              }
            </div>
          </figure>
        }
        @if (phones().length) {
          <div class="phones" [attr.data-count]="phones().length">
            @for (m of phones(); track m.src; let i = $index) {
              <div class="slab">
                @for (z of edges; track z) {
                  <i class="edge" [style.--z]="z" aria-hidden="true"></i>
                }
                @for (k of keys; track $index) {
                  <i class="key" [class.r]="k.right" [style.top.%]="k.top" [style.height.%]="k.h" [style.--z]="k.z" aria-hidden="true"></i>
                }
                <app-phone class="phone" [shot]="m" [alt]="labelled() && i === 0 ? m.alt : ''" [eager]="priority() && i === 0" />
              </div>
            }
          </div>
        }
    </div>
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }
    .stage {
      --tx: 0;
      --ty: 0;
      position: relative;
      /* the frame stays put; the browser and the phone inside it turn in 3D */
      perspective: 1200px;
      padding: 7% 7% 9%;
      background:
        radial-gradient(90% 80% at 70% 110%, color-mix(in srgb, var(--accent) 26%, transparent), transparent 70%),
        var(--bg-3);
      border-radius: var(--radius-m);
      overflow: hidden;
      isolation: isolate;
    }
    .stage[data-mode='BOTH'].has-phone {
      padding-right: 16%;
    }
    .stage[data-mode='MOBILE'] {
      aspect-ratio: 16 / 10;
      padding: 7% 6% 0;
    }
    .poster-img {
      display: block;
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .stage:has(.poster-img) {
      aspect-ratio: 16 / 11;
    }

    /* ── browser window (macOS) ── */
    .browser {
      position: relative;
      margin: 0;
      border-radius: 10px;
      overflow: hidden;
      background: var(--bg-2);
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--fg) 12%, transparent),
        var(--shadow-3);
      transition: transform 1s var(--ease-out);
    }
    .chrome {
      position: relative;
      display: flex;
      align-items: center;
      height: clamp(20px, 4.2cqi, 32px);
      padding: 0 clamp(8px, 1.6cqi, 14px);
      background: var(--bg-3);
      border-bottom: 1px solid var(--line);
    }
    .lights {
      display: flex;
      gap: clamp(4px, 0.9cqi, 8px);
    }
    .lights i {
      width: clamp(7px, 1.25cqi, 12px);
      aspect-ratio: 1;
      border-radius: 50%;
      box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.18);
    }
    .lights .r { background: #ff5f57; }
    .lights .y { background: #febc2e; }
    .lights .g { background: #28c840; }
    .url {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      width: 46%;
      padding: 2px 8px;
      border-radius: 6px;
      background: var(--bg-2);
      font: 500 clamp(9px, 1.5cqi, 12px) / 1.4 var(--font-body);
      color: var(--fg-2);
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .screen {
      position: relative;
      aspect-ratio: 16 / 10;
      overflow: hidden;
      background: var(--bg-3);
    }
    .screen img,
    .screen video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      transition: transform 1.4s var(--ease-out);
    }
    .live {
      position: absolute;
      top: 0;
      left: 0;
      width: 1440px;
      height: 900px;
      border: 0;
      transform: scale(var(--scale, 0.5));
      transform-origin: 0 0;
      background: #fff;
    }

    /* ── phones: the stage crops their lower part, only the top shows ── */
    .phones {
      position: absolute;
      right: 5%;
      bottom: -16%;
      width: 23%;
    }
    .stage[data-mode='MOBILE'] .phones {
      position: relative;
      right: auto;
      bottom: auto;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      gap: 3%;
      width: 100%;
      height: 100%;
    }
    .slab {
      position: relative;
      width: 100%;
      transform-style: preserve-3d;
      transition: transform 1s var(--ease-out);
    }
    .phone {
      display: block;
      width: 100%;
    }
    /* the phone's thickness: ten layers in its silhouette (the body of phone.svg: 2.45% / 0.36% in,
       corners 17.85% / 8.61%), stepped back in depth; seen face on they hide behind the screen,
       turned they form the edge, lighter at the front like the polished band */
    .edge {
      position: absolute;
      left: 2.446%;
      right: 2.446%;
      top: 0.36%;
      bottom: 0.36%;
      border-radius: 17.85% / 8.61%;
      background: color-mix(in srgb, #56565c calc(100% - var(--z) * 9%), #121214);
      transform: translateZ(calc(var(--z) * -0.24cqi));
    }
    /* a button: one slim metal key standing 0.7 % out of the band, in the middle of the edge's
       depth, rounded at both ends with a light running along it; face on it only shows as a slight
       bump, turned it reads as a button on the side */
    .key {
      position: absolute;
      left: 1.75%;
      width: 1.5%;
      border-radius: 999px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.16), transparent 18%, transparent 82%, rgba(0, 0, 0, 0.35)),
        linear-gradient(90deg, #3a3a3f, #9a9aa1 45%, #55555b 80%, #2a2a2e);
      transform: translateZ(calc(var(--z) * -0.24cqi));
    }
    .key.r {
      left: auto;
      right: 1.75%;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.16), transparent 18%, transparent 82%, rgba(0, 0, 0, 0.35)),
        linear-gradient(270deg, #3a3a3f, #9a9aa1 45%, #55555b 80%, #2a2a2e);
    }
    .stage[data-mode='MOBILE'] .slab {
      flex: none;
      width: 40%;
    }
    .stage[data-mode='MOBILE'] .phones[data-count='2'] .slab {
      width: 34%;
    }
    .stage[data-mode='MOBILE'] .phones[data-count='3'] .slab {
      width: 29%;
    }
    .stage[data-mode='MOBILE'] .phones[data-count='3'] .slab:not(:nth-child(2)) {
      transform: translateY(12%);
    }

    :host-context(.is-hover) .browser {
      transform: translate3d(0, -2%, 0);
    }
    :host-context(.is-hover) .screen img,
    :host-context(.is-hover) .screen video {
      transform: scale(1.03);
    }
    :host-context(.is-hover) .stage[data-mode='BOTH'] .slab {
      transform: translate3d(0, -7%, 0) rotate(-2deg);
    }
    :host-context(.is-hover) .stage[data-mode='MOBILE'] .phones {
      transform: translate3d(0, -4%, 0);
    }

  
    /* depth: both screens turn towards the pointer (the axis follows it, the angle grows with the
       distance from the centre); the phone, closer to the eye, turns and drifts more than the
       browser and shows its edge: a dark band on the side turned towards the viewer */
    .browser,
    .phones {
      transition:
        rotate 0.7s var(--ease-out),
        translate 0.7s var(--ease-out),
        transform 1s var(--ease-out);
    }
    .browser {
      rotate: calc(-1 * var(--ty) + 0.0001) var(--tx) 0 calc(hypot(var(--tx), var(--ty)) * 6deg);
      translate: calc(var(--tx) * -0.8%) calc(var(--ty) * -0.8%);
    }
    .phones {
      rotate: calc(-1 * var(--ty) + 0.0001) var(--tx) 0 calc(hypot(var(--tx), var(--ty)) * 7deg);
      translate: calc(var(--tx) * 2.2%) calc(var(--ty) * 1.5%);
      transform-style: preserve-3d;
    }
    .stage.tilting .browser,
    .stage.tilting .phones {
      transition:
        rotate 0.25s var(--ease-out),
        translate 0.25s var(--ease-out),
        transform 1s var(--ease-out);
    }
    /* project page: the phone rises and straightens in front of the browser over the first
       screen of scrolling (scroll-driven animation; browsers without it show it in place) */
    @supports (animation-timeline: scroll()) {
      @media (prefers-reduced-motion: no-preference) {
        .enter-on-scroll[data-mode='BOTH'] .slab {
          animation: phone-in linear both;
          animation-timeline: scroll(root);
          animation-range: 0 55vh;
        }
        .enter-on-scroll .browser {
          animation: browser-in linear both;
          animation-timeline: scroll(root);
          animation-range: 0 55vh;
        }
      }
    }
    @keyframes phone-in {
      from {
        translate: 4% 16%;
        rotate: 5deg;
      }
      to {
        translate: 0 0;
        rotate: 0deg;
      }
    }
    @keyframes browser-in {
      from {
        scale: 0.97;
      }
      to {
        scale: 1;
      }
    }
  `,
})
export class ShowcaseComponent {
  readonly slug = input.required<string>();
  readonly title = input('');
  readonly accent = input('#2b3bea');
  readonly mode = input<DisplayMode | null | undefined>('BOTH');
  readonly cover = input<MediaDto | null | undefined>(null);
  /** optional loop for the browser frame; the cover is its poster */
  readonly coverVideo = input<MediaDto | null | undefined>(null);
  readonly mobileMedia = input<MediaDto | null | undefined>(null);
  /** every portrait capture (project page): up to three phones in MOBILE mode */
  readonly mobileList = input<MediaDto[]>([]);
  readonly site = input<string | null>(null);
  /** load the real site inside the browser frame (project page, when framing is allowed) */
  readonly live = input(false);
  readonly priority = input(false);
  /** rendered width of the browser frame, for the responsive copies */
  readonly sizes = input('(max-width: 720px) 92vw, 46vw');
  /** project page: the phone slides up and straightens in front of the browser as the page scrolls */
  readonly scrollEntry = input(false);

  private readonly i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly screen = viewChild<ElementRef<HTMLElement>>('screen');
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly motion = inject(MotionService);

  private readonly alt = computed(() => this.i18n.t('project.shotAlt', { title: this.title() }));
  readonly effectiveMode = computed<DisplayMode>(() => this.mode() ?? 'BOTH');
  /** the first phone carries the description only when there is no browser image */
  readonly labelled = computed(() => this.effectiveMode() === 'MOBILE');

  readonly desktop = computed<Visual>(
    () => fromMedia(this.cover(), this.alt()) ?? { ...PLACEHOLDER, alt: this.alt() },
  );

  /** depth steps of the phone's edge layers */
  readonly edges = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  /**
   * the side buttons, one piece each on the edge at mid depth: action, volume up and down on the
   * left, the side button on the right; positions from the 2760 px high drawing
   */
  readonly keys = [
    { top: 21.01, h: 4.49, right: false },
    { top: 28.84, h: 7.25, right: false },
    { top: 38.19, h: 7.25, right: false },
    { top: 31.38, h: 11.67, right: true },
  ].map((k) => ({ ...k, z: 5 }));

  readonly desktopVideo = computed<Visual | null>(() => {
    const v = fromMedia(this.coverVideo(), this.alt());
    return v?.video ? v : null;
  });

  readonly phones = computed<Visual[]>(() => {
    const mode = this.effectiveMode();
    if (mode === 'DESKTOP') return [];
    const alt = this.alt();
    const first =
      fromMedia(this.mobileMedia(), alt) ??
      fromMedia(this.mobileList()[0], alt) ??
      (mode === 'MOBILE' ? { ...PLACEHOLDER_MOBILE, alt } : null);
    if (!first) return [];
    if (mode !== 'MOBILE') return [first];
    const extra = this.mobileList()
      .map((m) => fromMedia(m, alt)!)
      .filter((v) => v.src !== first.src)
      .slice(0, 2);
    return extra.length === 2 ? [extra[0], first, extra[1]] : [first, ...extra];
  });

  readonly host = computed(() => {
    const url = this.site();
    if (!url) return this.slug() + '.app';
    try {
      return new URL(url).host.replace(/^www\./, '');
    } catch {
      return url;
    }
  });
  readonly liveUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.site();
    return this.live() && url && /^https:\/\//.test(url) ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.tilt(destroyRef);
      const el = this.screen()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(([entry]) => el.style.setProperty('--scale', String(entry.contentRect.width / 1440)));
      ro.observe(el);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  /**
   * The stage leans a few degrees towards the pointer and the phone drifts more than the browser,
   * for depth. Mouse and trackpad only, never with reduced motion; one write per frame at most.
   */
  private tilt(destroyRef: DestroyRef): void {
    if (!this.motion.finePointer() || this.motion.reduced()) return;
    const stage = this.stage().nativeElement;
    let frame = 0;
    let next = { x: 0, y: 0 };
    const write = (): void => {
      frame = 0;
      stage.style.setProperty('--tx', next.x.toFixed(3));
      stage.style.setProperty('--ty', next.y.toFixed(3));
    };
    const move = (e: PointerEvent): void => {
      if (e.pointerType === 'touch') return;
      const r = stage.getBoundingClientRect();
      next = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
      stage.classList.add('tilting');
      if (!frame) frame = requestAnimationFrame(write);
    };
    const leave = (): void => {
      next = { x: 0, y: 0 };
      stage.classList.remove('tilting');
      if (!frame) frame = requestAnimationFrame(write);
    };
    stage.addEventListener('pointermove', move, { passive: true });
    stage.addEventListener('pointerleave', leave);
    destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerleave', leave);
    });
  }
}
