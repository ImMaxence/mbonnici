import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmService } from './confirm.service';
import { IconComponent } from './icon.component';

/** Modal confirmation (native <dialog>: focus trap, Escape, inert page) driven by ConfirmService. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [TranslatePipe, IconComponent],
  template: `
    <dialog class="confirm" #dialog (cancel)="$event.preventDefault(); confirm.answer(false)" (click)="onBackdrop($event)" aria-labelledby="confirm-title">
      @if (confirm.current(); as c) {
        <div class="box" [class.danger]="c.danger">
          <span class="ico" aria-hidden="true"><app-icon [name]="c.danger ? 'trash' : 'check'" [size]="20" /></span>
          <div class="text">
            <h2 id="confirm-title">{{ c.title }}</h2>
            @if (c.message) {
              <p>{{ c.message }}</p>
            }
          </div>
          <div class="actions">
            <button type="button" class="btn btn-ghost" #cancelBtn (click)="confirm.answer(false)">{{ c.cancel ?? ('admin.common.cancel' | t) }}</button>
            <button type="button" class="btn" [class.btn-danger]="c.danger" #okBtn (click)="confirm.answer(true)">{{ c.confirm ?? ('admin.common.confirm' | t) }}</button>
          </div>
        </div>
      }
    </dialog>
  `,
  styles: `
    .confirm {
      border: 0;
      padding: 0;
      background: transparent;
      max-width: min(92vw, 460px);
      width: 100%;
      color: var(--fg);
      overflow: visible;
    }
    .confirm::backdrop {
      background: rgba(10, 10, 12, 0.45);
      backdrop-filter: blur(4px);
    }
    .confirm[open] .box {
      animation: pop 0.35s var(--ease-out) both;
    }
    @keyframes pop {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.98);
      }
    }
    .box {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 1rem 1.1rem;
      padding: 1.5rem;
      border-radius: 18px;
      background: var(--bg-2);
      border: 1px solid var(--line);
      box-shadow: var(--shadow-3);
    }
    .ico {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: var(--accent-soft);
      color: var(--accent);
    }
    .danger .ico {
      background: color-mix(in srgb, var(--danger) 14%, transparent);
      color: var(--danger);
    }
    .text {
      display: grid;
      gap: 0.4rem;
      align-content: center;
    }
    h2 {
      font-family: var(--font-body);
      font-size: 1.05rem;
      font-weight: 650;
      letter-spacing: -0.01em;
      line-height: 1.3;
    }
    p {
      color: var(--fg-2);
      font-size: var(--fs-small);
      line-height: 1.5;
    }
    .actions {
      grid-column: 1 / -1;
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding-top: 0.5rem;
    }
  `,
})
export class ConfirmDialogComponent {
  readonly confirm = inject(ConfirmService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly okBtn = viewChild<ElementRef<HTMLButtonElement>>('okBtn');
  private readonly cancelBtn = viewChild<ElementRef<HTMLButtonElement>>('cancelBtn');

  constructor() {
    effect(() => {
      const c = this.confirm.current();
      const d = this.dialog().nativeElement;
      if (c && !d.open) {
        d.showModal();
        // destructive actions start on "Cancel"
        setTimeout(() => (c.danger ? this.cancelBtn() : this.okBtn())?.nativeElement.focus(), 30);
      } else if (!c && d.open) {
        d.close();
      }
    });
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.confirm.answer(false);
  }
}
