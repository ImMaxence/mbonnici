import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from '../api/api.service';
import type { Me } from '../api/models';

const ANONYMOUS: Me = { authenticated: false, email: null, name: null, picture: null };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly me = signal<Me | null>(null);
  readonly isAdmin = computed(() => this.me()?.authenticated === true);
  readonly loginUrl = '/api/auth/oauth2/authorization/google';

  private pending: Promise<Me> | null = null;

  /** Resolves the current session once and caches it; call refresh() after login/logout. */
  load(): Promise<Me> {
    if (!this.browser) {
      return Promise.resolve(ANONYMOUS);
    }
    const cached = this.me();
    if (cached) {
      return Promise.resolve(cached);
    }
    if (!this.pending) {
      this.pending = this.api
        .me()
        .catch(() => ANONYMOUS)
        .then((me) => {
          this.me.set(me);
          this.pending = null;
          return me;
        });
    }
    return this.pending;
  }

  refresh(): Promise<Me> {
    this.me.set(null);
    return this.load();
  }

  async logout(): Promise<void> {
    try {
      await this.api.logout();
    } finally {
      this.me.set(ANONYMOUS);
    }
  }
}

/** Protects /admin/** : unauthenticated visitors are sent to the login screen. */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const platform = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platform)) {
    // admin is client-rendered only; never decide on the server
    return true;
  }
  const me = await auth.load();
  return me.authenticated ? true : router.createUrlTree(['/admin/login']);
};
