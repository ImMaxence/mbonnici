import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import type { MediaDto } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { focalPosition, isVideo } from '../../shared/ui/shots';
import { isVideoFile } from '../../core/api/api.service';
import { MediaEditDialogComponent } from './media-edit-dialog.component';

@Component({
  selector: 'app-admin-media',
  imports: [TranslatePipe, IconComponent, TooltipDirective, MediaEditDialogComponent],
  template: `
    <div class="admin-head">
      <div>
        <h1>{{ 'admin.media.title' | t }}</h1>
        <p class="muted small">
          {{ 'admin.media.count' | t: { n: total() } }}
          @if (noAlt()) {
            · <span class="warn-text">{{ 'admin.media.noAltCount' | t: { n: noAlt() } }}</span>
          }
        </p>
      </div>
      <div class="row" style="gap:.5rem; flex-wrap: wrap">
        <label class="row" style="gap:.6rem">
          <button type="button" class="switch" role="switch" [attr.aria-checked]="unusedOnly()" (click)="unusedOnly.set(!unusedOnly())"></button>
          {{ 'admin.media.unusedOnly' | t: { n: unused().size } }}
        </label>
        @if (unused().size) {
          <button type="button" class="btn btn-ghost danger-text" (click)="cleanUp()"><app-icon name="trash" [size]="15" /> {{ 'admin.media.cleanUp' | t: { n: unused().size } }}</button>
        }
        <button type="button" class="icon-btn" (click)="variants()" [appTip]="'admin.media.variantsTip' | t"><app-icon name="refresh" [size]="15" /></button>
      </div>
    </div>

    <label
      class="dropzone"
      [class.is-over]="over()"
      (dragover)="$event.preventDefault(); over.set(true)"
      (dragleave)="over.set(false)"
      (drop)="drop($event)"
    >
      <app-icon name="upload" [size]="28" />
      <strong>{{ 'admin.media.drop' | t }}</strong>
      <span class="small faint">{{ 'admin.media.formats' | t }}</span>
      <input type="file" accept=".png,.jpg,.jpeg,.mp4,.webm,.mov,image/png,image/jpeg,video/mp4,video/webm,video/quicktime" multiple hidden (change)="onFiles($event)" />
    </label>
    @if (uploading()) {
      <p class="small muted" style="margin-top:.5rem">{{ 'admin.media.uploading' | t: { n: uploading() } }}</p>
    }
    @if (error()) {
      <p class="field-error">{{ error() }}</p>
    }
    @if (notice()) {
      <p class="toast">{{ notice() }}</p>
    }

    <div class="panel" style="margin-top: 1.5rem">
      @if (!items().length) {
        <p class="muted">{{ 'admin.media.empty' | t }}</p>
      }
      <div class="library">
        @for (m of shown(); track m.id) {
          <div class="entry">
            <button type="button" class="media-item" [class.is-selected]="editing() === m.id" (click)="editing.set(m.id)" [attr.aria-label]="('admin.media.edit' | t) + (m.alt.fr ? ' — ' + m.alt.fr : '')">
              @if (isVideo(m)) {
                <video [src]="m.url + '#t=0.1'" muted preload="metadata" playsinline aria-hidden="true" [style.object-position]="pos(m)"></video>
                <span class="kind-badge" aria-hidden="true"><app-icon name="play" [size]="11" /> {{ 'admin.media.video' | t }}</span>
              } @else {
                <img [src]="m.url" [attr.srcset]="m.srcset || null" sizes="220px" [style.object-position]="pos(m)" alt="" loading="lazy" />
              }
              @if (!m.alt.fr && !m.alt.en) {
                <span class="no-alt" [appTip]="'admin.media.noAlt' | t" [tipLabel]="false">ALT</span>
              }
              @if (unused().has(m.id)) {
                <span class="unused" [appTip]="'admin.media.unusedTip' | t" [tipLabel]="false">{{ 'admin.media.unused' | t }}</span>
              }
            </button>
            @if (m.alt.fr || m.alt.en) {
              <p class="entry-alt small" [title]="m.alt.fr || m.alt.en">{{ m.alt.fr || m.alt.en }}</p>
            } @else {
              <p class="entry-alt small warn-text">{{ 'admin.media.noAlt' | t }}</p>
            }
            <div class="entry-foot">
              <span class="small faint mono">{{ m.width ?? '?' }}×{{ m.height ?? '?' }} · {{ kb(m.sizeBytes) }} ko</span>
              <span class="entry-actions">
                <button type="button" class="icon-btn" (click)="editing.set(m.id)" [appTip]="'admin.media.edit' | t"><app-icon name="edit" [size]="14" /></button>
                <button type="button" class="icon-btn" (click)="copy(m)" [appTip]="'admin.media.copyUrl' | t"><app-icon name="copy" [size]="14" /></button>
                <button type="button" class="icon-btn danger" (click)="remove(m)" [appTip]="'admin.media.delete' | t"><app-icon name="trash" [size]="14" /></button>
              </span>
            </div>
          </div>
        }
      </div>
    </div>

    <app-media-edit-dialog [media]="current()" [hasNext]="nextId() != null" [position]="position()" (saved)="onSaved($event)" (closed)="editing.set(null)" />
  `,
  styles: `
    .library {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: var(--space-4);
    }
    .entry {
      display: grid;
      gap: 0.5rem;
      align-content: start;
    }
    button.media-item {
      display: block;
      width: 100%;
      padding: 0;
      text-align: left;
    }
    .entry-alt {
      margin: 0;
      color: var(--fg-2);
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .entry-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .entry-actions {
      display: flex;
      gap: 0.25rem;
    }
    .entry-actions .icon-btn {
      width: 30px;
      height: 30px;
    }
    .unused {
      position: absolute;
      left: 8px;
      bottom: 8px;
      padding: 0.2em 0.5em;
      border-radius: 6px;
      background: var(--bg-2);
      color: var(--fg-2);
      font: 600 0.62rem/1.2 var(--font-mono);
      letter-spacing: 0.04em;
    }
    .warn-text {
      color: var(--warning);
    }
    .danger-text {
      color: var(--danger, #c62828);
    }
    .kind-badge {
      position: absolute;
      left: 8px;
      top: 8px;
      display: inline-flex;
      align-items: center;
      gap: 0.3em;
      padding: 0.2em 0.5em;
      border-radius: 6px;
      background: rgba(10, 10, 12, 0.78);
      color: #fff;
      font: 600 0.62rem/1.2 var(--font-mono);
      letter-spacing: 0.04em;
    }
    .media-item video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .no-alt {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 0.2em 0.5em;
      border-radius: 6px;
      background: var(--warning);
      color: #000;
      font: 700 0.62rem/1.2 var(--font-mono);
    }
  `,
})
export class MediaPage {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly confirmDialog = inject(ConfirmService);

