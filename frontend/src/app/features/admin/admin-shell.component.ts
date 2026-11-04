import { UpperCasePipe } from '@angular/common';
import { Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeService } from '../../core/theme/theme.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { APP_VERSION } from '../../../environments/version';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, IconComponent, UpperCasePipe],
  template: `
    <div class="admin">
      <aside class="admin-aside">
        <a class="admin-brand" routerLink="/admin"><span class="mark"></span> {{ 'admin.title' | t }}</a>
        <nav class="admin-nav" aria-label="Admin">
          <a routerLink="/admin" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }"><app-icon name="chart" [size]="18" /> {{ 'admin.nav.dashboard' | t }}</a>
          <a routerLink="/admin/projects" routerLinkActive="is-active"><app-icon name="layers" [size]="18" /> {{ 'admin.nav.projects' | t }}</a>
          <a routerLink="/admin/media" routerLinkActive="is-active"><app-icon name="image" [size]="18" /> {{ 'admin.nav.media' | t }}</a>
          <a routerLink="/admin/profile" routerLinkActive="is-active"><app-icon name="user" [size]="18" /> {{ 'admin.nav.profile' | t }}</a>
          <a routerLink="/admin/settings" routerLinkActive="is-active"><app-icon name="settings" [size]="18" /> {{ 'admin.nav.settings' | t }}</a>
          <a routerLink="/admin/messages" routerLinkActive="is-active">
            <app-icon name="inbox" [size]="18" /> {{ 'admin.nav.messages' | t }}
            @if (unread() > 0) {
              <span class="badge">{{ unread() }}</span>
            }
          </a>
          <a routerLink="/admin/backups" routerLinkActive="is-active"><app-icon name="upload" [size]="18" /> {{ 'admin.nav.backups' | t }}</a>
          <a routerLink="/admin/changelog" routerLinkActive="is-active"><app-icon name="sparkles" [size]="18" /> {{ 'admin.nav.changelog' | t }}</a>
        </nav>
        <div class="admin-user">
          <div class="row" style="gap: 0.6rem">
            @if (auth.me()?.picture; as pic) {
              <img [src]="pic" alt="" width="36" height="36" referrerpolicy="no-referrer" />
            }
            <div class="meta">
              <strong>{{ auth.me()?.name }}</strong>
              <div class="faint small">{{ auth.me()?.email }}</div>
            </div>
          </div>
          <div class="row" style="gap: 0.4rem">
            <a class="chip" href="/fr" target="_blank" rel="noopener"><app-icon name="external" [size]="12" /> {{ 'admin.nav.site' | t }}</a>
            <button type="button" class="chip" (click)="toggleLang()">{{ i18n.other() | uppercase }}</button>
            <button type="button" class="chip" (click)="theme.toggleMode()"><app-icon [name]="theme.isDark() ? 'sun' : 'moon'" [size]="12" /></button>
            <button type="button" class="chip" (click)="logout()"><app-icon name="logout" [size]="12" /> {{ 'admin.nav.logout' | t }}</button>
          </div>
          <div class="faint small mono meta">v{{ version.version }}{{ version.commit ? ' · ' + version.commit : '' }}</div>
        </div>
      </aside>
      <main class="admin-main" id="main">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly version = APP_VERSION;
  readonly unread = signal(0);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      try {
        const lang = localStorage.getItem('mb.adminLang');
        if (lang === 'fr' || lang === 'en') this.i18n.setLang(lang);
      } catch {
        /* ignore */
      }
      const refresh = (): void => {
        this.api.unreadCount().then((r) => this.unread.set(r.unread)).catch(() => undefined);
      };
      refresh();
      const timer = setInterval(refresh, 60_000);
      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  toggleLang(): void {
    const next = this.i18n.other();
    this.i18n.setLang(next);
    try {
      localStorage.setItem('mb.adminLang', next);
    } catch {
      /* ignore */
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/admin/login');
  }
}
