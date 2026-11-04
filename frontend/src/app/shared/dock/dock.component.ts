import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { PageKey } from '../../core/i18n/routes';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MotionService } from '../../core/motion/motion.service';
import { damp } from '../../core/motion/physics';
import { RafService } from '../../core/motion/raf.service';
import { STYLES, ThemeMode, ThemeService, VisualStyle } from '../../core/theme/theme.service';
import { TransitionService } from '../curtain/transition.service';
import { IconComponent } from '../ui/icon.component';

interface DockItem {
  key: PageKey;
  icon: string;
  path: string;
  label: string;
  active: boolean;
}

/**
 * Floating frosted-glass dock (macOS-style magnification on desktop, tab bar on phones).
 * Hosts navigation plus the appearance controls: language, light/dark, and the three visual styles.
 */
@Component({
  selector: 'app-dock',
  imports: [IconComponent, TranslatePipe, UpperCasePipe],
  template: `
    <nav class="wrap" [class.is-open]="open()" aria-label="Navigation">
      @if (open()) {
        <div class="backdrop" (click)="open.set(false)"></div>
        <div class="pop glass" role="dialog" [attr.aria-label]="'nav.settings' | t" #pop>
          <section>
            <h3 class="eyebrow">{{ 'dock.modeLabel' | t }}</h3>
            <div class="seg" role="radiogroup">
              @for (m of modes; track m.id) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="theme.mode() === m.id"
                  (click)="theme.setMode(m.id)"
                >
                  <app-icon [name]="m.icon" [size]="16" />
                  <span>{{ 'dock.' + m.id | t }}</span>
                </button>
              }
            </div>
          </section>
          <section>
            <h3 class="eyebrow">{{ 'dock.styleLabel' | t }}</h3>
            <p class="hint">{{ 'dock.styleHint' | t }}</p>
            <div class="styles" role="radiogroup">
              @for (s of styles; track s) {
                <button
                  type="button"
                  role="radio"
                  class="style-card"
                  [attr.data-style]="s"
                  [attr.aria-checked]="theme.style() === s"
                  (click)="theme.setStyle(s)"
                >
                  <span class="swatch" aria-hidden="true"><i></i><i></i><i></i></span>
                  <span class="name">{{ 'dock.styles.' + s + '.name' | t }}</span>
                  <span class="desc">{{ 'dock.styles.' + s + '.hint' | t }}</span>
                </button>
              }
            </div>
          </section>
          <section class="row between">
            <h3 class="eyebrow">{{ 'nav.language' | t }}</h3>
            <button type="button" class="chip chip-outline lang" (click)="switchLang()">
              <app-icon name="globe" [size]="14" />
              {{ i18n.other() === 'fr' ? 'Français' : 'English' }}
            </button>
          </section>
        </div>
      }

      <div class="dock glass" #dock (pointermove)="onMove($event)" (pointerleave)="onLeave()">
        @for (item of items(); track item.key; let i = $index) {
          <a
            class="item"
            [href]="item.path"
            [class.is-active]="item.active"
            [attr.aria-label]="item.label"
            [attr.aria-current]="item.active ? 'page' : null"
            (click)="go($event, item)"
            #itemEl
          >
            <app-icon [name]="item.icon" [size]="22" />
            <span class="tip">{{ item.label }}</span>
            <span class="indicator"></span>
          </a>
        }
        <span class="sep" aria-hidden="true"></span>
        <button
          type="button"
          class="item hide-mobile"
          (click)="switchLang()"
          [attr.aria-label]="(i18n.other() | uppercase) + ' · ' + ('nav.switchLanguage' | t)"
          #itemEl
        >
          <span class="lang-mark">{{ i18n.other() | uppercase }}</span>
          <span class="tip">{{ i18n.other() | uppercase }} · {{ 'nav.switchLanguage' | t }}</span>
        </button>
        <button type="button" class="item hide-mobile" (click)="theme.toggleMode()" [attr.aria-label]="'nav.theme' | t" #itemEl>
          <app-icon [name]="theme.isDark() ? 'sun' : 'moon'" [size]="22" />
          <span class="tip">{{ (theme.isDark() ? 'dock.light' : 'dock.dark') | t }}</span>
        </button>
        <button
          type="button"
          class="item"
          (click)="open.set(!open())"
          [attr.aria-label]="'nav.style' | t"
          [attr.aria-expanded]="open()"
          #itemEl
        >
          <app-icon name="palette" [size]="22" />
          <span class="tip">{{ 'nav.style' | t }}</span>
        </button>
        @if (auth.isAdmin()) {
          <a class="item" href="/admin" [attr.aria-label]="'nav.admin' | t" #itemEl>
            <app-icon name="settings" [size]="22" />
            <span class="tip">{{ 'nav.admin' | t }}</span>
          </a>
        }
      </div>
    </nav>
  `,
  styles: `
    .wrap {
      position: fixed;
      left: 0;
      right: 0;
      bottom: max(14px, env(safe-area-inset-bottom));
      z-index: 120;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }
    .dock {
      pointer-events: auto;
      display: flex;
      align-items: flex-end;
      gap: 6px;
      padding: 10px 12px;
      border-radius: 26px;
      height: var(--dock-h);
      box-shadow:
        inset 0 1px 0 var(--glass-highlight),
        var(--shadow-2);
      animation: rise 0.9s var(--ease-out) both;
      animation-delay: 0.2s;
    }
    .item {
      position: relative;
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 16px;
      color: var(--fg-2);
      transform-origin: 50% 100%;
      transition:
        color 0.2s,
        background-color 0.2s;
      will-change: transform;
      text-decoration: none;
    }
    .item:hover,
    .item:focus-visible,
    .item.is-active {
      color: var(--fg);
    }
    .item:hover {
      background: color-mix(in srgb, var(--fg) 8%, transparent);
    }
    .indicator {
      position: absolute;
      bottom: -6px;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--accent);
      opacity: 0;
      transform: scale(0);
      transition:
        opacity 0.3s,
        transform 0.4s var(--ease-spring);
    }
    .item.is-active .indicator {
      opacity: 1;
      transform: scale(1);
    }
    .tip {
      position: absolute;
      bottom: calc(100% + 14px);
      left: 50%;
      transform: translate(-50%, 6px);
      padding: 0.45em 0.75em;
      border-radius: 8px;
      background: var(--fg);
      color: var(--bg);
      font-size: var(--fs-micro);
      font-weight: 600;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition:
        opacity 0.15s,
        transform 0.3s var(--ease-out);
    }
    .item:hover .tip,
    .item:focus-visible .tip {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    .lang-mark {
      font: 700 12px/1 var(--font-mono);
      letter-spacing: 0.1em;
    }
    .sep {
      width: 1px;
      height: 28px;
      margin: 0 4px 10px;
      background: var(--line-strong);
    }

    /* settings popover */
    .backdrop {
      position: fixed;
      inset: 0;
      pointer-events: auto;
    }
    .pop {
      pointer-events: auto;
      position: absolute;
      bottom: calc(var(--dock-h) + 14px);
      width: min(92vw, 440px);
      padding: 20px;
      border-radius: 24px;
      display: grid;
      gap: 18px;
      animation: rise 0.5s var(--ease-out) both;
    }
    .pop section {
      display: grid;
      gap: 10px;
    }
    .pop .hint {
      font-size: var(--fs-small);
      color: var(--fg-3);
      margin-top: -4px;
    }
    .seg {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      padding: 4px;
      gap: 2px;
      border-radius: 14px;
      background: color-mix(in srgb, var(--fg) 6%, transparent);
    }
    .seg button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 9px 6px;
      border-radius: 11px;
      font-size: var(--fs-small);
      font-weight: 600;
      color: var(--fg-2);
      transition:
        background-color 0.2s,
        color 0.2s;
    }
    .seg button[aria-checked='true'] {
      background: var(--fg);
      color: var(--bg);
    }
    .styles {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .style-card {
      display: grid;
      gap: 6px;
      padding: 10px;
      border-radius: 14px;
      border: 1.5px solid var(--line);
      text-align: left;
      transition:
        border-color 0.2s,
        background-color 0.2s;
    }
    .style-card:hover {
      border-color: var(--line-strong);
    }
    .style-card[aria-checked='true'] {
      border-color: var(--accent);
      background: var(--accent-soft);
    }
    .swatch {
      display: flex;
      gap: 3px;
      height: 22px;
    }
    .swatch i {
      flex: 1;
      border-radius: 5px;
    }
    .style-card[data-style='obsidian'] .swatch i:nth-child(1) { background: #0a0a0c; }
    .style-card[data-style='obsidian'] .swatch i:nth-child(2) { background: #5b9dff; }
    .style-card[data-style='obsidian'] .swatch i:nth-child(3) { background: #f5f5f7; }
    .style-card[data-style='editorial'] .swatch i:nth-child(1) { background: #141311; }
    .style-card[data-style='editorial'] .swatch i:nth-child(2) { background: #ff4d1c; }
    .style-card[data-style='editorial'] .swatch i:nth-child(3) { background: #f3efe6; }
    .style-card[data-style='aurora'] .swatch i:nth-child(1) { background: #06061a; }
    .style-card[data-style='aurora'] .swatch i:nth-child(2) { background: linear-gradient(135deg, #22d3ee, #f472b6); }
    .style-card[data-style='aurora'] .swatch i:nth-child(3) { background: #eef0ff; }
    .style-card .name {
      font-weight: 700;
      font-size: var(--fs-small);
    }
    .style-card .desc {
      font-size: var(--fs-micro);
      color: var(--fg-3);
      line-height: 1.3;
    }
    .lang {
      cursor: pointer;
    }

    @media (max-width: 719px) {
      .wrap {
        bottom: 0;
        padding: 0 10px calc(10px + env(safe-area-inset-bottom));
      }
      .dock {
        width: 100%;
        justify-content: space-around;
        height: 64px;
        padding: 8px;
        border-radius: 22px;
        gap: 0;
      }
      .item {
        width: 46px;
        height: 46px;
      }
      .sep,
      .tip {
        display: none;
      }
      .pop {
        bottom: calc(64px + 20px + env(safe-area-inset-bottom));
      }
      .styles {
        grid-template-columns: 1fr;
      }
      .style-card {
        grid-template-columns: 56px 1fr;
        align-items: center;
      }
      .style-card .desc {
        grid-column: 2;
      }
    }
  `,
})
export class DockComponent {
  readonly i18n = inject(I18nService);
  readonly theme = inject(ThemeService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly transition = inject(TransitionService);
  private readonly raf = inject(RafService);
  private readonly motion = inject(MotionService);
  private readonly dockEl = viewChild.required<ElementRef<HTMLElement>>('dock');

  readonly open = signal(false);
  readonly styles = STYLES;
  readonly modes: { id: ThemeMode; icon: string }[] = [
    { id: 'light', icon: 'sun' },
    { id: 'dark', icon: 'moon' },
    { id: 'system', icon: 'monitor' },
  ];

  private readonly url = signal(this.router.url);
  readonly items = computed<DockItem[]>(() => {
    const lang = this.i18n.lang();
    const url = this.url();
    const dict = this.i18n.dict();
    const nav: { key: PageKey; icon: string; label: string }[] = [
      { key: 'home', icon: 'home', label: dict.nav.home },
      { key: 'projects', icon: 'grid', label: dict.nav.projects },
      { key: 'about', icon: 'user', label: dict.nav.about },
      { key: 'contact', icon: 'mail', label: dict.nav.contact },
    ];
    return nav.map((n) => {
      const path = this.i18n.path(n.key);
      const active = n.key === 'home' ? url === path || url === `/${lang}/` : url.startsWith(path);
      return { ...n, path, active };
    });
  });

  // magnification state
  private scales: number[] = [];
  private targets: number[] = [];
  private loop: (() => void) | null = null;
  private hovering = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((e) => {
        this.url.set(e.urlAfterRedirects.split('?')[0]);
        this.open.set(false);
      });

    afterNextRender(() => {
      const onKey = (e: KeyboardEvent): void => {
        if (e.key === 'Escape' && this.open()) this.open.set(false);
      };
      document.addEventListener('keydown', onKey);
      destroyRef.onDestroy(() => {
        document.removeEventListener('keydown', onKey);
        this.loop?.();
      });
    });
  }

