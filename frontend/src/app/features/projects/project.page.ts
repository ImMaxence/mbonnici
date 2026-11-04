import { Component, ElementRef, PLATFORM_ID, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import type { MediaDto, ProjectCard, ProjectDetail, Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { LinkDirective } from '../../shared/curtain/link.directive';
import { CursorDirective } from '../../shared/cursor/cursor.directive';
import { MagneticDirective } from '../../shared/cursor/magnetic.directive';
import { IphoneComponent } from '../../shared/iphone/iphone.component';
import { SceneHostComponent } from '../../shared/scenes/scene-host.component';
import { StackSceneComponent } from '../../shared/scenes/stack-scene.component';
import { FooterComponent } from '../../shared/ui/footer.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ImgComponent } from '../../shared/ui/img.component';
import { MarkdownComponent } from '../../shared/ui/markdown.component';
import { RevealDirective } from '../../shared/ui/reveal.directive';

@Component({
  selector: 'app-project',
  imports: [
    TranslatePipe,
    LocalizedPipe,
    LinkDirective,
    CursorDirective,
    MagneticDirective,
    IphoneComponent,
    SceneHostComponent,
    StackSceneComponent,
    FooterComponent,
    IconComponent,
    ImgComponent,
    MarkdownComponent,
    RevealDirective,
  ],
  template: `
    <main id="main" class="page" [style.--accent]="project()?.accentColor">
      @if (project(); as p) {
        <header class="container head">
          <a class="back eyebrow" [appLink]="i18n.path('projects')" [linkLabel]="'nav.projects' | t">
            <app-icon name="chevron-left" [size]="14" /> {{ 'project.backToProjects' | t }}
          </a>
          <h1 class="display" appReveal revealSplit="words">{{ p.title | l }}</h1>
          <p class="lead" appReveal [revealDelay]="200">{{ p.tagline | l }}</p>
          <div class="meta" appReveal [revealDelay]="300">
            <span class="chip chip-outline">{{ 'categories.' + p.category | t }}</span>
            @if (p.year) {
              <span class="chip chip-outline">{{ p.year }}</span>
            }
            @for (s of p.stack; track s) {
              <span class="chip">{{ s }}</span>
            }
          </div>
          <div class="row links" appReveal [revealDelay]="380">
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
        </header>

        <!-- ── Scene ─────────────────────────────────────────────────── -->
        <section class="scene-wrap" [attr.data-scene]="p.sceneType" appReveal [revealDelay]="150">
          @switch (p.sceneType) {
            @case ('STACK') {
              <app-stack-scene class="scene" [accent]="p.accentColor" [labels]="p.stack" [image]="p.gallery[0] ?? p.cover" [autoplay]="true" />
            }
            @case ('DEVICE') {
              <div class="scene device">
                <app-iphone
                  [images]="p.mobile.length ? p.mobile : p.cover ? [p.cover] : []"
                  [src]="p.allowIframe ? p.liveUrl : null"
                  [title]="p.title | l"
                  [tagline]="p.tagline | l"
                  [accent]="p.accentColor"
                />
                @if (p.allowIframe && p.liveUrl) {
                  <p class="small faint hint">{{ 'project.liveInPhone' | t }} · {{ 'project.iframeHint' | t }}</p>
                }
              </div>
            }
            @default {
              <app-scene
                class="scene"
                [type]="p.sceneType"
                [accent]="p.accentColor"
                [labels]="p.stack"
                [seed]="p.slug"
                [autoplay]="true"
                [ariaLabel]="'project.sceneAria' | t"
              />
            }
          }
        </section>

        <!-- ── Description ───────────────────────────────────────────── -->
        <section class="container body">
          <div>
            <span class="eyebrow" appReveal>{{ 'project.about' | t }}</span>
            <app-md [text]="p.description | l" appReveal [revealDelay]="80" />
          </div>
          <aside class="aside card" appReveal [revealDelay]="160">
            <dl class="facts">
              <dt>{{ 'common.year' | t }}</dt>
              <dd>{{ p.year ?? '—' }}</dd>
              <dt>{{ 'common.category' | t }}</dt>
              <dd>{{ 'categories.' + p.category | t }}</dd>
              <dt>{{ 'common.stack' | t }}</dt>
              <dd>{{ p.stack.join(', ') }}</dd>
            </dl>
            @if (p.liveUrl || p.repoUrl) {
              <div class="stack aside-links">
                @if (p.liveUrl; as live) {
                  <a class="link-row" [href]="live" target="_blank" rel="noopener noreferrer" (click)="outbound()">
                    <app-icon name="external" [size]="16" /> {{ hostOf(live) }}
                  </a>
                }
                @if (p.repoUrl; as repo) {
                  <a class="link-row" [href]="repo" target="_blank" rel="noopener noreferrer" (click)="outbound()">
                    <app-icon name="github" [size]="16" /> {{ 'common.code' | t }}
                  </a>
                }
              </div>
            }
          </aside>
        </section>

        <!-- ── Gallery ───────────────────────────────────────────────── -->
        @if (p.gallery.length) {
          <section class="container gallery">
            <span class="eyebrow" appReveal>{{ 'project.gallery' | t }}</span>
            <div class="grid grid-2">
              @for (img of p.gallery; track img.id; let i = $index) {
                <button type="button" class="shot" (click)="open(img)" appCursor="label" [cursorLabel]="'common.open' | t" appReveal [revealDelay]="(i % 2) * 80">
                  <app-img [media]="img" sizes="(max-width: 720px) 100vw, 50vw" />
                </button>
              }
            </div>
          </section>
        }

        @if (p.mobile.length && p.sceneType !== 'DEVICE') {
          <section class="container mobile">
            <span class="eyebrow" appReveal>{{ 'project.onMobile' | t }}</span>
            <div class="mobile-stage" appReveal>
              <app-iphone [images]="p.mobile" [title]="p.title | l" [accent]="p.accentColor" />
            </div>
          </section>
        }

        <!-- ── Prev / next ───────────────────────────────────────────── -->
        <nav class="container neighbours" aria-label="Projects navigation">
          @if (p.previous; as prev) {
            <a class="neighbour" [appLink]="i18n.path('project', prev.slug)" [linkLabel]="prev.title | l" [style.--accent]="prev.accentColor" appCursor="label" [cursorLabel]="'common.previous' | t">
              <span class="eyebrow">{{ 'project.previousProject' | t }}</span>
              <span class="h2">{{ prev.title | l }}</span>
            </a>
          } @else {
            <span></span>
          }
          @if (p.next; as next) {
            <a class="neighbour next" [appLink]="i18n.path('project', next.slug)" [linkLabel]="next.title | l" [style.--accent]="next.accentColor" appCursor="label" [cursorLabel]="'common.next' | t">
              <span class="eyebrow">{{ 'project.nextProject' | t }}</span>
              <span class="h2">{{ next.title | l }}</span>
            </a>
          }
        </nav>

        <dialog class="lightbox" #lightbox (click)="closeLightbox($event)">
          @if (lightboxImage(); as img) {
            <img [src]="img.url" [alt]="i18n.l(img.alt)" [width]="img.width ?? undefined" [height]="img.height ?? undefined" />
          }
        </dialog>
      }

      <app-footer [settings]="settings()" />
    </main>
  `,
  styles: `
    .head {
      display: grid;
      gap: var(--space-4);
      padding: var(--space-9) 0 var(--space-6);
      justify-items: start;
    }
    .head > * {
      max-width: 1000px;
    }
    .back {
      cursor: pointer;
    }
    .back::before {
      display: none;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .links {
      gap: var(--space-3);
      margin-top: var(--space-2);
    }
    .scene-wrap {
      position: relative;
      margin: var(--space-4) 0 var(--space-8);
      background:
        radial-gradient(70% 60% at 50% 60%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%),
        var(--bg-2);
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }
    .scene {
      display: block;
      width: 100%;
      height: min(72vh, 720px);
    }
    .device {
      display: grid;
      place-items: center;
      align-content: center;
      gap: var(--space-4);
      padding: var(--space-6) 0;
      height: auto;
      min-height: min(78vh, 760px);
    }
    .device .hint {
      text-align: center;
      max-width: 40ch;
    }
    .body {
      display: grid;
      gap: var(--space-7);
      padding-bottom: var(--space-7);
    }
    @media (min-width: 900px) {
      .body {
        grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.8fr);
        align-items: start;
      }
    }
    .body app-md {
      margin-top: var(--space-4);
    }
    .aside {
      padding: var(--space-5);
      position: sticky;
      top: var(--space-5);
      display: grid;
      gap: var(--space-5);
    }
    .facts {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.6rem 1.2rem;
      font-size: var(--fs-small);
    }
    .facts dt {
      color: var(--fg-3);
    }
    .aside-links {
      border-top: 1px solid var(--line);
      padding-top: var(--space-4);
      gap: 0.6rem;
    }
    .link-row {
      display: inline-flex;
      align-items: center;
      gap: 0.6em;
      font-size: var(--fs-small);
      color: var(--fg-2);
    }
    .link-row:hover {
      color: var(--accent);
    }
    .gallery,
    .mobile {
      display: grid;
      gap: var(--space-5);
      padding-bottom: var(--space-8);
    }
    .shot {
      display: block;
      width: 100%;
      border-radius: var(--radius-m);
      overflow: hidden;
      border: 1px solid var(--line);
      transition: transform var(--dur-3) var(--ease-out), box-shadow var(--dur-3);
    }
    .shot:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-2);
    }
    .mobile-stage {
      display: grid;
      place-items: center;
      padding: var(--space-6);
      border-radius: var(--radius-l);
      background: radial-gradient(60% 60% at 50% 50%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%);
    }
    .neighbours {
      display: grid;
      gap: var(--space-4);
      padding-top: var(--space-6);
      border-top: 1px solid var(--line);
    }
    @media (min-width: 720px) {
      .neighbours {
        grid-template-columns: 1fr 1fr;
      }
    }
    .neighbour {
      display: grid;
      gap: 0.5rem;
      padding: var(--space-5);
      border-radius: var(--radius-m);
      transition: background-color var(--dur-2), transform var(--dur-3) var(--ease-out);
    }
    .neighbour:hover {
      background: color-mix(in srgb, var(--accent) 10%, transparent);
      transform: translateY(-3px);
    }
    .neighbour .h2 {
      transition: color var(--dur-2);
    }
    .neighbour:hover .h2 {
      color: var(--accent);
    }
    .neighbour.next {
      text-align: right;
      justify-items: end;
    }
    .skeleton-title {
      height: 5rem;
      width: 60%;
      border-radius: var(--radius-s);
    }
    .skeleton-line {
      height: 1.4rem;
      width: 40%;
      border-radius: var(--radius-s);
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

  readonly lightboxImage = signal<MediaDto | null>(null);
  private readonly lightbox = viewChild<ElementRef<HTMLDialogElement>>('lightbox');

  constructor() {
    effect(() => {
      const p = this.project();
      this.i18n.lang();
      if (!p) return;
      const title = this.i18n.l(p.title);
      const description = this.i18n.l(p.tagline) || this.i18n.t('meta.projects.description');
      const origin = this.seo.origin;
      const url = origin + this.i18n.path('project', p.slug);
      this.seo.set({
        title,
        description,
        page: 'project',
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
      if (this.browser) {
        untracked(() => this.analytics.projectView(p.slug, this.i18n.path('project', p.slug)));
      }
    });
  }

  outbound(): void {
    const p = this.project();
    if (p) this.analytics.outbound(p.slug, this.i18n.path('project', p.slug));
  }

  hostOf(url: string): string {
    try {
      return new URL(url).host.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  open(img: MediaDto): void {
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

  static neighbourTitle(card: ProjectCard | null, i18n: I18nService): string {
    return card ? i18n.l(card.title) : '';
  }
}
