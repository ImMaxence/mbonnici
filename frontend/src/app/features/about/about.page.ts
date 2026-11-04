import { Component, computed, effect, inject, input } from '@angular/core';
import { type Profile, SKILL_CATEGORIES, type Settings, type Skill, type SkillCategory } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { LinkDirective } from '../../shared/curtain/link.directive';
import { MagneticDirective } from '../../shared/cursor/magnetic.directive';
import { SceneHostComponent } from '../../shared/scenes/scene-host.component';
import { FooterComponent } from '../../shared/ui/footer.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { MarkdownComponent } from '../../shared/ui/markdown.component';
import { RevealDirective } from '../../shared/ui/reveal.directive';

@Component({
  selector: 'app-about',
  imports: [TranslatePipe, LocalizedPipe, LinkDirective, MagneticDirective, SceneHostComponent, FooterComponent, IconComponent, MarkdownComponent, RevealDirective],
  template: `
    <main id="main" class="page">
      <header class="container head">
        <div class="head-text">
          <span class="eyebrow" appReveal>{{ 'nav.about' | t }}</span>
          <h1 class="display" appReveal revealSplit="words">{{ settings()?.headline | l }}</h1>
          <p class="lead" appReveal [revealDelay]="200">{{ 'about.subtitle' | t }}</p>
          <div class="row" appReveal [revealDelay]="280">
            @if (settings()?.location; as loc) {
              <span class="chip chip-outline"><app-icon name="map-pin" [size]="13" /> {{ loc }}</span>
            }
            @if (settings()?.availability; as state) {
              <span class="availability" [attr.data-state]="state"><i class="dot"></i>{{ 'availability.' + state | t }}</span>
            }
          </div>
        </div>
        <app-scene class="orbit" type="ORBIT" [labels]="topSkills()" seed="about" [autoplay]="true" [ariaLabel]="'about.orbitAria' | t" />
      </header>

      <section class="container bio">
        <app-md [text]="settings()?.bio | l" appReveal />
        <div class="row" appReveal [revealDelay]="100">
          @if (settings()?.githubUrl; as gh) {
            <a class="btn btn-ghost" [href]="gh" target="_blank" rel="noopener noreferrer me" appMagnetic><app-icon name="github" [size]="16" /> GitHub</a>
          }
          @if (settings()?.linkedinUrl; as li) {
            <a class="btn btn-ghost" [href]="li" target="_blank" rel="noopener noreferrer me" appMagnetic><app-icon name="linkedin" [size]="16" /> LinkedIn</a>
          }
          <a class="btn" [appLink]="i18n.path('contact')" [linkLabel]="'nav.contact' | t" appMagnetic>{{ 'home.ctaContact' | t }} <app-icon class="arrow" name="arrow-right" [size]="16" /></a>
        </div>
      </section>

      <!-- ── Experience ─────────────────────────────────────────────── -->
      <section class="section container">
        <div class="section-head">
          <div class="stack" style="gap: 0.75rem">
            <span class="eyebrow" appReveal>{{ 'about.experience' | t }}</span>
            <h2 appReveal>{{ 'home.experienceSub' | t }}</h2>
          </div>
        </div>
        <ol class="timeline">
          @for (e of profile()?.experiences ?? []; track e.id; let i = $index) {
            <li class="tl-item" appReveal [revealDelay]="i * 70">
              <div class="tl-when">
                <span class="mono small">{{ i18n.formatRange(e.startDate, e.endDate) }}</span>
                <span class="chip chip-outline">{{ 'about.contract.' + e.contractType | t }}</span>
              </div>
              <div class="tl-body">
                <h3 class="h3">{{ e.role | l }}</h3>
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
                  <p class="desc">{{ desc }}</p>
                }
                <div class="chips">
                  @for (s of e.skills; track s) {
                    <span class="chip">{{ s }}</span>
                  }
                </div>
              </div>
            </li>
          }
        </ol>
      </section>

      <!-- ── Education ──────────────────────────────────────────────── -->
      <section class="section-tight container">
        <div class="section-head">
          <span class="eyebrow" appReveal>{{ 'about.education' | t }}</span>
        </div>
        <ol class="timeline">
          @for (e of profile()?.education ?? []; track e.id) {
            <li class="tl-item" appReveal>
              <div class="tl-when"><span class="mono small">{{ i18n.formatRange(e.startDate, e.endDate) }}</span></div>
              <div class="tl-body">
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

      <!-- ── Skills ─────────────────────────────────────────────────── -->
      <section class="section container">
        <div class="section-head">
          <div class="stack" style="gap: 0.75rem">
            <span class="eyebrow" appReveal>{{ 'about.skills' | t }}</span>
            <h2 appReveal>{{ 'about.skillsSub' | t }}</h2>
          </div>
        </div>
        <div class="skills">
          @for (group of groups(); track group.key; let gi = $index) {
            <div class="skill-group card" appReveal [revealDelay]="gi * 60">
              <h3 class="eyebrow">{{ 'about.skillCategories.' + group.key | t }}</h3>
              <ul>
                @for (s of group.items; track s.id) {
                  <li>
                    <span>{{ s.name }}</span>
                    <span class="level" role="img" [attr.aria-label]="'about.levelAria' | t: { level: s.level }">
                      @for (n of [1, 2, 3, 4, 5]; track n) {
                        <i [class.on]="n <= s.level"></i>
                      }
                    </span>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      </section>

      <app-footer [settings]="settings()" />
    </main>
  `,
  styles: `
    .head {
      display: grid;
      gap: var(--space-6);
      padding: var(--space-9) 0 var(--space-6);
      align-items: center;
    }
    @media (min-width: 900px) {
      .head {
        grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
      }
    }
    .head-text {
      display: grid;
      gap: var(--space-4);
    }
    .orbit {
      width: 100%;
      aspect-ratio: 1;
      max-height: 480px;
    }
    .bio {
      display: grid;
      gap: var(--space-5);
      justify-items: start;
    }
    .timeline {
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
        grid-template-columns: 240px 1fr;
        gap: var(--space-6);
      }
    }
    .tl-when {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      align-items: center;
      color: var(--fg-3);
      align-content: start;
      padding-top: 0.4rem;
    }
    .tl-body {
      display: grid;
      gap: 0.5rem;
    }
    .desc {
      color: var(--fg-2);
      max-width: 60ch;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 0.5rem;
    }
    .skills {
      display: grid;
      gap: var(--space-4);
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    }
    .skill-group {
      padding: var(--space-5);
      display: grid;
      gap: var(--space-4);
      align-content: start;
    }
    .skill-group ul {
      display: grid;
      gap: 0.6rem;
    }
    .skill-group li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-3);
      font-size: var(--fs-small);
    }
    .level {
      display: inline-flex;
      gap: 3px;
    }
    .level i {
      width: 14px;
      height: 6px;
      border-radius: 3px;
      background: var(--bg-4);
    }
    .level i.on {
      background: var(--accent);
    }
  `,
})
export class AboutPage {
  private readonly seo = inject(SeoService);
  readonly i18n = inject(I18nService);

  // resolved by the route and bound as inputs
  readonly settings = input<Settings>();
  readonly profile = input<Profile>();

  readonly topSkills = computed(() =>
    (this.profile()?.skills ?? [])
      .filter((s) => s.level >= 5)
      .slice(0, 3)
      .map((s) => s.name),
  );

  readonly groups = computed(() => {
    const skills = this.profile()?.skills ?? [];
    const map = new Map<SkillCategory, Skill[]>();
    for (const s of skills) map.set(s.category, [...(map.get(s.category) ?? []), s]);
    return SKILL_CATEGORIES.filter((k) => map.has(k)).map((key) => ({ key, items: map.get(key)! }));
  });

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
