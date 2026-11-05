import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Testimonial } from '../../core/api/models';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from './icon.component';
import { RevealDirective } from './reveal.directive';

/**
 * What people the owner worked with say: each quote set large in the serif italic, the author and
 * their role below in small mono capitals, and a link to where the quote can be read.
 */
@Component({
  selector: 'app-testimonials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LocalizedPipe, TranslatePipe, IconComponent, RevealDirective],
  template: `
    <ul class="quotes" [class.single]="items().length === 1">
      @for (q of items(); track q.id; let i = $index) {
        <li appReveal [revealDelay]="(i % 2) * 90">
          <figure>
            <blockquote>
              <p>{{ q.quote | l }}</p>
            </blockquote>
            <figcaption>
              <span class="who">{{ q.author }}</span>
              @if (q.role | l; as role) {
                <span class="role">{{ role }}</span>
              }
              @if (q.url) {
                <a class="source" [href]="q.url" target="_blank" rel="noopener noreferrer">
                  {{ 'testimonials.source' | t }} <app-icon name="arrow-up-right" [size]="13" />
                </a>
              }
            </figcaption>
          </figure>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }
    .quotes {
      display: grid;
      gap: clamp(2.5rem, 6vw, 4.5rem) var(--gutter);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    @media (min-width: 900px) {
      .quotes:not(.single) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    figure {
      display: grid;
      gap: var(--space-5);
      margin: 0;
      padding-top: var(--space-5);
      border-top: 1px solid var(--line);
    }
    blockquote {
      margin: 0;
    }
    blockquote p {
      font-family: var(--font-serif);
      font-style: italic;
      font-size: clamp(1.45rem, 1.1rem + 1.4vw, 2.2rem);
      line-height: 1.22;
      letter-spacing: -0.01em;
      color: var(--fg);
      text-wrap: pretty;
    }
    .single blockquote p {
      max-width: 34ch;
      font-size: clamp(1.7rem, 1.2rem + 2vw, 3rem);
    }
    blockquote p::before {
      content: '“';
    }
    blockquote p::after {
      content: '”';
    }
    :host-context(html[lang='fr']) blockquote p::before {
      content: '« ';
    }
    :host-context(html[lang='fr']) blockquote p::after {
      content: ' »';
    }
    figcaption {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.35rem 1rem;
      font-family: var(--font-mono);
      font-size: var(--fs-micro);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .who {
      color: var(--fg);
      font-weight: 600;
    }
    .role {
      color: var(--fg-2);
    }
    .source {
      display: inline-flex;
      align-items: center;
      gap: 0.3em;
      margin-left: auto;
      color: var(--fg-2);
      text-decoration: none;
      transition: color var(--dur-1);
    }
    @media (hover: hover) {
      .source:hover {
        color: var(--accent);
      }
    }
  `,
})
export class TestimonialsComponent {
  readonly items = input.required<Testimonial[]>();
}
