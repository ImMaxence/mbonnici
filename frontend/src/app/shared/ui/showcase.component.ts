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
  imports: [PhoneComponent],
  template: `
    <div class="stage" [attr.data-mode]="effectiveMode()" [class.has-phone]="phones().length > 0" [style.--accent]="accent()">
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
              <app-phone class="phone" [shot]="m" [alt]="labelled() && i === 0 ? m.alt : ''" [eager]="priority() && i === 0" />
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
      position: relative;
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
    .screen img {
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
    .phone {
      width: 100%;
      transition: transform 1s var(--ease-out);
    }
    .stage[data-mode='MOBILE'] .phone {
      flex: none;
      width: 40%;
    }
    .stage[data-mode='MOBILE'] .phones[data-count='2'] .phone {
      width: 34%;
    }
    .stage[data-mode='MOBILE'] .phones[data-count='3'] .phone {
      width: 29%;
    }
    .stage[data-mode='MOBILE'] .phones[data-count='3'] .phone:not(:nth-child(2)) {
      transform: translateY(12%);
    }

    :host-context(.is-hover) .browser {
      transform: translate3d(0, -2%, 0);
    }
    :host-context(.is-hover) .screen img {
      transform: scale(1.03);
    }
    :host-context(.is-hover) .stage[data-mode='BOTH'] .phone {
      transform: translate3d(0, -7%, 0) rotate(-2deg);
    }
    :host-context(.is-hover) .stage[data-mode='MOBILE'] .phones {
      transform: translate3d(0, -4%, 0);
    }
    .stage[data-mode='MOBILE'] .phones {
      transition: transform 1s var(--ease-out);
    }
  `,
})
export class ShowcaseComponent {
  readonly slug = input.required<string>();
  readonly title = input('');
  readonly accent = input('#2b3bea');
  readonly mode = input<DisplayMode | null | undefined>('BOTH');
  readonly cover = input<MediaDto | null | undefined>(null);
  readonly mobileMedia = input<MediaDto | null | undefined>(null);
  /** every portrait capture (project page): up to three phones in MOBILE mode */
  readonly mobileList = input<MediaDto[]>([]);
  readonly site = input<string | null>(null);
  /** load the real site inside the browser frame (project page, when framing is allowed) */
  readonly live = input(false);
  readonly priority = input(false);
  /** rendered width of the browser frame, for the responsive copies */
  readonly sizes = input('(max-width: 720px) 92vw, 46vw');

  private readonly i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly screen = viewChild<ElementRef<HTMLElement>>('screen');

  private readonly alt = computed(() => this.i18n.t('project.shotAlt', { title: this.title() }));
  readonly effectiveMode = computed<DisplayMode>(() => this.mode() ?? 'BOTH');
  /** the first phone carries the description only when there is no browser image */
  readonly labelled = computed(() => this.effectiveMode() === 'MOBILE');

  readonly desktop = computed<Visual>(
    () => fromMedia(this.cover(), this.alt()) ?? { ...PLACEHOLDER, alt: this.alt() },
  );

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
      const el = this.screen()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(([entry]) => el.style.setProperty('--scale', String(entry.contentRect.width / 1440)));
      ro.observe(el);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }
}
