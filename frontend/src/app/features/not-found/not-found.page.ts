import { Component, RESPONSE_INIT, effect, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { LinkDirective } from '../../shared/curtain/link.directive';
import { MagneticDirective } from '../../shared/cursor/magnetic.directive';
import { SceneHostComponent } from '../../shared/scenes/scene-host.component';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-not-found',
  imports: [TranslatePipe, LinkDirective, MagneticDirective, SceneHostComponent, IconComponent],
  template: `
    <main id="main" class="page nf">
      <app-scene class="bg" type="HELIX" seed="404" [autoplay]="true" />
      <div class="container inner">
        <span class="eyebrow">404</span>
        <h1 class="display">{{ 'notFound.title' | t }}</h1>
        <p class="lead">{{ 'notFound.text' | t }}</p>
        <a class="btn btn-lg" [appLink]="i18n.path('home')" [linkLabel]="'nav.home' | t" appMagnetic>
          {{ 'notFound.cta' | t }} <app-icon class="arrow" name="arrow-right" [size]="18" />
        </a>
      </div>
    </main>
  `,
  styles: `
    .nf {
      position: relative;
      display: grid;
      align-items: center;
      min-height: 100svh;
      overflow: clip;
    }
    .bg {
      position: absolute;
      inset: 0;
      opacity: 0.7;
    }
    .inner {
      position: relative;
      display: grid;
      gap: var(--space-4);
      justify-items: start;
      max-width: 760px;
    }
  `,
})
export class NotFoundPage {
  readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  constructor() {
    if (this.responseInit) this.responseInit.status = 404;
    effect(() => {
      this.i18n.lang();
      this.seo.set({
        title: this.i18n.t('meta.notFound.title'),
        description: this.i18n.t('meta.notFound.description'),
        page: 'home',
        noindex: true,
      });
    });
  }
}
