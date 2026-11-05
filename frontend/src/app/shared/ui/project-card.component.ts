import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { ProjectCard } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LinkDirective } from '../curtain/link.directive';
import { CursorDirective } from '../cursor/cursor.directive';
import { IconComponent } from './icon.component';
import { ShowcaseComponent } from './showcase.component';
import { StatusPillComponent } from './status-pill.component';
import { InsightsStore } from '../../core/api/insights.store';
import { stripDot } from './text';

/** Project tile: the real landing page (desktop + phone) with title, year and stack underneath. */
@Component({
  selector: 'app-project-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, LinkDirective, CursorDirective, IconComponent, ShowcaseComponent, StatusPillComponent],
  template: `
    <a
      class="pc"
      [appLink]="path()"
      [linkLabel]="title()"
      linkMorph="app-showcase"
      appCursor="label"
      [cursorLabel]="'cursor.view' | t"
      [class.is-hover]="hover()"
      (pointerenter)="$event.pointerType !== 'touch' && hover.set(true)"
      (pointerleave)="hover.set(false)"
      (focus)="focused($event)"
      (blur)="hover.set(false)"
    >
      <app-showcase
        [slug]="project().slug"
        [title]="title()"
        [accent]="project().accentColor"
        [mode]="project().displayMode"
        [cover]="project().cover"
        [coverVideo]="project().coverVideo"
        [mobileMedia]="project().mobileCover"
        [site]="project().liveUrl"
        [priority]="priority()"
      />
      <div class="body">
        <div class="line">
          @if (headingLevel() === 'h2') {
            <h2 class="h3">{{ title() }}</h2>
          } @else {
            <h3 class="h3">{{ title() }}</h3>
          }
          <span class="arrow" aria-hidden="true"><app-icon name="arrow-up-right" [size]="18" /></span>
        </div>
        <p class="tagline">{{ tagline() }}</p>
        <p class="meta mono">
          @if (insight()?.site; as site) {
            @if (site.up) {
              <app-status-pill [site]="site" />
            }
          }
          <span>{{ 'categories.' + project().category | t }}</span>
          @if (project().year) {
            <span>{{ project().year }}</span>
          }
          @for (s of project().stack.slice(0, 3); track s) {
            <span>{{ s }}</span>
          }
        </p>
      </div>
    </a>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .pc {
      display: grid;
      gap: var(--space-5);
      align-content: start;
      height: 100%;
      color: inherit;
    }
    .body {
      display: grid;
      gap: 0.55rem;
    }
    .line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
    }
    .line h2,
    .line h3 {
      font-size: clamp(1.4rem, 1rem + 1.4vw, 2.2rem);
      letter-spacing: -0.04em;
      background-image: linear-gradient(currentColor, currentColor);
      background-size: 0 1.5px;
      background-repeat: no-repeat;
      background-position: 0 96%;
      transition: background-size 0.7s var(--ease-out);
    }
    .is-hover .line h2,
    .is-hover .line h3 {
      background-size: 100% 1.5px;
    }
    .arrow {
      flex: none;
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 1px solid var(--line-strong);
      transition:
        background-color var(--dur-2),
        color var(--dur-2),
        transform 0.6s var(--ease-spring);
    }
    .is-hover .arrow {
      background: var(--fg);
      color: var(--bg);
      transform: rotate(45deg);
    }
    .tagline {
      color: var(--fg-2);
      max-width: 52ch;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem 1rem;
      font-size: var(--fs-micro);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--fg-3);
    }
  `,
})
export class ProjectCardComponent {
  readonly project = input.required<ProjectCard>();
  /** h2 on listing pages (directly under the page h1), h3 inside a titled section */
  readonly headingLevel = input<'h2' | 'h3'>('h3');
  readonly priority = input(false);
  private readonly i18n = inject(I18nService);

  readonly hover = signal(false);

  /** keyboard focus lifts the card like a hover; the focus a tap gives does not */
  focused(e: FocusEvent): void {
    if ((e.target as HTMLElement).matches(':focus-visible')) this.hover.set(true);
  }
  readonly title = computed(() => this.i18n.l(this.project().title));
  readonly tagline = computed(() => stripDot(this.i18n.l(this.project().tagline)));
  readonly path = computed(() => this.i18n.path('project', this.project().slug));
  private readonly insights = inject(InsightsStore);
  readonly insight = computed(() => this.insights.of(this.project().slug));
}

