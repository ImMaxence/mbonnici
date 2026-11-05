import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Text that rolls letter by letter from the grotesk to the serif italic when its trigger is
 * hovered with a mouse or focused with the keyboard (an ancestor with the `roll-trigger` class): each glyph slides up out of a mask while its
 * italic twin rises behind it, with a short stagger. Screen readers get the plain word once.
 */
@Component({
  selector: 'app-roll-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="visually-hidden">{{ text() }}</span>
    <span class="roll" aria-hidden="true">
      <span class="layer a">
        @for (c of chars(); track $index) {
          <span class="c" [style.--i]="$index">{{ c }}</span>
        }
      </span>
      <span class="layer b">
        @for (c of chars(); track $index) {
          <span class="c" [style.--i]="$index">{{ c }}</span>
        }
      </span>
    </span>
  `,
  styles: `
    :host {
      display: inline-block;
    }
    .roll {
      display: inline-grid;
      overflow: hidden;
      /* room for the italic overhang and the descenders */
      padding: 0.06em 0.12em 0.14em;
      margin: -0.06em -0.12em -0.14em;
    }
    .layer {
      grid-area: 1 / 1;
      display: inline-flex;
      white-space: pre;
    }
    .b {
      font-family: var(--font-serif);
      font-style: italic;
      font-weight: 400;
      letter-spacing: -0.02em;
      color: var(--accent);
    }
    .c {
      display: inline-block;
      transition:
        transform 0.75s var(--ease-out),
        opacity 0.45s var(--ease-out);
      transition-delay: calc(var(--i) * 28ms);
    }
    /* the outgoing glyphs fade quickly so nothing lingers above the line */
    .a .c {
      transition:
        transform 0.6s var(--ease-in-out),
        opacity 0.25s linear;
      transition-delay: calc(var(--i) * 22ms);
    }
    .b .c {
      transform: translate3d(0, 110%, 0) rotate(6deg);
      opacity: 0;
    }
    :host-context(.roll-trigger:focus-visible) .a .c {
      transform: translate3d(0, -130%, 0) rotate(-4deg);
      opacity: 0;
    }
    :host-context(.roll-trigger:focus-visible) .b .c {
      transform: none;
      opacity: 1;
    }
    /* a touch screen "hovers" at the tap, just before the page changes: no roll there */
    @media (hover: hover) and (pointer: fine) {
      :host-context(.roll-trigger:hover) .a .c {
        transform: translate3d(0, -130%, 0) rotate(-4deg);
        opacity: 0;
      }
      :host-context(.roll-trigger:hover) .b .c {
        transform: none;
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .c {
        transition: opacity 0.2s;
        transition-delay: 0s;
      }
    }
  `,
})
export class RollTextComponent {
  readonly text = input.required<string>();
  readonly chars = computed(() => Array.from(this.text()));
}
