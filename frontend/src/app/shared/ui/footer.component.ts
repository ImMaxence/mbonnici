import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { MotionService } from '../../core/motion/motion.service';
import { LinkDirective } from '../curtain/link.directive';
import { MagneticDirective } from '../cursor/magnetic.directive';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, LocalizedPipe, LinkDirective, IconComponent, MagneticDirective],
  template: `
    <footer class="footer">
      <div class="container">
        <div class="top">
          <div class="brand">
            <span class="eyebrow">{{ 'meta.siteName' | t }}</span>
            <p class="h3">{{ settings()?.headline | l }}</p>
            @if (settings()?.location; as loc) {
              <p class="small faint row"><app-icon name="map-pin" [size]="14" /> {{ loc }}</p>
            }
          </div>
          <nav class="links" aria-label="Footer">
            <a [appLink]="i18n.path('home')" [linkLabel]="'nav.home' | t" class="link">{{ 'nav.home' | t }}</a>
            <a [appLink]="i18n.path('projects')" [linkLabel]="'nav.projects' | t" class="link">{{ 'nav.projects' | t }}</a>
            <a [appLink]="i18n.path('about')" [linkLabel]="'nav.about' | t" class="link">{{ 'nav.about' | t }}</a>
            <a [appLink]="i18n.path('contact')" [linkLabel]="'nav.contact' | t" class="link">{{ 'nav.contact' | t }}</a>
          </nav>
          <div class="socials">
            @if (settings()?.githubUrl; as gh) {
              <a class="btn btn-ghost btn-icon" [href]="gh" target="_blank" rel="noopener noreferrer me" aria-label="GitHub" appMagnetic>
                <app-icon name="github" [size]="18" />
              </a>
            }
            @if (settings()?.linkedinUrl; as li) {
              <a class="btn btn-ghost btn-icon" [href]="li" target="_blank" rel="noopener noreferrer me" aria-label="LinkedIn" appMagnetic>
                <app-icon name="linkedin" [size]="18" />
              </a>
            }
            @if (settings()?.publicEmail; as mail) {
              <a class="btn btn-ghost btn-icon" [href]="'mailto:' + mail" aria-label="E-mail" appMagnetic>
                <app-icon name="mail" [size]="18" />
              </a>
            }
          </div>
        </div>
        <div class="bottom">
          <p class="small faint">{{ 'footer.rights' | t: { year: year, owner: settings()?.ownerName ?? 'Maxence Bonnici' } }}</p>
          <nav class="legal small" aria-label="Legal">
            <a [appLink]="i18n.path('legal')" [linkLabel]="'footer.legal' | t">{{ 'footer.legal' | t }}</a>
            <a [appLink]="i18n.path('privacy')" [linkLabel]="'footer.privacy' | t">{{ 'footer.privacy' | t }}</a>
            <a [appLink]="i18n.path('terms')" [linkLabel]="'footer.terms' | t">{{ 'footer.terms' | t }}</a>
            <a href="https://github.com/ImMaxence/mbonnici" target="_blank" rel="noopener noreferrer">{{ 'footer.source' | t }}</a>
          </nav>
          <button type="button" class="btn btn-ghost btn-icon" (click)="top()" [attr.aria-label]="'common.backToTop' | t" appMagnetic>
            <app-icon name="arrow-up" [size]="18" />
          </button>
        </div>
      </div>
    </footer>
  `,
  styles: `
    .footer {
      margin-top: var(--section);
      padding: var(--space-8) 0 var(--space-6);
      border-top: 1px solid var(--line);
    }
    .top {
      display: grid;
      gap: var(--space-6);
      padding-bottom: var(--space-6);
      border-bottom: 1px solid var(--line);
    }
    @media (min-width: 900px) {
      .top {
        grid-template-columns: 1.4fr 1fr auto;
        align-items: start;
      }
    }
    .brand {
      display: grid;
      gap: var(--space-3);
      max-width: 36ch;
    }
    .brand .row {
      gap: 0.4em;
    }
    .links {
      display: grid;
      gap: var(--space-2);
      justify-items: start;
      font-size: var(--fs-lead);
      font-family: var(--font-display);
      letter-spacing: var(--track-display);
    }
    .socials {
      display: flex;
      gap: var(--space-2);
    }
    .bottom {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding-top: var(--space-5);
    }
    .legal {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
      color: var(--fg-3);
    }
    .legal a:hover {
      color: var(--fg);
    }
  `,
})
export class FooterComponent {
  readonly settings = input<Settings | null | undefined>(null);
  readonly i18n = inject(I18nService);
  private readonly motion = inject(MotionService);
  readonly year = new Date().getFullYear();

  top(): void {
    window.scrollTo({ top: 0, behavior: this.motion.reduced() ? 'auto' : 'smooth' });
  }
}
