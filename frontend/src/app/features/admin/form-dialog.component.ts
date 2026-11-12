import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import type { Lang } from '../../core/i18n/routes';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';

let nextId = 0;

/**
 * A back-office form in a modal (native <dialog>: focus trap, inert page). The page owns the form
 * and projects it: `<form class="dialog-form">` holding `.dialog-body` (scrolls) and
 * `.dialog-actions` (stays at the bottom), styled in admin.css. With `[(lang)]` the header shows
 * the FR / EN tabs of the texts being typed. Every way out (Escape, ×, a click beside the box)
 * only asks to close: the page decides, so it can warn about unsaved changes.
 */
@Component({
  selector: 'app-form-dialog',
  imports: [TranslatePipe, IconComponent],
  template: `
    <dialog
      #dialog
      class="form-dialog"
      [style.--dialog-width]="width() + 'px'"
      [attr.aria-labelledby]="titleId"
      (keydown)="onKey($event)"
      (cancel)="$event.preventDefault(); dismiss.emit()"
      (pointerdown)="onPointerDown($event)"
      (click)="onBackdrop($event)"
    >
      <div class="box">
        <header class="head">
          <h2 [id]="titleId">{{ title() }}</h2>
          @if (lang(); as current) {
            <div class="lang-tabs" role="tablist" [attr.aria-label]="'admin.profile.formLang' | t">
              <button type="button" role="tab" [attr.aria-selected]="current === 'fr'" (click)="langChange.emit('fr')">FR</button>
              <button type="button" role="tab" [attr.aria-selected]="current === 'en'" (click)="langChange.emit('en')">EN</button>
            </div>
          }
          <button type="button" class="icon-btn" (click)="dismiss.emit()" [attr.aria-label]="'common.close' | t"><app-icon name="close" [size]="16" /></button>
        </header>
        <ng-content />
      </div>
    </dialog>
  `,
  styles: `
    .form-dialog {
      position: fixed;
      inset: 0;
      margin: auto;
      height: fit-content;
      width: min(calc(100vw - 32px), var(--dialog-width, 640px));
      max-width: none;
      max-height: min(92dvh, 860px);
      border: 0;
      padding: 0;
      background: transparent;
      color: var(--fg);
      overflow: visible;
    }
    .form-dialog::backdrop {
      background: rgba(10, 10, 12, 0.45);
      backdrop-filter: blur(4px);
    }
    .form-dialog[open] .box {
      animation: pop 0.35s var(--ease-out) both;
    }
    @keyframes pop {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.98);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .form-dialog[open] .box {
        animation: none;
      }
    }
    .box {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      max-height: min(92dvh, 860px);
      border-radius: 18px;
      background: var(--bg-2);
      border: 1px solid var(--line);
      box-shadow: var(--shadow-3);
      overflow: hidden;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.9rem 1rem 0.9rem 1.25rem;
      border-bottom: 1px solid var(--line);
    }
    .head h2 {
      margin-right: auto;
      font-family: var(--font-body);
      font-size: 1.05rem;
      font-weight: 650;
      letter-spacing: -0.01em;
    }
  `,
})
export class FormDialogComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  /** widest the box gets, in CSS pixels */
  readonly width = input(640);
  /** language of the texts typed in the form; null hides the tabs */
  readonly lang = input<Lang | null>(null);
  readonly langChange = output<Lang>();
  /** Escape, × or a click beside the box */
  readonly dismiss = output<void>();

  readonly titleId = `form-dialog-${nextId++}`;
  /** a text selection dragged out of the box must not close it */
  downOnBackdrop = false;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const d = this.dialog().nativeElement;
      if (this.open() && !d.open) {
        d.showModal();
        // the first field, not the tabs or the × the browser would pick
        setTimeout(() => d.querySelector<HTMLElement>('.dialog-body :is(input, select, textarea)')?.focus(), 30);
      } else if (!this.open() && d.open) {
        d.close();
      }
    });
  }

  /**
   * Escape is handled here rather than through the dialog's own "cancel": after a first refused
   * cancel, Chrome closes the dialog on the next Escape whatever the page says.
   */
  onKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    this.dismiss.emit();
  }

  /**
   * A method, not an inline `downOnBackdrop = …`: Angular cancels the event when a template handler
   * evaluates to false, and a cancelled pointerdown kept every <select> of the box from opening.
   */
  onPointerDown(event: PointerEvent): void {
    this.downOnBackdrop = event.target === event.currentTarget;
  }

  onBackdrop(event: MouseEvent): void {
    if (this.downOnBackdrop && event.target === this.dialog().nativeElement) this.dismiss.emit();
    this.downOnBackdrop = false;
  }
}
