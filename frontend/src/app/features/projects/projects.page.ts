import {
  ApplicationRef,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { ProjectCard, ProjectCategory, Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { MotionService } from '../../core/motion/motion.service';
import { Spring2 } from '../../core/motion/physics';
import { RafService } from '../../core/motion/raf.service';
import { SeoService } from '../../core/seo/seo.service';
import { LinkDirective } from '../../shared/curtain/link.directive';
import { CursorDirective } from '../../shared/cursor/cursor.directive';
import { FooterComponent } from '../../shared/ui/footer.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ProjectCardComponent } from '../../shared/ui/project-card.component';
import { RevealDirective } from '../../shared/ui/reveal.directive';
import { fromMedia } from '../../shared/ui/shots';
import { usesTech } from '../../shared/ui/tech';

type View = 'grid' | 'list';
const VIEW_KEY = 'mb.projectsView';

@Component({
  selector: 'app-projects',
  imports: [TranslatePipe, LocalizedPipe, FooterComponent, ProjectCardComponent, RevealDirective, IconComponent, LinkDirective, CursorDirective],
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
        <div class="toolbar" appReveal [revealDelay]="260">
          <div class="filters" role="group" [attr.aria-label]="'common.category' | t">
            <button type="button" class="filter" [attr.aria-pressed]="filter() === null" (click)="choose(null)">
              {{ 'projects.filterAll' | t }} <sup>{{ byTech().length }}</sup>
            </button>
            @for (c of categories(); track c.key) {
              <button type="button" class="filter" [attr.aria-pressed]="filter() === c.key" (click)="choose(c.key)">
                {{ 'categories.' + c.key | t }} <sup>{{ c.count }}</sup>
              </button>
            }
            @if (tech(); as t) {
              <a class="filter tech" [appLink]="i18n.path('projects')" [linkLabel]="'nav.projects' | t" [attr.aria-label]="'projects.clearTech' | t: { tech: t }">
                <span class="faint">{{ 'projects.with' | t }}</span> {{ t }} <app-icon name="close" [size]="14" />
              </a>
            }
          </div>
          <div class="views" role="group" [attr.aria-label]="'projects.view' | t">
            <button type="button" class="view-btn" [attr.aria-pressed]="view() === 'grid'" (click)="setView('grid')" [attr.aria-label]="'projects.viewGrid' | t">
              <app-icon name="grid" [size]="16" /> <span>{{ 'projects.viewGrid' | t }}</span>
            </button>
            <button type="button" class="view-btn" [attr.aria-pressed]="view() === 'list'" (click)="setView('list')" [attr.aria-label]="'projects.viewList' | t">
              <app-icon name="menu" [size]="16" /> <span>{{ 'projects.viewList' | t }}</span>
            </button>
          </div>
        </div>

        <p class="visually-hidden" aria-live="polite">
          {{ visible().length === 1 ? ('projects.countOne' | t) : ('projects.count' | t: { n: visible().length }) }}
        </p>

        @if (!visible().length) {
          <p class="muted">{{ 'projects.empty' | t }}</p>
        } @else if (view() === 'grid') {
          <div class="grid-projects" #grid>
            @for (p of visible(); track p.id; let i = $index) {
              <div class="cell" [attr.data-id]="p.id">
                <app-project-card [project]="p" headingLevel="h2" [priority]="i < 2" />
              </div>
            }
          </div>
        } @else {
          <ol class="rows" #grid (pointerleave)="leave()" (pointermove)="track($event)">
            @for (p of visible(); track p.id; let i = $index) {
              <li class="cell" [attr.data-id]="p.id">
                <a
                  class="row roll-trigger"
                  [appLink]="i18n.path('project', p.slug)"
                  [linkLabel]="p.title | l"
                  appCursor="label"
                  [cursorLabel]="'cursor.view' | t"
                  (pointerenter)="enter(p)"
                  (focus)="enter(p)"
                  (blur)="leave()"
                >
                  <span class="n mono">{{ pad(i + 1) }}</span>
                  <h2 class="title">{{ p.title | l }}</h2>
                  <span class="tagline">{{ p.tagline | l }}</span>
                  <span class="meta mono">
                    <span>{{ 'categories.' + p.category | t }}</span>
                    @if (p.year) {
                      <span>{{ p.year }}</span>
                    }
                  </span>
                  @if (thumb(p); as v) {
                    <img class="thumb" [src]="v.src" [attr.srcset]="v.srcset || null" sizes="96px" [style.object-position]="v.pos" alt="" loading="lazy" decoding="async" />
                  }
                  <span class="go" aria-hidden="true"><app-icon name="arrow-up-right" [size]="20" /></span>
                </a>
              </li>
            }
          </ol>
          <!-- follows the pointer over the list (fine pointers only) -->
          <div class="preview" #preview aria-hidden="true" [class.is-on]="hovered() !== null">
            @for (p of visible(); track p.id) {
              @if (thumb(p); as v) {
                <img [src]="v.src" [attr.srcset]="v.srcset || null" sizes="420px" [style.object-position]="v.pos" alt="" decoding="async" [class.is-current]="hovered()?.id === p.id" />
              }
            }
          </div>
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
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-4);
      margin-bottom: var(--space-7);
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .filter {
      display: inline-flex;
      align-items: center;
      gap: 0.35em;
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
    .filter.tech {
      border-color: var(--accent);
      color: var(--fg);
    }
    .views {
      display: inline-flex;
      padding: 4px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--line-strong);
    }
    .view-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      min-height: 36px;
      padding: 0 0.9rem;
      border-radius: var(--radius-pill);
      font-size: var(--fs-small);
      font-weight: 500;
      color: var(--fg-2);
      transition:
        background-color var(--dur-2),
        color var(--dur-2);
    }
    .view-btn[aria-pressed='true'] {
      background: var(--fg);
      color: var(--bg);
    }
    @media (max-width: 520px) {
      .view-btn span {
        display: none;
      }
    }
    .grid-projects {
      display: grid;
      gap: clamp(3rem, 6vw, 5rem) var(--gutter);
    }
    @media (min-width: 900px) {
      .grid-projects {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .grid-projects .cell:nth-child(even) {
        margin-top: clamp(0px, 8vw, 8rem);
      }
    }

    /* ── list ── */
    .rows {
      border-top: 1px solid var(--line-strong);
    }
    .rows .cell {
      border-bottom: 1px solid var(--line);
    }
    .row {
      position: relative;
      display: grid;
      grid-template-columns: 3rem minmax(0, 1fr) auto;
      grid-template-areas:
        'n title go'
        'n tagline go'
        'n meta go';
      align-items: center;
      column-gap: var(--space-4);
      row-gap: 0.2rem;
      padding: clamp(1.1rem, 2.6vw, 2rem) 0;
    }
    .n {
      grid-area: n;
      align-self: start;
      padding-top: 0.6em;
      font-size: var(--fs-micro);
      color: var(--fg-3);
    }
    .title {
      grid-area: title;
      margin: 0;
      font-family: var(--font-display);
      font-weight: var(--weight-display);
      font-size: clamp(2rem, 1rem + 4.2vw, 5.2rem);
      letter-spacing: -0.045em;
      line-height: 1;
      transition:
        transform 0.6s var(--ease-out),
        color var(--dur-2);
    }
    .tagline {
      grid-area: tagline;
      color: var(--fg-2);
      max-width: 60ch;
    }
    .meta {
      grid-area: meta;
      display: flex;
      gap: 1rem;
      font-size: var(--fs-micro);
      color: var(--fg-3);
    }
    .go {
      grid-area: go;
      display: grid;
      place-items: center;
      width: 3.2rem;
      height: 3.2rem;
      border-radius: 50%;
      border: 1px solid var(--line-strong);
      transition:
        transform 0.5s var(--ease-out),
        background-color var(--dur-2),
        color var(--dur-2),
        border-color var(--dur-2);
    }
    .thumb {
      display: none;
    }
    @media (hover: hover) and (pointer: fine) {
      .row:hover .title {
        transform: translateX(1.2rem);
        color: var(--accent);
      }
      .row:hover .go {
        transform: rotate(45deg);
        background: var(--fg);
        border-color: var(--fg);
        color: var(--bg);
      }
    }
    /* touch screens: no floating preview, a small picture in the row */
    @media (hover: none), (pointer: coarse) {
      .row {
        grid-template-columns: minmax(0, 1fr) 96px;
        grid-template-areas:
          'title thumb'
          'tagline thumb'
          'meta thumb';
      }
      .n,
      .go {
        display: none;
      }
      .thumb {
        grid-area: thumb;
        display: block;
        width: 96px;
        height: 64px;
        object-fit: cover;
        border-radius: 8px;
        background: var(--bg-3);
      }
      .title {
        font-size: clamp(1.6rem, 1rem + 4vw, 2.4rem);
      }
    }
    .preview {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 30;
      width: min(420px, 32vw);
      aspect-ratio: 16 / 10;
      border-radius: 14px;
      overflow: hidden;
      pointer-events: none;
      background: var(--bg-3);
      box-shadow: 0 30px 80px -24px rgba(10, 10, 20, 0.45);
      opacity: 0;
      scale: 0.6;
      transition:
        opacity 0.3s var(--ease-out),
        scale 0.45s var(--ease-out);
      will-change: transform;
    }
    .preview.is-on {
      opacity: 1;
      scale: 1;
    }
    .preview img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      scale: 1.08;
      transition:
        opacity 0.35s var(--ease-out),
        scale 0.8s var(--ease-out);
    }
    .preview img.is-current {
      opacity: 1;
      scale: 1;
    }
    @media (hover: none), (pointer: coarse) {
      .preview {
        display: none;
      }
    }
  `,
})
export class ProjectsPage {
  private readonly seo = inject(SeoService);
  private readonly motion = inject(MotionService);
  private readonly raf = inject(RafService);
  private readonly appRef = inject(ApplicationRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly i18n = inject(I18nService);

  // resolved by the route and bound as inputs
  readonly projects = input<ProjectCard[]>();
  readonly settings = input<Settings>();
  /** ?tech=Spring Boot (from a skill of the toolbox) */
  readonly tech = input<string | undefined>();
  readonly filter = signal<ProjectCategory | null>(null);
  readonly view = signal<View>('grid');
  readonly hovered = signal<ProjectCard | null>(null);
  private readonly grid = viewChild<ElementRef<HTMLElement>>('grid');
  private readonly preview = viewChild<ElementRef<HTMLElement>>('preview');
  private readonly spring = new Spring2(220, 26);
  private stopFrame: (() => void) | null = null;

  readonly all = computed(() => this.projects() ?? []);
  /** the projects using the ?tech= technology (all when there is none) */
  readonly byTech = computed(() => {
    const t = this.tech()?.trim();
    return t ? this.all().filter((p) => usesTech(p.stack, t)) : this.all();
  });
  readonly categories = computed(() => {
    const counts = new Map<ProjectCategory, number>();
    for (const p of this.byTech()) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [...counts.entries()].map(([key, count]) => ({ key, count }));
  });
  readonly visible = computed(() => {
    const f = this.filter();
    return f ? this.byTech().filter((p) => p.category === f) : this.byTech();
  });

  constructor() {
    afterNextRender(() => {
      try {
        const v = localStorage.getItem(VIEW_KEY);
        if (v === 'list' || v === 'grid') this.view.set(v);
      } catch {
        // storage blocked: grid
      }
    });
    inject(DestroyRef).onDestroy(() => this.stopFrame?.());

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

  pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  thumb(p: ProjectCard) {
    return fromMedia(p.cover, '');
  }

  setView(v: View): void {
    if (v === this.view()) return;
    this.hovered.set(null);
    this.view.set(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // private mode: not remembered
    }
    if (!this.motion.reduced()) {
      this.appRef.tick();
      const cells = Array.from(this.grid()?.nativeElement.querySelectorAll<HTMLElement>('.cell') ?? []);
      cells.forEach((el, i) =>
        el.animate([{ opacity: 0, transform: 'translate3d(0, 24px, 0)' }, { opacity: 1, transform: 'none' }], {
          duration: 600,
          delay: Math.min(i, 8) * 45,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'backwards',
        }),
      );
    }
  }

  // ── floating preview (list view) ─────────────────────────────────────────
  enter(p: ProjectCard): void {
    this.hovered.set(p);
  }

  leave(): void {
    this.hovered.set(null);
  }

  track(e: PointerEvent): void {
    if (!this.browser || e.pointerType !== 'mouse') return;
    const el = this.preview()?.nativeElement;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    // to the right of the pointer, kept inside the viewport
    const x = Math.min(innerWidth - w - 16, e.clientX + 28);
    const y = Math.min(innerHeight - h - 16, Math.max(16, e.clientY - h / 2));
    if (!this.stopFrame) {
      this.spring.x.set(x);
      this.spring.y.set(y);
      this.stopFrame = this.raf.add((dt) => {
        this.spring.update(this.motion.reduced() ? 1 : dt);
        el.style.transform = `translate3d(${this.spring.x.value}px, ${this.spring.y.value}px, 0)`;
        if (this.hovered() === null && this.spring.settled()) {
          this.stopFrame?.();
          this.stopFrame = null;
        }
      });
    }
    this.spring.setTarget(x, y);
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
