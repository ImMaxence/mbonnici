import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TransitionService } from './transition.service';

/**
 * Page transition: one solid sheet rises from the bottom edge, shows the destination's name,
 * then keeps going up to uncover the new page. No strips, no rounded edges, no gaps.
 */
@Component({
  selector: 'app-curtain',
  imports: [TranslatePipe],
  template: `
    <div class="curtain" [attr.data-state]="transition.state()" aria-hidden="true">
      <div class="sheet">
        <div class="label">
          <span class="eyebrow plain">{{ 'meta.siteName' | t }}</span>
          <span class="title"><span>{{ transition.label() }}</span></span>
        </div>
      </div>
    </div>
  `,
  styles: `
    .curtain {
      position: fixed;
      inset: 0;
      z-index: 150;
      pointer-events: none;
      overflow: hidden;
    }
    .curtain[data-state='covering'],
    .curtain[data-state='covered'] {
      pointer-events: all;
    }
    .sheet {
      position: absolute;
      inset: 0;
      background: var(--fg);
      color: var(--bg);
      transform: translate3d(0, 100%, 0);
      will-change: transform;
    }
    .curtain[data-state='covering'] .sheet {
      transform: translate3d(0, 0, 0);
      transition: transform 0.75s var(--ease-curtain);
    }
    .curtain[data-state='covered'] .sheet {
      transform: translate3d(0, 0, 0);
      transition: none;
    }
    .curtain[data-state='revealing'] .sheet {
      transform: translate3d(0, -100%, 0);
      transition: transform 0.8s var(--ease-curtain);
    }
    .label {
      position: absolute;
      left: var(--gutter);
      right: var(--gutter);
      bottom: calc(var(--gutter) + env(safe-area-inset-bottom));
      display: grid;
      gap: var(--space-4);
    }
    .label .eyebrow {
      color: inherit;
      opacity: 0.6;
    }
    .title {
      display: block;
      overflow: hidden;
      font-family: var(--font-display);
      font-size: var(--fs-hero);
      font-weight: var(--weight-display);
      letter-spacing: -0.05em;
      line-height: 0.95;
      padding: 0 0.1em 0.08em;
      margin: 0 -0.1em;
    }
    .title > span {
      display: inline-block;
      transform: translate3d(0, 105%, 0);
    }
    .curtain[data-state='covering'] .title > span,
    .curtain[data-state='covered'] .title > span {
      transform: none;
      transition: transform 0.8s var(--ease-out) 0.28s;
    }
    /* phones: a short fade through the page colour, no sliding sheet, no oversized title */
    @media (max-width: 719px) {
      .sheet,
      .curtain[data-state] .sheet {
        transform: none;
        background: var(--bg);
      }
      .sheet {
        opacity: 0;
      }
      .curtain[data-state='covering'] .sheet {
        opacity: 1;
        transition: opacity 0.3s var(--ease-in-out);
      }
      .curtain[data-state='covered'] .sheet {
        opacity: 1;
        transition: none;
      }
      .curtain[data-state='revealing'] .sheet {
        opacity: 0;
        transition: opacity 0.4s var(--ease-out);
      }
      .label {
        display: none;
      }
    }
    .curtain[data-state='revealing'] .title > span {
      transform: translate3d(0, -40%, 0);
      opacity: 0;
      transition:
        transform 0.6s var(--ease-in-out),
        opacity 0.3s;
    }
  `,
})
export class CurtainComponent {
  readonly transition = inject(TransitionService);
}
