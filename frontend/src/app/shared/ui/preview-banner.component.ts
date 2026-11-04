import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from './icon.component';

/** Shown over a public page rendered from the back office: what you see is not online yet. */
@Component({
  selector: 'app-preview-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, IconComponent],
  template: `
    <div class="banner" role="status">
      <span class="label"><i aria-hidden="true"></i>{{ 'preview.label' | t }}</span>
      <span class="text">{{ 'preview.text' | t }}</span>
      <a class="back" [routerLink]="edit()"><app-icon name="edit" [size]="14" /> {{ 'preview.back' | t }}</a>
    </div>
  `,
  styles: `
    /* over the space the public header normally takes */
    :host {
      position: fixed;
      inset: 0 0 auto;
      z-index: 200;
      display: block;
    }
    .banner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem 1rem;
      padding: 0.7rem var(--gutter);
      background: var(--fg);
      color: var(--bg);
      font-size: var(--fs-small);
    }
    .label {
      display: inline-flex;
      align-items: center;
      gap: 0.5em;
      font-family: var(--font-mono);
      font-size: var(--fs-micro);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .label i {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f5a524;
    }
    .text {
      opacity: 0.75;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 0.4em;
      margin-left: auto;
      padding: 0.35rem 0.8rem;
      border-radius: var(--radius-pill);
      border: 1px solid color-mix(in srgb, var(--bg) 30%, transparent);
      font-weight: 600;
    }
    .back:hover {
      background: color-mix(in srgb, var(--bg) 12%, transparent);
    }
  `,
})
export class PreviewBannerComponent {
  /** back-office URL to go back to */
  readonly edit = input.required<string>();
}
