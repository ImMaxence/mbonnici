import { Component, DestroyRef, ElementRef, PLATFORM_ID, computed, inject, signal, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SiteStore } from '../../core/api/site.store';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { PageKey } from '../../core/i18n/routes';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ScrollService } from '../../core/motion/scroll.service';
import { ThemeMode, ThemeService } from '../../core/theme/theme.service';
import { TransitionService } from '../curtain/transition.service';
import { IconComponent } from '../ui/icon.component';

interface NavItem {
  key: PageKey;
  n: string;
  label: string;
  path: string;
  active: boolean;
}

/**
 * Top bar: wordmark, text navigation, language and light / dark switches. It slides away while
 * reading down and comes back on the slightest scroll up. Below 900 px the links move into a
 * full-screen menu (a modal <dialog>: focus trap, Escape and inert page for free).
 */
@Component({
  selector: 'app-header',
  imports: [IconComponent, TranslatePipe],
  template: `
    <header class="bar" [class.is-scrolled]="scroll.scrolled()" [class.is-hidden]="scroll.headerHidden() && !open()">
      <div class="inner">
        <a class="brand" [href]="i18n.path('home')" (click)="go($event, home())">
          <span class="mark" aria-hidden="true">
            @if (avatar(); as a) {
              <img [src]="a.url" alt="" width="34" height="34" />
            } @else {
              {{ (store.settings()?.ownerName ?? 'M').charAt(0) }}
            }
          </span>
          <span class="name">{{ store.settings()?.ownerName ?? 'Maxence Bonnici' }}</span>
        </a>

        <nav class="links" [attr.aria-label]="'nav.menu' | t">
          @for (item of items(); track $index) {
            <a [href]="item.path" [class.is-active]="item.active" [attr.aria-current]="item.active ? 'page' : null" (click)="go($event, item)">
              <span class="n" aria-hidden="true">{{ item.n }}</span>{{ item.label }}
            </a>
          }
        </nav>

        <div class="tools">
          <button type="button" class="lang" (click)="switchLang()">
            <span [class.on]="i18n.lang() === 'fr'">FR</span><i>/</i><span [class.on]="i18n.lang() === 'en'">EN</span>
            <span class="visually-hidden"> · {{ 'nav.switchLanguage' | t }}</span>
          </button>
          <div class="theme" role="radiogroup" [attr.aria-label]="'dock.modeLabel' | t">
            @for (m of modes; track m.id) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="theme.mode() === m.id"
                [attr.aria-label]="'dock.' + m.id | t"
                [attr.title]="'dock.' + m.id | t"
                (click)="setMode(m.id, $event)"
              >
                @if (m.id === 'system') {
                  <span class="auto" aria-hidden="true">A</span>
                } @else {
                  <app-icon [name]="m.icon" [size]="15" />
                }
              </button>
            }
          </div>
          @if (auth.isAdmin()) {
            <a class="round" href="/admin" [attr.aria-label]="'nav.admin' | t" [attr.title]="'nav.admin' | t"><app-icon name="settings" [size]="18" /></a>
          }
          <button type="button" class="menu-btn" (click)="openMenu()" aria-haspopup="dialog" [attr.aria-expanded]="open()">
            <span>{{ 'nav.menu' | t }}</span>
            <i aria-hidden="true"><b></b><b></b></i>
          </button>
        </div>
      </div>
    </header>

    <dialog class="menu" #menu [class.is-closing]="closing()" (cancel)="$event.preventDefault(); closeMenu()" (click)="onBackdrop($event)" [attr.aria-label]="'nav.menu' | t">
      <div class="menu-inner">
        <div class="menu-top">
          <span class="eyebrow">{{ 'nav.menu' | t }}</span>
          <button type="button" class="menu-btn is-open" (click)="closeMenu()">
            <span>{{ 'nav.close' | t }}</span>
            <i aria-hidden="true"><b></b><b></b></i>
          </button>
        </div>
        <nav class="menu-links">
          @for (item of allItems(); track $index; let i = $index) {
            <a [href]="item.path" [class.is-active]="item.active" [attr.aria-current]="item.active ? 'page' : null" [class.is-pending]="pending() === item.key" (click)="go($event, item)" [style.--i]="i">
              <span class="n" aria-hidden="true">{{ item.n }}</span>
              <span class="t">{{ item.label }}</span>
            </a>
          }
        </nav>
        <div class="menu-foot">
          <div class="seg" role="radiogroup" [attr.aria-label]="'dock.modeLabel' | t">
            @for (m of modes; track m.id) {
              <button type="button" role="radio" [attr.aria-checked]="theme.mode() === m.id" (click)="setMode(m.id, $event)">
                <app-icon [name]="m.icon" [size]="15" /> {{ 'dock.' + m.id | t }}
              </button>
            }
          </div>
          <div class="foot-links">
            <button type="button" class="btn btn-ghost" (click)="switchLang()">
              <app-icon name="globe" [size]="16" /> {{ i18n.other() === 'fr' ? 'Français' : 'English' }}
            </button>
            @if (auth.isAdmin()) {
              <a class="btn btn-ghost" href="/admin"><app-icon name="settings" [size]="16" /> {{ 'nav.admin' | t }}</a>
            }
          </div>
        </div>
      </div>
    </dialog>
  `,
  styles: `
    .bar {
      position: fixed;
      inset: 0 0 auto;
      z-index: 120;
      height: var(--header-h);
      transition:
        transform 0.6s var(--ease-out),
        background-color 0.4s,
        border-color 0.4s;
      border-bottom: 1px solid transparent;
    }
    .bar.is-scrolled {
      background: var(--glass);
      backdrop-filter: blur(var(--glass-blur)) saturate(140%);
      -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(140%);
      border-bottom-color: var(--line);
    }
    .bar.is-hidden {
      transform: translate3d(0, -100%, 0);
    }
    .inner {
      height: 100%;
      width: min(100% - 2 * var(--gutter), var(--container));
      margin-inline: auto;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: var(--space-4);
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.7rem;
      height: 42px;
      line-height: 1;
      justify-self: start;
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 1.05rem;
      letter-spacing: -0.03em;
    }
    .mark {
      display: grid;
      place-items: center;
      flex: none;
      overflow: hidden;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--fg);
      color: var(--bg);
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0;
      transition: transform 0.6s var(--ease-spring);
    }
    .mark img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .brand:hover .mark {
      transform: rotate(-12deg) scale(1.08);
    }
    .links {
      display: flex;
      gap: clamp(1.2rem, 3vw, 2.6rem);
    }
    .links a,
    .menu-links a {
      position: relative;
    }
    .links a {
      display: inline-flex;
      align-items: flex-start;
      gap: 0.35em;
      font-size: 0.95rem;
      font-weight: 500;
      padding: 0.5rem 0;
      color: var(--fg-2);
      transition: color var(--dur-1);
    }
    .links a::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0.25rem;
      height: 1px;
      background: currentColor;
      transform: scaleX(0);
      transform-origin: 100% 50%;
      transition: transform 0.5s var(--ease-out);
    }
    .links a:hover,
    .links a.is-active {
      color: var(--fg);
    }
    .links a:hover::after,
    .links a.is-active::after {
      transform: scaleX(1);
      transform-origin: 0 50%;
    }
    .n {
      font-family: var(--font-mono);
      font-size: 0.62rem;
      letter-spacing: 0.04em;
      color: var(--fg-3);
      padding-top: 0.1em;
    }
    .tools {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      justify-self: end;
    }
    .lang {
      display: inline-flex;
      align-items: center;
      gap: 0.3em;
      height: 40px;
      padding: 0 0.85rem;
      border-radius: var(--radius-pill);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      letter-spacing: 0.06em;
      color: var(--fg-3);
      transition: background-color var(--dur-1);
    }
    .lang:hover {
      background: var(--bg-3);
    }
    .lang .on {
      color: var(--fg);
      font-weight: 600;
    }
    .lang i {
      font-style: normal;
      opacity: 0.5;
    }
    .theme {
      display: inline-flex;
      padding: 3px;
      gap: 2px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--line-strong);
    }
    .theme button {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      color: var(--fg-2);
      transition:
        background-color var(--dur-2),
        color var(--dur-2);
    }
    .theme button:hover {
      color: var(--fg);
    }
    .theme button[aria-checked='true'] {
      background: var(--fg);
      color: var(--bg);
    }
    .auto {
      font: 700 12px/1 var(--font-mono);
    }
    .round {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 1px solid var(--line-strong);
      color: var(--fg);
      transition:
        background-color var(--dur-1),
        transform 0.5s var(--ease-spring);
    }
    .round:hover {
      background: var(--fg);
      color: var(--bg);
      transform: rotate(-20deg);
    }
    .menu-btn {
      display: none;
      align-items: center;
      gap: 0.75rem;
      height: 42px;
      line-height: 1;
      padding: 0 5px 0 1.1rem;
      border-radius: var(--radius-pill);
      background: var(--fg);
      color: var(--bg);
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      -webkit-tap-highlight-color: transparent;
      transition: transform 0.4s var(--ease-spring);
    }
    .menu-btn:active {
      transform: scale(0.96);
    }
    .menu-btn i {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--bg);
      color: var(--fg);
      display: grid;
      place-content: center;
      gap: 4px;
    }
    .menu-btn b {
      display: block;
      width: 12px;
      height: 2px;
      border-radius: 1px;
      background: currentColor;
      transition: transform 0.45s var(--ease-out);
    }
    .menu-btn.is-open b:first-child {
      transform: translateY(3px) rotate(45deg);
    }
    .menu-btn.is-open b:last-child {
      transform: translateY(-3px) rotate(-45deg);
    }
    @media (max-width: 899px) {
      .inner {
        grid-template-columns: 1fr auto;
      }
      .links,
      .tools .lang,
      .tools .theme,
      .tools .round {
        display: none;
      }
      .menu-btn {
        display: inline-flex;
      }
    }

    /* full-screen menu */
    .menu {
      position: fixed;
      inset: 0;
      width: 100%;
      max-width: none;
      height: 100%;
      max-height: none;
      margin: 0;
      padding: 0;
      border: 0;
      background: var(--bg);
      color: var(--fg);
      clip-path: inset(0 0 0 0);
      transition: clip-path 0.65s var(--ease-curtain);
    }
    .menu::backdrop {
      background: transparent;
    }
    @starting-style {
      .menu[open] {
        clip-path: inset(0 0 100% 0);
      }
    }
    .menu.is-closing {
      clip-path: inset(0 0 100% 0);
    }
    .menu.is-closing .menu-links .t {
      transform: translate3d(0, -40%, 0);
      opacity: 0;
      transition-duration: 0.4s;
      transition-delay: 0s;
    }
    .menu-links .n {
      transition: opacity 0.3s;
    }
    .menu.is-closing .menu-links .n {
      opacity: 0;
    }
    .menu-inner {
      min-height: 100%;
      display: grid;
      grid-template-rows: var(--header-h) 1fr auto;
      width: min(100% - 2 * var(--gutter), var(--container));
      margin-inline: auto;
      padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
    }
    .menu-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: var(--header-h);
    }
    .menu-top .menu-btn {
      display: inline-flex;
    }
    .menu-links {
      display: grid;
      align-content: center;
      border-top: 1px solid var(--line);
    }
    .menu-links a {
      display: flex;
      align-items: baseline;
      gap: 1rem;
      padding: 0.9rem 0;
      border-bottom: 1px solid var(--line);
      overflow: hidden;
    }
    .menu-links .t {
      font-family: var(--font-display);
      font-size: clamp(2.6rem, 11vw, 5rem);
      font-weight: var(--weight-display);
      letter-spacing: -0.05em;
      line-height: 1;
      transition:
        transform 0.8s var(--ease-out),
        color var(--dur-1);
      transition-delay: calc(0.12s + var(--i) * 0.06s);
    }
    @starting-style {
      .menu[open] .menu-links .t {
        transform: translate3d(0, 110%, 0);
      }
    }
    .menu-links a.is-pending .t {
      color: var(--accent);
    }
    .menu-links a.is-active .t {
      font-family: var(--font-serif);
      font-style: italic;
      font-weight: 400;
      color: var(--accent);
      letter-spacing: -0.02em;
    }
    .menu-foot {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      align-items: center;
      justify-content: space-between;
      padding-top: var(--space-6);
    }
    .foot-links {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .seg {
      display: inline-grid;
      grid-auto-flow: column;
      padding: 4px;
      gap: 2px;
      border-radius: var(--radius-pill);
      background: var(--bg-3);
    }
    .seg button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 38px;
      padding: 0 0.9rem;
      border-radius: var(--radius-pill);
      font-size: var(--fs-small);
      font-weight: 600;
      color: var(--fg-2);
    }
    .seg button[aria-checked='true'] {
      background: var(--fg);
      color: var(--bg);
    }
  `,
})
export class HeaderComponent {
  readonly i18n = inject(I18nService);
  readonly theme = inject(ThemeService);
  readonly auth = inject(AuthService);
  readonly scroll = inject(ScrollService);
  readonly store = inject(SiteStore);
  readonly avatar = computed(() => this.store.settings()?.avatar ?? null);
  private readonly router = inject(Router);
  private readonly transition = inject(TransitionService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly menu = viewChild.required<ElementRef<HTMLDialogElement>>('menu');

  readonly open = signal(false);
  readonly closing = signal(false);
  /** the menu entry being opened (the menu stays up until the new page is there) */
  readonly pending = signal<string | null>(null);
  readonly modes: { id: ThemeMode; icon: string }[] = [
    { id: 'light', icon: 'sun' },
    { id: 'dark', icon: 'moon' },
    { id: 'system', icon: 'monitor' },
  ];

  private readonly url = signal(this.router.url.split('?')[0]);

  readonly allItems = computed<NavItem[]>(() => {
    const lang = this.i18n.lang();
    const url = this.url();
    const d = this.i18n.dict().nav;
    const nav: { key: PageKey; label: string }[] = [
      { key: 'home', label: d.home },
      { key: 'projects', label: d.projects },
      { key: 'about', label: d.about },
      { key: 'contact', label: d.contact },
    ];
    return nav.map((n, i) => {
      const path = this.i18n.path(n.key);
      const active = n.key === 'home' ? url === path || url === `/${lang}/` : url.startsWith(path);
      return { ...n, n: String(i).padStart(2, '0'), path, active };
    });
  });
  readonly items = computed(() => this.allItems());
  readonly home = computed(() => this.allItems()[0]);

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((e) => {
        this.url.set(e.urlAfterRedirects.split('?')[0]);
        this.scroll.setHidden(false);
      });
  }

