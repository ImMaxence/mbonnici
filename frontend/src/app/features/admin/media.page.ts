import { Component, afterNextRender, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import type { MediaDto } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-admin-media',
  imports: [FormsModule, TranslatePipe, IconComponent],
  template: `
    <div class="admin-head">
      <h1>{{ 'admin.media.title' | t }}</h1>
      <span class="muted small">{{ total() }} · {{ 'admin.media.formats' | t }}</span>
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
      <input type="file" accept="image/*" multiple hidden (change)="onFiles($event)" />
    </label>
    @if (uploading()) {
      <p class="small muted" style="margin-top:.5rem">{{ 'admin.media.uploading' | t: { n: uploading() } }}</p>
    }
    @if (error()) {
      <p class="field-error">{{ error() }}</p>
    }

    <div class="panel" style="margin-top: 1.5rem">
      @if (!items().length) {
        <p class="muted">{{ 'admin.media.empty' | t }}</p>
      }
      <div class="library">
        @for (m of items(); track m.id) {
          <div class="entry">
            <div class="media-item" [class.is-selected]="editing() === m.id" (click)="editing.set(editing() === m.id ? null : m.id)">
              <img [src]="m.url" [alt]="m.alt.fr || ''" loading="lazy" />
            </div>
            <div class="small faint mono">{{ m.width ?? '?' }}×{{ m.height ?? '?' }} · {{ kb(m.sizeBytes) }} ko</div>
            @if (editing() === m.id) {
              <div class="stack" style="gap:.4rem">
                <input class="input" [placeholder]="'admin.media.altFr' | t" [(ngModel)]="m.alt.fr" name="altFr-{{ m.id }}" />
                <input class="input" [placeholder]="'admin.media.altEn' | t" [(ngModel)]="m.alt.en" name="altEn-{{ m.id }}" />
                <div class="row" style="gap:.4rem">
                  <button type="button" class="chip" (click)="saveAlt(m)"><app-icon name="check" [size]="12" /> {{ 'admin.profile.save' | t }}</button>
                  <button type="button" class="chip" (click)="copy(m)"><app-icon name="copy" [size]="12" /> {{ 'admin.media.copyUrl' | t }}</button>
                  <button type="button" class="chip" (click)="remove(m)"><app-icon name="trash" [size]="12" /> {{ 'admin.media.delete' | t }}</button>
                </div>
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
      gap: 0.4rem;
      align-content: start;
    }
  `,
})
export class MediaPage {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);

  readonly items = signal<MediaDto[]>([]);
  readonly total = signal(0);
  readonly uploading = signal(0);
  readonly over = signal(false);
  readonly editing = signal<string | null>(null);
  readonly error = signal('');

  constructor() {
    afterNextRender(() => this.load());
  }

  async load(): Promise<void> {
    const page = await this.api.media(0, 100);
    this.items.set(page.items);
    this.total.set(page.total);
  }

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
    if (!confirm(this.i18n.t('admin.media.confirmDelete'))) return;
    await this.api.deleteMedia(m.id);
    this.items.update((list) => list.filter((x) => x.id !== m.id));
    this.total.update((t) => t - 1);
  }

  async copy(m: MediaDto): Promise<void> {
    try {
      await navigator.clipboard.writeText(location.origin + m.url);
    } catch {
      /* ignore */
    }
  }
}
