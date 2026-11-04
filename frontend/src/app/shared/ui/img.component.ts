import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { MediaDto } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { focalPosition } from './shots';

/**
 * Image with reserved aspect ratio (no layout shift) and a blurred inline placeholder that
 * cross-fades into the real picture once decoded.
 */
@Component({
  selector: 'app-img',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="frame" [style.aspect-ratio]="ratio()" [class.is-loaded]="loaded()">
      @if (media().blurDataUrl) {
        <div class="blur" [style.background-image]="'url(' + media().blurDataUrl + ')'" aria-hidden="true"></div>
      }
      <img
        [src]="media().url"
        [attr.srcset]="media().srcset || null"
        [style.object-position]="position()"
        [alt]="alt()"
        [attr.width]="media().width"
        [attr.height]="media().height"
        [attr.loading]="priority() ? 'eager' : 'lazy'"
        [attr.fetchpriority]="priority() ? 'high' : null"
        decoding="async"
        [attr.sizes]="sizes()"
        (load)="loaded.set(true)"
      />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .frame {
      position: relative;
      overflow: hidden;
      background: var(--bg-3);
      border-radius: inherit;
    }
    .blur {
      position: absolute;
      inset: -8%;
      background-size: cover;
      background-position: center;
      filter: blur(18px) saturate(1.2);
      transform: scale(1.05);
      transition: opacity 0.6s var(--ease-out);
    }
    img {
      position: relative;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transform: scale(1.02);
      transition:
        opacity 0.7s var(--ease-out),
        transform 1.2s var(--ease-out);
    }
    .is-loaded img {
      opacity: 1;
      transform: none;
    }
    .is-loaded .blur {
      opacity: 0;
    }
  `,
})
export class ImgComponent {
  readonly media = input.required<MediaDto>();
  readonly sizes = input('(max-width: 720px) 100vw, 50vw');
  readonly priority = input(false);

  private readonly i18n = inject(I18nService);
  readonly loaded = signal(false);
  readonly alt = computed(() => this.i18n.l(this.media().alt));
  readonly position = computed(() => focalPosition(this.media()));
  readonly ratio = computed(() => {
    const m = this.media();
    return m.width && m.height ? `${m.width} / ${m.height}` : '16 / 10';
  });
}
