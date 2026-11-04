import { Component, computed, effect, inject, input, signal } from '@angular/core';
import type { ProjectCard, ProjectCategory, Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { FooterComponent } from '../../shared/ui/footer.component';
import { ProjectCardComponent } from '../../shared/ui/project-card.component';
import { RevealDirective } from '../../shared/ui/reveal.directive';

@Component({
  selector: 'app-projects',
  imports: [TranslatePipe, FooterComponent, ProjectCardComponent, RevealDirective],
  template: `
    <main id="main" class="page">
      <header class="container page-head">
        <span class="eyebrow" appReveal>{{ 'nav.projects' | t }}</span>
        <h1 class="display" appReveal revealSplit="words">{{ 'projects.title' | t }}</h1>
        <p class="lead" appReveal [revealDelay]="200">{{ 'projects.subtitle' | t }}</p>
      </header>

      <section class="container">
        <div class="filters" role="group" [attr.aria-label]="'common.category' | t" appReveal [revealDelay]="260">
          <button type="button" class="chip" [attr.aria-pressed]="filter() === null" (click)="filter.set(null)">
            {{ 'projects.filterAll' | t }} <span class="count">{{ all().length }}</span>
          </button>
          @for (c of categories(); track c.key) {
            <button type="button" class="chip" [attr.aria-pressed]="filter() === c.key" (click)="filter.set(c.key)">
              {{ 'categories.' + c.key | t }} <span class="count">{{ c.count }}</span>
            </button>
          }
        </div>

        <p class="small faint result" aria-live="polite">
          {{ visible().length === 1 ? ('projects.countOne' | t) : ('projects.count' | t: { n: visible().length }) }}
        </p>

        @if (visible().length) {
          <div class="grid grid-2">
            @for (p of visible(); track p.id; let i = $index) {
              <div appReveal [revealDelay]="(i % 2) * 80">
                <app-project-card [project]="p" headingLevel="h2" />
              </div>
            }
          </div>
        } @else {
          <p class="muted">{{ 'projects.empty' | t }}</p>
        }
      </section>

      <app-footer [settings]="settings()" />
    </main>
  `,
  styles: `
    .page-head {
      display: grid;
      gap: var(--space-4);
      padding: var(--space-9) 0 var(--space-7);
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: var(--space-4);
    }
    .filters .chip {
      cursor: pointer;
      padding: 0.6em 1em;
    }
    .count {
      opacity: 0.6;
      margin-left: 0.2em;
    }
    .result {
      margin-bottom: var(--space-5);
    }
    .skeleton {
      aspect-ratio: 16 / 13;
      border-radius: var(--radius-m);
    }
  `,
})
export class ProjectsPage {
  private readonly seo = inject(SeoService);
  readonly i18n = inject(I18nService);

  // resolved by the route and bound as inputs
  readonly projects = input<ProjectCard[]>();
  readonly settings = input<Settings>();
  readonly filter = signal<ProjectCategory | null>(null);

  readonly all = computed(() => this.projects() ?? []);
  readonly categories = computed(() => {
    const counts = new Map<ProjectCategory, number>();
    for (const p of this.all()) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [...counts.entries()].map(([key, count]) => ({ key, count }));
  });
  readonly visible = computed(() => {
    const f = this.filter();
    return f ? this.all().filter((p) => p.category === f) : this.all();
  });

  constructor() {
    effect(() => {
      this.i18n.lang();
      const list = this.all();
      this.seo.set({
        title: this.i18n.t('meta.projects.title'),
        description: this.i18n.t('meta.projects.description'),
        page: 'projects',
        jsonLd: [
          {
            '@type': 'CollectionPage',
            name: this.i18n.t('meta.projects.title'),
            url: this.seo.origin + this.i18n.path('projects'),
            isPartOf: { '@id': `${this.seo.origin}/#website` },
          },
          {
            '@type': 'ItemList',
            itemListElement: list.map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: this.seo.origin + this.i18n.path('project', p.slug),
              name: this.i18n.l(p.title),
            })),
          },
        ],
      });
    });
  }
}
