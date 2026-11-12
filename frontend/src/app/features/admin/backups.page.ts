import { Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import type { BackupOverview, BackupRun, BackupSettings, DriveFile, StagedPreview } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';
import { RestoreReviewComponent } from './restore-review.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';

@Component({
  selector: 'app-admin-backups',
  imports: [FormsModule, TranslatePipe, IconComponent, RestoreReviewComponent, TooltipDirective],
  template: `
    <div class="admin-head">
      <div>
        <h1>{{ 'admin.backups.title' | t }}</h1>
        <p class="muted small" style="max-width: 70ch">{{ 'admin.backups.intro' | t }}</p>
      </div>
    </div>

    <p class="visually-hidden" role="status">{{ loading() ? ('admin.common.loading' | t) : '' }}</p>
    @if (toast()) {
      <p class="toast">{{ toast() }}</p>
    }
    @if (error()) {
      <p class="field-error" role="alert">{{ error() }}</p>
    }
    @if (staged(); as st) {
      <app-restore-review [preview]="st" (done)="restored($event)" (cancelled)="staged.set(null)" />
    }
    @if (staging()) {
      <p class="chip chip-accent" style="margin-bottom: 1rem"><app-icon name="refresh" [size]="12" /> {{ 'admin.backups.review.analysing' | t }}</p>
    }
    @if (overview()?.running) {
      <p class="chip chip-accent" style="margin-bottom: 1rem"><app-icon name="refresh" [size]="12" /> {{ 'admin.backups.running' | t }}</p>
    }

    <div class="grid-2">
      <!-- ── Google Drive ──────────────────────────────────────────── -->
      <section class="panel">
        <h2 class="panel-title">{{ 'admin.backups.drive.title' | t }}</h2>
        @if (loading()) {
          <div class="skel-group" aria-hidden="true">
            <span class="skel loading-shimmer" style="width: 62%"></span>
            <span class="skel skel-bar loading-shimmer"></span>
            <span class="skel skel-sm loading-shimmer" style="width: 36%"></span>
            <span class="skel skel-btn loading-shimmer"></span>
          </div>
        }
        @if (overview()?.drive; as d) {
          @if (d.connected) {
            <p><app-icon name="check" [size]="14" /> {{ 'admin.backups.drive.connected' | t: { email: d.email ?? '' } }}</p>
            @if (d.quotaLimit && d.quotaUsage != null) {
              <div class="bar-row" style="margin-top: .6rem">
                <div class="bar"><i [style.--w.%]="pct(d.quotaUsage, d.quotaLimit)"></i><span>{{ 'admin.backups.drive.quota' | t: { used: size(d.quotaUsage), total: size(d.quotaLimit) } }}</span></div>
                <span class="num mono">{{ pct(d.quotaUsage, d.quotaLimit) }} %</span>
              </div>
            }
            <p class="small faint" style="margin-top: .6rem">{{ 'admin.backups.drive.folder' | t: { name: 'mbonnici.fr backups' } }}</p>
            @if (d.error) {
              <p class="field-error">{{ d.error }}</p>
            }
            <div class="row" style="margin-top: 1rem">
              <button type="button" class="btn btn-ghost" (click)="disconnect()"><app-icon name="logout" [size]="14" /> {{ 'admin.backups.drive.disconnect' | t }}</button>
            </div>
          } @else {
            <p class="muted small">{{ 'admin.backups.drive.notConnected' | t }}</p>
            <p class="small faint" style="margin: .6rem 0 1rem">{{ 'admin.backups.drive.hint' | t }}</p>
            <a class="btn-google" [href]="api.driveConnectUrl"><app-icon name="google" [size]="18" /> {{ 'admin.backups.drive.connect' | t }}</a>
          }
        }
      </section>

      <!-- ── Actions ───────────────────────────────────────────────── -->
      <section class="panel">
        <h2 class="panel-title">{{ 'admin.backups.actions.title' | t }}</h2>
        <div class="stack" style="gap: 1rem">
          <div>
            <button type="button" class="btn btn-accent" [disabled]="!overview()?.drive?.connected || overview()?.running" (click)="backupNow()">
              <app-icon name="upload" [size]="16" /> {{ 'admin.backups.actions.backupNow' | t }}
            </button>
          </div>
          <div>
            <a class="btn btn-ghost" [href]="api.backupExportUrl" download><app-icon name="arrow-down" [size]="16" /> {{ 'admin.backups.actions.export' | t }}</a>
            <p class="small faint" style="margin-top: .4rem">{{ 'admin.backups.actions.exportHint' | t }}</p>
          </div>
          <div>
            <label class="btn btn-ghost" [class.is-disabled]="importing()">
              <app-icon name="refresh" [size]="16" /> {{ importing() ? ('admin.common.loading' | t) : ('admin.backups.actions.import' | t) }}
              <input type="file" accept=".zip,application/zip" hidden (change)="importFile($event)" [disabled]="importing()" />
            </label>
            <p class="small faint" style="margin-top: .4rem">{{ 'admin.backups.actions.importHint' | t }}</p>
            @if (loading()) {
              <span class="skel skel-sm loading-shimmer" style="width: 70%; margin-top: .5rem" aria-hidden="true"></span>
            }
            @if (overview()?.schemaVersion; as v) {
              <p class="small faint" style="margin-top: .25rem">{{ 'admin.backups.schema' | t: { v: v } }}</p>
            }
          </div>
        </div>
      </section>

      <!-- ── Schedule ──────────────────────────────────────────────── -->
      <section class="panel">
        <h2 class="panel-title">{{ 'admin.backups.schedule.title' | t }}</h2>
        @if (loading()) {
          <div class="skel-group" aria-hidden="true">
            <span class="skel loading-shimmer" style="width: 70%"></span>
            <span class="skel skel-sm loading-shimmer" style="width: 22%"></span>
            <span class="skel skel-field loading-shimmer"></span>
            <span class="skel skel-sm loading-shimmer" style="width: 40%"></span>
            <span class="skel skel-field loading-shimmer"></span>
            <span class="skel skel-btn loading-shimmer"></span>
          </div>
        }
        @if (settings(); as s) {
          <div class="form-grid">
            <label class="row" style="gap: .6rem">
              <button type="button" class="switch" role="switch" [attr.aria-checked]="s.autoEnabled" [disabled]="!overview()?.drive?.connected" (click)="s.autoEnabled = !s.autoEnabled"></button>
              {{ 'admin.backups.schedule.auto' | t }}
            </label>
            <div class="field">
              <label for="b-hour">{{ 'admin.backups.schedule.hour' | t }}</label>
              <select id="b-hour" class="select" [(ngModel)]="s.hourUtc" name="hourUtc">
                @for (h of hours; track h) {
                  <option [ngValue]="h">{{ h.toString().padStart(2, '0') }}:00</option>
                }
              </select>
            </div>
            <div class="field">
              <label for="b-keep">{{ 'admin.backups.schedule.keep' | t }}</label>
              <input id="b-keep" class="input" type="number" min="1" max="100" [(ngModel)]="s.keepCount" name="keepCount" />
            </div>
            <div><button type="button" class="btn" (click)="saveSettings()">{{ 'admin.backups.schedule.save' | t }}</button></div>
          </div>
        }
      </section>

      <!-- ── Files on Drive ────────────────────────────────────────── -->
      <section class="panel">
        <h2 class="panel-title">{{ 'admin.backups.files.title' | t }}</h2>
        @if (loading()) {
          <div aria-hidden="true">
            @for (r of skeletonFiles; track r) {
              <div class="skel-row">
                <div class="skel-group skel-grow">
                  <span class="skel loading-shimmer" style="width: 72%"></span>
                  <span class="skel skel-sm loading-shimmer" style="width: 44%"></span>
                </div>
                <span class="skel skel-actions loading-shimmer"></span>
              </div>
            }
          </div>
        } @else if (!overview()?.files?.length) {
          <p class="muted small">{{ 'admin.backups.files.empty' | t }}</p>
        } @else {
          <table class="table table-stack files-table">
            <tbody>
              @for (f of overview()!.files; track f.id) {
                <tr>
                  <td>
                    <div class="mono small">{{ f.name }}</div>
                    <div class="faint small">{{ f.createdTime ? i18n.formatDate(f.createdTime, { dateStyle: 'medium', timeStyle: 'short' }) : '' }} · {{ size(f.size ?? 0) }}</div>
                  </td>
                  <td class="num">
                    <div class="file-actions">
                    <button type="button" class="chip" (click)="restore(f)" [disabled]="overview()?.running || staging()"><app-icon name="refresh" [size]="12" /> {{ 'admin.backups.files.restore' | t }}</button>
                    <a class="chip" [href]="api.backupDownloadUrl(f.id)"><app-icon name="arrow-down" [size]="12" /> {{ 'admin.backups.files.download' | t }}</a>
                    <button type="button" class="icon-btn danger" (click)="remove(f)" [appTip]="'admin.backups.files.delete' | t"><app-icon name="trash" [size]="15" /></button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>
    </div>

    <!-- ── History ─────────────────────────────────────────────────── -->
    <section class="panel">
      <h2 class="panel-title">{{ 'admin.backups.runs.title' | t }}</h2>
      @if (loading()) {
        <div aria-hidden="true">
          @for (r of skeletonRuns; track r) {
            <div class="skel-row">
              <span class="skel skel-sm loading-shimmer" style="width: 18%"></span>
              <span class="skel skel-sm loading-shimmer" style="width: 22%"></span>
              <span class="skel skel-sm loading-shimmer" style="width: 10%"></span>
              <span class="skel skel-sm loading-shimmer skel-grow"></span>
            </div>
          }
        </div>
      } @else if (!overview()?.runs?.length) {
        <p class="muted small">{{ 'admin.backups.runs.empty' | t }}</p>
      } @else {
        <table class="table table-stack runs-table">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Statut</th><th>Fichier</th><th class="num">Taille</th><th>Message</th></tr>
          </thead>
          <tbody>
            @for (r of overview()!.runs; track r.id) {
              <tr>
                <td class="mono small">{{ i18n.formatDate(r.startedAt, { dateStyle: 'medium', timeStyle: 'short' }) }}</td>
                <td>{{ 'admin.backups.runs.kind.' + r.kind | t }} <span class="faint">({{ 'admin.backups.runs.trigger.' + r.trigger | t }})</span></td>
                <td><span class="status-pill" [attr.data-status]="r.status === 'SUCCESS' ? 'PUBLISHED' : 'DRAFT'">{{ 'admin.backups.runs.status.' + r.status | t }}</span></td>
                <td class="mono small">{{ r.fileName ?? '' }}</td>
                <td class="num mono small">{{ r.sizeBytes ? size(r.sizeBytes) : '' }}</td>
                <td class="small faint">{{ r.message ?? '' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    .grid-2 {
      display: grid;
      gap: var(--space-5);
      margin-bottom: var(--space-5);
    }
    @media (min-width: 1100px) {
      .grid-2 {
        grid-template-columns: 1fr 1fr;
      }
      .grid-2 .panel + .panel {
        margin-top: 0;
      }
    }
    .file-actions {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.4rem;
      white-space: nowrap;
    }
    /* phones (.table-stack): name then buttons; a run reads date + status, what, file + size, message */
    @media (max-width: 719px) {
      .files-table td {
        grid-column: 1 / -1;
      }
      .file-actions {
        justify-content: flex-start;
        flex-wrap: wrap;
      }
      .runs-table td:nth-child(1) {
        grid-row: 1;
        grid-column: 1;
      }
      .runs-table td:nth-child(3) {
        grid-row: 1;
        grid-column: 2;
      }
      .runs-table td:nth-child(2),
      .runs-table td:nth-child(6) {
        grid-column: 1 / -1;
      }
      .runs-table td:nth-child(4) {
        grid-column: 1;
      }
      .runs-table td:nth-child(5) {
        grid-column: 2;
        text-align: right;
      }
    }
    .is-disabled {
      opacity: 0.5;
      pointer-events: none;
    }
    .btn-google {
      width: auto;
      display: inline-flex;
    }
    .skel {
      display: block;
      height: 0.95rem;
      border-radius: 4px;
    }
    .skel-sm {
      height: 0.72rem;
    }
    .skel-bar {
      height: 1.6rem;
      border-radius: 6px;
    }
    .skel-field {
      height: 2.8rem;
      border-radius: 8px;
    }
    .skel-btn {
      width: 8.5rem;
      height: 2.4rem;
      margin-top: 0.3rem;
      border-radius: 8px;
    }
    .skel-actions {
      flex: 0 0 min(45%, 16rem);
      height: 1.9rem;
      border-radius: 8px;
    }
    .skel-group {
      display: grid;
      gap: 0.7rem;
    }
    .skel-grow {
      flex: 1;
    }
    .skel-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.8rem 0;
      border-top: 1px solid var(--line);
    }
    .skel-row:first-child {
      border-top: 0;
    }
  `,
})
export class BackupsPage {
  readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);
  private readonly confirmDialog = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);

  readonly overview = signal<BackupOverview | null>(null);
  readonly settings = signal<BackupSettings | null>(null);
  /** The first answer waits on Google Drive (about 2 s) */
  readonly loading = signal(true);
  readonly skeletonFiles = [1, 2, 3, 4];
  readonly skeletonRuns = [1, 2, 3, 4, 5];
  readonly toast = signal('');
  readonly error = signal('');
  readonly importing = signal(false);
  readonly hours = Array.from({ length: 24 }, (_, i) => i);
  readonly staged = signal<StagedPreview | null>(null);
  readonly staging = signal(false);

  readonly connected = computed(() => this.overview()?.drive.connected ?? false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      void this.load();
      if (this.route.snapshot.queryParamMap.get('connected')) {
        this.notify(this.i18n.t('admin.backups.drive.justConnected'));
      }
      const timer = setInterval(() => {
        if (this.overview()?.running) void this.load(true);
      }, 4000);
      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  async load(quiet = false): Promise<void> {
    try {
      const o = await this.api.backups();
      const wasRunning = this.overview()?.running;
      this.overview.set(o);
      if (!this.settings() || !quiet) this.settings.set({ ...o.settings });
      if (wasRunning && !o.running) this.notify(this.i18n.t('admin.backups.actions.restored'));
    } catch (e) {
      this.fail(e);
    } finally {
      this.loading.set(false);
    }
  }

  async backupNow(): Promise<void> {
    try {
      await this.api.runBackup();
      this.notify(this.i18n.t('admin.backups.actions.started'));
      await this.load(true);
    } catch (e) {
      this.fail(e);
    }
  }

  async saveSettings(): Promise<void> {
    const s = this.settings();
    if (!s) return;
    try {
      const saved = await this.api.updateBackupSettings({ ...s, hourUtc: Number(s.hourUtc), keepCount: Number(s.keepCount) });
      this.settings.set(saved);
      this.notify(this.i18n.t('admin.backups.schedule.saved'));
    } catch (e) {
      this.fail(e);
    }
  }

  /** Drive archive → comparison with the live data, nothing is changed yet */
  async restore(f: DriveFile): Promise<void> {
    this.staging.set(true);
    this.error.set('');
    try {
      this.staged.set(await this.api.stageDriveBackup(f.id, f.name));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      this.fail(e);
    } finally {
      this.staging.set(false);
    }
  }

  restored(run: BackupRun): void {
    this.staged.set(null);
    this.notify(this.i18n.t('admin.backups.actions.restored') + (run.message ? ' — ' + run.message : ''));
    void this.load(true);
  }

  async remove(f: DriveFile): Promise<void> {
    const ok = await this.confirmDialog.ask({
      title: this.i18n.t('admin.backups.files.deleteConfirm', { name: f.name }),
      message: this.i18n.t('admin.common.irreversible'),
      confirm: this.i18n.t('admin.backups.files.delete'),
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.deleteBackupFile(f.id);
      await this.load(true);
    } catch (e) {
      this.fail(e);
    }
  }

  async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.importing.set(true);
    this.error.set('');
    try {
      this.staged.set(await this.api.stageBackup(file));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      this.fail(e);
    } finally {
      this.importing.set(false);
    }
  }

  async disconnect(): Promise<void> {
    const ok = await this.confirmDialog.ask({
      title: this.i18n.t('admin.backups.drive.disconnect'),
      message: this.i18n.t('admin.backups.drive.disconnectConfirm'),
      confirm: this.i18n.t('admin.backups.drive.disconnect'),
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.disconnectDrive();
      await this.load();
    } catch (e) {
      this.fail(e);
    }
  }

  pct(used: number, total: number): number {
    return total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  }

  size(bytes: number): string {
    if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' Go';
    if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' Mo';
    return Math.max(1, Math.round(bytes / 1024)) + ' ko';
  }

  private notify(text: string): void {
    this.toast.set(text);
    setTimeout(() => this.toast.set(''), 2500);
  }

  private fail(e: unknown): void {
    const msg = e instanceof HttpErrorResponse ? ((e.error as { message?: string } | null)?.message ?? e.message) : String(e);
    this.error.set(msg);
  }
}
