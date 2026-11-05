import { TestimonialsComponent } from '../../shared/ui/testimonials.component';
import { Component, computed, effect, inject, input } from '@angular/core';
import { type Profile, type ProjectCard, type Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { LinkDirective } from '../../shared/curtain/link.directive';
import { MagneticDirective } from '../../shared/cursor/magnetic.directive';
import { FooterComponent } from '../../shared/ui/footer.component';
import { cvLink } from '../../shared/ui/cv';
import { IconComponent } from '../../shared/ui/icon.component';
import { MarkdownComponent } from '../../shared/ui/markdown.component';
import { RevealDirective } from '../../shared/ui/reveal.directive';
import { NoDotPipe } from '../../shared/ui/text';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { ToolboxComponent } from '../../shared/ui/toolbox.component';

@Component({
  selector: 'app-about',
  imports: [TranslatePipe, LocalizedPipe, NoDotPipe, LinkDirective, MagneticDirective, FooterComponent, IconComponent, MarkdownComponent, RevealDirective, ToolboxComponent, TestimonialsComponent],
  template: `
    <main id="main" class="page">
      <header class="container head">
        <span class="eyebrow" appReveal>{{ 'nav.about' | t }}</span>
        <h1 class="display" appReveal revealSplit="words">
          {{ 'about.titleA' | t }} <span class="accent-word">{{ 'about.titleB' | t }}</span>
        </h1>
        <div class="head-foot">
          <p class="lead" appReveal [revealDelay]="200">@if (settings()?.headline | l; as h) { {{ h }} — }{{ 'about.subtitle' | t }}</p>
          <div class="row" appReveal [revealDelay]="280">
            @if (settings()?.location; as loc) {
              <span class="chip chip-outline"><app-icon name="map-pin" [size]="13" /> {{ loc }}</span>
            }
            @if (settings()?.availability; as state) {
              <span class="availability" [attr.data-state]="state"><i class="dot"></i>{{ 'availability.' + state | t }}</span>
            }
          </div>
        </div>
      </header>

      <!-- ── Bio ─────────────────────────────────────────────────────── -->
      <section class="container bio-row">
        <span class="eyebrow" appReveal>{{ 'about.bio' | t }}</span>
        <div class="bio">
          <app-md class="bio-text" [text]="settings()?.bio | l" appReveal />
          <div class="row" appReveal [revealDelay]="100">
            @if (settings()?.githubUrl; as gh) {
              <a class="btn btn-ghost" [href]="gh" target="_blank" rel="noopener noreferrer me" appMagnetic><app-icon name="github" [size]="16" /> GitHub</a>
            }
            @if (settings()?.linkedinUrl; as li) {
              <a class="btn btn-ghost" [href]="li" target="_blank" rel="noopener noreferrer me" appMagnetic><app-icon name="linkedin" [size]="16" /> LinkedIn</a>
            }
            @if (cv(); as c) {
              <a class="btn btn-ghost" [href]="c.href" download (click)="cvDownloaded()" appMagnetic>
                <app-icon name="download" [size]="16" /> {{ 'about.cv' | t }}
              </a>
            }
            <a class="btn" [appLink]="i18n.path('contact')" [linkLabel]="'nav.contact' | t" appMagnetic>{{ 'home.ctaContact' | t }} <app-icon class="arrow" name="arrow-right" [size]="16" /></a>
          </div>
        </div>
      </section>

      @if (profile()?.experiences?.length) {
      <!-- ── Experience ─────────────────────────────────────────────── -->
      <section class="section container">
        <div class="section-title">
          <span class="eyebrow" appReveal>{{ 'about.experience' | t }}</span>
          <h2 appReveal revealSplit="words">{{ 'home.experienceSub' | t }}</h2>
        </div>
        <ol class="rows">
          @for (e of profile()?.experiences ?? []; track e.id; let i = $index) {
            <li class="row-item" appReveal [revealDelay]="i * 70">
              <div class="when">
                <span class="mono small">{{ i18n.formatRange(e.startDate, e.endDate) }}</span>
              </div>
              <div class="what">
                <div class="title-line">
                  <h3 class="h3">{{ e.role | l }}</h3>
                  <span class="chip chip-outline kind">{{ 'about.contract.' + e.contractType | t }}</span>
                </div>
                <p class="muted">
                  @if (e.companyUrl; as url) {
                    <a class="link" [href]="url" target="_blank" rel="noopener noreferrer">{{ e.company }}</a>
                  } @else {
                    {{ e.company }}
                  }
                  @if (e.location) {
                    <span class="faint"> · {{ e.location }}</span>
                  }
                </p>
                @if (e.description | l; as desc) {
                  <p class="desc">{{ desc | noDot }}</p>
                }
                <p class="stack mono">
                  @for (s of e.skills; track s) {
                    <span>{{ s }}</span>
                  }
                </p>
              </div>
            </li>
          }
        </ol>
      </section>
      }

      @if (profile()?.education?.length) {
      <!-- ── Education ──────────────────────────────────────────────── -->
      <section class="section container">
        <div class="section-title">
          <span class="eyebrow" appReveal>{{ 'about.education' | t }}</span>
          <h2 appReveal revealSplit="words">{{ 'about.educationSub' | t }}</h2>
        </div>
        <ol class="rows">
          @for (e of profile()?.education ?? []; track e.id) {
            <li class="row-item" appReveal>
              <div class="when"><span class="mono small">{{ i18n.formatRange(e.startDate, e.endDate) }}</span></div>
              <div class="what">
                <h3 class="h3">{{ e.degree | l }}</h3>
                <p class="muted">
                  @if (e.schoolUrl; as url) {
                    <a class="link" [href]="url" target="_blank" rel="noopener noreferrer">{{ e.school }}</a>
                  } @else {
                    {{ e.school }}
                  }
                  @if (e.location) {
                    <span class="faint"> · {{ e.location }}</span>
                  }
                </p>
              </div>
            </li>
          }
        </ol>
      </section>
      }

      @if (profile()?.skills?.length) {
      <!-- ── Skills ─────────────────────────────────────────────────── -->
      <section class="section container">
        <div class="section-title">
          <span class="eyebrow" appReveal>{{ 'about.skills' | t }}</span>
          <h2 appReveal revealSplit="words">{{ 'about.skillsSub' | t }}</h2>
        </div>
        <app-toolbox [skills]="profile()?.skills ?? []" [projects]="projects() ?? []" />
      </section>
      }

      @if (profile()?.testimonials?.length) {
      <!-- ── Testimonials ───────────────────────────────────────────── -->
      <section class="section container">
        <div class="section-title">
          <span class="eyebrow" appReveal>{{ 'home.testimonials' | t }}</span>
          <h2 appReveal revealSplit="words">{{ 'home.testimonialsSub' | t }}</h2>
        </div>
        <app-testimonials [items]="profile()?.testimonials ?? []" />
      </section>
      }

      <app-footer [settings]="settings()" />
    </main>
  `,
  styles: `
    .head {
      display: grid;
      gap: var(--space-5);
      padding: var(--space-8) 0 var(--space-7);
    }
    .head-foot {
      display: grid;
      gap: var(--space-5);
      align-items: end;
      padding-top: var(--space-4);
      border-top: 1px solid var(--line-strong);
    }
    @media (min-width: 900px) {
      .head-foot {
        grid-template-columns: 1fr auto;
      }
    }
    .bio-row {
      display: grid;
      gap: var(--space-5);
    }
    @media (min-width: 900px) {
      .bio-row {
        grid-template-columns: minmax(180px, 3fr) 9fr;
        align-items: start;
      }
    }
    .bio {
      display: grid;
      gap: var(--space-6);
      justify-items: start;
    }
    .bio-text {
      font-family: var(--font-display);
      font-size: clamp(1.3rem, 1rem + 1.2vw, 2.1rem);
      line-height: 1.3;
      letter-spacing: -0.025em;
      color: var(--fg);
      max-width: 34ch;
    }
    .rows {
      border-top: 1px solid var(--line);
    }
    .row-item {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-6) 0;
      border-bottom: 1px solid var(--line);
    }
    @media (min-width: 900px) {
      .row-item {
        grid-template-columns: minmax(180px, 3fr) 9fr;
      }
    }
    .when {
      color: var(--fg-3);
      padding-top: 0.45rem;
    }
    .what {
      display: grid;
      gap: 0.5rem;
    }
    /* the contract badge always sits on the role line, whatever the length of the dates */
    .title-line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem 1rem;
    }
    .desc {
      color: var(--fg-2);
      max-width: 62ch;
    }
    .stack {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem 1rem;
      margin-top: 0.4rem;
      font-size: var(--fs-micro);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--fg-3);
    }
  `,
})
export class AboutPage {
  private readonly seo = inject(SeoService);
  readonly i18n = inject(I18nService);

  // resolved by the route and bound as inputs
  readonly settings = input<Settings>();
  readonly profile = input<Profile>();
  private readonly analytics = inject(AnalyticsService);

  readonly cv = computed(() => cvLink(this.settings(), this.i18n.lang(), this.i18n.locale()));

  cvDownloaded(): void {
    this.analytics.cvDownload(this.i18n.path('about'));
  }

  /** published projects, for the skills that link to them */
  readonly projects = input<ProjectCard[]>();

  constructor() {
    effect(() => {
      const s = this.settings();
      this.i18n.lang();
      const graph = s ? this.seo.siteGraph(s.ownerName, this.i18n.l(s.headline), [s.githubUrl, s.linkedinUrl]) : [];
      graph.push({
        '@type': 'ProfilePage',
        mainEntity: { '@id': `${this.seo.origin}/#person` },
        url: this.seo.origin + this.i18n.path('about'),
      });
      this.seo.set({
        title: this.i18n.t('meta.about.title'),
        description: this.i18n.t('meta.about.description'),
        page: 'about',
        type: 'profile',
        jsonLd: graph,
      });
    });
  }
}
