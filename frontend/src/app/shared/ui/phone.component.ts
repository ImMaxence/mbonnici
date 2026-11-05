import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, input, signal, viewChild } from '@angular/core';
import type { Visual } from './shots';
import { AutoplayDirective } from './autoplay.directive';

/**
 * The one phone of the site (cards, project pages, back-office preview): a frame image
 * (public/img/devices/phone.svg, 1350 × 2760 with a transparent 1206 × 2622 screen at 72,69,
 * drawn by scripts/device-svg.mjs) laid over the capture. To use another frame, replace the image
 * and adjust the .screen rectangle. Sized by its container; the stage around it usually crops the
 * bottom so only the upper part shows.
 */
@Component({
  selector: 'app-phone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AutoplayDirective],
  template: `
    <div class="device">
      <div class="screen" [class.bare]="shot().bare">
        @if (shot().bare) {
          <span class="sb" aria-hidden="true" [style.--sb-bg]="bar()?.bg" [style.--sb-fg]="bar()?.fg">
            <b>9:41</b>
            <span class="icons"><i class="sig"><i></i><i></i><i></i><i></i></i><i class="wifi"></i><i class="bat"><i></i></i></span>
          </span>
        }
        @if (shot().video) {
          <video class="shot" appAutoplay loop preload="metadata" [src]="shot().src" [attr.poster]="shot().poster || null" [attr.aria-label]="alt() || null" [attr.width]="shot().w" [attr.height]="shot().h"></video>
        } @else {
        <img #shotImg class="shot" [src]="shot().src" [attr.srcset]="shot().srcset || null" [attr.sizes]="shot().srcset ? '(max-width: 720px) 45vw, 22vw' : null" [alt]="alt()" [width]="shot().w" [height]="shot().h" [attr.loading]="eager() ? 'eager' : 'lazy'" decoding="async" draggable="false" (load)="sample($event)" />
        }
      </div>
      <img class="bezel" src="/img/devices/phone.svg" alt="" width="1350" height="2760" aria-hidden="true" draggable="false" [attr.loading]="eager() ? 'eager' : 'lazy'" decoding="async" />
    </div>
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }
    .device {
      position: relative;
      font-size: 1cqi;
      aspect-ratio: 1350 / 2760;
      filter: drop-shadow(0 3em 5em rgba(10, 10, 20, 0.28)) drop-shadow(0 1em 1.6em rgba(10, 10, 20, 0.18));
    }
    /* the transparent screen of the bezel: 72,69 → 1206 × 2622 */
    .screen {
      position: absolute;
      left: 5.333%;
      top: 2.5%;
      width: 89.333%;
      height: 95%;
      border-radius: 13.4% / 6.15%;
      overflow: hidden;
      background: #000;
    }
    .shot {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      user-select: none;
    }
    .bezel {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      user-select: none;
    }

    /* status bar for captures that have none (live screenshots), around the Dynamic Island */
    .screen.bare {
      display: flex;
      flex-direction: column;
    }
    .screen.bare .shot {
      flex: 1;
      min-height: 0;
      height: auto;
    }
    .sb {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 13em;
      padding: 0.6em 7.5em 0 9.5em;
      /* the page's own top colour, like iOS does (set once the capture has loaded) */
      background: var(--sb-bg, #000);
      color: var(--sb-fg, #fff);
    }
    .sb b {
      font: 600 4.4em/1 var(--font-body);
      letter-spacing: -0.01em;
    }
    .icons {
      display: flex;
      align-items: center;
      gap: 1.5em;
    }
    .sig {
      display: flex;
      align-items: flex-end;
      gap: 0.5em;
      height: 3.4em;
    }
    .sig i {
      width: 0.85em;
      border-radius: 0.3em;
      background: currentColor;
    }
    .sig i:nth-child(1) { height: 30%; }
    .sig i:nth-child(2) { height: 52%; }
    .sig i:nth-child(3) { height: 75%; }
    .sig i:nth-child(4) { height: 100%; }
    .wifi {
      width: 4.8em;
      height: 3.4em;
      background: currentColor;
      clip-path: polygon(50% 100%, 0 30%, 12% 15%, 30% 4%, 50% 0, 70% 4%, 88% 15%, 100% 30%);
    }
    .bat {
      position: relative;
      width: 7.6em;
      height: 3.6em;
      padding: 0.45em;
      border-radius: 1.1em;
      border: 0.33em solid color-mix(in srgb, currentColor 45%, transparent);
    }
    .bat::after {
      content: '';
      position: absolute;
      right: -1.1em;
      top: 30%;
      width: 0.65em;
      height: 40%;
      border-radius: 0 0.4em 0.4em 0;
      background: color-mix(in srgb, currentColor 45%, transparent);
    }
    .bat i {
      display: block;
      width: 85%;
      height: 100%;
      border-radius: 0.55em;
      background: currentColor;
    }
  `,
})
export class PhoneComponent {
  readonly shot = input.required<Visual>();
  readonly alt = input('');
  readonly eager = input(false);
  /** status bar colours for a capture without one: its top row, and ink that reads on it */
  readonly bar = signal<{ bg: string; fg: string } | null>(null);
  private readonly shotImg = viewChild<ElementRef<HTMLImageElement>>('shotImg');

  constructor() {
    // a capture already loaded before hydration fired no load event the browser app could hear
    afterNextRender(() => {
      const img = this.shotImg()?.nativeElement;
      if (img?.complete && img.naturalWidth) this.sample({ target: img } as unknown as Event);
    });
  }

  sample(e: Event): void {
    if (!this.shot().bare) return;
    const img = e.target as HTMLImageElement;
    try {
      const c = document.createElement('canvas');
      c.width = 24;
      c.height = 4;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx || !img.naturalWidth) return;
      // the top 1 % of the capture, squeezed into 24 × 4 pixels
      ctx.drawImage(img, 0, 0, img.naturalWidth, Math.max(2, img.naturalHeight * 0.01), 0, 0, 24, 4);
      const d = ctx.getImageData(0, 0, 24, 4).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
      }
      const n = d.length / 4;
      [r, g, b] = [r / n, g / n, b / n].map(Math.round);
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      this.bar.set({ bg: `rgb(${r} ${g} ${b})`, fg: luminance > 0.6 ? '#000' : '#fff' });
    } catch {
      // a cross-origin picture cannot be read: keep the black bar
    }
  }
}
