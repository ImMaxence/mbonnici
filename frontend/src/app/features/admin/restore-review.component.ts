import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import type { BackupRun, RowDiff, RowStatus, StagedPreview, TableDiff } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';
import { ConfirmService } from '../../shared/ui/confirm.service';

/**
 * Second step of a restore: what the archive contains compared with the live site, row by row.
 * Either pick what to bring back (new rows are pre-selected, modified ones are opt-in) or replace
 * everything at once.
 */
@Component({
  selector: 'app-restore-review',
  imports: [FormsModule, TranslatePipe, IconComponent],
  template: `
    <section class="panel review">
      <div class="row between head">
        <div>
          <h2 class="panel-title" style="margin: 0">{{ 'admin.backups.review.title' | t }}</h2>
          <p class="small faint mono">
            {{ preview().source }} · {{ i18n.formatDate(preview().manifest.createdAt, { dateStyle: 'medium', timeStyle: 'short' }) }} · v{{ preview().manifest.appVersion }}
          </p>
        </div>
        <button type="button" class="chip" (click)="cancel()"><app-icon name="close" [size]="12" /> {{ 'admin.backups.review.cancel' | t }}</button>
      </div>

      @if (!preview().schemaMatches) {
        <div class="warn">
          <p>{{ 'admin.backups.review.schemaWarning' | t: { archive: preview().manifest.schemaVersion, current: preview().currentSchema ?? '?' } }}</p>
          <label class="row small" style="gap: .5rem"><input type="checkbox" [(ngModel)]="force" name="force" /> {{ 'admin.backups.actions.force' | t }}</label>
        </div>
      }

      <div class="seg mode" role="radiogroup" [attr.aria-label]="'admin.backups.review.mode' | t">
        <button type="button" role="radio" [attr.aria-checked]="mode() === 'MERGE'" (click)="mode.set('MERGE')">
          <app-icon name="check" [size]="14" /> {{ 'admin.backups.review.merge' | t }}
        </button>
        <button type="button" role="radio" [attr.aria-checked]="mode() === 'REPLACE'" (click)="mode.set('REPLACE')">
          <app-icon name="refresh" [size]="14" /> {{ 'admin.backups.review.replace' | t }}
        </button>
      </div>
      <p class="small faint">{{ (mode() === 'MERGE' ? 'admin.backups.review.mergeHint' : 'admin.backups.review.replaceHint') | t }}</p>

      @if (mode() === 'MERGE') {
        <label class="row small" style="gap: .5rem; margin: .6rem 0 1rem">
          <input type="checkbox" [checked]="showSame()" (change)="showSame.set(!showSame())" /> {{ 'admin.backups.review.showSame' | t }}
        </label>

        @for (t of tables(); track t.table) {
          <details class="table-block" [open]="t.added + t.changed + t.conflicts > 0">
            <summary>
              <strong>{{ 'admin.backups.tables.' + t.table | t }}</strong>
              <span class="counts small">
                @if (t.added) { <span class="pill" data-s="NEW">+{{ t.added }} {{ 'admin.backups.status.NEW' | t }}</span> }
                @if (t.changed) { <span class="pill" data-s="CHANGED">{{ t.changed }} {{ 'admin.backups.status.CHANGED' | t }}</span> }
                @if (t.conflicts) { <span class="pill" data-s="CONFLICT">{{ t.conflicts }} {{ 'admin.backups.status.CONFLICT' | t }}</span> }
                @if (t.currentOnly) { <span class="pill" data-s="CURRENT_ONLY">{{ t.currentOnly }} {{ 'admin.backups.status.CURRENT_ONLY' | t }}</span> }
                <span class="faint">{{ t.same }} {{ 'admin.backups.status.SAME' | t }}</span>
              </span>
            </summary>

            @if (t.rows) {
              @if (selectable(t).length) {
                <div class="row small bulk">
                  <button type="button" class="chip" (click)="selectAll(t, true)">{{ 'admin.backups.review.selectAll' | t }}</button>
                  <button type="button" class="chip" (click)="selectAll(t, false)">{{ 'admin.backups.review.selectNone' | t }}</button>
                </div>
              }
              <ul class="rows">
                @for (r of visibleRows(t); track r.id) {
                  <li [attr.data-s]="r.status">
                    @if (canPick(r)) {
                      <input type="checkbox" [id]="'r-' + r.id" [checked]="isPicked(t.table, r.id)" (change)="toggle(t.table, r.id)" />
                    } @else {
                      <span class="box-placeholder" aria-hidden="true"></span>
                    }
                    <label [for]="'r-' + r.id">
                      <span class="lbl">{{ r.label || r.id }}</span>
                      @if (r.detail) {
                        <span class="faint small detail">{{ r.detail }}</span>
                      }
                      @if (r.changes.length) {
                        <span class="small changes">{{ 'admin.backups.review.fields' | t }} {{ r.changes.join(', ') }}</span>
                      }
                    </label>
                    <span class="pill" [attr.data-s]="r.status">{{ 'admin.backups.status.' + r.status | t }}</span>
                  </li>
                }
              </ul>
            } @else {
              <label class="row small" style="gap: .5rem; padding: .8rem 0">
                <input type="checkbox" [checked]="analytics()" (change)="analytics.set(!analytics())" [disabled]="!t.added" />
                {{ 'admin.backups.review.analytics' | t: { n: t.added } }}
              </label>
            }
          </details>
        }
        <p class="small faint">{{ 'admin.backups.review.dependencies' | t }}</p>
      } @else {
        <ul class="replace-summary small">
          @for (t of tables(); track t.table) {
            <li>
              <strong>{{ 'admin.backups.tables.' + t.table | t }}</strong>
              <span class="faint">{{ 'admin.backups.review.replaceLine' | t: { archive: t.archive, current: t.current } }}</span>
            </li>
          }
          <li>
            <strong>{{ 'admin.backups.tables.objects' | t }}</strong>
            <span class="faint">{{ preview().mediaObjects }}</span>
          </li>
        </ul>
      }

      @if (error()) {
        <p class="field-error" role="alert">{{ error() }}</p>
      }

      <div class="row between foot">
        <span class="small">
          @if (mode() === 'MERGE') {
            {{ 'admin.backups.review.selected' | t: { n: pickedCount() } }}
          }
        </span>
        <button
          type="button"
          class="btn"
          [class.btn-accent]="mode() === 'MERGE'"
          [disabled]="busy() || (mode() === 'MERGE' && !pickedCount() && !analytics()) || (!preview().schemaMatches && !force)"
          (click)="apply()"
        >
          {{ busy() ? ('admin.common.loading' | t) : ((mode() === 'MERGE' ? 'admin.backups.review.applyMerge' : 'admin.backups.review.applyReplace') | t) }}
        </button>
      </div>
    </section>
  `,
  styles: `
    .review {
      display: grid;
      gap: 0.8rem;
      margin-bottom: var(--space-5);
      border-color: var(--accent);
    }
    .warn {
      padding: 0.8rem 1rem;
      border-radius: var(--radius-s);
      background: color-mix(in srgb, var(--warning) 14%, transparent);
      display: grid;
      gap: 0.4rem;
    }
    .seg {
      display: inline-grid;
      grid-auto-flow: column;
      justify-self: start;
      padding: 4px;
      gap: 2px;
      border-radius: var(--radius-pill);
      background: var(--bg-3);
    }
    .seg button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 36px;
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
    .table-block {
      border: 1px solid var(--line);
      border-radius: var(--radius-s);
      padding: 0 1rem;
    }
    .table-block + .table-block {
      margin-top: 0.5rem;
    }
    summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem 1rem;
      padding: 0.8rem 0;
      cursor: pointer;
    }
    .counts {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      align-items: center;
    }
    .pill {
      padding: 0.2em 0.6em;
      border-radius: var(--radius-pill);
      font-size: var(--fs-micro);
      font-weight: 600;
      background: var(--bg-3);
      color: var(--fg-2);
      white-space: nowrap;
    }
    .pill[data-s='NEW'] {
      background: color-mix(in srgb, var(--success) 16%, transparent);
      color: var(--success);
    }
    .pill[data-s='CHANGED'] {
      background: color-mix(in srgb, var(--warning) 16%, transparent);
      color: var(--warning);
    }
    .pill[data-s='CONFLICT'] {
      background: color-mix(in srgb, var(--danger) 16%, transparent);
      color: var(--danger);
    }
    .bulk {
      gap: 0.4rem;
      padding-bottom: 0.6rem;
    }
    .rows {
      display: grid;
      border-top: 1px solid var(--line);
      max-height: 420px;
      overflow: auto;
    }
    .rows li {
      display: grid;
      grid-template-columns: 22px 1fr auto;
      gap: 0.75rem;
      align-items: start;
      padding: 0.6rem 0;
      border-bottom: 1px solid var(--line);
    }
    .rows li[data-s='SAME'],
    .rows li[data-s='CURRENT_ONLY'] {
      opacity: 0.65;
    }
    .rows input {
      margin-top: 0.25rem;
    }
    .rows label {
      display: grid;
      gap: 0.15rem;
      cursor: pointer;
      min-width: 0;
    }
    .detail,
    .changes {
      overflow-wrap: anywhere;
    }
    .changes {
      color: var(--warning);
    }
    .replace-summary {
      display: grid;
      gap: 0.4rem;
    }
    .replace-summary li {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.4rem 0;
      border-bottom: 1px solid var(--line);
    }
    .foot {
      padding-top: 0.6rem;
      border-top: 1px solid var(--line);
    }
  `,
})
export class RestoreReviewComponent {
  readonly preview = input.required<StagedPreview>();
  readonly done = output<BackupRun>();
  readonly cancelled = output<void>();

