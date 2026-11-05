import { Component, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import type { MediaDto } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';

/** a description longer than this is read out in full by screen readers, but rarely needed */
const ALT_ADVICE = 150;

/**
 * Edits one picture of the library in a modal (native <dialog>: focus trap, Escape, inert page):
 * the picture large with its focal point, its details, and the French and English descriptions.
 * Nothing is saved until "Save"; "Save and next" walks the library, handy to describe a batch.
 */
@Component({
  selector: 'app-media-edit-dialog',
  imports: [FormsModule, TranslatePipe, IconComponent],
  template: `
    <dialog #dialog class="media-dialog" (cancel)="$event.preventDefault(); close()" (click)="onBackdrop($event)" aria-labelledby="media-dialog-title">
      @if (media(); as m) {
        <form class="box" (ngSubmit)="save(false)">
          <header class="head">
            <h2 id="media-dialog-title">{{ 'admin.media.editTitle' | t }}</h2>
            @if (position(); as p) {
              <span class="small faint mono">{{ p }}</span>
            }
            <button type="button" class="icon-btn" (click)="close()" [attr.aria-label]="'common.close' | t"><app-icon name="close" [size]="16" /></button>
          </header>

          <div class="body">
            <div class="visual">
              <div class="stage">
              <button type="button" class="focal" (click)="pick($event)" [attr.aria-label]="'admin.media.focal' | t">
                <img [src]="m.url" [attr.srcset]="m.srcset || null" sizes="(max-width: 900px) 90vw, 560px" alt="" />
                <i class="dot" [style.left.%]="focalX() * 100" [style.top.%]="focalY() * 100" aria-hidden="true"></i>
              </button>
              </div>
              <p class="small faint">{{ 'admin.media.focalHint' | t }}</p>
              <dl class="meta small">
                <dt>{{ 'admin.media.dimensions' | t }}</dt>
                <dd class="mono">{{ m.width ?? '?' }} × {{ m.height ?? '?' }}</dd>
                <dt>{{ 'admin.media.weight' | t }}</dt>
                <dd class="mono">{{ kb(m.sizeBytes) }} ko · {{ m.contentType.replace('image/', '') }}</dd>
                @if (m.originalFilename) {
                  <dt>{{ 'admin.media.file' | t }}</dt>
                  <dd class="mono ellipsis" [title]="m.originalFilename">{{ m.originalFilename }}</dd>
                }
                <dt>{{ 'admin.media.added' | t }}</dt>
                <dd>{{ i18n.formatDate(m.createdAt, { dateStyle: 'medium' }) }}</dd>
              </dl>
            </div>

            <div class="fields">
              <p class="small muted">{{ 'admin.media.altIntro' | t }}</p>
              <div class="field">
                <label for="alt-fr">{{ 'admin.media.altFr' | t }}</label>
                <textarea id="alt-fr" #first class="textarea" rows="3" name="altFr" [(ngModel)]="altFr" [placeholder]="'admin.media.altPlaceholderFr' | t"></textarea>
                <span class="count small" [class.over]="altFr.length > advice">{{ altFr.length }} / {{ advice }}</span>
              </div>
              <div class="field">
                <label for="alt-en">{{ 'admin.media.altEn' | t }}</label>
                <textarea id="alt-en" class="textarea" rows="3" name="altEn" [(ngModel)]="altEn" [placeholder]="'admin.media.altPlaceholderEn' | t"></textarea>
                <span class="count small" [class.over]="altEn.length > advice">{{ altEn.length }} / {{ advice }}</span>
              </div>
              @if (error()) {
                <p class="field-error" role="alert">{{ error() }}</p>
              }
            </div>
          </div>

          <footer class="actions">
            <button type="button" class="btn btn-ghost" (click)="close()">{{ 'admin.common.cancel' | t }}</button>
            @if (hasNext()) {
              <button type="button" class="btn btn-ghost" [disabled]="saving()" (click)="save(true)">{{ 'admin.media.saveNext' | t }} <app-icon name="arrow-right" [size]="14" /></button>
            }
            <button type="submit" class="btn" [disabled]="saving()"><app-icon name="check" [size]="14" /> {{ 'admin.profile.save' | t }}</button>
          </footer>
        </form>
      }
    </dialog>
  `,
  styles: `
    .media-dialog {
      height: fit-content;
      position: fixed;
      inset: 0;
      margin: auto;
      border: 0;
      padding: 0;
      background: transparent;
      width: min(94vw, 980px);
      max-width: none;
      max-height: min(92dvh, 900px);
      color: var(--fg);
      overflow: visible;
    }
    .media-dialog::backdrop {
      background: rgba(10, 10, 12, 0.5);
      backdrop-filter: blur(4px);
    }
    .media-dialog[open] .box {
      animation: pop 0.35s var(--ease-out) both;
    }
    @keyframes pop {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.98);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .media-dialog[open] .box {
        animation: none;
      }
    }
    .box {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      max-height: min(92dvh, 900px);
      border-radius: 18px;
      background: var(--bg-2);
      border: 1px solid var(--line);
      box-shadow: var(--shadow-3);
      overflow: hidden;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--line);
    }
    .head h2 {
      font-family: var(--font-body);
      font-size: 1.05rem;
      font-weight: 650;
      letter-spacing: -0.01em;
    }
    .head .icon-btn {
      margin-left: auto;
    }
    .body {
      display: grid;
      gap: 1.5rem;
      padding: 1.25rem;
      overflow: auto;
    }
    @media (min-width: 820px) {
      .body {
        grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      }
    }
    .visual {
      display: grid;
      gap: 0.6rem;
      align-content: start;
    }
    .stage {
      display: grid;
      place-items: center;
      padding: 0.75rem;
      border-radius: 12px;
      background: var(--bg-3);
    }
    /* the button hugs the picture, so the dot's percentages are the picture's */
    .focal {
      position: relative;
      display: block;
      width: fit-content;
      max-width: 100%;
      padding: 0;
      border-radius: 12px;
      overflow: hidden;
      cursor: crosshair;
      background: var(--bg-3);
    }
    .focal img {
      display: block;
      width: auto;
      max-width: 100%;
      height: auto;
      max-height: 50dvh;
    }
    @media (max-width: 819px) {
      .focal img {
        max-height: 30dvh;
      }
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
    .meta {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.3rem 1rem;
      margin-top: 0.4rem;
    }
    .meta dt {
      color: var(--fg-3);
    }
    .ellipsis {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .fields {
      display: grid;
      gap: 1rem;
      align-content: start;
    }
    .field {
      position: relative;
    }
    .field .textarea {
      resize: vertical;
      min-height: 5.5rem;
    }
    .count {
      justify-self: end;
      color: var(--fg-3);
      font-variant-numeric: tabular-nums;
    }
    .count.over {
      color: var(--warning);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.5rem;
      padding: 0.9rem 1.25rem;
      border-top: 1px solid var(--line);
    }
  `,
})
export class MediaEditDialogComponent {
  private readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);

  /** the picture being edited; null closes the dialog */
  readonly media = input<MediaDto | null>(null);
  readonly hasNext = input(false);
  /** "3 / 42" */
  readonly position = input('');
  readonly saved = output<{ media: MediaDto; next: boolean }>();
  readonly closed = output<void>();

  readonly advice = ALT_ADVICE;
  readonly focalX = signal(0.5);
  readonly focalY = signal(0);
  readonly saving = signal(false);
  readonly error = signal('');
  altFr = '';
  altEn = '';

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly first = viewChild<ElementRef<HTMLTextAreaElement>>('first');

  constructor() {
    effect(() => {
      const m = this.media();
      const d = this.dialog().nativeElement;
      if (m) {
        this.altFr = m.alt.fr ?? '';
        this.altEn = m.alt.en ?? '';
        this.focalX.set(m.focalX ?? 0.5);
        this.focalY.set(m.focalY ?? 0);
        this.error.set('');
        if (!d.open) d.showModal();
        setTimeout(() => this.first()?.nativeElement.focus(), 30);
      } else if (d.open) {
        d.close();
      }
    });
  }

  /** click on the picture: that point stays in view when a frame crops it */
  pick(e: MouseEvent): void {
    const r = (e.currentTarget as HTMLElement).querySelector('img')!.getBoundingClientRect();
    this.focalX.set(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 100) / 100);
    this.focalY.set(Math.round(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * 100) / 100);
  }

  async save(next: boolean): Promise<void> {
    const m = this.media();
    if (!m || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      let updated = m;
      if (this.focalX() !== (m.focalX ?? 0.5) || this.focalY() !== (m.focalY ?? 0)) {
        updated = await this.api.updateMediaFocal(m.id, this.focalX(), this.focalY());
      }
      const fr = this.altFr.trim();
      const en = this.altEn.trim();
      if (fr !== (m.alt.fr ?? '') || en !== (m.alt.en ?? '')) {
        updated = await this.api.updateMediaAlt(m.id, { fr, en });
      }
      this.saved.emit({ media: updated, next });
    } catch (e) {
      this.error.set((e as { error?: { message?: string } }).error?.message ?? String(e));
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.closed.emit();
  }

  /** a click beside the box closes it, unless something was typed or moved */
  onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement && !this.dirty()) this.close();
  }

  private dirty(): boolean {
    const m = this.media();
    if (!m) return false;
    return (
      this.altFr.trim() !== (m.alt.fr ?? '') ||
      this.altEn.trim() !== (m.alt.en ?? '') ||
      this.focalX() !== (m.focalX ?? 0.5) ||
      this.focalY() !== (m.focalY ?? 0)
    );
  }

  kb(bytes: number): number {
    return Math.round(bytes / 1024);
  }
}
