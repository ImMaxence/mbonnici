import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Testimonial } from '../../core/api/models';
import { LocalizedPipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from './icon.component';
import { RevealDirective } from './reveal.directive';

/**
 * Tech news: the tools and projects the owner keeps an eye on (stored as the profile's
 * "testimonial" rows: title, source, summary, link). One editorial row each, numbered: the title
 * in the display face with its source in small mono capitals, the summary beside it, and the
 * site it links to. The whole row is the link.
 */
@Component({
  selector: 'app-tech-news',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, LocalizedPipe, IconComponent, RevealDirective],
  template: `
    <ol class="news">
      @for (n of items(); track n.id; let i = $index) {
        <li appReveal [revealDelay]="i * 70">
          @if (n.url) {
            <a class="item" [href]="n.url" target="_blank" rel="noopener noreferrer">
              <ng-container *ngTemplateOutlet="body; context: { $implicit: n, i }" />
              <span class="where mono">{{ host(n.url) }} <app-icon class="arrow" name="arrow-up-right" [size]="14" /></span>
            </a>
          } @else {
            <div class="item">
              <ng-container *ngTemplateOutlet="body; context: { $implicit: n, i }" />
            </div>
          }
        </li>
      }
    </ol>

    <ng-template #body let-n let-i="i">
      <span class="num mono" aria-hidden="true">{{ (i + 1).toString().padStart(2, '0') }}</span>
      <span class="head">
        <span class="title">{{ n.author }}</span>
        @if (n.role | l; as role) {
          <span class="source mono">{{ role }}</span>
        }
      </span>
      <span class="summary">{{ n.quote | l }}</span>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
    }
    .news {
      margin: 0;
      padding: 0;
      list-style: none;
      border-top: 1px solid var(--line);
    }
    .item {
      display: grid;
      grid-template-columns: 2.6rem minmax(0, 1fr);
      gap: var(--space-3) var(--space-4);
      padding: var(--space-6) 0;
      border-bottom: 1px solid var(--line);
      color: inherit;
      text-decoration: none;
    }
    .num {
      padding-top: 0.35em;
      color: var(--fg-3);
      font-size: var(--fs-small);
      transition: color var(--dur-2);
    }
    .head {
      display: grid;
      gap: 0.55rem;
      align-content: start;
    }
    .title {
      font-family: var(--font-display);
      font-weight: var(--weight-display);
      font-size: var(--fs-h3);
      line-height: 1.1;
      letter-spacing: -0.025em;
      text-wrap: balance;
      transition: color var(--dur-2);
    }
    .source,
    .where {
      font-size: var(--fs-micro);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--fg-2);
    }
    .summary,
    .where {
      grid-column: 2;
    }
    .summary {
      max-width: 60ch;
      color: var(--fg-2);
      text-wrap: pretty;
    }
    .where {
      display: inline-flex;
      align-items: center;
      gap: 0.35em;
      justify-self: start;
      transition: color var(--dur-2);
    }
    .arrow {
      transition: transform var(--dur-2) var(--ease-out);
    }
    @media (min-width: 900px) {
      .item {
        grid-template-columns: 3.5rem minmax(0, 5fr) minmax(0, 6fr) minmax(9rem, auto);
        align-items: start;
      }
      .summary,
      .where {
        grid-column: auto;
      }
      .summary {
        padding-top: 0.2em;
      }
      .where {
        justify-self: end;
        padding-top: 0.45em;
      }
    }
    @media (hover: hover) {
      a.item:hover .title,
      a.item:hover .num,
      a.item:hover .where {
        color: var(--accent);
      }
      a.item:hover .arrow {
        transform: translate(2px, -2px);
      }
    }
    a.item:focus-visible {
      outline-offset: 4px;
    }
    @media (prefers-reduced-motion: reduce) {
      .arrow {
        transition: none;
      }
    }
  `,
})
export class TechNewsComponent {
  readonly items = input.required<Testimonial[]>();

  /** "github.com" for https://github.com/… */
  host(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
}
