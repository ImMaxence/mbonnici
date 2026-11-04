import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

type Metric = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface EventTiming extends PerformanceEntry {
  interactionId?: number;
}

/**
 * Core Web Vitals of the landing page, measured in the visitor's browser (real-user monitoring)
 * with the standard Performance APIs — no library. Sent once, when the page is hidden, as an
 * anonymous beacon: metric values, the path and the viewport width; nothing identifies the visitor.
 * Skipped with Do Not Track / Global Privacy Control, like the audience events.
 *
 * In a single-page app only the first (hard) navigation has a real LCP / FCP / TTFB; layout shifts
 * and interactions are counted over the whole visit and reported for that first page.
 */
@Injectable({ providedIn: 'root' })
export class VitalsService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly values = new Map<Metric, number>();
  private started = false;
  private sent = false;

  start(path: string): void {
    if (!this.browser || this.started || typeof PerformanceObserver === 'undefined') return;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === '1' || nav.globalPrivacyControl) return;
    this.started = true;

    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (navEntry && navEntry.responseStart > 0) this.values.set('TTFB', navEntry.responseStart);

    this.observe('paint', (e) => {
      if (e.name === 'first-contentful-paint') this.values.set('FCP', e.startTime);
    });
    this.observe('largest-contentful-paint', (e) => this.values.set('LCP', e.startTime));

    // CLS: the largest burst of unexpected shifts (session windows: gaps < 1 s, at most 5 s)
    let session = 0;
    let first = 0;
    let last = 0;
    let cls = 0;
    this.observe('layout-shift', (raw) => {
      const e = raw as LayoutShift;
      if (e.hadRecentInput) return;
      if (session && e.startTime - last < 1000 && e.startTime - first < 5000) {
        session += e.value;
      } else {
        session = e.value;
        first = e.startTime;
      }
      last = e.startTime;
      cls = Math.max(cls, session);
      this.values.set('CLS', Math.round(cls * 10_000) / 10_000);
    });

    // INP: the slowest interaction (≈ p98 once there are many)
    const interactions = new Map<number, number>();
    this.observe(
      'event',
      (raw) => {
        const e = raw as EventTiming;
        if (!e.interactionId) return;
        interactions.set(e.interactionId, Math.max(interactions.get(e.interactionId) ?? 0, e.duration));
        const sorted = [...interactions.values()].sort((a, b) => b - a);
        this.values.set('INP', sorted[Math.min(sorted.length - 1, Math.floor(sorted.length / 50))]);
      },
      { durationThreshold: 40 },
    );

    const flush = () => this.send(path);
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    addEventListener('pagehide', flush);
  }

  private observe(type: string, cb: (e: PerformanceEntry) => void, extra: Record<string, unknown> = {}): void {
    try {
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return;
      new PerformanceObserver((list) => list.getEntries().forEach(cb)).observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
    } catch {
      // older browser: that metric is simply missing
    }
  }

  private send(path: string): void {
    if (this.sent || !this.values.size || typeof navigator.sendBeacon !== 'function') return;
    this.sent = true;
    const metrics = [...this.values.entries()].map(([name, value]) => ({ name, value: Math.round(value * 1000) / 1000 }));
    const body = JSON.stringify({ path, viewportWidth: innerWidth, metrics });
    navigator.sendBeacon('/api/analytics/vitals', new Blob([body], { type: 'application/json' }));
  }
}
