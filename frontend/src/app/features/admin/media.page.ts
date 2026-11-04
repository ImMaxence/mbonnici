import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import type { MediaDto } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { focalPosition } from '../../shared/ui/shots';

@Component({
  selector: 'app-admin-media',
  imports: [FormsModule, TranslatePipe, IconComponent, TooltipDirective],
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
      <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" multiple hidden (change)="onFiles($event)" />
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
          <div class="entry" [class.is-editing]="editing() === m.id">
            <div class="media-item" [class.is-selected]="editing() === m.id" (click)="editing.set(editing() === m.id ? null : m.id)">
              <img [src]="m.url" [attr.srcset]="m.srcset || null" sizes="220px" [style.object-position]="pos(m)" [alt]="m.alt.fr || ''" loading="lazy" />
              @if (!m.alt.fr && !m.alt.en) {
                <span class="no-alt" [appTip]="'admin.media.noAlt' | t" [tipLabel]="false">ALT</span>
              }
              @if (unused().has(m.id)) {
                <span class="unused" [appTip]="'admin.media.unusedTip' | t" [tipLabel]="false">{{ 'admin.media.unused' | t }}</span>
              }
            </div>
            <div class="entry-foot">
              <span class="small faint mono">{{ m.width ?? '?' }}×{{ m.height ?? '?' }} · {{ kb(m.sizeBytes) }} ko · {{ m.contentType.replace('image/', '') }}</span>
              <span class="entry-actions">
                <button type="button" class="icon-btn" (click)="editing.set(editing() === m.id ? null : m.id)" [appTip]="'admin.media.alt' | t"><app-icon name="edit" [size]="14" /></button>
                <button type="button" class="icon-btn" (click)="copy(m)" [appTip]="'admin.media.copyUrl' | t"><app-icon name="copy" [size]="14" /></button>
                <button type="button" class="icon-btn danger" (click)="remove(m)" [appTip]="'admin.media.delete' | t"><app-icon name="trash" [size]="14" /></button>
              </span>
            </div>
            @if (editing() === m.id) {
              <div class="stack" style="gap:.4rem">
                <span class="small faint">{{ 'admin.media.focalHint' | t }}</span>
                <button type="button" class="focal" (click)="setFocal(m, $event)" [attr.aria-label]="'admin.media.focal' | t">
                  <img [src]="m.url" [attr.srcset]="m.srcset || null" sizes="300px" alt="" />
                  <i class="dot" [style.left.%]="(m.focalX ?? 0.5) * 100" [style.top.%]="(m.focalY ?? 0) * 100" aria-hidden="true"></i>
                </button>
                <input class="input" [placeholder]="'admin.media.altFr' | t" [(ngModel)]="m.alt.fr" name="altFr-{{ m.id }}" />
                <input class="input" [placeholder]="'admin.media.altEn' | t" [(ngModel)]="m.alt.en" name="altEn-{{ m.id }}" />
                <button type="button" class="btn" (click)="saveAlt(m)"><app-icon name="check" [size]="14" /> {{ 'admin.profile.save' | t }}</button>
              </div>
            }
          </div>
        }
      </div>
    </div>
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
    .focal {
      position: relative;
      display: block;
      width: 100%;
      padding: 0;
      border-radius: 10px;
      overflow: hidden;
      cursor: crosshair;
      background: var(--bg-3);
    }
    .focal img {
      display: block;
      width: 100%;
      height: auto;
    }
    .focal .dot {
      position: absolute;
      width: 22px;
      height: 22px;
      margin: -11px 0 0 -11px;
      border-radius: 50%;
      border: 2px solid #fff;
      box-shadow:
        0 0 0 2px var(--accent),
        0 2px 10px rgba(0, 0, 0, 0.4);
      transition:
        left 0.3s var(--ease-out),
        top 0.3s var(--ease-out);
      pointer-events: none;
    }
    .warn-text {
      color: var(--warning);
    }
    .danger-text {
      color: var(--danger, #c62828);
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

  pos(m: MediaDto): string {
    return focalPosition(m);
  }

  /** click on the picture: that point stays in view when a frame crops it */
  async setFocal(m: MediaDto, e: MouseEvent): Promise<void> {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 100) / 100;
    const y = Math.round(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * 100) / 100;
    this.items.update((list) => list.map((i) => (i.id === m.id ? { ...i, focalX: x, focalY: y } : i)));
    try {
      const updated = await this.api.updateMediaFocal(m.id, x, y);
      this.items.update((list) => list.map((i) => (i.id === m.id ? { ...updated, alt: i.alt } : i)));
    } catch (err) {
      this.error.set(String(err));
    }
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
    void this.upload(Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/')));
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

  async saveAlt(m: MediaDto): Promise<void> {
    const updated = await this.api.updateMediaAlt(m.id, { fr: m.alt.fr, en: m.alt.en });
    this.items.update((list) => list.map((x) => (x.id === m.id ? updated : x)));
    this.editing.set(null);
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