  go(event: MouseEvent, item: DockItem): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (item.active) {
      window.scrollTo({ top: 0, behavior: this.motion.reduced() ? 'auto' : 'smooth' });
      return;
    }
    void this.transition.navigate(item.path, item.label);
  }

  switchLang(): void {
    const target = this.i18n.alternatePath(this.router.url, this.i18n.other());
    void this.transition.navigate(target, this.i18n.other() === 'fr' ? 'Français' : 'English');
  }

  onMove(e: PointerEvent): void {
    if (!this.motion.finePointer() || this.motion.reduced() || this.motion.mobile()) return;
    this.hovering = true;
    const nodes = this.itemNodes();
    if (this.scales.length !== nodes.length) {
      this.scales = nodes.map(() => 1);
      this.targets = nodes.map(() => 1);
    }
    nodes.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(e.clientX - (r.left + r.width / 2));
      this.targets[i] = 1 + 0.5 * Math.exp(-(d * d) / (2 * 70 * 70));
    });
    this.ensureLoop();
  }

  onLeave(): void {
    this.hovering = false;
    this.targets = this.targets.map(() => 1);
    this.ensureLoop();
  }

  private itemNodes(): HTMLElement[] {
    return Array.from(this.dockEl().nativeElement.querySelectorAll<HTMLElement>('.item'));
  }

  private ensureLoop(): void {
    if (this.loop) return;
    this.loop = this.raf.add((dt) => {
      const nodes = this.itemNodes();
      let settled = true;
      nodes.forEach((el, i) => {
        const target = this.targets[i] ?? 1;
        const s = damp(this.scales[i] ?? 1, target, 18, dt);
        this.scales[i] = s;
        if (Math.abs(s - target) > 0.002) settled = false;
        const lift = (s - 1) * 18;
        el.style.transform = `translate3d(0, ${-lift.toFixed(2)}px, 0) scale(${s.toFixed(3)})`;
        el.style.marginInline = `${((s - 1) * 14).toFixed(2)}px`;
      });
      if (settled && !this.hovering) {
        nodes.forEach((el) => {
          el.style.transform = '';
          el.style.marginInline = '';
        });
        this.loop?.();
        this.loop = null;
      }
    });
  }
}
