import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirm?: string;
  cancel?: string;
  /** red confirm button, focus starts on "Cancel" */
  danger?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/** Promise-based replacement for window.confirm(), rendered by <app-confirm-dialog>. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<Pending | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    this.current()?.resolve(false);
    return new Promise<boolean>((resolve) => this.current.set({ ...options, resolve }));
  }

  answer(ok: boolean): void {
    const p = this.current();
    if (!p) return;
    this.current.set(null);
    p.resolve(ok);
  }
}
