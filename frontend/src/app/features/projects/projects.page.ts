import { ApplicationRef, Component, computed, effect, inject, input, signal } from '@angular/core';
import type { ProjectCard, ProjectCategory, Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MotionService } from '../../core/motion/motion.service';
import { SeoService } from '../../core/seo/seo.service';
import { FooterComponent } from '../../shared/ui/footer.component';
import { ProjectCardComponent } from '../../shared/ui/project-card.component';
import { RevealDirective } from '../../shared/ui/reveal.directive';

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown };

@Component({
  selector: 'app-projects',
  imports: [TranslatePipe, FooterComponent, ProjectCardComponent, RevealDirective],
  template: `
    <main id="main" class="page">
      <header class="container page-head">
        <span class="eyebrow" appReveal>{{ 'nav.projects' | t }}</span>
        <h1 class="display" appReveal revealSplit="words">
          {{ 'projects.titleA' | t }} <span class="accent-word">{{ 'projects.titleB' | t }}</span>
        </h1>
        <div class="head-foot">
          <p class="lead" appReveal [revealDelay]="200">{{ 'projects.subtitle' | t }}</p>
          <span class="mono faint total" appReveal [revealDelay]="240">({{ all().length }})</span>
        </div>
      </header>

      <section class="container">
        <div class="filters" role="group" [attr.aria-label]="'common.category' | t" appReveal [revealDelay]="260">
          <button type="button" class="filter" [attr.aria-pressed]="filter() === null" (click)="choose(null)">
            {{ 'projects.filterAll' | t }} <sup>{{ all().length }}</sup>
          </button>
          @for (c of categories(); track c.key) {
            <button type="button" class="filter" [attr.aria-pressed]="filter() === c.key" (click)="choose(c.key)">
              {{ 'categories.' + c.key | t }} <sup>{{ c.count }}</sup>
            </button>
          }
        </div>

        <p class="visually-hidden" aria-live="polite">
          {{ visible().length === 1 ? ('projects.countOne' | t) : ('projects.count' | t: { n: visible().length }) }}
        </p>

        @if (visible().length) {
          @for (g of [generation()]; track g) {
            <div class="grid-projects">
              @for (p of visible(); track p.id; let i = $index) {
                <div
                  class="cell"
                  [class.enter]="animate()"
                  [style.--i]="i"
                  [style.view-transition-name]="'p-' + p.id"
                >
                  <app-project-card [project]="p" headingLevel="h2" [priority]="i < 2" />
                </div>
              }
            </div>
          }
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
      gap: var(--space-5);
      padding: var(--space-8) 0 var(--space-7);
    }
    .head-foot {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: var(--space-5);
      padding-top: var(--space-4);
      border-top: 1px solid var(--line-strong);
    }
    .total {
      font-size: var(--fs-lead);
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: var(--space-7);
    }
    .filter {
      min-height: 44px;
      padding: 0 1.15rem;
      border-radius: var(--radius-pill);
      border: 1px solid var(--line-strong);
      font-weight: 500;
      color: var(--fg-2);
      transition:
        background-color var(--dur-2),
        color var(--dur-2),
        border-color var(--dur-2);
    }
    .filter:hover {
      color: var(--fg);
      border-color: var(--fg);
    }
    .filter[aria-pressed='true'] {
      background: var(--fg);
      border-color: var(--fg);
      color: var(--bg);
    }
    .filter sup {
      font-family: var(--font-mono);
      font-size: 0.62rem;
      margin-left: 0.15em;
      opacity: 0.7;
    }
    .grid-projects {
      display: grid;
      gap: clamp(3rem, 6vw, 5rem) var(--gutter);
    }
    @media (min-width: 900px) {
      .grid-projects {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .cell:nth-child(even) {
        margin-top: clamp(0px, 8vw, 8rem);
      }
    }
  `,
})
export class ProjectsPage {
  private readonly seo = inject(SeoService);
  private readonly motion = inject(MotionService);
  private readonly appRef = inject(ApplicationRef);
  readonly i18n = inject(I18nService);

  // resolved by the route and bound as inputs
  readonly projects = input<ProjectCard[]>();
  readonly settings = input<Settings>();
  readonly filter = signal<ProjectCategory | null>(null);
  /** bumped on every filter change when the cards are re-created (fallback animation) */
  readonly generation = signal(0);
  readonly animate = signal(false);

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

  /** Cards that stay glide to their new place, the others fade in (View Transitions), or the grid re-enters in cascade. */
  choose(category: ProjectCategory | null): void {
    if (category === this.filter()) return;
    const doc = document as ViewTransitionDocument;
    if (this.motion.reduced()) {
      this.filter.set(category);
      return;
    }
    if (doc.startViewTransition) {
      this.animate.set(false);
      doc.startViewTransition(() => {
        this.filter.set(category);
        // zoneless: render now, the transition snapshots the DOM right after this callback
        this.appRef.tick();
      });
      return;
    }
    this.animate.set(true);
    this.filter.set(category);
    this.generation.update((g) => g + 1);
  }
}
