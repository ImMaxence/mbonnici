import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeService } from '../../core/theme/theme.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';

@Component({
  selector: 'app-admin-login',
  imports: [TranslatePipe, IconComponent, TooltipDirective],
  template: `
    <main class="login" id="main">
      <section class="side" aria-hidden="true">
        <span class="eyebrow plain">mbonnici.fr · {{ 'admin.title' | t }}</span>
        <p class="big">Maxence<br />Bonnici</p>
        <ul>
          <li>{{ 'admin.nav.projects' | t }}</li>
          <li>{{ 'admin.nav.media' | t }}</li>
          <li>{{ 'admin.nav.profile' | t }}</li>
          <li>{{ 'admin.nav.messages' | t }}</li>
          <li>{{ 'admin.nav.backups' | t }}</li>
        </ul>
      </section>

      <section class="form">
        <div class="top">
          <a class="back" href="/fr"><app-icon name="chevron-left" [size]="14" /> {{ 'admin.login.backToSite' | t }}</a>
          <button type="button" class="icon-btn" (click)="theme.toggleMode($any($event.currentTarget))" [appTip]="(theme.isDark() ? 'dock.toLight' : 'dock.toDark') | t">
            <app-icon [name]="theme.isDark() ? 'sun' : 'moon'" [size]="16" />
          </button>
        </div>

        <div class="login-card">
          <span class="lock" aria-hidden="true"><app-icon name="settings" [size]="22" /></span>
          <h1>{{ 'admin.login.title' | t }}</h1>
          <p class="muted">{{ 'admin.login.text' | t }}</p>

          @if (error()) {
            <p class="alert" role="alert"><app-icon name="close" [size]="14" /> {{ 'admin.login.notAllowed' | t }}</p>
          }

          <div class="actions">
            @if (providers()?.google !== false) {
              <a class="sso" [href]="auth.loginUrl">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
                  <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
                  <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
                  <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9z" />
                </svg>
                {{ 'admin.login.button' | t }}
              </a>
            } @else {
              <p class="note"><app-icon name="sparkles" [size]="14" /> {{ 'admin.login.googleMissing' | t }}</p>
            }
            @if (providers()?.devLogin) {
              <div class="divider"><span>{{ 'admin.login.or' | t }}</span></div>
              <a class="btn btn-ghost dev" href="/api/auth/dev-login"><app-icon name="code" [size]="16" /> {{ 'admin.login.devLogin' | t }}</a>
              <p class="small faint">{{ 'admin.login.devLoginHint' | t }}</p>
            }
          </div>
        </div>

        <p class="foot small faint">{{ 'admin.login.footer' | t }}</p>
      </section>
    </main>
  `,
  styles: `
    .login {
      min-height: 100dvh;
      display: grid;
      background: var(--bg);
    }
    @media (min-width: 960px) {
      .login {
        grid-template-columns: minmax(0, 1.1fr) minmax(420px, 0.9fr);
      }
    }
    .side {
      display: none;
      position: relative;
      overflow: hidden;
      padding: clamp(2rem, 4vw, 3.5rem);
      background: #121211;
      color: #eceae3;
    }
    @media (min-width: 960px) {
      .side {
        display: grid;
        grid-template-rows: auto 1fr auto;
        align-items: end;
      }
    }
    .side .eyebrow {
      color: rgba(236, 234, 227, 0.6);
    }
    .big {
      font-family: var(--font-display);
      font-weight: var(--weight-display);
      font-size: clamp(4rem, 9vw, 9.5rem);
      line-height: 0.86;
      letter-spacing: -0.055em;
      padding-bottom: 2rem;
    }
    .side ul {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(236, 234, 227, 0.16);
    }
    .side li {
      padding: 0.45em 0.9em;
      border-radius: 999px;
      border: 1px solid rgba(236, 234, 227, 0.22);
      font-size: var(--fs-small);
      color: rgba(236, 234, 227, 0.8);
    }
    .form {
      display: grid;
      grid-template-rows: auto 1fr auto;
      padding: clamp(1.25rem, 3vw, 2.5rem);
      gap: 2rem;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: var(--fs-small);
      color: var(--fg-2);
    }
    .back:hover {
      color: var(--fg);
    }
    .login-card {
      align-self: center;
      justify-self: center;
      width: min(100%, 440px);
      display: grid;
      gap: 0.9rem;
      padding: clamp(1.5rem, 3vw, 2.25rem);
      border-radius: 22px;
      background: var(--bg-2);
      border: 1px solid var(--line);
      box-shadow: var(--shadow-2);
    }
    .lock {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      border-radius: 16px;
      background: var(--fg);
      color: var(--bg);
      margin-bottom: 0.5rem;
    }
    h1 {
      font-size: clamp(1.7rem, 2.4vw, 2.1rem);
      line-height: 1.05;
      letter-spacing: -0.04em;
    }
    .alert {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      background: color-mix(in srgb, var(--danger) 12%, transparent);
      color: var(--danger);
      font-size: var(--fs-small);
      font-weight: 600;
    }
    .actions {
      display: grid;
      gap: 0.75rem;
      margin-top: 0.75rem;
    }
    .sso {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      min-height: 50px;
      padding: 0 1.25rem;
      border-radius: 14px;
      background: var(--bg-2);
      border: 1px solid var(--line-strong);
      font-weight: 600;
      transition:
        border-color var(--dur-1),
        box-shadow var(--dur-2);
    }
    .sso:hover {
      border-color: var(--fg);
      box-shadow: var(--shadow-1);
    }
    .note {
      display: flex;
      gap: 0.6rem;
      padding: 0.9rem 1rem;
      border-radius: 12px;
      background: var(--bg-3);
      color: var(--fg-2);
      font-size: var(--fs-small);
      line-height: 1.45;
    }
    .divider {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: var(--fg-3);
      font-size: var(--fs-micro);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--line);
    }
    .dev {
      min-height: 50px;
      border-radius: 14px;
    }
    .foot {
      text-align: center;
    }
  `,
})
export class LoginPage {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly query = toSignal(this.route.queryParamMap);
  readonly error = computed(() => !!this.query()?.get('error'));
  readonly providers = signal<{ google: boolean; devLogin: boolean } | null>(null);

  constructor() {
    afterNextRender(() => {
      firstValueFrom(this.http.get<{ google: boolean; devLogin: boolean }>('/api/auth/providers'))
        .then((p) => this.providers.set(p))
        .catch(() => undefined);
      this.auth.refresh().then((me) => {
        if (me.authenticated) this.router.navigateByUrl('/admin');
      });
    });
  }
}