  readonly items = signal<MediaDto[]>([]);
  readonly total = signal(0);
  readonly uploading = signal(0);
  readonly over = signal(false);
  readonly editing = signal<string | null>(null);
  readonly error = signal('');
  readonly unused = signal<Set<string>>(new Set());
  readonly unusedOnly = signal(false);
  /** pictures without a description in either language (accessibility) */
  readonly noAlt = computed(() => this.items().filter((i) => !i.alt.fr?.trim() && !i.alt.en?.trim()).length);
  readonly shown = computed(() => (this.unusedOnly() ? this.items().filter((m) => this.unused().has(m.id)) : this.items()));

  constructor() {
    afterNextRender(() => this.load());
  }

  async load(): Promise<void> {
    const [page, unused] = await Promise.all([this.api.media(0, 100), this.api.unusedMedia()]);
    this.items.set(page.items);
    this.total.set(page.total);
    this.unused.set(new Set(unused.ids));
  }

  readonly isVideo = isVideo;

  pos(m: MediaDto): string {
    return focalPosition(m);
  }

  async cleanUp(): Promise<void> {
    const n = this.unused().size;
    const ok = await this.confirmDialog.ask({
      title: this.i18n.t('admin.media.cleanUpTitle', { n }),
      message: this.i18n.t('admin.media.cleanUpMessage'),
      confirm: this.i18n.t('admin.media.cleanUp', { n }),
      danger: true,
    });
    if (!ok) return;
    const { deleted } = await this.api.deleteUnusedMedia();
    this.unusedOnly.set(false);
    await this.load();
    this.error.set('');
    this.notice.set(this.i18n.t('admin.media.cleaned', { n: deleted }));
    setTimeout(() => this.notice.set(''), 2500);
  }

  async variants(): Promise<void> {
    const r = await this.api.makeMediaVariants();
    this.notice.set(this.i18n.t(r.started ? 'admin.media.variantsStarted' : 'admin.media.variantsRunning'));
    setTimeout(() => this.notice.set(''), 3000);
  }

  readonly notice = signal('');

  kb(bytes: number): number {
    return Math.round(bytes / 1024);
  }

  onFiles(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    void this.upload(files);
    (event.target as HTMLInputElement).value = '';
  }

  drop(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    void this.upload(Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/') || isVideoFile(f)));
  }

  private async upload(files: File[]): Promise<void> {
    this.error.set('');
    this.uploading.set(files.length);
    for (const file of files) {
      try {
        const m = await this.api.uploadMedia(file);
        this.items.update((list) => [m, ...list]);
        this.total.update((t) => t + 1);
        // nothing uses a new picture yet
        this.unused.update((s) => new Set([...s, m.id]));
      } catch (e) {
        this.error.set(`${file.name}: ${(e as { error?: { message?: string } }).error?.message ?? e}`);
      } finally {
        this.uploading.update((n) => n - 1);
      }
    }
  }

  /** the picture open in the dialog, and the one after it in the visible list */
  readonly current = computed(() => this.items().find((m) => m.id === this.editing()) ?? null);
  readonly nextId = computed(() => {
    const list = this.shown();
    const i = list.findIndex((m) => m.id === this.editing());
    return i >= 0 && i < list.length - 1 ? list[i + 1].id : null;
  });
  readonly position = computed(() => {
    const list = this.shown();
    const i = list.findIndex((m) => m.id === this.editing());
    return i >= 0 ? `${i + 1} / ${list.length}` : '';
  });

  onSaved(e: { media: MediaDto; next: boolean }): void {
    const next = e.next ? this.nextId() : null;
    this.items.update((list) => list.map((x) => (x.id === e.media.id ? e.media : x)));
    this.editing.set(next);
  }

  async remove(m: MediaDto): Promise<void> {
    const ok = await this.confirmDialog.ask({
      title: this.i18n.t('admin.media.deleteTitle'),
      message: this.i18n.t('admin.media.confirmDelete'),
      confirm: this.i18n.t('admin.media.delete'),
      danger: true,
    });
    if (!ok) return;
    await this.api.deleteMedia(m.id);
    this.items.update((list) => list.filter((x) => x.id !== m.id));
    this.total.update((t) => t - 1);
    this.unused.update((s) => {
      const next = new Set(s);
      next.delete(m.id);
      return next;
    });
  }

  async copy(m: MediaDto): Promise<void> {
    try {
      await navigator.clipboard.writeText(location.origin + m.url);
    } catch {
      /* ignore */
    }
  }
}
