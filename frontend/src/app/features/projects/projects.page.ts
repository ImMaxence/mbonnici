import { ApplicationRef, Component, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import type { ProjectCard, ProjectCategory, Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MotionService } from '../../core/motion/motion.service';
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
          <div class="grid-projects" #grid>
            @for (p of visible(); track p.id; let i = $index) {
              <div class="cell" [attr.data-id]="p.id">
                <app-project-card [project]="p" headingLevel="h2" [priority]="i < 2" />
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
  private readonly grid = viewChild<ElementRef<HTMLElement>>('grid');

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

  /**
   * FLIP: cards that stay glide from their old slot to the new one, new cards rise in cascade.
   * Pure Web Animations on transforms — the page stays clickable, so filters can be changed as
   * fast as you like (a new click simply restarts from wherever the cards are).
   */
  choose(category: ProjectCategory | null): void {
    if (category === this.filter()) return;
    const grid = this.grid()?.nativeElement;
    if (!grid || this.motion.reduced()) {
      this.filter.set(category);
      return;
    }
    const before = new Map<string, DOMRect>();
    for (const el of Array.from(grid.querySelectorAll<HTMLElement>('.cell'))) {
      before.set(el.dataset['id']!, el.getBoundingClientRect());
      el.getAnimations().forEach((a) => a.cancel());
    }
    this.filter.set(category);
    // zoneless: render the new list now so it can be measured in the same frame
    this.appRef.tick();
    const cells = Array.from((this.grid()?.nativeElement ?? grid).querySelectorAll<HTMLElement>('.cell'));
    let fresh = 0;
    for (const el of cells) {
      const old = before.get(el.dataset['id']!);
      const now = el.getBoundingClientRect();
      if (old) {
        const dx = old.left - now.left;
        const dy = old.top - now.top;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
            duration: 700,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          });
        }
      } else {
        el.animate(
          [
            { opacity: 0, transform: 'translate3d(0, 40px, 0) scale(0.97)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 700, delay: Math.min(fresh++, 6) * 70, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' },
        );
      }
    }
  }
}
