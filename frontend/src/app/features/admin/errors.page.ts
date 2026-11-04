import { Component, afterNextRender, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import type { ErrorEntry } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';

/** Error log: JavaScript errors of visitors' browsers and unexpected API errors, grouped. */
@Component({
  selector: 'app-admin-errors',
  imports: [TranslatePipe, IconComponent, TooltipDirective],
  template: `
    <div class="admin-head">
      <div>
        <h1>{{ 'admin.errors.title' | t }}</h1>
        <p class="muted small">{{ 'admin.errors.intro' | t }}</p>
      </div>
      <div class="row" style="gap:.75rem; flex-wrap: wrap">
        <div class="lang-tabs" role="tablist" [attr.aria-label]="'admin.errors.title' | t">
          <button type="button" role="tab" [attr.aria-selected]="!resolved()" (click)="show(false)">{{ 'admin.errors.open' | t }}</button>
          <button type="button" role="tab" [attr.aria-selected]="resolved()" (click)="show(true)">{{ 'admin.errors.resolved' | t }}</button>
        </div>
        @if (resolved() && items().length) {
          <button type="button" class="btn btn-ghost" (click)="clear()"><app-icon name="trash" [size]="15" /> {{ 'admin.errors.clear' | t }}</button>
        }
      </div>
    </div>

    @if (!items().length && !loading()) {
      <div class="panel empty-state">
        <app-icon name="check" [size]="26" />
        <p>{{ (resolved() ? 'admin.errors.noneResolved' : 'admin.errors.none') | t }}</p>
      </div>
    }

    <div class="stack">
      @for (e of items(); track e.id) {
        <article class="panel error" [attr.data-source]="e.source">
          <header class="err-head">
            <span class="status-pill src">{{ 'admin.errors.source.' + e.source | t }}</span>
            <strong class="msg">{{ e.message }}</strong>
            <span class="count mono" [appTip]="'admin.errors.occurrences' | t: { n: e.occurrences }">× {{ e.occurrences }}</span>
          </header>
          <p class="meta small faint mono">
            @if (e.path) {
              <span>{{ e.path }}</span>
            }
            <span>{{ 'admin.errors.first' | t }} {{ date(e.firstSeen) }}</span>
            <span>{{ 'admin.errors.last' | t }} {{ date(e.lastSeen) }}</span>
          </p>
          @if (e.detail) {
            <details>
              <summary class="small">{{ 'admin.errors.detail' | t }}</summary>
              <pre>{{ e.detail }}</pre>
            </details>
          }
          <div class="actions">
            <button type="button" class="btn" (click)="resolve(e, !e.resolved)">
              <app-icon [name]="e.resolved ? 'refresh' : 'check'" [size]="14" /> {{ (e.resolved ? 'admin.errors.reopen' : 'admin.errors.markResolved') | t }}
            </button>
            <button type="button" class="icon-btn danger" (click)="remove(e)" [appTip]="'admin.errors.delete' | t"><app-icon name="trash" [size]="15" /></button>
          </div>
        </article>
      }
    </div>
  `,
  styles: `
    .empty-state {
      display: grid;
      justify-items: center;
      gap: 0.6rem;
      padding: 2.5rem 1rem;
      color: var(--fg-2);
    }
    .error {
      display: grid;
      gap: 0.6rem;
      border-left: 3px solid #e5484d;
    }
    .error[data-source='CLIENT'] {
      border-left-color: #e0a12a;
    }
    .err-head {
      display: flex;
      align-items: baseline;
      gap: 0.7rem;
      flex-wrap: wrap;
    }
    .msg {
      flex: 1;
      min-width: 0;
      font-family: var(--font-mono);
      font-size: 0.86rem;
      overflow-wrap: anywhere;
    }
    .count {
      font-size: 0.8rem;
      color: var(--fg-2);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.2rem 1rem;
      margin: 0;
    }
    details pre {
      max-height: 320px;
      overflow: auto;
      margin-top: 0.5rem;
      padding: 0.8rem 1rem;
      border-radius: 10px;
      background: var(--bg);
      font-size: 0.75rem;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .actions {
      display: flex;
      gap: 0.4rem;
    }
  `,
})
export class ErrorsPage {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly confirmDialog = inject(ConfirmService);

  readonly items = signal<ErrorEntry[]>([]);
  readonly resolved = signal(false);
  readonly loading = signal(true);

  constructor() {
    afterNextRender(() => void this.load());
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.items.set(await this.api.errors(this.resolved()));
    } finally {
      this.loading.set(false);
    }
  }

  show(resolved: boolean): void {
    if (resolved === this.resolved()) return;
    this.resolved.set(resolved);
    void this.load();
  }

  date(iso: string): string {
    return this.i18n.formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' });
  }

  async resolve(e: ErrorEntry, value: boolean): Promise<void> {
    await this.api.resolveError(e.id, value);
    this.items.update((list) => list.filter((x) => x.id !== e.id));
  }

  async remove(e: ErrorEntry): Promise<void> {
    const ok = await this.confirmDialog.ask({ title: this.i18n.t('admin.errors.confirmDelete'), confirm: this.i18n.t('admin.errors.delete'), danger: true });
    if (!ok) return;
    await this.api.deleteError(e.id);
    this.items.update((list) => list.filter((x) => x.id !== e.id));
  }

  async clear(): Promise<void> {
    const ok = await this.confirmDialog.ask({ title: this.i18n.t('admin.errors.confirmClear'), confirm: this.i18n.t('admin.errors.clear'), danger: true });
    if (!ok) return;
    await this.api.deleteResolvedErrors();
    this.items.set([]);
  }
}
