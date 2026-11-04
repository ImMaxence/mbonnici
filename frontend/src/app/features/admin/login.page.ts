import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-admin-login',
  imports: [TranslatePipe, IconComponent],
  template: `
    <main class="admin-login" id="main">
      <div class="panel">
        <span class="admin-brand" style="justify-content:center"><span class="mark"></span> {{ 'meta.siteName' | t }}</span>
        <div>
          <h1 class="h3">{{ 'admin.login.title' | t }}</h1>
          <p class="muted small" style="margin-top:.5rem">{{ 'admin.login.text' | t }}</p>
        </div>
        @if (error()) {
          <p class="field-error" role="alert">{{ 'admin.login.notAllowed' | t }}</p>
        }
        @if (providers()?.google !== false) {
          <a class="btn-google" [href]="auth.loginUrl">
            <app-icon name="google" [size]="18" /> {{ 'admin.login.button' | t }}
          </a>
        } @else {
          <p class="small faint">{{ 'admin.login.googleMissing' | t }}</p>
        }
        @if (providers()?.devLogin) {
          <a class="btn btn-ghost" href="/api/auth/dev-login"><app-icon name="code" [size]="16" /> {{ 'admin.login.devLogin' | t }}</a>
          <p class="small faint">{{ 'admin.login.devLoginHint' | t }}</p>
        }
        <a class="link small" href="/fr">{{ 'admin.login.backToSite' | t }}</a>
      </div>
    </main>
  `,
})
export class LoginPage {
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly query = toSignal(this.route.queryParamMap);
  readonly error = computed(() => !!this.query()?.get('error'));
  readonly providers = signal<{ google: boolean; devLogin: boolean } | null>(null);
  private readonly http = inject(HttpClient);

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
