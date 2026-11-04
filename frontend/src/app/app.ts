import { Component, DestroyRef, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AnalyticsService } from './core/analytics/analytics.service';
import { I18nService } from './core/i18n/i18n.service';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { MotionService } from './core/motion/motion.service';
import { PointerService } from './core/motion/pointer.service';
import { ScrollService } from './core/motion/scroll.service';
import { ThemeService } from './core/theme/theme.service';
import { CurtainComponent } from './shared/curtain/curtain.component';
import { TransitionService } from './shared/curtain/transition.service';
import { CursorComponent } from './shared/cursor/cursor.component';
import { INTRO_END_MS } from './shared/ui/reveal.directive';
import { HeaderComponent } from './shared/header/header.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CursorComponent, CurtainComponent, HeaderComponent, TranslatePipe],
  template: `
    <a class="skip-link" href="#main">{{ 'common.skipToContent' | t }}</a>
    @if (!isAdmin()) {
      <app-header />
    }
    <router-outlet />
    @if (!isAdmin()) {
      <app-curtain />
    }
    @if (showCursor()) {
      <app-cursor />
    }
    <div class="visually-hidden" aria-live="polite" role="status">{{ announcement() }}</div>
  `,
})
export class App {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);
  private readonly motion = inject(MotionService);
  private readonly pointer = inject(PointerService);
  private readonly scroll = inject(ScrollService);
  private readonly analytics = inject(AnalyticsService);
  private readonly transition = inject(TransitionService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);

  // instantiated for its side effects (html attributes, theme-color)
  readonly theme = inject(ThemeService);

  readonly isAdmin = signal(this.router.url.startsWith('/admin'));
  readonly announcement = signal('');
  readonly showCursor = computed(() => this.browser && this.motion.finePointer() && !this.motion.reduced() && !this.isAdmin());

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        const url = e.urlAfterRedirects;
        this.isAdmin.set(url.startsWith('/admin'));
        this.transition.onNavigationEnd();
        if (this.browser) {
          this.analytics.pageView(url.split('?')[0]);
          // announce the new page to screen readers (pages set the document title)
          setTimeout(() => this.announcement.set(document.title), 400);
        }
      });

    afterNextRender(() => {
      // arms the scroll reveals only now: before hydration the server HTML stays fully visible
      document.documentElement.classList.add('js');
      // the intro sheet is pure CSS; drop its class once it has lifted
      if (document.documentElement.classList.contains('intro-play')) {
        setTimeout(() => document.documentElement.classList.remove('intro-play'), Math.max(0, INTRO_END_MS - performance.now()) + 200);
      }
      this.pointer.start();
      this.scroll.start();
      this.analytics.init();
      if (!this.isAdmin()) {
        this.analytics.pageView(this.router.url.split('?')[0]);
      }
    });
  }
}
