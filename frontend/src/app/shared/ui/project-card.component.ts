import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { ProjectCard } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LinkDirective } from '../curtain/link.directive';
import { CursorDirective } from '../cursor/cursor.directive';
import { IphoneComponent } from '../iphone/iphone.component';
import { HostedSceneType, SceneHostComponent } from '../scenes/scene-host.component';
import { StackSceneComponent } from '../scenes/stack-scene.component';
import { IconComponent } from './icon.component';
import { ImgComponent } from './img.component';

/** Project tile: the 3D scene wakes up on hover, the cover (if any) floats above it. */
@Component({
  selector: 'app-project-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, LinkDirective, CursorDirective, IconComponent, ImgComponent, SceneHostComponent, StackSceneComponent, IphoneComponent],
  template: `
    <a
      class="card pc"
      [appLink]="path()"
      [linkLabel]="title()"
      appCursor="label"
      [cursorLabel]="'cursor.view' | t"
      [style.--accent]="project().accentColor"
      [class.is-hover]="hover()"
      (pointerenter)="hover.set(true)"
      (pointerleave)="hover.set(false)"
      (focus)="hover.set(true)"
      (blur)="hover.set(false)"
    >
      <div class="visual">
        @switch (project().sceneType) {
          @case ('STACK') {
            <app-stack-scene class="fill" [accent]="project().accentColor" [labels]="project().stack" [image]="project().cover" />
          }
          @case ('DEVICE') {
            <div class="device fill">
              <app-iphone
                [images]="project().cover ? [project().cover!] : []"
                [title]="title()"
                [tagline]="tagline()"
                [accent]="project().accentColor"
              />
            </div>
          }
          @default {
            <app-scene
              class="fill"
              [type]="hostedType()"
              [accent]="project().accentColor"
              [labels]="project().stack"
              [seed]="project().slug"
              [active]="hover()"
              [ariaLabel]="title()"
            />
            @if (project().cover; as cover) {
              <app-img class="cover" [media]="cover" sizes="(max-width: 720px) 90vw, 40vw" />
            }
          }
        }
        @if (project().featured) {
          <span class="featured chip chip-accent"><app-icon name="star" [size]="12" /> {{ 'projects.featured' | t }}</span>
        }
      </div>
      <div class="body">
        <span class="eyebrow">
          {{ 'categories.' + project().category | t }}
          @if (project().year) {
            <span class="dot-sep">·</span>{{ project().year }}
          }
        </span>
        @if (headingLevel() === 'h2') {
          <h2 class="h3">{{ title() }}</h2>
        } @else {
          <h3 class="h3">{{ title() }}</h3>
        }
        <p class="muted">{{ tagline() }}</p>
        <div class="chips">
          @for (s of project().stack.slice(0, 4); track s) {
            <span class="chip">{{ s }}</span>
          }
        </div>
      </div>
      <span class="arrow" aria-hidden="true"><app-icon name="arrow-up-right" [size]="18" /></span>
    </a>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .pc {
      display: grid;
      grid-template-rows: auto 1fr;
      height: 100%;
      color: inherit;
    }
    .visual {
      position: relative;
      aspect-ratio: 16 / 11;
      background:
        radial-gradient(80% 70% at 50% 100%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%),
        var(--bg-3);
      overflow: hidden;
    }
    .fill {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .device {
      display: grid;
      place-items: center;
      --phone-w: 170px;
    }
    .device app-iphone {
      transform: translateY(14%);
      transition: transform 0.9s var(--ease-out);
    }
    .is-hover .device app-iphone {
      transform: translateY(8%);
    }
    .cover {
      position: absolute;
      left: 12%;
      right: 12%;
      bottom: -6%;
      border-radius: var(--radius-s);
      box-shadow: var(--shadow-3);
      transform: perspective(900px) rotateX(8deg) translateY(10px);
      transition: transform 0.9s var(--ease-out);
      border: 1px solid var(--glass-border);
    }
    .is-hover .cover {
      transform: perspective(900px) rotateX(2deg) translateY(-6px);
    }
    .featured {
      position: absolute;
      top: 14px;
      left: 14px;
      z-index: 2;
      backdrop-filter: blur(10px);
    }
    .body {
      display: grid;
      gap: 0.6rem;
      padding: var(--space-5);
      align-content: start;
    }
    .body h2,
    .body h3 {
      transition: color var(--dur-2);
    }
    .is-hover .body h2,
    .is-hover .body h3 {
      color: var(--accent);
    }
    .dot-sep {
      margin: 0 0.4em;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 0.4rem;
    }
    .arrow {
      position: absolute;
      top: var(--space-4);
      right: var(--space-4);
      z-index: 2;
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--fg);
      color: var(--bg);
      opacity: 0;
      transform: translate(-6px, 6px) scale(0.8);
      transition:
        opacity var(--dur-2),
        transform var(--dur-3) var(--ease-spring);
    }
    .is-hover .arrow {
      opacity: 1;
      transform: none;
    }
    @media (hover: none) {
      .arrow {
        opacity: 1;
        transform: none;
      }
    }
  `,
})
export class ProjectCardComponent {
  readonly project = input.required<ProjectCard>();
  /** h2 on listing pages (directly under the page h1), h3 inside a titled section */
  readonly headingLevel = input<'h2' | 'h3'>('h3');
  private readonly i18n = inject(I18nService);

  readonly hover = signal(false);
  /** STACK and DEVICE are DOM scenes; everything else is a canvas scene. */
  readonly hostedType = computed<HostedSceneType>(() => {
    const t = this.project().sceneType;
    return t === 'STACK' || t === 'DEVICE' ? 'ORBIT' : t;
  });
  readonly title = computed(() => this.i18n.l(this.project().title));
  readonly tagline = computed(() => this.i18n.l(this.project().tagline));
  readonly path = computed(() => this.i18n.path('project', this.project().slug));
}
