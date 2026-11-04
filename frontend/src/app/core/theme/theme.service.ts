import { DOCUMENT, Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeMode = 'light' | 'dark' | 'system';

const MODE_KEY = 'mb.mode';
/** theme-color for the browser chrome */
const THEME_COLORS = { light: '#efede7', dark: '#0d0d0c' } as const;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void>; finished: Promise<void> };
};

/**
 * Colour scheme (light / dark / system). The inline script in index.html applies the stored choice
 * before first paint; this service keeps <html data-theme> and localStorage in sync afterwards and
 * animates the switch: a circle of the new scheme grows from the button that was pressed.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);

  readonly mode = signal<ThemeMode>('system');
  private readonly systemDark = signal(false);

  readonly resolved = computed<'light' | 'dark'>(() => {
    const m = this.mode();
    if (m === 'system') return this.systemDark() ? 'dark' : 'light';
    return m;
  });

  readonly isDark = computed(() => this.resolved() === 'dark');

  constructor() {
    if (this.browser) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemDark.set(mq.matches);
      mq.addEventListener('change', (e) => this.animate(() => this.systemDark.set(e.matches)));
      this.mode.set(this.read());
    }
    effect(() => this.apply(this.resolved()));
  }

  /** @param origin the element (or point) the reveal starts from */
  setMode(mode: ThemeMode, origin?: Element | { x: number; y: number } | null): void {
    this.animate(() => {
      this.mode.set(mode);
      this.write(mode);
    }, origin);
  }

  toggleMode(origin?: Element | { x: number; y: number } | null): void {
    this.setMode(this.resolved() === 'dark' ? 'light' : 'dark', origin);
  }

  private apply(theme: 'light' | 'dark'): void {
    const root = this.document.documentElement;
    if (root.getAttribute('data-theme') !== theme) root.setAttribute('data-theme', theme);
    this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  }

  private animate(update: () => void, origin?: Element | { x: number; y: number } | null): void {
    if (!this.browser) {
      update();
      return;
    }
    const before = this.resolved();
    const run = (): void => {
      update();
      // apply synchronously: the view transition snapshots the DOM right after this callback
      this.apply(this.resolved());
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const doc = this.document as ViewTransitionDocument;
    if (reduced) {
      run();
      return;
    }
    if (!doc.startViewTransition) {
      // older browsers: a soft cross-fade of every colour
      const root = this.document.documentElement;
      root.classList.add('theming');
      run();
      setTimeout(() => root.classList.remove('theming'), 650);
      return;
    }
    let x = window.innerWidth - 60;
    let y = 40;
    if (origin instanceof Element) {
      const r = origin.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    } else if (origin) {
      ({ x, y } = origin);
    }
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = doc.startViewTransition(run);
    transition.ready
      .then(() => {
        if (this.resolved() === before) return;
        this.document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 760, easing: 'cubic-bezier(0.76, 0, 0.24, 1)', pseudoElement: '::view-transition-new(root)' },
        );
      })
      .catch(() => undefined);
  }

  private read(): ThemeMode {
    try {
      const v = localStorage.getItem(MODE_KEY);
      return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
    } catch {
      return 'system';
    }
  }

  private write(value: string): void {
    try {
      localStorage.setItem(MODE_KEY, value);
    } catch {
      /* private mode: preference lives for the session only */
    }
  }
}
