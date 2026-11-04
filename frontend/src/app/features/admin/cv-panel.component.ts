import { ChangeDetectionStrategy, Component, afterNextRender, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../core/api/api.service';
import type { CvStatus } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';

type CvLang = 'fr' | 'en';

/**
 * The resume PDFs (one per language, both optional). Once one is uploaded the site offers it on the
 * contact and about pages and in the footer; a visitor of the other language gets the same file.
 */
@Component({
  selector: 'app-cv-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent, TooltipDirective],
  template: `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title" style="margin:0">{{ 'admin.cv.title' | t }}</h2>
          <p class="faint small cv-intro">{{ 'admin.cv.intro' | t }}</p>
        </div>
      </div>
      <div class="cv-rows">
        @for (l of langs; track l) {
          @let file = status()?.[l];
          <div
            class="cv-row"
            [class.is-over]="over() === l"
            (dragover)="$event.preventDefault(); over.set(l)"
            (dragleave)="over.set(null)"
            (drop)="dropped($event, l)"
          >
            <span class="cv-icon" [class.has]="file" aria-hidden="true"><app-icon name="file" [size]="18" /></span>
            <div class="cv-info">
              <strong>{{ 'admin.cv.lang.' + l | t }}</strong>
              @if (busy() === l) {
                <span class="faint small">{{ 'admin.cv.uploading' | t }}</span>
              } @else if (file) {
                <span class="faint small mono">PDF · {{ size(file.size) }} · {{ 'admin.cv.uploaded' | t: { date: date(file.uploadedAt) } }}</span>
              } @else {
                <span class="faint small">{{ (status()?.[other(l)] ? 'admin.cv.fallback' : 'admin.cv.none') | t }}</span>
              }
            </div>
            <div class="row cv-actions">
              @if (file) {
                <a class="icon-btn" [href]="'/api/cv?lang=' + l" target="_blank" rel="noopener" [appTip]="'admin.cv.open' | t" [attr.aria-label]="('admin.cv.open' | t) + ' — ' + ('admin.cv.lang.' + l | t)">
                  <app-icon name="eye" [size]="15" />
                </a>
              }
              <label class="btn btn-ghost pick" [class.is-disabled]="busy() !== null">
                <input type="file" accept="application/pdf,.pdf" class="visually-hidden" [disabled]="busy() !== null" (change)="picked($event, l)" />
                <app-icon name="upload" [size]="15" /> {{ (file ? 'admin.cv.replace' : 'admin.cv.upload') | t }}
                <span class="visually-hidden"> — {{ 'admin.cv.lang.' + l | t }}</span>
              </label>
              @if (file) {
                <button type="button" class="icon-btn" (click)="remove(l)" [disabled]="busy() !== null" [appTip]="'admin.cv.remove' | t" [attr.aria-label]="('admin.cv.remove' | t) + ' — ' + ('admin.cv.lang.' + l | t)">
                  <app-icon name="trash" [size]="15" />
                </button>
              }
            </div>
          </div>
        }
      </div>
      @if (error()) {
        <p class="field-error" role="alert">{{ error() }}</p>
      }
    </div>
  `,
  styles: `
    .cv-intro {
      margin: 0.35rem 0 0;
      max-width: 62ch;
    }
    .cv-rows {
      display: grid;
      gap: 0.6rem;
    }
    .cv-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.9rem;
      padding: 0.75rem 0.9rem;
      border: 1px dashed var(--line-strong);
      border-radius: 12px;
      transition:
        border-color var(--dur-1),
        background-color var(--dur-1);
    }
    .cv-row.is-over {
      border-color: var(--accent);
      background: var(--accent-soft);
    }
    .cv-icon {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--bg-3);
      color: var(--fg-3);
    }
    .cv-icon.has {
      background: var(--fg);
      color: var(--bg);
    }
    .cv-info {
      display: grid;
      gap: 0.15rem;
      min-width: 0;
    }
    .cv-actions {
      gap: 0.4rem;
      flex-wrap: nowrap;
    }
    .pick {
      cursor: pointer;
    }
    .pick:focus-within {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .pick.is-disabled {
      opacity: 0.5;
      pointer-events: none;
    }
    @media (max-width: 560px) {
      .cv-row {
        grid-template-columns: auto minmax(0, 1fr);
      }
      .cv-actions {
        grid-column: 1 / -1;
      }
    }
  `,
})
export class CvPanelComponent {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly confirmDialog = inject(ConfirmService);

  readonly langs: CvLang[] = ['fr', 'en'];
  readonly status = signal<CvStatus | null>(null);
  readonly busy = signal<CvLang | null>(null);
  readonly over = signal<CvLang | null>(null);
  readonly error = signal('');

  constructor() {
    afterNextRender(async () => this.status.set(await this.api.cvStatus()));
  }

  other(l: CvLang): CvLang {
    return l === 'fr' ? 'en' : 'fr';
  }

  picked(event: Event, l: CvLang): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.upload(file, l);
  }

  dropped(event: DragEvent, l: CvLang): void {
    event.preventDefault();
    this.over.set(null);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.upload(file, l);
  }

  async upload(file: File, l: CvLang): Promise<void> {
    this.error.set('');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.error.set(this.i18n.t('admin.cv.onlyPdf'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.error.set(this.i18n.t('admin.cv.tooLarge'));
      return;
    }
    this.busy.set(l);
    try {
      this.status.set(await this.api.uploadCv(l, file));
    } catch (e) {
      const message = e instanceof HttpErrorResponse ? (e.error?.message as string | undefined) : undefined;
      this.error.set(message?.includes('PDF') ? this.i18n.t('admin.cv.onlyPdf') : this.i18n.t('admin.cv.failed'));
    } finally {
      this.busy.set(null);
    }
  }

  async remove(l: CvLang): Promise<void> {
    const ok = await this.confirmDialog.ask({
      title: this.i18n.t('admin.cv.confirmRemove', { lang: this.i18n.t('admin.cv.lang.' + l) }),
      confirm: this.i18n.t('admin.cv.remove'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(l);
    try {
      this.status.set(await this.api.deleteCv(l));
    } catch {
      this.error.set(this.i18n.t('admin.cv.failed'));
    } finally {
      this.busy.set(null);
    }
  }

  size(bytes: number): string {
    const mega = bytes >= 1_000_000;
    return new Intl.NumberFormat(this.i18n.locale(), { style: 'unit', unit: mega ? 'megabyte' : 'kilobyte', maximumFractionDigits: mega ? 1 : 0 }).format(
      mega ? bytes / 1_000_000 : Math.max(1, bytes / 1000),
    );
  }

  date(iso: string): string {
    return new Intl.DateTimeFormat(this.i18n.locale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
  }
}
