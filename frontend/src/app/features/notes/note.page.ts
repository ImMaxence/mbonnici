import { Component, DestroyRef, ElementRef, PLATFORM_ID, afterNextRender, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { ArticleDetail, Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { LinkDirective } from '../../shared/curtain/link.directive';
import { CursorDirective } from '../../shared/cursor/cursor.directive';
import { FooterComponent } from '../../shared/ui/footer.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ImgComponent } from '../../shared/ui/img.component';
import { MarkdownComponent, parseMarkdown } from '../../shared/ui/markdown.component';
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
        <!-- reading progress -->
        <div class="progress" aria-hidden="true"><i #bar></i></div>
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

          <div class="container body" [class.has-toc]="toc().length > 1">
            @if (toc().length > 1) {
              <nav class="toc" [attr.aria-label]="'notes.toc' | t">
                <span class="eyebrow plain">{{ 'notes.toc' | t }}</span>
                <ol>
                  @for (h of toc(); track h.id) {
                    <li [class.sub]="h.level === 3">
                      <a [href]="'#' + h.id" [class.is-active]="active() === h.id" (click)="jump($event, h.id)">{{ h.text }}</a>
                    </li>
                  }
                </ol>
              </nav>
            }
            <div class="text" #text>
              <app-md [text]="a.body | l" />
            </div>
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
    .progress {
      position: fixed;
      inset: 0 0 auto;
      z-index: 150;
      height: 3px;
      pointer-events: none;
    }
    .progress i {
      display: block;
      height: 100%;
      background: var(--accent);
      transform: scaleX(0);
      transform-origin: left;
    }
    .body {
      display: grid;
      justify-items: center;
    }
    .text {
      width: 100%;
      max-width: 68ch;
    }
    .body app-md {
      max-width: none;
      font-size: calc(var(--fs-body) * 1.12);
    }
    .body app-md ::ng-deep :is(h2, h3) {
      scroll-margin-top: 6rem;
    }
    .toc {
      display: none;
    }
    @media (min-width: 1200px) {
      .body.has-toc {
        grid-template-columns: minmax(0, 1fr) minmax(0, 68ch) minmax(0, 1fr);
        align-items: start;
        justify-items: stretch;
      }
      .body.has-toc .text {
        grid-column: 2;
      }
      .toc {
        grid-column: 1;
        grid-row: 1;
        position: sticky;
        top: 7rem;
        display: grid;
        gap: 0.8rem;
        max-width: 15rem;
        padding-right: var(--space-5);
      }
      .toc ol {
        display: grid;
        gap: 0.45rem;
        border-left: 1px solid var(--line);
      }
      .toc li {
        padding-left: 0.9rem;
      }
      .toc li.sub {
        padding-left: 1.7rem;
      }
      .toc a {
        display: block;
        margin-left: -1px;
        font-size: var(--fs-small);
        line-height: 1.35;
        color: var(--fg-3);
        transition: color var(--dur-1);
      }
      .toc a:hover,
      .toc a.is-active {
        color: var(--fg);
      }
      .toc a.is-active {
        box-shadow: -0.9rem 0 0 -0.85rem var(--accent);
      }
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
  private readonly destroyRef = inject(DestroyRef);

  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly bar = viewChild<ElementRef<HTMLElement>>('bar');
  private readonly textEl = viewChild<ElementRef<HTMLElement>>('text');
  /** the headings of the note, for the table of contents */
  readonly toc = computed(() => {
    const a = this.article();
    if (!a) return [];
    return parseMarkdown(this.i18n.l(a.body)).flatMap((b) => (b.t === 'h' ? [{ id: b.id, text: b.text, level: b.level }] : []));
  });
  /** the section being read */
  readonly active = signal('');

  /** smooth scroll to a heading, the address keeps the fragment */
  jump(e: MouseEvent, id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(history.state, '', '#' + id);
    this.active.set(id);
  }

  readonly minutes = computed(() => {
    const a = this.article();
    return a ? (this.i18n.lang() === 'en' ? a.minutes.en : a.minutes.fr) : 1;
  });

  date(iso: string): string {
    return this.i18n.formatDate(iso, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  constructor() {
    afterNextRender(() => {
      if (!this.browser) return;
      let frame = 0;
      const update = () => {
        frame = 0;
        const text = this.textEl()?.nativeElement;
        const bar = this.bar()?.nativeElement;
        if (!text || !bar) return;
        const r = text.getBoundingClientRect();
        const total = r.height - innerHeight * 0.6;
        const done = Math.min(1, Math.max(0, (innerHeight * 0.4 - r.top) / Math.max(1, total)));
        bar.style.transform = `scaleX(${done})`;
        // the last heading above the upper third of the screen
        let current = '';
        for (const h of this.toc()) {
          const el = document.getElementById(h.id);
          if (el && el.getBoundingClientRect().top < innerHeight * 0.3) current = h.id;
        }
        if (current !== this.active()) this.active.set(current);
      };
      const onScroll = () => {
        if (!frame) frame = requestAnimationFrame(update);
      };
      addEventListener('scroll', onScroll, { passive: true });
      addEventListener('resize', onScroll);
      update();
      this.destroyRef.onDestroy(() => {
        removeEventListener('scroll', onScroll);
        removeEventListener('resize', onScroll);
        cancelAnimationFrame(frame);
      });
    });
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
        image: `/api/og/notes/${a.slug}.jpg?lang=${this.i18n.lang()}`,
        imageSize: { width: 1200, height: 630, type: 'image/jpeg' },
        imageAlt: title,
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