  private readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);
  private readonly confirmDialog = inject(ConfirmService);

  readonly mode = signal<'MERGE' | 'REPLACE'>('MERGE');
  readonly showSame = signal(false);
  readonly analytics = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  force = false;

  /** table → selected ids; new rows are pre-selected */
  private readonly picked = signal<Record<string, Set<string>> | null>(null);

  readonly tables = computed(() => this.preview().tables);
  private readonly selection = computed(() => {
    const p = this.picked();
    if (p) return p;
    const init: Record<string, Set<string>> = {};
    for (const t of this.tables()) {
      init[t.table] = new Set((t.rows ?? []).filter((r) => r.status === 'NEW').map((r) => r.id));
    }
    return init;
  });
  readonly pickedCount = computed(() => Object.values(this.selection()).reduce((n, s) => n + s.size, 0));

  canPick(r: RowDiff): boolean {
    return r.status === 'NEW' || r.status === 'CHANGED' || r.status === 'CONFLICT';
  }

  selectable(t: TableDiff): RowDiff[] {
    return (t.rows ?? []).filter((r) => this.canPick(r));
  }

  visibleRows(t: TableDiff): RowDiff[] {
    const hidden: RowStatus[] = this.showSame() ? [] : ['SAME'];
    return (t.rows ?? []).filter((r) => !hidden.includes(r.status));
  }

  isPicked(table: string, id: string): boolean {
    return this.selection()[table]?.has(id) ?? false;
  }

  toggle(table: string, id: string): void {
    const next = this.clone();
    const set = next[table] ?? new Set<string>();
    if (set.has(id)) set.delete(id);
    else set.add(id);
    next[table] = set;
    this.picked.set(next);
  }

  selectAll(t: TableDiff, on: boolean): void {
    const next = this.clone();
    next[t.table] = new Set(on ? this.selectable(t).map((r) => r.id) : []);
    this.picked.set(next);
  }

  async apply(): Promise<void> {
    const replace = this.mode() === 'REPLACE';
    if (
      replace &&
      !(await this.confirmDialog.ask({
        title: this.i18n.t('admin.backups.review.applyReplace'),
        message: this.i18n.t('admin.backups.files.restoreConfirm', { name: this.preview().source }),
        confirm: this.i18n.t('admin.backups.review.applyReplace'),
        danger: true,
      }))
    )
      return;
    this.busy.set(true);
    this.error.set('');
    try {
      const rows: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(this.selection())) if (v.size) rows[k] = [...v];
      const run = await this.api.applyStaged(this.preview().id, {
        mode: this.mode(),
        rows: replace ? undefined : rows,
        analytics: !replace && this.analytics(),
        force: this.force,
      });
      this.done.emit(run);
    } catch (e) {
      this.error.set(e instanceof HttpErrorResponse ? ((e.error as { message?: string } | null)?.message ?? e.message) : String(e));
    } finally {
      this.busy.set(false);
    }
  }

  async cancel(): Promise<void> {
    await this.api.discardStaged(this.preview().id).catch(() => undefined);
    this.cancelled.emit();
  }

  private clone(): Record<string, Set<string>> {
    const out: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(this.selection())) out[k] = new Set(v);
    return out;
  }
}
