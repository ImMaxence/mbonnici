import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import type { Insight } from './models';

/**
 * Live facts about the projects (site up, response time, GitHub stars / last push), fetched in the
 * browser once the page is shown and refreshed every few minutes. Never part of the server render:
 * a slow or failing call only means no badge.
 */
@Injectable({ providedIn: 'root' })
export class InsightsStore {
  private readonly api = inject(ApiService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly bySlug = signal<Record<string, Insight>>({});
  private loadedAt = 0;
  private pending: Promise<void> | null = null;

  /** Loads (or refreshes after 5 minutes); safe to call from every page. */
  ensure(): void {
    if (!this.browser || this.pending || Date.now() - this.loadedAt < 5 * 60_000) return;
    this.pending = this.api
      .insights()
      .then((map) => {
        this.bySlug.set(map ?? {});
        this.loadedAt = Date.now();
      })
      .catch(() => undefined)
      .finally(() => (this.pending = null));
  }

  of(slug: string): Insight | null {
    return this.bySlug()[slug] ?? null;
  }
}