  go(event: MouseEvent, item: NavItem): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (this.open()) {
      void this.leaveMenu(item.active ? null : item.path, item.key);
      return;
    }
    if (item.active) {
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      return;
    }
    void this.transition.navigate(item.path, item.label);
  }

  switchLang(): void {
    const target = this.i18n.alternatePath(this.router.url, this.i18n.other());
    if (this.open()) {
      void this.leaveMenu(target, 'lang');
      return;
    }
    void this.transition.navigate(target, this.i18n.other() === 'fr' ? 'Français' : 'English');
  }

  /**
   * From the phone menu the menu itself is the transition: the new page renders underneath while it
   * covers the screen, then it lifts (no glimpse of the old page, no second animation).
   */
  private async leaveMenu(url: string | null, key: string): Promise<void> {
    if (this.pending() || this.closing()) return;
    this.pending.set(key);
    if (url) {
      await this.transition.navigateUnder(url);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
    this.closeMenu();
  }

  setMode(mode: ThemeMode, event: MouseEvent): void {
    this.theme.setMode(mode, event.currentTarget as Element);
  }

  openMenu(): void {
    if (!this.browser) return;
    this.closing.set(false);
    this.pending.set(null);
    this.menu().nativeElement.showModal();
    this.open.set(true);
  }

  closeMenu(): void {
    const dialog = this.menu().nativeElement;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.closing.set(true);
      dialog.close();
      this.open.set(false);
      this.pending.set(null);
      return;
    }
    if (this.closing()) return;
    this.closing.set(true);
    // .is-closing stays on until the next opening: removing it right after close() would play the
    // opening transition again while the dialog fades out
    setTimeout(() => {
      dialog.close();
      this.open.set(false);
      this.pending.set(null);
    }, 650);
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === this.menu().nativeElement) this.closeMenu();
  }
}
