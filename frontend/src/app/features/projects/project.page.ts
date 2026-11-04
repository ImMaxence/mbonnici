import { Component, PLATFORM_ID, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { CASE_STUDY_KEYS, type ProjectDetail, type Settings } from '../../core/api/models';
import { InsightsStore } from '../../core/api/insights.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { LinkDirective } from '../../shared/curtain/link.directive';
import { CursorDirective } from '../../shared/cursor/cursor.directive';
import { MagneticDirective } from '../../shared/cursor/magnetic.directive';
import { FooterComponent } from '../../shared/ui/footer.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { MarkdownComponent } from '../../shared/ui/markdown.component';
import { RevealDirective } from '../../shared/ui/reveal.directive';
import { ShowcaseComponent } from '../../shared/ui/showcase.component';
import { Visual, fromMedia } from '../../shared/ui/shots';
import { SliderComponent } from '../../shared/ui/slider.component';
import { RollTextComponent } from '../../shared/ui/roll-text.component';
import { NoDotPipe } from '../../shared/ui/text';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { PreviewBannerComponent } from '../../shared/ui/preview-banner.component';

@Component({
  selector: 'app-project',
  imports: [
    TranslatePipe,
    LocalizedPipe,
    NoDotPipe,
    LinkDirective,
    CursorDirective,
    MagneticDirective,
    FooterComponent,
    IconComponent,
    MarkdownComponent,
    RevealDirective,
    ShowcaseComponent,
    SliderComponent,
    RollTextComponent,
    StatusPillComponent,
    PreviewBannerComponent,
  ],
  template: `
    <main id="main" class="page" [style.--accent-project]="project()?.accentColor">
      @if (project(); as p) {
        @if (preview()) {
          <app-preview-banner [edit]="'/admin/projects/' + p.id" />
        }
        <header class="container head">
          <a class="back eyebrow plain" [appLink]="i18n.path('projects')" [linkLabel]="'nav.projects' | t">
            <app-icon name="chevron-left" [size]="14" /> {{ 'project.backToProjects' | t }}
          </a>
          <h1 class="display" appReveal revealSplit="words">{{ p.title | l }}</h1>
          <div class="head-foot">
            <p class="lead" appReveal [revealDelay]="200">{{ p.tagline | l | noDot }}</p>
            <div class="links" appReveal [revealDelay]="300">
              @if (p.liveUrl; as live) {
                <a class="btn btn-accent" [href]="live" target="_blank" rel="noopener noreferrer" (click)="outbound()" appMagnetic>
                  {{ 'project.visit' | t }} <app-icon class="arrow" name="arrow-up-right" [size]="16" />
                </a>
              }
              @if (p.repoUrl; as repo) {
                <a class="btn btn-ghost" [href]="repo" target="_blank" rel="noopener noreferrer" (click)="outbound()" appMagnetic>
                  <app-icon name="github" [size]="16" /> {{ 'project.code' | t }}
                </a>
              }
            </div>
          </div>
          <dl class="facts" appReveal [revealDelay]="360">
            <div><dt>{{ 'common.category' | t }}</dt><dd>{{ 'categories.' + p.category | t }}</dd></div>
            <div><dt>{{ 'common.year' | t }}</dt><dd>{{ p.year ?? '—' }}</dd></div>
            <div class="wide">
              <dt>{{ 'common.stack' | t }}</dt>
              <dd class="stack">
                @for (s of p.stack; track s; let last = $last) {
                  <a [appLink]="i18n.path('projects') + '?tech=' + encode(s)" [linkLabel]="'nav.projects' | t" [attr.aria-label]="'projects.allWith' | t: { tech: s }">{{ s }}</a>
                  @if (!last) {
                    <span class="sep" aria-hidden="true">·</span>
                  }
                }
              </dd>
            </div>
            @if (insight()?.site; as site) {
              <div><dt>{{ 'project.status' | t }}</dt><dd><app-status-pill [site]="site" /></dd></div>
            }
            @if (insight()?.repo; as repo) {
              <div class="wide repo">
                <dt>GitHub</dt>
                <dd>
                  <span class="stat"><app-icon name="star" [size]="13" /> {{ repo.stars }}</span>
                  @if (repo.pushedAt) {
                    <span class="stat">{{ 'project.pushed' | t: { when: ago(repo.pushedAt) } }}</span>
                  }
                  @if (repo.languages.length) {
                    <span class="langs" role="img" [attr.aria-label]="languagesLabel(repo.languages)">
                      @for (l of repo.languages; track l.name; let i = $index) {
                        <i [style.flex-grow]="l.share" [attr.data-i]="i"></i>
                      }
                    </span>
                    <span class="lang-names mono">
                      @for (l of repo.languages; track l.name; let i = $index) {
                        <span><b [attr.data-i]="i"></b>{{ l.name }} {{ percent(l.share) }}</span>
                      }
                    </span>
                  }
                </dd>
              </div>
            }
          </dl>
        </header>

        <!-- ── The product ─────────────────────────────────────────── -->
        <section class="container hero-shot" appReveal [revealDelay]="120">
          @if (canLive()) {
            <div class="view-switch" role="radiogroup" [attr.aria-label]="'project.view' | t">
              <button type="button" role="radio" [attr.aria-checked]="!live()" (click)="live.set(false)">{{ 'project.viewShot' | t }}</button>
              <button type="button" role="radio" [attr.aria-checked]="live()" (click)="live.set(true)">
                <i class="rec" aria-hidden="true"></i>{{ 'project.viewLive' | t }}
              </button>
            </div>
          }
          <app-showcase
            [slug]="p.slug"
            [title]="p.title | l"
            [accent]="p.accentColor"
            [mode]="p.displayMode"
            [cover]="p.cover"
            [mobileList]="p.mobile"
            [site]="p.liveUrl"
            [live]="live()"
            [priority]="true"
            sizes="(max-width: 720px) 96vw, 84vw"
          />
          @if (live()) {
            <p class="small faint hint">{{ 'project.iframeHint' | t }}</p>
          }
        </section>

        <!-- ── Description ───────────────────────────────────────────── -->
        <section class="container body">
          <span class="eyebrow" appReveal>{{ 'project.about' | t }}</span>
          <app-md [text]="p.description | l" appReveal [revealDelay]="80" />
        </section>

        <!-- ── Case study ────────────────────────────────────────────── -->
        @if (caseStudy().length) {
          <section class="container case" [attr.aria-label]="'project.caseStudy' | t">
            <div class="case-head">
              <span class="eyebrow" appReveal>{{ 'project.caseStudy' | t }}</span>
              <h2 class="h2" appReveal revealSplit="words">{{ 'project.caseStudyTitle' | t }}</h2>
            </div>
            <div class="case-grid">
              @for (c of caseStudy(); track c.key; let i = $index) {
                <article class="case-item" appReveal [revealDelay]="i * 80">
                  <h3 class="case-label">{{ 'project.case.' + c.key | t }}</h3>
                  <app-md [text]="c.text" />
                </article>
              }
            </div>
          </section>
        }

        <!-- ── Gallery slider ─────────────────────────────────────────── -->
        @if (gallery().length) {
          <section class="gallery">
            <div class="container gallery-head">
              <span class="eyebrow" appReveal>{{ 'project.gallery' | t }}</span>
              <span class="mono small faint" appReveal>{{ 'project.dragHint' | t }}</span>
            </div>
            <app-slider [images]="gallery()" [label]="('project.gallery' | t) + ' — ' + (p.title | l)" appReveal />
          </section>
        }

        <!-- ── Mobile ─────────────────────────────────────────────────── -->
        @if (hasPhone() && p.displayMode !== 'MOBILE' && p.displayMode !== 'DESKTOP') {
          <section class="container mobile">
            <div class="mobile-text">
              <span class="eyebrow" appReveal>{{ 'project.onMobile' | t }}</span>
              <h2 class="h2" appReveal revealSplit="words">{{ 'project.onMobileTitle' | t }}</h2>
            </div>
            <div class="mobile-stage" appReveal>
              <app-showcase [slug]="p.slug" [title]="p.title | l" [accent]="p.accentColor" mode="MOBILE" [mobileList]="p.mobile" [site]="p.liveUrl" />
            </div>
          </section>
        }

        <!-- ── Similar project? ─────────────────────────────────────── -->
        @if (!preview()) {
          <section class="container similar" appReveal>
            <p class="similar-text">{{ 'project.similar' | t }}</p>
            <a class="btn btn-lg" [appLink]="contactPath(p.slug)" [linkLabel]="'nav.contact' | t" appMagnetic>
              {{ 'project.similarCta' | t }} <app-icon class="arrow" name="arrow-right" [size]="18" />
            </a>
          </section>
        }

        <!-- ── Prev / next ───────────────────────────────────────────── -->
        <nav class="container neighbours" [attr.aria-label]="'project.neighbours' | t">
          @if (p.previous; as prev) {
            <a class="neighbour roll-trigger" [appLink]="i18n.path('project', prev.slug)" [linkLabel]="prev.title | l" appCursor="label" [cursorLabel]="'common.previous' | t">
              <span class="eyebrow plain">← {{ 'project.previousProject' | t }}</span>
              <app-roll-text class="h2" [text]="prev.title | l" />
            </a>
          } @else {
            <span></span>
          }
          @if (p.next; as next) {
            <a class="neighbour next roll-trigger" [appLink]="i18n.path('project', next.slug)" [linkLabel]="next.title | l" appCursor="label" [cursorLabel]="'common.next' | t">
              <span class="eyebrow plain">{{ 'project.nextProject' | t }} →</span>
              <app-roll-text class="h2" [text]="next.title | l" />
            </a>
          }
        </nav>

      }

      <app-footer [settings]="settings()" />
    </main>
  `,
  styles: `
    .facts .stack {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      row-gap: 0.2rem;
    }
    .stack a {
      display: inline;
      background-image: linear-gradient(currentColor, currentColor);
      background-size: 0 1px;
      background-repeat: no-repeat;
      background-position: 0 100%;
      transition:
        background-size 0.45s var(--ease-out),
        color var(--dur-1);
    }
    .stack a:hover,
    .stack a:focus-visible {
      color: var(--accent);
      background-size: 100% 1px;
    }
    .stack .sep {
      margin: 0 0.4em;
      color: var(--fg-3);
    }
    .repo dd {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1.1rem;
    }
    .stat {
      display: inline-flex;
      align-items: center;
      gap: 0.35em;
      white-space: nowrap;
    }
    .langs {
      display: flex;
      gap: 2px;
      width: min(220px, 100%);
      height: 6px;
      border-radius: 99px;
      overflow: hidden;
    }
    .langs i {
      flex-basis: 0;
      min-width: 3px;
    }
    .lang-names {
      display: flex;
      flex-wrap: wrap;
      gap: 0.2rem 0.9rem;
      font-size: var(--fs-micro);
      color: var(--fg-2);
    }
    .lang-names b {
      display: inline-block;
      width: 7px;
      height: 7px;
      margin-right: 0.35em;
      border-radius: 50%;
    }
    [data-i='0'] {
      background: var(--accent);
    }
    [data-i='1'] {
      background: var(--fg);
    }
    [data-i='2'] {
      background: var(--fg-3);
    }
    [data-i='3'] {
      background: var(--line-strong);
    }
    .case {
      display: grid;
      gap: var(--space-6);
      padding-top: var(--section);
    }
    .case-head {
      display: grid;
      gap: var(--space-3);
      max-width: 40ch;
    }
    .case-grid {
      display: grid;
      gap: var(--space-6) var(--gutter);
      border-top: 1px solid var(--line-strong);
      padding-top: var(--space-6);
    }
    @media (min-width: 900px) {
      .case-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    .case-item {
      display: grid;
      align-content: start;
      gap: var(--space-3);
    }
    .case-label {
      margin: 0;
      font-family: var(--font-serif);
      font-style: italic;
      font-weight: 400;
      font-size: clamp(1.6rem, 1rem + 1.8vw, 2.4rem);
      letter-spacing: -0.01em;
      color: var(--accent);
    }
    .similar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-5);
      margin-top: var(--section);
      padding: var(--space-6) 0;
      border-top: 1px solid var(--line-strong);
      border-bottom: 1px solid var(--line-strong);
    }
    .similar-text {
      margin: 0;
      max-width: 22ch;
      font-family: var(--font-display);
      font-weight: var(--weight-display);
      font-size: clamp(1.8rem, 1rem + 3vw, 3.4rem);
      letter-spacing: -0.04em;
      line-height: 1.02;
    }
    .head {
      display: grid;
      gap: var(--space-5);
      padding: var(--space-7) 0 var(--space-6);
    }
    .back {
      justify-self: start;
      cursor: pointer;
      transition: color var(--dur-1);
    }
    .back:hover {
      color: var(--fg);
    }
    .head-foot {
      display: grid;
      gap: var(--space-5);
      align-items: end;
    }
    @media (min-width: 900px) {
      .head-foot {
        grid-template-columns: 1fr auto;
      }
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      border-top: 1px solid var(--line-strong);
    }
    .facts > div {
      display: grid;
      gap: 0.3rem;
      padding: var(--space-4) var(--space-4) var(--space-4) 0;
    }
    .facts .wide {
      grid-column: span 2;
    }
    @media (max-width: 599px) {
      .facts .wide {
        grid-column: 1 / -1;
      }
    }
    .facts dt {
      font-family: var(--font-mono);
      font-size: var(--fs-micro);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--fg-3);
    }
    .hero-shot {
      display: grid;
      gap: var(--space-4);
      margin-bottom: var(--section);
    }
    .view-switch {
      justify-self: end;
      display: inline-grid;
      grid-auto-flow: column;
      padding: 4px;
      gap: 2px;
      border-radius: var(--radius-pill);
      background: var(--bg-3);
    }
    .view-switch button {
      display: inline-flex;
      align-items: center;
      gap: 0.5em;
      min-height: 38px;
      padding: 0 1rem;
      border-radius: var(--radius-pill);
      font-size: var(--fs-small);
      font-weight: 600;
      color: var(--fg-2);
    }
    .view-switch button[aria-checked='true'] {
      background: var(--fg);
      color: var(--bg);
    }
    .rec {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #e5484d;
      animation: blink 1.4s steps(2) infinite;
    }
    .hint {
      text-align: right;
    }
    .body {
      display: grid;
      gap: var(--space-5);
      padding-bottom: var(--section);
    }
    @media (min-width: 900px) {
      .body {
        grid-template-columns: minmax(180px, 3fr) 9fr;
        align-items: start;
      }
    }
    .body app-md {
      font-size: var(--fs-lead);
      line-height: 1.6;
      max-width: 62ch;
    }
    .gallery {
      padding-bottom: var(--section);
    }
    .gallery-head {
      display: flex;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-5);
    }
    .mobile {
      display: grid;
      gap: var(--space-7);
      align-items: center;
      padding-bottom: var(--section);
    }
    @media (min-width: 900px) {
      .mobile {
        grid-template-columns: 1fr 1fr;
      }
    }
    .mobile-text {
      display: grid;
      gap: var(--space-4);
      align-content: start;
    }
    .mobile-stage {
      min-width: 0;
    }
    .neighbours {
      display: grid;
      border-top: 1px solid var(--line-strong);
    }
    @media (min-width: 720px) {
      .neighbours {
        grid-template-columns: 1fr 1fr;
      }
    }
    .neighbour {
      display: grid;
      gap: 0.6rem;
      padding: var(--space-6) 0;
    }

    .neighbour.next {
      text-align: right;
      justify-items: end;
    }
  `,
})
export class ProjectPage {
  readonly slug = input<string>();
  // resolved by the route (unknown slugs are redirected to the 404 page by the resolver)
  readonly project = input<ProjectDetail>();
  readonly settings = input<Settings>();
  /** back-office preview of a draft (route data): banner, no analytics, not indexed */
  readonly preview = input(false);
  private readonly insights = inject(InsightsStore);
  readonly insight = computed(() => {
    const p = this.project();
    return p ? this.insights.of(p.slug) : null;
  });

  /** the filled sections of the case study, in reading order */
  readonly caseStudy = computed(() => {
    const cs = this.project()?.caseStudy;
    if (!cs) return [];
    return CASE_STUDY_KEYS.map((key) => ({ key, text: this.i18n.l(cs[key]).trim() })).filter((c) => c.text.length > 0);
  });

  private readonly seo = inject(SeoService);
  private readonly analytics = inject(AnalyticsService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly i18n = inject(I18nService);

  readonly live = signal(false);

  readonly canLive = computed(() => {
    const p = this.project();
    return !!p?.allowIframe && !!p.liveUrl;
  });

  /** the gallery of the back office */
  readonly gallery = computed<Visual[]>(() => {
    const p = this.project();
    if (!p) return [];
    return p.gallery.map((m, i) => fromMedia(m, this.i18n.l(m.alt) || this.i18n.t('project.screenshot', { n: i + 1 }))!);
  });

  /** a phone capture exists (back office or README) */
  readonly hasPhone = computed(() => {
    const p = this.project();
    return !!p && p.mobile.length > 0;
  });

  constructor() {
    effect(() => {
      const p = this.project();
      this.i18n.lang();
      if (!p) return;
      untracked(() => this.live.set(false));
      const title = this.i18n.l(p.title);
      const description = this.i18n.l(p.tagline) || this.i18n.t('meta.projects.description');
      const origin = this.seo.origin;
      const url = origin + this.i18n.path('project', p.slug);
      this.seo.set({
        title,
        description,
        page: 'project',
        ...(this.preview() ? { noindex: true } : {}),
        slug: p.slug,
        type: 'article',
        image: p.cover?.url ?? p.gallery[0]?.url ?? null,
        jsonLd: [
          {
            '@type': p.repoUrl ? 'SoftwareSourceCode' : 'CreativeWork',
            '@id': url,
            name: title,
            headline: title,
            description,
            url,
            ...(p.repoUrl ? { codeRepository: p.repoUrl } : {}),
            ...(p.liveUrl ? { sameAs: p.liveUrl } : {}),
            ...(p.stack.length ? { programmingLanguage: p.stack.join(', ') } : {}),
            keywords: [...p.tags, ...p.stack].join(', '),
            dateModified: p.updatedAt,
            ...(p.publishedAt ? { datePublished: p.publishedAt } : {}),
            author: { '@id': `${origin}/#person` },
            inLanguage: this.i18n.lang(),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: this.i18n.t('nav.home'), item: origin + this.i18n.path('home') },
              { '@type': 'ListItem', position: 2, name: this.i18n.t('nav.projects'), item: origin + this.i18n.path('projects') },
              { '@type': 'ListItem', position: 3, name: title, item: url },
            ],
          },
        ],
      });
      if (this.browser && !this.preview()) {
        untracked(() => this.analytics.projectView(p.slug, this.i18n.path('project', p.slug)));
      }
    });
  }

  encode(v: string): string {
    return encodeURIComponent(v);
  }

  contactPath(slug: string): string {
    return this.i18n.path('contact') + '?project=' + encodeURIComponent(slug);
  }

  percent(share: number): string {
    return new Intl.NumberFormat(this.i18n.locale(), { style: 'percent', maximumFractionDigits: 0 }).format(share);
  }

  languagesLabel(langs: { name: string; share: number }[]): string {
    return langs.map((l) => l.name + ' ' + this.percent(l.share)).join(', ');
  }

  /** "3 days ago", "2 months ago" */
  ago(iso: string): string {
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(this.i18n.locale(), { numeric: 'auto' });
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 31_536_000],
      ['month', 2_592_000],
      ['week', 604_800],
      ['day', 86_400],
      ['hour', 3_600],
      ['minute', 60],
    ];
    for (const [unit, sec] of units) {
      if (Math.abs(diff) >= sec) return rtf.format(Math.round(diff / sec), unit);
    }
    return rtf.format(0, 'minute');
  }

  outbound(): void {
    const p = this.project();
    if (p) this.analytics.outbound(p.slug, this.i18n.path('project', p.slug));
  }
}
