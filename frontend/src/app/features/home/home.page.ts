import { Component, computed, effect, inject, input } from '@angular/core';
import type { Profile, ProjectCard, Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { LinkDirective } from '../../shared/curtain/link.directive';
import { MagneticDirective } from '../../shared/cursor/magnetic.directive';
import { SceneHostComponent } from '../../shared/scenes/scene-host.component';
import { FooterComponent } from '../../shared/ui/footer.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ProjectCardComponent } from '../../shared/ui/project-card.component';
import { RevealDirective } from '../../shared/ui/reveal.directive';

@Component({
  selector: 'app-home',
  imports: [
    TranslatePipe,
    LocalizedPipe,
    LinkDirective,
    MagneticDirective,
    SceneHostComponent,
    FooterComponent,
    IconComponent,
    ProjectCardComponent,
    RevealDirective,
  ],
  template: `
    <main id="main" class="page home">
      <!-- ── Hero ───────────────────────────────────────────────────────── -->
      <section class="hero">
        <app-scene class="hero-scene" type="HERO" [autoplay]="true" [ariaLabel]="'home.heroAria' | t" />
        <div class="container hero-inner">
          <p class="eyebrow" appReveal>{{ 'home.eyebrow' | t: { year: year } }}</p>
          <p class="hello" appReveal [revealDelay]="80">
            {{ 'home.hello' | t }} <strong>{{ settings()?.ownerName ?? 'Maxence Bonnici' }}</strong>
            <span class="sep">—</span>
            <span class="muted">{{ settings()?.headline | l }}</span>
          </p>
          <h1 class="display" appReveal revealSplit="words" [revealDelay]="120">
            {{ 'home.headlineA' | t }} <span class="gradient-text">{{ 'home.headlineB' | t }}</span> {{ 'home.headlineC' | t }}
          </h1>
          <p class="lead" appReveal [revealDelay]="420">{{ 'home.intro' | t }}</p>
          <div class="row cta" appReveal [revealDelay]="520">
            <a class="btn btn-lg" [appLink]="i18n.path('projects')" [linkLabel]="'nav.projects' | t" appMagnetic>
              {{ 'home.ctaProjects' | t }} <app-icon class="arrow" name="arrow-right" [size]="18" />
            </a>
            <a class="btn btn-ghost btn-lg" [appLink]="i18n.path('contact')" [linkLabel]="'nav.contact' | t" appMagnetic>
              {{ 'home.ctaContact' | t }}
            </a>
            @if (settings()?.availability; as state) {
              <span class="availability" [attr.data-state]="state"><i class="dot"></i>{{ 'availability.' + state | t }}</span>
            }
          </div>
        </div>
        <a class="scroll-hint" href="#work" aria-hidden="true" tabindex="-1">
          <span>{{ 'home.scrollHint' | t }}</span>
          <app-icon name="arrow-down" [size]="16" />
        </a>
      </section>

      <!-- ── Selected work ──────────────────────────────────────────────── -->
      <section class="section container" id="work">
        <div class="section-head">
          <div class="stack" style="gap: 0.75rem">
            <span class="eyebrow" appReveal>{{ 'home.selected' | t }}</span>
            <h2 appReveal revealSplit="words">{{ 'home.selectedSub' | t }}</h2>
          </div>
          <a class="btn btn-ghost" [appLink]="i18n.path('projects')" [linkLabel]="'nav.projects' | t" appReveal>
            {{ 'home.allProjects' | t }} <app-icon class="arrow" name="arrow-right" [size]="16" />
          </a>
        </div>
        <div class="work-grid">
          @for (p of featured(); track p.id; let i = $index) {
            <div appReveal [revealDelay]="i * 90" [class.wide]="i === 0">
              <app-project-card [project]="p" />
            </div>
          }
        </div>
      </section>

      <!-- ── Toolbox marquee ────────────────────────────────────────────── -->
      <section class="section-tight toolbox">
        <div class="container section-head">
          <div class="stack" style="gap: 0.75rem">
            <span class="eyebrow" appReveal>{{ 'home.toolbox' | t }}</span>
            <h2 appReveal>{{ 'home.toolboxSub' | t }}</h2>
          </div>
        </div>
        <div class="marquee" aria-hidden="true">
          <div class="marquee-track">
            @for (s of marquee(); track $index) {
              <span class="marquee-item">{{ s }}</span>
            }
          </div>
        </div>
        <ul class="visually-hidden">
          @for (s of skills(); track s.id) {
            <li>{{ s.name }}</li>
          }
        </ul>
      </section>

      <!-- ── Experience ─────────────────────────────────────────────────── -->
      <section class="section container">
        <div class="section-head">
          <div class="stack" style="gap: 0.75rem">
            <span class="eyebrow" appReveal>{{ 'home.experience' | t }}</span>
            <h2 appReveal revealSplit="words">{{ 'home.experienceSub' | t }}</h2>
          </div>
          <a class="btn btn-ghost" [appLink]="i18n.path('about')" [linkLabel]="'nav.about' | t" appReveal>
            {{ 'home.fullStory' | t }} <app-icon class="arrow" name="arrow-right" [size]="16" />
          </a>
        </div>
        <ol class="timeline">
          @for (e of experiences(); track e.id; let i = $index) {
            <li class="tl-item" appReveal [revealDelay]="i * 80">
              <span class="tl-date mono">{{ i18n.formatRange(e.startDate, e.endDate) }}</span>
              <div class="tl-body">
                <h3 class="h3">{{ e.role | l }}</h3>
                <p class="muted">
                  {{ e.company }}
                  @if (e.location) {
                    <span class="faint"> · {{ e.location }}</span>
                  }
                </p>
                <div class="chips">
                  @for (s of e.skills.slice(0, 5); track s) {
                    <span class="chip">{{ s }}</span>
                  }
                </div>
              </div>
            </li>
          }
        </ol>
      </section>

      <!-- ── CTA ────────────────────────────────────────────────────────── -->
      <section class="section container">
        <div class="cta-band glass" appReveal>
          <div>
            <h2 class="h2">{{ 'home.letsTalk' | t }}</h2>
            <p class="lead">{{ 'home.letsTalkSub' | t }}</p>
          </div>
          <a class="btn btn-accent btn-lg" [appLink]="i18n.path('contact')" [linkLabel]="'nav.contact' | t" appMagnetic>
            {{ 'home.ctaContact' | t }} <app-icon class="arrow" name="arrow-right" [size]="18" />
          </a>
        </div>
      </section>

      <app-footer [settings]="settings()" />
    </main>
  `,
  styles: `
    .hero {
      position: relative;
      min-height: 100svh;
      display: grid;
      align-items: center;
      /* keep the call-to-action row clear of the floating dock */
      padding: var(--space-9) 0 calc(var(--dock-gap) + 1.5rem);
      overflow: clip;
    }
    .hero-scene {
      position: absolute;
      inset: 0;
      z-index: 0;
      opacity: 0.95;
    }
    @media (max-width: 719px) {
      .hero-scene {
        opacity: 0.5;
      }
    }
    .hero-inner {
      position: relative;
      z-index: 1;
      display: grid;
      gap: var(--space-5);
      max-width: 980px;
    }
    .hello {
      font-size: var(--fs-lead);
    }
    .hello .sep {
      margin: 0 0.5em;
      color: var(--fg-3);
    }
    .display {
      max-width: 14ch;
    }
    .cta {
      gap: var(--space-3);
      margin-top: var(--space-2);
    }
    .scroll-hint {
      position: absolute;
      right: var(--gutter);
      bottom: calc(var(--dock-gap) - 0.5rem);
      display: inline-flex;
      align-items: center;
      gap: 0.5em;
      font-family: var(--font-mono);
      font-size: var(--fs-micro);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--fg-3);
      animation: float 3s ease-in-out infinite;
    }
    @media (max-width: 719px), (max-height: 720px) {
      .scroll-hint {
        display: none;
      }
    }
    .work-grid {
      display: grid;
      gap: var(--gutter);
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
    }
    @media (min-width: 900px) {
      .work-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    .toolbox {
      overflow: hidden;
    }
    .timeline {
      display: grid;
      gap: 0;
      border-top: 1px solid var(--line);
    }
    .tl-item {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-6) 0;
      border-bottom: 1px solid var(--line);
    }
    @media (min-width: 720px) {
      .tl-item {
        grid-template-columns: 220px 1fr;
        gap: var(--space-6);
      }
    }
    .tl-date {
      color: var(--fg-3);
      font-size: var(--fs-small);
      padding-top: 0.5rem;
    }
    .tl-body {
      display: grid;
      gap: 0.5rem;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 0.5rem;
    }
    .cta-band {
      display: grid;
      gap: var(--space-5);
      padding: clamp(2rem, 5vw, 4rem);
      border-radius: var(--radius-l);
      align-items: center;
    }
    @media (min-width: 900px) {
      .cta-band {
        grid-template-columns: 1fr auto;
      }
    }
    .cta-band .lead {
      margin-top: 0.5rem;
    }
  `,
})
export class HomePage {
  private readonly seo = inject(SeoService);
  readonly i18n = inject(I18nService);

  // resolved by the route (see core/api/resolvers.ts) and bound as inputs
  readonly settings = input<Settings>();
  readonly projects = input<ProjectCard[]>();
  readonly profile = input<Profile>();
  readonly year = new Date().getFullYear();

  readonly featured = computed(() => {
    const all = this.projects() ?? [];
    const featured = all.filter((p) => p.featured);
    return (featured.length ? featured : all).slice(0, 4);
  });
  readonly experiences = computed(() => (this.profile()?.experiences ?? []).slice(0, 3));
  readonly skills = computed(() => this.profile()?.skills ?? []);
  readonly marquee = computed(() => {
    const names = this.skills().map((s) => s.name);
    const list = names.length ? names : ['Java', 'Spring Boot', 'Angular', 'TypeScript', 'PostgreSQL', 'Docker'];
    return [...list, ...list];
  });

  constructor() {
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
}
