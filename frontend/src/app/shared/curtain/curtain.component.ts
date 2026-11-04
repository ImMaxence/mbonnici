import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TransitionService } from './transition.service';

/** Full-screen multi-panel curtain driven by TransitionService. */
@Component({
  selector: 'app-curtain',
  imports: [TranslatePipe],
  template: `
    <div class="curtain" [attr.data-state]="transition.state()" aria-hidden="true">
      @for (i of panels; track i) {
        <div class="panel" [style.--i]="i"></div>
      }
      <div class="label">
        <span class="eyebrow">{{ 'meta.siteName' | t }}</span>
        <span class="title">{{ transition.label() }}</span>
      </div>
    </div>
  `,
  styles: `
    .curtain {
      position: fixed;
      inset: 0;
      z-index: 150;
      display: flex;
      pointer-events: none;
      --n: 5;
    }
    .curtain[data-state='covering'],
    .curtain[data-state='covered'] {
      pointer-events: all;
    }
    .panel {
      flex: 1;
      background: var(--curtain-bg, var(--fg));
      transform: scaleY(0);
      transform-origin: 50% 100%;
      will-change: transform;
    }
    .curtain[data-state='covering'] .panel {
      transform: scaleY(1);
      transition: transform 0.72s var(--ease-curtain) calc(var(--i) * 45ms);
    }
    .curtain[data-state='covered'] .panel {
      transform: scaleY(1);
      transition: none;
    }
    .curtain[data-state='revealing'] .panel {
      transform: scaleY(0);
      transform-origin: 50% 0%;
      transition: transform 0.78s var(--ease-curtain) calc((var(--n) - 1 - var(--i)) * 45ms);
    }
    .label {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 0.6rem;
      color: var(--bg);
      opacity: 0;
      transform: translateY(14px);
      transition: opacity 0.3s, transform 0.5s var(--ease-out);
    }
    .label .eyebrow {
      color: inherit;
      opacity: 0.6;
    }
    .label .eyebrow::before {
      background: currentColor;
      box-shadow: none;
    }
    .title {
      font-family: var(--font-display);
      font-size: var(--fs-h1);
      letter-spacing: var(--track-display);
      font-weight: var(--weight-display);
      line-height: 1;
    }
    .curtain[data-state='covering'] .label,
    .curtain[data-state='covered'] .label {
      opacity: 1;
      transform: none;
      transition-delay: 0.35s;
    }
    :host-context([data-style='aurora']) .panel {
      --curtain-bg: var(--gradient-accent);
    }
    :host-context([data-style='aurora']) .label {
      color: #06061a;
    }
    :host-context([data-style='editorial']) .panel {
      --curtain-bg: var(--accent);
    }
    :host-context([data-style='editorial']) .label {
      color: var(--accent-fg);
    }
    :host-context([data-style='editorial']) .title {
      font-style: italic;
    }
    @media (max-width: 719px) {
      .curtain {
        --n: 3;
      }
      .panel:nth-child(n + 4) {
        display: none;
      }
    }
  `,
})
export class CurtainComponent {
  readonly transition = inject(TransitionService);
  readonly panels = [0, 1, 2, 3, 4];
}
