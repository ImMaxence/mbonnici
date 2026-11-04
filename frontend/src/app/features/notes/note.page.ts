import { Component, computed, effect, inject, input } from '@angular/core';
import type { ArticleDetail, Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { LinkDirective } from '../../shared/curtain/link.directive';
import { CursorDirective } from '../../shared/cursor/cursor.directive';
import { FooterComponent } from '../../shared/ui/footer.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ImgComponent } from '../../shared/ui/img.component';
import { MarkdownComponent } from '../../shared/ui/markdown.component';
import { PreviewBannerComponent } from '../../shared/ui/preview-banner.component';
import { RevealDirective } from '../../shared/ui/reveal.directive';
import { RollTextComponent } from '../../shared/ui/roll-text.component';
import { NoDotPipe } from '../../shared/ui/text';

@Component({
  selector: 'app-note',
  imports: [
    TranslatePipe,
    LocalizedPipe,
    NoDotPipe,
    LinkDirective,
    CursorDirective,
    FooterComponent,
    IconComponent,
    ImgComponent,
    MarkdownComponent,
    PreviewBannerComponent,
    RevealDirective,
    RollTextComponent,
  ],
  template: `
    <main id="main" class="page">
      @if (article(); as a) {
        @if (preview()) {
          <app-preview-banner [edit]="'/admin/notes/' + a.id" />
        }
        <article>
          <header class="container head">
            <a class="back eyebrow plain" [appLink]="i18n.path('notes')" [linkLabel]="'nav.notes' | t">
              <app-icon name="chevron-left" [size]="14" /> {{ 'notes.all' | t }}
            </a>
            <h1 class="display title" appReveal revealSplit="words">{{ a.title | l }}</h1>
            @if (a.summary | l; as s) {
              <p class="lead" appReveal [revealDelay]="200">{{ s | noDot }}</p>
            }
            <p class="meta mono" appReveal [revealDelay]="260">
              @if (a.publishedAt) {
                <time [attr.datetime]="a.publishedAt">{{ date(a.publishedAt) }}</time>
              }
              <span>{{ 'notes.minutes' | t: { n: minutes() } }}</span>
              @for (t of a.tags; track t) {
                <span>#{{ t }}</span>
              }
            </p>
          </header>

          @if (a.cover; as c) {
            <div class="container cover" appReveal [revealDelay]="120">
              <app-img [media]="c" [priority]="true" sizes="(max-width: 720px) 100vw, 1200px" />
            </div>
          }

          <div class="container body">
            <app-md [text]="a.body | l" />
          </div>
        </article>

        @if (a.previous || a.next) {
          <nav class="container neighbours" [attr.aria-label]="'notes.neighbours' | t">
            @if (a.previous; as prev) {
              <a class="neighbour roll-trigger" [appLink]="i18n.path('note', prev.slug)" [linkLabel]="prev.title | l" appCursor="label" [cursorLabel]="'notes.read' | t">
                <span class="eyebrow plain">← {{ 'notes.newer' | t }}</span>
                <app-roll-text class="h3" [text]="prev.title | l" />
              </a>
            } @else {
              <span></span>
            }
            @if (a.next; as next) {
              <a class="neighbour next roll-trigger" [appLink]="i18n.path('note', next.slug)" [linkLabel]="next.title | l" appCursor="label" [cursorLabel]="'notes.read' | t">
                <span class="eyebrow plain">{{ 'notes.older' | t }} →</span>
                <app-roll-text class="h3" [text]="next.title | l" />
              </a>
            }
          </nav>
        }
      }

      <app-footer [settings]="settings()" />
    </main>
  `,
  styles: `
    .head {
      display: grid;
      gap: var(--space-5);
      padding: var(--space-7) 0 var(--space-6);
      max-width: 1100px;
    }
    .back {
      justify-self: start;
      transition: color var(--dur-1);
    }
    .back:hover {
      color: var(--fg);
    }
    .title {
      font-size: clamp(2.6rem, 1rem + 6vw, 7rem);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem 1.1rem;
      margin: 0;
      padding-top: var(--space-4);
      border-top: 1px solid var(--line-strong);
      font-size: var(--fs-micro);
      color: var(--fg-3);
    }
    .cover {
      margin-bottom: var(--space-7);
    }
    .cover app-img {
      border-radius: var(--radius-m);
      overflow: hidden;
    }
    .body {
      display: grid;
      justify-items: center;
    }
    .body app-md {
      width: 100%;
      max-width: 68ch;
      font-size: calc(var(--fs-body) * 1.12);
    }
    .neighbours {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-5);
      margin-top: var(--section);
      padding-top: var(--space-6);
      border-top: 1px solid var(--line-strong);
    }
    .neighbour {
      display: grid;
      gap: var(--space-3);
      align-content: start;
    }
    .neighbour.next {
      text-align: right;
      justify-items: end;
    }
  `,
})
export class NotePage {
  readonly article = input<ArticleDetail>();
  readonly settings = input<Settings>();
  /** back-office preview of a draft (route data) */
  readonly preview = input(false);
  readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  readonly minutes = computed(() => {
    const a = this.article();
    return a ? (this.i18n.lang() === 'en' ? a.minutes.en : a.minutes.fr) : 1;
  });

  date(iso: string): string {
    return this.i18n.formatDate(iso, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  constructor() {
    effect(() => {
      const a = this.article();
      this.i18n.lang();
      if (!a) return;
      const title = this.i18n.l(a.title);
      const description = this.i18n.l(a.summary) || this.i18n.t('meta.notes.description');
      const url = this.seo.origin + this.i18n.path('note', a.slug);
      this.seo.set({
        title,
        description,
        page: 'note',
        slug: a.slug,
        type: 'article',
        image: a.cover?.url ?? null,
        ...(this.preview() ? { noindex: true } : {}),
        jsonLd: [
          {
            '@type': 'BlogPosting',
            '@id': url,
            headline: title,
            description,
            url,
            ...(a.publishedAt ? { datePublished: a.publishedAt } : {}),
            dateModified: a.updatedAt,
            keywords: a.tags.join(', '),
            ...(a.cover ? { image: this.seo.origin + a.cover.url } : {}),
            author: { '@id': `${this.seo.origin}/#person` },
            inLanguage: this.i18n.lang(),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: this.i18n.t('nav.home'), item: this.seo.origin + this.i18n.path('home') },
              { '@type': 'ListItem', position: 2, name: this.i18n.t('nav.notes'), item: this.seo.origin + this.i18n.path('notes') },
              { '@type': 'ListItem', position: 3, name: title, item: url },
            ],
          },
        ],
      });
    });
  }
}
