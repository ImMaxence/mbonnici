import { DOCUMENT, Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeMode = 'light' | 'dark' | 'system';
export type VisualStyle = 'obsidian' | 'editorial' | 'aurora';

export const STYLES: readonly VisualStyle[] = ['obsidian', 'editorial', 'aurora'] as const;
const MODE_KEY = 'mb.mode';
const STYLE_KEY = 'mb.style';

/** theme-color for the browser chrome, per style and scheme */
const THEME_COLORS: Record<VisualStyle, { dark: string; light: string }> = {
  obsidian: { dark: '#0a0a0c', light: '#f5f5f7' },
  editorial: { dark: '#141311', light: '#f3efe6' },
  aurora: { dark: '#06061a', light: '#f3f5ff' },
};

/**
 * Colour scheme (light / dark / system) and visual style (three complete looks).
 * The inline script in index.html applies the stored choice before first paint; this service
 * keeps <html data-theme data-style> and localStorage in sync afterwards.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);

  readonly mode = signal<ThemeMode>('system');
  readonly style = signal<VisualStyle>('obsidian');
  private readonly systemDark = signal(true);

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
      mq.addEventListener('change', (e) => this.systemDark.set(e.matches));
      this.mode.set(this.read(MODE_KEY, ['light', 'dark', 'system'], 'system'));
      this.style.set(this.read(STYLE_KEY, STYLES, 'obsidian'));
    }

    effect(() => {
      const theme = this.resolved();
      const style = this.style();
      const root = this.document.documentElement;
      root.setAttribute('data-theme', theme);
      root.setAttribute('data-style', style);
      const meta = this.document.querySelector('meta[name="theme-color"]');
      meta?.setAttribute('content', THEME_COLORS[style][theme]);
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    this.write(MODE_KEY, mode);
  }

  toggleMode(): void {
    this.setMode(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  setStyle(style: VisualStyle): void {
    this.style.set(style);
    this.write(STYLE_KEY, style);
  }

  private read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return allowed.includes(v as T) ? (v as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode: preference lives for the session only */
    }
  }
}
