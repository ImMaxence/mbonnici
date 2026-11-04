import {
  ChangeDetectionStrategy,
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
import { Visual, fromMedia, fromShot, shotsFor } from './shots';

/**
 * The real product, staged: the landing page in a minimal browser window, the phone version in
 * a phone overlapping its corner. Images come from the back office (cover / first mobile capture)
 * or, by default, from the screenshots published in the project's README. On the project page the
 * browser can also load the live site (scaled 1440 px viewport) when the project allows framing.
 */
@Component({
  selector: 'app-showcase',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stage" [class.has-phone]="!!mobile() && !poster()" [class.is-poster]="poster()" [style.--accent]="accent()">
      @if (poster() && desktop(); as d) {
        <img class="poster-img" [src]="d.src" [alt]="d.alt" [width]="d.w" [height]="d.h" [attr.loading]="priority() ? 'eager' : 'lazy'" [attr.fetchpriority]="priority() ? 'high' : null" decoding="async" />
      } @else {
        <figure class="browser">
          <div class="chrome" aria-hidden="true">
            <i></i><i></i><i></i>
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
            } @else if (desktop(); as d) {
              <img [src]="d.src" [alt]="d.alt" [width]="d.w" [height]="d.h" [attr.loading]="priority() ? 'eager' : 'lazy'" [attr.fetchpriority]="priority() ? 'high' : null" decoding="async" />
            } @else {
              <div class="blank"><span>{{ title() }}</span></div>
            }
          </div>
        </figure>
        @if (mobile(); as m) {
          <figure class="phone" aria-hidden="true">
            <div class="phone-screen">
              <img [src]="m.src" alt="" [width]="m.w" [height]="m.h" loading="lazy" decoding="async" />
            </div>
          </figure>
        }
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
    .stage.has-phone {
      padding-right: 16%;
    }
    .stage.is-poster {
      padding: 0;
      aspect-ratio: 16 / 10;
    }
    .poster-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .browser {
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      background: var(--bg-2);
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--fg) 10%, transparent),
        var(--shadow-3);
      transform: translateZ(0);
      transition: transform 1s var(--ease-out);
    }
    .chrome {
      display: flex;
      align-items: center;
      gap: 5px;
      height: clamp(18px, 4cqi, 28px);
      padding: 0 10px;
      background: var(--bg-3);
      border-bottom: 1px solid var(--line);
    }
    .chrome i {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--fg) 22%, transparent);
    }
    .url {
      flex: 1;
      margin: 0 8% 0 6%;
      padding: 2px 8px;
      border-radius: 99px;
      background: var(--bg-2);
      font: 500 clamp(9px, 1.6cqi, 11px) / 1.3 var(--font-mono);
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
    .blank {
      display: grid;
      place-items: center;
      height: 100%;
      font-family: var(--font-display);
      font-size: clamp(1.4rem, 7cqi, 4rem);
      letter-spacing: -0.04em;
      color: var(--fg-3);
    }
    .phone {
      position: absolute;
      right: 5%;
      bottom: 6%;
      width: 22%;
      padding: 1.2%;
      border-radius: 18% / 8.5%;
      background: var(--device);
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.08) inset,
        var(--shadow-3);
      transition: transform 1s var(--ease-out);
    }
    .phone-screen {
      aspect-ratio: 9 / 19.5;
      border-radius: 15% / 7%;
      overflow: hidden;
      background: #000;
    }
    .phone-screen img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
    }
    :host-context(.is-hover) .browser {
      transform: translate3d(0, -2%, 0);
    }
    :host-context(.is-hover) .screen img {
      transform: scale(1.03);
    }
    :host-context(.is-hover) .phone {
      transform: translate3d(0, -7%, 0) rotate(-2deg);
    }
  `,
})
export class ShowcaseComponent {
  readonly slug = input.required<string>();
  readonly title = input('');
  readonly accent = input('#2b3bea');
  readonly cover = input<MediaDto | null | undefined>(null);
  readonly mobileMedia = input<MediaDto | null | undefined>(null);
  readonly site = input<string | null>(null);
  /** load the real site inside the browser frame (project page, when framing is allowed) */
  readonly live = input(false);
  readonly priority = input(false);

  private readonly i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly screen = viewChild<ElementRef<HTMLElement>>('screen');

  private readonly shots = computed(() => shotsFor(this.slug()));
  private readonly alt = computed(() => this.i18n.t('project.shotAlt', { title: this.title() }));
  readonly desktop = computed<Visual | null>(() => fromMedia(this.cover(), this.alt()) ?? fromShot(this.shots().desktop, this.alt()));
  readonly mobile = computed<Visual | null>(() => fromMedia(this.mobileMedia(), '') ?? fromShot(this.shots().mobile, ''));
  readonly poster = computed(() => !this.cover() && !!this.shots().poster);
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

  readonly scale = signal(0.5);

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
