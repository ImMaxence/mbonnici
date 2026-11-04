import { Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../core/api/api.service';
import type { Settings } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeService } from '../../core/theme/theme.service';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { APP_VERSION } from '../../../environments/version';

interface NavLink {
  path: string;
  icon: string;
  key: string;
  exact?: boolean;
  badge?: () => number;
}

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, IconComponent, TooltipDirective, ConfirmDialogComponent],
  template: `
    <div class="admin" [class.nav-open]="navOpen()">
      <aside class="admin-aside">
        <div class="aside-top">
          <a class="admin-brand" routerLink="/admin">
            <span class="brand-mark">
              @if (settings()?.avatar; as a) {
                <img [src]="a.url" alt="" />
              } @else {
                {{ initial() }}
              }
            </span>
            <span class="brand-text">
              <strong>{{ settings()?.ownerName ?? 'Maxence Bonnici' }}</strong>
              <span>{{ 'admin.title' | t }}</span>
            </span>
          </a>
          <button type="button" class="icon-btn nav-toggle" (click)="navOpen.set(!navOpen())" [attr.aria-expanded]="navOpen()" [appTip]="'nav.menu' | t">
            <app-icon [name]="navOpen() ? 'close' : 'menu'" [size]="18" />
          </button>
        </div>

        <nav class="admin-nav" aria-label="Admin">
          @for (group of groups; track group.key) {
            <span class="nav-group">{{ 'admin.navGroups.' + group.key | t }}</span>
            @for (l of group.links; track l.path) {
              <a [routerLink]="l.path" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: !!l.exact }">
                <app-icon [name]="l.icon" [size]="17" />
                <span>{{ 'admin.nav.' + l.key | t }}</span>
                @if (l.badge && l.badge() > 0) {
                  <span class="badge">{{ l.badge() }}</span>
                }
              </a>
            }
          }
        </nav>

        <div class="admin-user">
          <div class="who">
            <span class="who-pic">
              @if (auth.me()?.picture; as pic) {
                <img [src]="pic" alt="" width="36" height="36" referrerpolicy="no-referrer" />
              } @else {
                {{ (auth.me()?.name || auth.me()?.email || 'A').charAt(0).toUpperCase() }}
              }
            </span>
            <span class="who-text">
              <strong>{{ displayName() }}</strong>
              @if (auth.me()?.email && displayName() !== auth.me()?.email) {
                <span>{{ auth.me()?.email }}</span>
              }
            </span>
          </div>
          <div class="user-actions">
            <a class="icon-btn" href="/fr" target="_blank" rel="noopener" [appTip]="'admin.nav.site' | t"><app-icon name="external" [size]="16" /></a>
            <button type="button" class="icon-btn" (click)="toggleLang()" [appTip]="i18n.lang() === 'fr' ? 'Switch to English' : 'Passer en français'">
              <span class="lang">{{ i18n.other().toUpperCase() }}</span>
            </button>
            <button type="button" class="icon-btn" (click)="theme.toggleMode($any($event.currentTarget))" [appTip]="(theme.isDark() ? 'dock.toLight' : 'dock.toDark') | t">
              <app-icon [name]="theme.isDark() ? 'sun' : 'moon'" [size]="16" />
            </button>
            <button type="button" class="icon-btn" (click)="logout()" [appTip]="'admin.nav.logout' | t"><app-icon name="logout" [size]="16" /></button>
          </div>
          <span class="version mono">v{{ version.version }}{{ version.commit ? ' · ' + version.commit : '' }}</span>
        </div>
      </aside>
      <main class="admin-main" id="main">
        <div class="admin-content">
          <router-outlet />
        </div>
      </main>
      <app-confirm-dialog />
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
  /** open entries of the error log */
  readonly openErrors = signal(0);
  readonly navOpen = signal(false);
  readonly settings = signal<Settings | null>(null);

  readonly initial = computed(() => (this.settings()?.ownerName ?? 'M').charAt(0).toUpperCase());
  /** the local sign-in has no display name: the e-mail is shown once, not twice */
  readonly displayName = computed(() => {
    const me = this.auth.me();
    return me?.name && me.name !== me.email ? me.name : (me?.email ?? '');
  });

  readonly groups: { key: string; links: NavLink[] }[] = [
    {
      key: 'overview',
      links: [{ path: '/admin', icon: 'chart', key: 'dashboard', exact: true }],
    },
    {
      key: 'content',
      links: [
        { path: '/admin/projects', icon: 'layers', key: 'projects' },
        { path: '/admin/notes', icon: 'file', key: 'notes' },
        { path: '/admin/media', icon: 'image', key: 'media' },
        { path: '/admin/profile', icon: 'user', key: 'profile' },
        { path: '/admin/messages', icon: 'inbox', key: 'messages', badge: () => this.unread() },
      ],
    },
    {
      key: 'site',
      links: [
        { path: '/admin/settings', icon: 'settings', key: 'settings' },
        { path: '/admin/backups', icon: 'upload', key: 'backups' },
        { path: '/admin/errors', icon: 'gauge', key: 'errors', badge: () => this.openErrors() },
        { path: '/admin/changelog', icon: 'sparkles', key: 'changelog' },
      ],
    },
  ];

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => this.navOpen.set(false));
    afterNextRender(() => {
      try {
        const lang = localStorage.getItem('mb.adminLang');
        if (lang === 'fr' || lang === 'en') this.i18n.setLang(lang);
      } catch {
        /* ignore */
      }
      this.api.adminSettings().then((s) => this.settings.set(s)).catch(() => undefined);
      const refresh = (): void => {
        this.api.unreadCount().then((r) => this.unread.set(r.unread)).catch(() => undefined);
        this.api.errorSummary().then((r) => this.openErrors.set(r.open)).catch(() => undefined);
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
