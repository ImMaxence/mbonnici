import { DOCUMENT, Directive, ElementRef, OnDestroy, PLATFORM_ID, effect, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * `<button appTip="Supprimer">` — a small tooltip for icon buttons. It doubles as the accessible
 * name (aria-label) when the element has no text of its own. The bubble lives in <body> with fixed
 * positioning, so it is never clipped by an overflow; it shows on hover (short delay) and on
 * keyboard focus, flips below when there is no room above and stays inside the viewport.
 */
@Directive({
  selector: '[appTip]',
  host: {
    '(mouseenter)': 'show(320)',
    '(mouseleave)': 'hide()',
    '(focusin)': 'onFocus()',
    '(focusout)': 'hide()',
    '(click)': 'hide()',
    '(keydown.escape)': 'hide()',
  },
})
export class TooltipDirective implements OnDestroy {
  readonly appTip = input.required<string>();
  /** set false when the element already has a visible label */
  readonly tipLabel = input(true);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private bubble: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const text = this.appTip();
      const el = this.el.nativeElement;
      if (this.tipLabel() && !el.textContent?.trim()) {
        el.setAttribute('aria-label', text);
      }
      if (this.bubble) this.bubble.textContent = text;
    });
  }

  onFocus(): void {
    // keyboard focus only (a mouse click also focuses the button)
    if (this.el.nativeElement.matches(':focus-visible')) this.show(0);
  }

  show(delay: number): void {
    if (!this.browser || !this.appTip()) return;
    this.clear();
    this.timer = setTimeout(() => this.open(), delay);
  }

  hide(): void {
    this.clear();
    this.bubble?.remove();
    this.bubble = null;
  }

  ngOnDestroy(): void {
    this.hide();
  }

  private open(): void {
    const el = this.el.nativeElement;
    if (!el.isConnected) return;
    const tip = this.document.createElement('div');
    tip.className = 'tip-bubble';
    tip.setAttribute('role', 'tooltip');
    tip.textContent = this.appTip();
    this.document.body.appendChild(tip);
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const margin = 8;
    let top = r.top - t.height - margin;
    let below = false;
    if (top < 4) {
      top = r.bottom + margin;
      below = true;
    }
    const left = Math.min(window.innerWidth - t.width - 6, Math.max(6, r.left + r.width / 2 - t.width / 2));
    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
    tip.classList.toggle('is-below', below);
    requestAnimationFrame(() => tip.classList.add('is-in'));
    this.bubble = tip;
  }

  private clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
