import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Visual } from './shots';

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
  template: `
    <div class="device">
      <div class="screen" [class.bare]="shot().bare">
        @if (shot().bare) {
          <span class="sb" aria-hidden="true">
            <b>9:41</b>
            <span class="icons"><i class="sig"><i></i><i></i><i></i><i></i></i><i class="wifi"></i><i class="bat"><i></i></i></span>
          </span>
        }
        <img class="shot" [src]="shot().src" [attr.srcset]="shot().srcset || null" [attr.sizes]="shot().srcset ? '(max-width: 720px) 45vw, 22vw' : null" [alt]="alt()" [width]="shot().w" [height]="shot().h" [attr.loading]="eager() ? 'eager' : 'lazy'" decoding="async" draggable="false" />
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
      background: #000;
      color: #fff;
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
      background: #fff;
    }
    .sig i:nth-child(1) { height: 30%; }
    .sig i:nth-child(2) { height: 52%; }
    .sig i:nth-child(3) { height: 75%; }
    .sig i:nth-child(4) { height: 100%; }
    .wifi {
      width: 4.8em;
      height: 3.4em;
      background: #fff;
      clip-path: polygon(50% 100%, 0 30%, 12% 15%, 30% 4%, 50% 0, 70% 4%, 88% 15%, 100% 30%);
    }
    .bat {
      position: relative;
      width: 7.6em;
      height: 3.6em;
      padding: 0.45em;
      border-radius: 1.1em;
      border: 0.33em solid rgba(255, 255, 255, 0.45);
    }
    .bat::after {
      content: '';
      position: absolute;
      right: -1.1em;
      top: 30%;
      width: 0.65em;
      height: 40%;
      border-radius: 0 0.4em 0.4em 0;
      background: rgba(255, 255, 255, 0.45);
    }
    .bat i {
      display: block;
      width: 85%;
      height: 100%;
      border-radius: 0.55em;
      background: #fff;
    }
  `,
})
export class PhoneComponent {
  readonly shot = input.required<Visual>();
  readonly alt = input('');
  readonly eager = input(false);
}
