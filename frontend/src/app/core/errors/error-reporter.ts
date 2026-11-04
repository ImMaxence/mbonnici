import { isPlatformBrowser } from '@angular/common';
import { ErrorHandler, Injectable, PLATFORM_ID, inject } from '@angular/core';

/**
 * Sends the JavaScript errors of the site to the back office's error log (Journal), as an
 * anonymous beacon: the message, the stack and the page path, nothing about the visitor. At most
 * five reports per page load, the same error once; skipped with Do Not Track / Global Privacy
 * Control. The error still reaches the console as usual. Window errors and rejected promises come
 * through Angular's handler too (provideBrowserGlobalErrorListeners).
 */
@Injectable({ providedIn: 'root' })
export class ErrorReporter {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly sent = new Set<string>();
  private count = 0;

  report(error: unknown): void {
    if (!this.browser || this.count >= 5) return;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === '1' || nav.globalPrivacyControl || typeof navigator.sendBeacon !== 'function') return;
    const err = error instanceof Error ? error : null;
    const message = (err ? `${err.name}: ${err.message}` : String(error ?? 'Unknown error')).slice(0, 2000);
    if (!message.trim() || this.sent.has(message)) return;
    this.sent.add(message);
    this.count++;
    const body = JSON.stringify({ message, stack: err?.stack?.slice(0, 12_000) ?? null, path: location.pathname });
    try {
      navigator.sendBeacon('/api/analytics/errors', new Blob([body], { type: 'application/json' }));
    } catch {
      // reporting must never fail the page
    }
  }
}

/** Angular's error handler, plus a report to the back office. */
@Injectable()
export class ReportingErrorHandler extends ErrorHandler {
  private readonly reporter = inject(ErrorReporter);

  override handleError(error: unknown): void {
    super.handleError(error);
    this.reporter.report(error);
  }
}
