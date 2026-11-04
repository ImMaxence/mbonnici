import { Component, DestroyRef, PLATFORM_ID, computed, effect, inject, input, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { type Profile, type ProjectCard, type Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { LinkDirective } from '../../shared/curtain/link.directive';
import { MagneticDirective } from '../../shared/cursor/magnetic.directive';
import { FooterComponent } from '../../shared/ui/footer.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ProjectCardComponent } from '../../shared/ui/project-card.component';
import { RevealDirective } from '../../shared/ui/reveal.directive';
import { NoDotPipe } from '../../shared/ui/text';
import { ToolboxComponent } from '../../shared/ui/toolbox.component';

@Component({
  selector: 'app-home',
  imports: [
    TranslatePipe,
    LocalizedPipe,
    NoDotPipe,
    LinkDirective,
    MagneticDirective,
    FooterComponent,
    IconComponent,
    ProjectCardComponent,
    RevealDirective,
    ToolboxComponent,
  ],
  template: `
    <main id="main" class="page home">
      <!-- ── Hero ───────────────────────────────────────────────────────── -->
      <section class="hero container">
        <div class="hero-top" appReveal>
          <span class="eyebrow">{{ settings()?.headline | l }}</span>
          <span class="mono small faint clock">
            {{ settings()?.location ?? 'Aix-en-Provence' }} · <time>{{ time() }}</time>
          </span>
        </div>

        <h1 class="display headline" appReveal revealSplit="words" [revealDelay]="60">
          {{ 'home.headlineA' | t }} <span class="accent-word">{{ 'home.headlineB' | t }}</span> {{ 'home.headlineC' | t }}
        </h1>

        <div class="hero-foot">
          <p class="lead" appReveal [revealDelay]="360">
            <strong>{{ settings()?.ownerName ?? 'Maxence Bonnici' }}</strong> — {{ 'home.intro' | t }}
          </p>
          <div class="cta" appReveal [revealDelay]="460">
            <a class="btn btn-lg" [appLink]="i18n.path('projects')" [linkLabel]="'nav.projects' | t" appMagnetic>
              {{ 'home.ctaProjects' | t }} <app-icon class="arrow" name="arrow-right" [size]="18" />
            </a>
            <a class="btn btn-ghost btn-lg" [appLink]="i18n.path('contact')" [linkLabel]="'nav.contact' | t" appMagnetic>
              {{ 'home.ctaContact' | t }}
            </a>
          </div>
          @if (settings()?.availability; as state) {
            <span class="availability" [attr.data-state]="state" appReveal [revealDelay]="540"><i class="dot"></i>{{ 'availability.' + state | t }}</span>
          }
        </div>
      </section>

      <!-- ── Selected work ──────────────────────────────────────────────── -->
      <section class="section container" id="work">
        <div class="section-title">
          <span class="eyebrow" appReveal>(01) {{ 'home.selected' | t }}</span>
          <div class="title-row">
            <h2 appReveal revealSplit="words">{{ 'home.selectedSub' | t }}</h2>
            <a class="btn btn-ghost" [appLink]="i18n.path('projects')" [linkLabel]="'nav.projects' | t" appReveal>
              {{ 'home.allProjects' | t }} <app-icon class="arrow" name="arrow-right" [size]="16" />
            </a>
          </div>
        </div>
        <div class="work-grid">
          @for (p of featured(); track p.id; let i = $index) {
            <div appReveal [revealDelay]="(i % 2) * 90" [class.wide]="i === 0">
              <app-project-card [project]="p" />
            </div>
          }
        </div>
      </section>

      <!-- ── Toolbox ────────────────────────────────────────────────────── -->
      <section class="section container">
        <div class="section-title">
          <span class="eyebrow" appReveal>(02) {{ 'home.toolbox' | t }}</span>
          <h2 appReveal revealSplit="words">{{ 'home.toolboxSub' | t }}</h2>
        </div>
        <app-toolbox [skills]="profile()?.skills ?? []" />
      </section>

      <!-- ── Experience ─────────────────────────────────────────────────── -->
      <section class="section container">
        <div class="section-title">
          <span class="eyebrow" appReveal>(03) {{ 'home.experience' | t }}</span>
          <div class="title-row">
            <h2 appReveal revealSplit="words">{{ 'home.experienceSub' | t }}</h2>
            <a class="btn btn-ghost" [appLink]="i18n.path('about')" [linkLabel]="'nav.about' | t" appReveal>
              {{ 'home.fullStory' | t }} <app-icon class="arrow" name="arrow-right" [size]="16" />
            </a>
          </div>
        </div>
        <ol class="rows">
          @for (e of experiences(); track e.id; let i = $index) {
            <li class="row-item" appReveal [revealDelay]="i * 70">
              <span class="when mono">{{ i18n.formatRange(e.startDate, e.endDate) }}</span>
              <div class="what">
                <h3 class="h3">{{ e.role | l }}</h3>
                <p class="muted">{{ e.company }}@if (e.location) {<span class="faint"> · {{ e.location }}</span>}</p>
              </div>
              <span class="chip chip-outline kind">{{ 'about.contract.' + e.contractType | t }}</span>
            </li>
          }
        </ol>
      </section>

      <!-- ── CTA ────────────────────────────────────────────────────────── -->
      <section class="section container cta-big">
        <span class="eyebrow" appReveal>(04) {{ 'nav.contact' | t }}</span>
        <a class="big-link" [appLink]="i18n.path('contact')" [linkLabel]="'nav.contact' | t" appReveal>
          <span class="mega">{{ 'home.letsTalkBig' | t }}</span>
          <span class="circle" aria-hidden="true"><app-icon name="arrow-up-right" [size]="40" /></span>
        </a>
        <p class="lead" appReveal>{{ 'home.letsTalk' | t }} {{ 'home.letsTalkSub' | t | noDot }}</p>
      </section>

      <app-footer [settings]="settings()" />
    </main>
  `,
  styles: `
    .hero {
      min-height: calc(100svh - var(--header-h));
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: var(--space-6);
      padding: var(--space-6) 0 var(--space-7);
    }
    .hero-top {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: var(--space-3);
      padding-bottom: var(--space-4);
      border-bottom: 1px solid var(--line-strong);
    }
    .headline {
      align-self: center;
      max-width: 15ch;
      font-size: clamp(3rem, 0.6rem + 9.6vw, 11rem);
    }
    .headline .accent-word {
      letter-spacing: -0.03em;
    }
    .hero-foot {
      display: grid;
      gap: var(--space-5);
      align-items: end;
    }
    @media (min-width: 1000px) {
      .hero-foot {
        grid-template-columns: minmax(0, 1.3fr) auto auto;
      }
    }
    .hero-foot .lead strong {
      color: var(--fg);
      font-weight: 600;
    }
    .cta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }
    .availability {
      justify-self: start;
    }
    .title-row {
      display: grid;
      gap: var(--space-5);
      align-items: end;
    }
    @media (min-width: 900px) {
      .title-row {
        grid-template-columns: 1fr auto;
      }
    }
    .work-grid {
      display: grid;
      gap: clamp(3rem, 6vw, 5rem) var(--gutter);
    }
    @media (min-width: 900px) {
      .work-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .work-grid > .wide {
        grid-column: 1 / -1;
      }
    }
    .rows {
      border-top: 1px solid var(--line);
    }
    .row-item {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-6) 0;
      border-bottom: 1px solid var(--line);
      align-items: center;
    }
    @media (min-width: 900px) {
      .row-item {
        grid-template-columns: minmax(180px, 3fr) 7fr 2fr;
      }
    }
    .when {
      color: var(--fg-3);
      font-size: var(--fs-small);
    }
    .what {
      display: grid;
      gap: 0.35rem;
    }
    .kind {
      justify-self: start;
    }
    @media (min-width: 900px) {
      .kind {
        justify-self: end;
      }
    }
    .cta-big {
      display: grid;
      gap: var(--space-5);
      border-top: 1px solid var(--line-strong);
      padding-top: var(--space-6);
      margin-top: var(--space-8);
    }
    .big-link {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-5);
    }
    .big-link .mega {
      transition: letter-spacing 0.8s var(--ease-out);
    }
    .big-link:hover .mega {
      font-family: var(--font-serif);
      font-style: italic;
      font-weight: 400;
      letter-spacing: -0.02em;
      color: var(--accent);
    }
    .circle {
      flex: none;
      display: grid;
      place-items: center;
      width: clamp(64px, 10vw, 140px);
      aspect-ratio: 1;
      border-radius: 50%;
      background: var(--fg);
      color: var(--bg);
      transition:
        transform 0.8s var(--ease-spring),
        background-color var(--dur-2);
    }
    .big-link:hover .circle {
      transform: rotate(45deg);
      background: var(--accent);
      color: var(--accent-fg);
    }
  `,
})
export class HomePage {
  private readonly seo = inject(SeoService);
  readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  // resolved by the route (see core/api/resolvers.ts) and bound as inputs
  readonly settings = input<Settings>();
  readonly projects = input<ProjectCard[]>();
  readonly profile = input<Profile>();

  readonly time = signal(this.now());

  readonly featured = computed(() => {
    const all = this.projects() ?? [];
    const featured = all.filter((p) => p.featured);
    return (featured.length ? featured : all).slice(0, 5);
  });
  readonly experiences = computed(() => (this.profile()?.experiences ?? []).slice(0, 3));

  constructor() {
    if (this.browser) {
      const timer = setInterval(() => this.time.set(this.now()), 15_000);
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
    effect(() => {
      const s = this.settings();
      const lang = this.i18n.lang();
      const title = s ? this.i18n.l(s.seoTitle) || this.i18n.t('meta.home.title') : this.i18n.t('meta.home.title');
      const description = s ? this.i18n.l(s.seoDescription) || this.i18n.t('meta.home.description') : this.i18n.t('meta.home.description');
      const graph = s ? this.seo.siteGraph(s.ownerName, this.i18n.l(s.headline), [s.githubUrl, s.linkedinUrl]) : [];
      const list = this.featured();
      if (list.length) {
        graph.push({
          '@type': 'ItemList',
          name: this.i18n.t('home.selected'),
          itemListElement: list.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: this.seo.origin + this.i18n.path('project', p.slug),
            name: this.i18n.l(p.title),
          })),
        });
      }
      void lang;
      this.seo.set({ title, description, page: 'home', type: 'profile', jsonLd: graph });
    });
  }

  private now(): string {
    return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date());
  }
}
