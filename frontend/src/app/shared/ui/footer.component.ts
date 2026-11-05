import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { MotionService } from '../../core/motion/motion.service';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { LinkDirective } from '../curtain/link.directive';
import { MagneticDirective } from '../cursor/magnetic.directive';
import { cvLink } from './cv';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, LocalizedPipe, LinkDirective, IconComponent, MagneticDirective],
  template: `
    <footer class="footer">
      <div class="container">
        <div class="top">
          <div class="col">
            <span class="eyebrow plain">{{ 'footer.say' | t }}</span>
            @if (settings()?.publicEmail; as mail) {
              <a class="mail" [href]="'mailto:' + mail">{{ mail }}</a>
            }
            <p class="small faint">@if (settings()?.headline | l; as h) { {{ h }}@if (settings()?.location) { · } }{{ settings()?.location }}</p>
          </div>
          <nav class="col links" [attr.aria-label]="'footer.nav' | t">
            <span class="eyebrow plain">{{ 'footer.pages' | t }}</span>
            <a [appLink]="i18n.path('home')" [linkLabel]="'nav.home' | t">{{ 'nav.home' | t }}</a>
            <a [appLink]="i18n.path('projects')" [linkLabel]="'nav.projects' | t">{{ 'nav.projects' | t }}</a>
            <a [appLink]="i18n.path('about')" [linkLabel]="'nav.about' | t">{{ 'nav.about' | t }}</a>
            <a [appLink]="i18n.path('contact')" [linkLabel]="'nav.contact' | t">{{ 'nav.contact' | t }}</a>
          </nav>
          <div class="col links">
            <span class="eyebrow plain">{{ 'footer.elsewhere' | t }}</span>
            @if (settings()?.githubUrl; as gh) {
              <a [href]="gh" target="_blank" rel="noopener noreferrer me">GitHub <app-icon name="arrow-up-right" [size]="14" /></a>
            }
            @if (settings()?.linkedinUrl; as li) {
              <a [href]="li" target="_blank" rel="noopener noreferrer me">LinkedIn <app-icon name="arrow-up-right" [size]="14" /></a>
            }
            @if (cvHref(); as href) {
              <a [href]="href" target="_blank" rel="noopener" (click)="cv()">{{ 'footer.cv' | t }} <app-icon name="arrow-up-right" [size]="14" /></a>
            }
            <a href="https://github.com/ImMaxence/mbonnici" target="_blank" rel="noopener noreferrer">{{ 'footer.source' | t }} <app-icon name="arrow-up-right" [size]="14" /></a>
          </div>
        </div>

        <!-- the domain name, sized to fill the column exactly (see .wordmark) -->
        <p class="wordmark" aria-hidden="true">MBONNICI.FR</p>

        <div class="bottom">
          <p class="small faint">{{ 'footer.rights' | t: { year: year, owner: settings()?.ownerName ?? 'Maxence Bonnici' } }}</p>
          <nav class="legal small" [attr.aria-label]="'footer.legalNav' | t">
            <a [appLink]="i18n.path('legal')" [linkLabel]="'footer.legal' | t">{{ 'footer.legal' | t }}</a>
            <a [appLink]="i18n.path('privacy')" [linkLabel]="'footer.privacy' | t">{{ 'footer.privacy' | t }}</a>
            <a [appLink]="i18n.path('terms')" [linkLabel]="'footer.terms' | t">{{ 'footer.terms' | t }}</a>
            <a [appLink]="i18n.path('accessibility')" [linkLabel]="'footer.accessibility' | t">{{ 'footer.accessibility' | t }}</a>
          </nav>
          <button type="button" class="top-btn" (click)="top()" appMagnetic>
            {{ 'common.backToTop' | t }} <app-icon name="arrow-up" [size]="16" />
          </button>
        </div>
      </div>
    </footer>
  `,
  styles: `
    .footer > .container {
      container-type: inline-size;
    }
    .footer {
      margin-top: var(--section);
      padding: var(--space-7) 0 var(--space-5);
      background: var(--fg);
      color: var(--bg);
      --line: color-mix(in srgb, var(--bg) 16%, transparent);
      overflow: hidden;
    }
    .footer .eyebrow,
    .footer .faint {
      color: color-mix(in srgb, var(--bg) 60%, transparent);
    }
    .top {
      display: grid;
      gap: var(--space-6);
      padding-bottom: var(--space-7);
    }
    @media (min-width: 900px) {
      .top {
        grid-template-columns: 6fr 3fr 3fr;
      }
    }
    .col {
      display: grid;
      gap: var(--space-3);
      align-content: start;
      justify-items: start;
    }
    .mail {
      font-family: var(--font-display);
      font-size: clamp(1.5rem, 1rem + 2.2vw, 2.8rem);
      font-weight: var(--weight-display);
      letter-spacing: -0.04em;
      line-height: 1.05;
      overflow-wrap: anywhere;
      background-image: linear-gradient(currentColor, currentColor);
      background-size: 0 2px;
      background-repeat: no-repeat;
      background-position: 0 100%;
      transition: background-size 0.6s var(--ease-out);
    }
    @media (hover: hover) {
      .mail:hover {
        background-size: 100% 2px;
      }
    }
    .links a {
      display: inline-flex;
      align-items: center;
      gap: 0.35em;
      font-size: 1.05rem;
      opacity: 0.85;
      transition: opacity var(--dur-1);
    }
    @media (hover: hover) {
      .links a:hover {
        opacity: 1;
      }
    }
    /* "MBONNICI.FR" in Inter Tight 600 at -0.04em: the ink is 5.818 × the font size wide and starts
       0.05em after the origin, so 17.18cqi fills the container from edge to edge at any width */
    .wordmark {
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 17.18cqi;
      letter-spacing: -0.04em;
      line-height: 0.74;
      white-space: nowrap;
      margin: 0 0 var(--space-5) -0.05em;
      padding-top: 0.04em;
    }
    .bottom {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding-top: var(--space-5);
      border-top: 1px solid var(--line);
    }
    .legal {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem var(--space-5);
      color: color-mix(in srgb, var(--bg) 70%, transparent);
    }
    @media (hover: hover) {
      .legal a:hover {
        color: var(--bg);
      }
    }
    .top-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5em;
      min-height: 44px;
      padding: 0 1rem;
      border-radius: var(--radius-pill);
      border: 1px solid var(--line);
      font-size: var(--fs-small);
    }
    @media (hover: hover) {
      .top-btn:hover {
        background: var(--bg);
        color: var(--fg);
      }
    }
  `,
})
export class FooterComponent {
  readonly settings = input<Settings | null | undefined>(null);
  readonly i18n = inject(I18nService);
  private readonly motion = inject(MotionService);
  readonly year = new Date().getFullYear();

  private readonly analytics = inject(AnalyticsService);
  /** opened in the browser's PDF viewer */
  readonly cvHref = computed(() => cvLink(this.settings(), this.i18n.lang(), this.i18n.locale(), false)?.href ?? null);

  cv(): void {
    this.analytics.cvDownload(location.pathname);
  }

  top(): void {
    window.scrollTo({ top: 0, behavior: this.motion.reduced() ? 'auto' : 'smooth' });
  }
}
