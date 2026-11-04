import { Component, ElementRef, PLATFORM_ID, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import type { MediaDto, ProjectDetail, Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { LinkDirective } from '../../shared/curtain/link.directive';
import { CursorDirective } from '../../shared/cursor/cursor.directive';
import { MagneticDirective } from '../../shared/cursor/magnetic.directive';
import { IphoneComponent } from '../../shared/iphone/iphone.component';
import { FooterComponent } from '../../shared/ui/footer.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { MarkdownComponent } from '../../shared/ui/markdown.component';
import { RevealDirective } from '../../shared/ui/reveal.directive';
import { ShowcaseComponent } from '../../shared/ui/showcase.component';
import { Visual, fromMedia, fromShot, shotAsMedia, shotsFor } from '../../shared/ui/shots';
import { SliderComponent } from '../../shared/ui/slider.component';
import { NoDotPipe } from '../../shared/ui/text';

@Component({
  selector: 'app-project',
  imports: [
    TranslatePipe,
    LocalizedPipe,
    NoDotPipe,
    LinkDirective,
    CursorDirective,
    MagneticDirective,
    IphoneComponent,
    FooterComponent,
    IconComponent,
    MarkdownComponent,
    RevealDirective,
    ShowcaseComponent,
    SliderComponent,
  ],
  template: `
    <main id="main" class="page" [style.--accent-project]="project()?.accentColor">
      @if (project(); as p) {
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
            <div class="wide"><dt>{{ 'common.stack' | t }}</dt><dd>{{ p.stack.join(' · ') }}</dd></div>
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
            [cover]="p.cover"
            [mobileMedia]="p.mobile[0]"
            [site]="p.liveUrl"
            [live]="live()"
            [priority]="true"
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

        <!-- ── Gallery slider ─────────────────────────────────────────── -->
        @if (gallery().length) {
          <section class="gallery">
            <div class="container gallery-head">
              <span class="eyebrow" appReveal>{{ 'project.gallery' | t }}</span>
              <span class="mono small faint" appReveal>{{ 'project.dragHint' | t }}</span>
            </div>
            <app-slider [images]="gallery()" [label]="('project.gallery' | t) + ' — ' + (p.title | l)" (opened)="open($event)" appReveal />
          </section>
        }

        <!-- ── Mobile ─────────────────────────────────────────────────── -->
        @if (phoneImages().length || canLive()) {
          <section class="container mobile">
            <div class="mobile-text">
              <span class="eyebrow" appReveal>{{ 'project.onMobile' | t }}</span>
              <h2 class="h2" appReveal revealSplit="words">{{ 'project.onMobileTitle' | t }}</h2>
              @if (live()) {
                <p class="muted">{{ 'project.liveInPhone' | t }}</p>
              }
            </div>
            <div class="mobile-stage" appReveal>
              <app-iphone
                [images]="phoneImages()"
                [src]="live() ? p.liveUrl : null"
                [title]="p.title | l"
                [tagline]="p.tagline | l"
                [accent]="p.accentColor"
              />
            </div>
          </section>
        }

        <!-- ── Prev / next ───────────────────────────────────────────── -->
        <nav class="container neighbours" [attr.aria-label]="'project.neighbours' | t">
          @if (p.previous; as prev) {
            <a class="neighbour" [appLink]="i18n.path('project', prev.slug)" [linkLabel]="prev.title | l" appCursor="label" [cursorLabel]="'common.previous' | t">
              <span class="eyebrow plain">← {{ 'project.previousProject' | t }}</span>
              <span class="h2">{{ prev.title | l }}</span>
            </a>
          } @else {
            <span></span>
          }
          @if (p.next; as next) {
            <a class="neighbour next" [appLink]="i18n.path('project', next.slug)" [linkLabel]="next.title | l" appCursor="label" [cursorLabel]="'common.next' | t">
              <span class="eyebrow plain">{{ 'project.nextProject' | t }} →</span>
              <span class="h2">{{ next.title | l }}</span>
            </a>
          }
        </nav>

        <dialog class="lightbox" #lightbox (click)="closeLightbox($event)">
          @if (lightboxImage(); as img) {
            <img [src]="img.src" [alt]="img.alt" [width]="img.w" [height]="img.h" />
          }
        </dialog>
      }

      <app-footer [settings]="settings()" />
    </main>
  `,
  styles: `
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
      display: grid;
      place-items: center;
      padding: var(--space-6) 0;
      border-radius: var(--radius-l);
      background:
        radial-gradient(60% 60% at 50% 50%, color-mix(in srgb, var(--accent-project, var(--accent)) 22%, transparent), transparent 70%),
        var(--bg-3);
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
    .neighbour .h2 {
      transition: color var(--dur-2);
    }
    .neighbour:hover .h2 {
      font-family: var(--font-serif);
      font-style: italic;
      font-weight: 400;
      letter-spacing: -0.02em;
      color: var(--accent);
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

  private readonly seo = inject(SeoService);
  private readonly analytics = inject(AnalyticsService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly i18n = inject(I18nService);

  readonly live = signal(false);
  readonly lightboxImage = signal<Visual | null>(null);
  private readonly lightbox = viewChild<ElementRef<HTMLDialogElement>>('lightbox');

  readonly canLive = computed(() => {
    const p = this.project();
    return !!p?.allowIframe && !!p.liveUrl;
  });

  /** back-office gallery first, otherwise the README captures */
  readonly gallery = computed<Visual[]>(() => {
    const p = this.project();
    if (!p) return [];
    const title = this.i18n.l(p.title);
    if (p.gallery.length) {
      return p.gallery.map((m, i) => fromMedia(m, this.i18n.l(m.alt) || this.i18n.t('project.screenshot', { n: i + 1 }))!);
    }
    return shotsFor(p.slug).gallery.map((s, i) => fromShot(s, `${title} — ${this.i18n.t('project.screenshot', { n: i + 1 })}`)!);
  });

  readonly phoneImages = computed<MediaDto[]>(() => {
    const p = this.project();
    if (!p) return [];
    if (p.mobile.length) return p.mobile;
    const shot = shotsFor(p.slug).mobile;
    return shot ? [shotAsMedia(shot, this.i18n.t('project.shotAlt', { title: this.i18n.l(p.title) }))] : [];
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
      const shot = shotsFor(p.slug).desktop;
      this.seo.set({
        title,
        description,
        page: 'project',
        slug: p.slug,
        type: 'article',
        image: p.cover?.url ?? p.gallery[0]?.url ?? (shot ? origin + shot.src : null),
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
      if (this.browser) {
        untracked(() => this.analytics.projectView(p.slug, this.i18n.path('project', p.slug)));
      }
    });
  }

  outbound(): void {
    const p = this.project();
    if (p) this.analytics.outbound(p.slug, this.i18n.path('project', p.slug));
  }

  open(index: number): void {
    const img = this.gallery()[index];
    if (!img) return;
    this.lightboxImage.set(img);
    this.lightbox()?.nativeElement.showModal();
  }

  closeLightbox(event: MouseEvent): void {
    const dialog = this.lightbox()?.nativeElement;
    if (!dialog) return;
    if (event.target === dialog || (event.target as HTMLElement).tagName === 'IMG') {
      dialog.close();
      this.lightboxImage.set(null);
    }
  }
}
