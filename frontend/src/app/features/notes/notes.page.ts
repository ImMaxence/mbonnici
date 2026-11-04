import { Component, effect, inject, input } from '@angular/core';
import type { ArticleCard, Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { LinkDirective } from '../../shared/curtain/link.directive';
import { CursorDirective } from '../../shared/cursor/cursor.directive';
import { FooterComponent } from '../../shared/ui/footer.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { RevealDirective } from '../../shared/ui/reveal.directive';
import { NoDotPipe } from '../../shared/ui/text';

/** Notes: short articles written in the back office (Markdown, FR / EN). */
@Component({
  selector: 'app-notes',
  imports: [TranslatePipe, LocalizedPipe, NoDotPipe, FooterComponent, RevealDirective, LinkDirective, CursorDirective, IconComponent],
  template: `
    <main id="main" class="page">
      <header class="container page-head">
        <span class="eyebrow" appReveal>{{ 'nav.notes' | t }}</span>
        <h1 class="display" appReveal revealSplit="words">
          {{ 'notes.titleA' | t }} <span class="accent-word">{{ 'notes.titleB' | t }}</span>
        </h1>
        <div class="head-foot">
          <p class="lead" appReveal [revealDelay]="200">{{ 'notes.subtitle' | t }}</p>
          <a class="rss mono" [href]="'/' + i18n.lang() + '/rss.xml'" appReveal [revealDelay]="240">
            <app-icon name="rss" [size]="14" /> RSS
          </a>
        </div>
      </header>

      <section class="container">
        @if (!list().length) {
          <p class="muted">{{ 'notes.empty' | t }}</p>
        }
        <ol class="notes">
          @for (a of list(); track a.id; let i = $index) {
            <li appReveal [revealDelay]="Math.min(i, 6) * 60">
              <a class="note roll-trigger" [appLink]="i18n.path('note', a.slug)" [linkLabel]="a.title | l" appCursor="label" [cursorLabel]="'notes.read' | t">
                <span class="when mono">{{ date(a.publishedAt) }}</span>
                <div class="what">
                  <h2 class="title">{{ a.title | l }}</h2>
                  @if (a.summary | l; as s) {
                    <p class="summary">{{ s | noDot }}</p>
                  }
                  <p class="meta mono">
                    <span>{{ 'notes.minutes' | t: { n: minutes(a) } }}</span>
                    @for (t of a.tags; track t) {
                      <span>#{{ t }}</span>
                    }
                  </p>
                </div>
                <span class="go" aria-hidden="true"><app-icon name="arrow-up-right" [size]="20" /></span>
              </a>
            </li>
          }
        </ol>
      </section>

      <app-footer [settings]="settings()" />
    </main>
  `,
  styles: `
    .page-head {
      display: grid;
      gap: var(--space-5);
      padding: var(--space-8) 0 var(--space-7);
    }
    .head-foot {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: var(--space-5);
      padding-top: var(--space-4);
      border-top: 1px solid var(--line-strong);
    }
    .rss {
      display: inline-flex;
      align-items: center;
      gap: 0.45em;
      font-size: var(--fs-micro);
      color: var(--fg-2);
    }
    .rss:hover {
      color: var(--accent);
    }
    .notes {
      border-top: 1px solid var(--line-strong);
    }
    .notes li {
      border-bottom: 1px solid var(--line);
    }
    .note {
      display: grid;
      grid-template-columns: 9rem minmax(0, 1fr) auto;
      gap: var(--space-4);
      align-items: start;
      padding: clamp(1.4rem, 3vw, 2.4rem) 0;
    }
    .when {
      padding-top: 0.6em;
      font-size: var(--fs-micro);
      color: var(--fg-3);
    }
    .what {
      display: grid;
      gap: 0.6rem;
    }
    .title {
      margin: 0;
      font-family: var(--font-display);
      font-weight: var(--weight-display);
      font-size: clamp(1.7rem, 1rem + 2.6vw, 3.4rem);
      letter-spacing: -0.04em;
      line-height: 1.04;
      transition:
        color var(--dur-2),
        transform 0.6s var(--ease-out);
    }
    .summary {
      margin: 0;
      max-width: 62ch;
      color: var(--fg-2);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem 1rem;
      margin: 0;
      font-size: var(--fs-micro);
      color: var(--fg-3);
    }
    .go {
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      border: 1px solid var(--line-strong);
      transition:
        transform 0.5s var(--ease-out),
        background-color var(--dur-2),
        color var(--dur-2);
    }
    @media (hover: hover) {
      .note:hover .title {
        color: var(--accent);
        transform: translateX(0.6rem);
      }
      .note:hover .go {
        transform: rotate(45deg);
        background: var(--fg);
        color: var(--bg);
      }
    }
    @media (max-width: 720px) {
      .note {
        grid-template-columns: minmax(0, 1fr);
        gap: 0.5rem;
      }
      .when {
        padding: 0;
      }
      .go {
        display: none;
      }
    }
  `,
})
export class NotesPage {
  readonly articles = input<ArticleCard[]>();
  readonly settings = input<Settings>();
  readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  readonly Math = Math;

  list(): ArticleCard[] {
    return this.articles() ?? [];
  }

  date(iso: string | null): string {
    return iso ? this.i18n.formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }

  minutes(a: ArticleCard): number {
    return this.i18n.lang() === 'en' ? a.minutes.en : a.minutes.fr;
  }

  constructor() {
    effect(() => {
      this.i18n.lang();
      const list = this.list();
      this.seo.set({
        title: this.i18n.t('meta.notes.title'),
        description: this.i18n.t('meta.notes.description'),
        page: 'notes',
        jsonLd: [
          {
            '@type': 'Blog',
            name: this.i18n.t('meta.notes.title'),
            url: this.seo.origin + this.i18n.path('notes'),
            author: { '@id': `${this.seo.origin}/#person` },
            blogPost: list.map((a) => ({
              '@type': 'BlogPosting',
              headline: this.i18n.l(a.title),
              url: this.seo.origin + this.i18n.path('note', a.slug),
              ...(a.publishedAt ? { datePublished: a.publishedAt } : {}),
            })),
          },
        ],
      });
    });
  }
}
