import { DOCUMENT, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { AnalyticsEvent, AnalyticsEventType } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { I18nService } from '../i18n/i18n.service';
import { ThemeService } from '../theme/theme.service';

/**
 * First-party, cookieless usage tracking. Events are batched and sent with keepalive so the
 * last page view survives tab closing. Honours DNT / GPC and never records the admin's own visits.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);

  private queue: AnalyticsEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private enabled = false;
  private lastPath = '';
  private lastAt = 0;
  private initialReferrer = '';

  init(): void {
    if (!this.browser) return;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === '1' || nav.globalPrivacyControl) {
      return;
    }
    this.enabled = true;
    this.initialReferrer = this.document.referrer;
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'hidden') this.flush();
    });
    window.addEventListener('pagehide', () => this.flush());
    // the owner's own browsing should not inflate the numbers
    this.auth.load().then((me) => {
      if (me.authenticated) {
        this.enabled = false;
        this.queue = [];
      }
    });
  }

  pageView(path: string): void {
    const now = Date.now();
    if (path === this.lastPath && now - this.lastAt < 1500) return;
    this.lastPath = path;
    this.lastAt = now;
    this.track('PAGE_VIEW', path);
  }

  projectView(slug: string, path: string): void {
    this.track('PROJECT_VIEW', path, slug);
  }

  outbound(slug: string | undefined, path: string): void {
    this.track('OUTBOUND_CLICK', path, slug);
    this.flush();
  }

  contactSubmitted(path: string): void {
    this.track('CONTACT_SUBMIT', path);
    this.flush();
  }

  private track(type: AnalyticsEventType, path: string, projectSlug?: string): void {
    if (!this.enabled || path.startsWith('/admin')) return;
    this.queue.push({
      type,
      path: path.slice(0, 300),
      projectSlug,
      locale: this.i18n.lang(),
      theme: this.theme.resolved(),
      referrer: this.initialReferrer || undefined,
      viewportWidth: window.innerWidth,
    });
    this.initialReferrer = '';
    if (this.queue.length >= 10) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), 6000);
    }
  }

  private flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.enabled || this.queue.length === 0) return;
    const events = this.queue.splice(0, 20);
    try {
      fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
        keepalive: true,
        credentials: 'omit',
      }).catch(() => undefined);
    } catch {
      /* offline, ignore */
    }
  }
}
