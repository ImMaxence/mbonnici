import { Component, afterNextRender, inject, input, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import type { AdminArticle, ApiError, ArticleUpsert, MediaDto } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { Lang } from '../../core/i18n/routes';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';
import { MarkdownComponent } from '../../shared/ui/markdown.component';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { MediaPickerComponent } from './media-picker.component';
import { missingIn } from './missing-lang.component';
import { HasUnsavedChanges, snapshot, warnBeforeUnload } from './unsaved.guard';

function emptyForm(): ArticleUpsert {
  return {
    slug: '',
    title: { fr: '', en: '' },
    summary: { fr: '', en: '' },
    body: { fr: '', en: '' },
    status: 'DRAFT',
    tags: [],
    coverMediaId: null,
    publishedAt: null,
  };
}

@Component({
  selector: 'app-admin-note-edit',
  imports: [FormsModule, RouterLink, TranslatePipe, UpperCasePipe, IconComponent, MarkdownComponent, TooltipDirective, MediaPickerComponent],
  template: `
    <div class="admin-head">
      <div>
        <a class="small link" routerLink="/admin/notes">← {{ 'admin.notes.title' | t }}</a>
        <h1>{{ (id() ? 'admin.notes.edit' : 'admin.notes.new') | t }}</h1>
        @if (dirty()) {
          <span class="unsaved" role="status"><i aria-hidden="true"></i>{{ 'admin.unsaved.badge' | t }}</span>
        }
      </div>
      <div class="row">
        <div class="lang-tabs" role="tablist">
          @for (l of langs; track l) {
            <button type="button" role="tab" [attr.aria-selected]="lang() === l" (click)="lang.set(l)">
              {{ l | uppercase }}
              @if (missing(l); as n) {
                <span class="tab-miss" [appTip]="(n === 1 ? 'admin.translate.one' : 'admin.translate.many') | t: { n: n, lang: (l | uppercase) }">{{ n }}</span>
              }
            </button>
          }
        </div>
        @if (id()) {
          <a class="btn btn-ghost" [href]="'/admin/preview/notes/' + id()" target="_blank" rel="noopener" [appTip]="'admin.preview.tip' | t">
            <app-icon name="eye" [size]="16" /> {{ 'admin.preview.open' | t }}
          </a>
        }
        <button type="button" class="btn btn-accent" (click)="save()" [disabled]="saving()">
          {{ (saving() ? 'admin.projectForm.saving' : 'admin.projectForm.save') | t }}
        </button>
      </div>
    </div>

    @if (error()) {
      <p class="field-error" role="alert">{{ 'admin.projectForm.error' | t: { message: error() } }}</p>
    }
    @if (saved()) {
      <p class="toast">{{ 'admin.projectForm.saved' | t }}</p>
    }

    @if (ready()) {
      <form (ngSubmit)="save()" novalidate>
        <div class="panel">
          <h2 class="panel-title">{{ 'admin.projectForm.content' | t }} — {{ lang() | uppercase }}</h2>
          <div class="form-grid">
            <div class="field">
              <label for="n-title">{{ 'admin.notes.fieldTitle' | t }}</label>
              <input id="n-title" class="input" name="title" [(ngModel)]="form.title[lang()]" required />
              @if (fieldErrors()['title']) {
                <span class="field-error">{{ fieldErrors()['title'] }}</span>
              }
            </div>
            <div class="field">
              <label for="n-summary">{{ 'admin.notes.summary' | t }}</label>
              <textarea id="n-summary" class="textarea" name="summary" rows="2" [(ngModel)]="form.summary[lang()]"></textarea>
              <span class="field-hint">{{ 'admin.notes.summaryHint' | t }}</span>
            </div>
          </div>
          <div class="editor">
            <div class="field">
              <label for="n-body">{{ 'admin.notes.body' | t }}</label>
              <textarea id="n-body" class="textarea mono-area" name="body" rows="22" [(ngModel)]="form.body[lang()]"></textarea>
              <span class="field-hint">{{ 'admin.notes.bodyHint' | t }}</span>
            </div>
            <div class="preview-pane" aria-live="off">
              <span class="field-label">{{ 'admin.notes.livePreview' | t }}</span>
              <div class="preview-box">
                @if (form.body[lang()].trim()) {
                  <app-md [text]="form.body[lang()]" />
                } @else {
                  <p class="faint small">{{ 'admin.notes.previewEmpty' | t }}</p>
                }
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <h2 class="panel-title">{{ 'admin.projectForm.general' | t }}</h2>
          <div class="form-grid cols-2">
            <div class="field">
              <label for="n-slug">{{ 'admin.projectForm.slug' | t }}</label>
              <input id="n-slug" class="input mono" name="slug" [(ngModel)]="form.slug" />
              <span class="field-hint">{{ 'admin.notes.slugHint' | t }}</span>
            </div>
            <div class="field">
              <label for="n-status">{{ 'admin.projectForm.status' | t }}</label>
              <select id="n-status" class="select" name="status" [(ngModel)]="form.status">
                <option value="DRAFT">{{ 'admin.projects.status.DRAFT' | t }}</option>
                <option value="PUBLISHED">{{ 'admin.projects.status.PUBLISHED' | t }}</option>
              </select>
            </div>
            <div class="field">
              <label for="n-date">{{ 'admin.notes.date' | t }}</label>
              <input id="n-date" class="input" type="date" name="date" [ngModel]="dateValue()" (ngModelChange)="setDate($event)" />
              <span class="field-hint">{{ 'admin.notes.dateHint' | t }}</span>
            </div>
            <div class="field">
              <label for="n-tags">{{ 'admin.projectForm.tags' | t }}</label>
              <input id="n-tags" class="input" name="tags" [ngModel]="form.tags.join(', ')" (ngModelChange)="form.tags = split($event)" />
            </div>
            <div class="field span-2">
              <span class="field-label">{{ 'admin.notes.cover' | t }}</span>
              @if (cover(); as c) {
                <div class="media-item is-selected" style="max-width: 260px"><img [src]="c.url" [attr.srcset]="c.srcset || null" sizes="260px" [alt]="c.alt.fr" /></div>
                <button type="button" class="chip" (click)="setCover(null)">{{ 'admin.projectForm.removeMedia' | t }}</button>
              }
              <button type="button" class="btn btn-ghost" (click)="picking.set(true)"><app-icon name="image" [size]="16" /> {{ 'admin.projectForm.pickMedia' | t }}</button>
            </div>
          </div>
        </div>
      </form>
    }

    @if (picking()) {
      <app-media-picker [multiple]="false" (picked)="setCover($event[0] ?? null); picking.set(false)" (closed)="picking.set(false)" />
    }
  `,
  styles: `
    .editor {
      display: grid;
      gap: var(--space-4);
      margin-top: var(--space-4);
    }
    @media (min-width: 1100px) {
      .editor {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
    }
    .mono-area {
      font-family: var(--font-mono);
      font-size: 0.84rem;
      line-height: 1.6;
    }
    .preview-pane {
      display: grid;
      gap: 0.4rem;
      align-content: start;
    }
    .preview-box {
      max-height: 560px;
      overflow: auto;
      padding: 1rem 1.2rem;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: var(--bg);
    }
  `,
})
export class NoteEditPage implements HasUnsavedChanges {
  readonly id = input<string>();
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly i18n = inject(I18nService);

  readonly langs: Lang[] = ['fr', 'en'];
  readonly lang = signal<Lang>('fr');
  readonly ready = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly picking = signal(false);
  readonly cover = signal<MediaDto | null>(null);
  form: ArticleUpsert = emptyForm();
  private savedState = '';

  constructor() {
    afterNextRender(() => void this.load());
    warnBeforeUnload(() => this.dirty());
  }

  private async load(): Promise<void> {
    const id = this.id();
    if (id) {
      try {
        const a: AdminArticle = await this.api.adminArticle(id);
        this.form = {
          slug: a.slug,
          title: { ...a.title },
          summary: { ...a.summary },
          body: { ...a.body },
          status: a.status,
          tags: [...a.tags],
          coverMediaId: a.coverMediaId,
          publishedAt: a.publishedAt,
        };
        this.cover.set(a.cover);
      } catch (e) {
        this.error.set(String(e));
      }
    }
    this.savedState = snapshot(this.form);
    this.ready.set(true);
  }

  dirty(): boolean {
    return this.ready() && snapshot(this.form) !== this.savedState;
  }

  missing(lang: Lang): number {
    return missingIn(lang, [this.form.title, this.form.summary, this.form.body]);
  }

  split(v: string): string[] {
    return v.split(',').map((s) => s.trim()).filter(Boolean);
  }

  dateValue(): string {
    return this.form.publishedAt ? this.form.publishedAt.slice(0, 10) : '';
  }

  setDate(v: string): void {
    this.form.publishedAt = v ? new Date(v + 'T09:00:00Z').toISOString() : null;
  }

  setCover(m: MediaDto | null): void {
    this.cover.set(m);
    this.form.coverMediaId = m?.id ?? null;
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    this.fieldErrors.set({});
    try {
      const id = this.id();
      const body: ArticleUpsert = { ...this.form, slug: this.form.slug?.trim() || null };
      const saved = await this.api.saveArticle(body, id);
      this.form.slug = saved.slug;
      this.form.publishedAt = saved.publishedAt;
      this.savedState = snapshot(this.form);
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 2000);
      if (!id) await this.router.navigate(['/admin/notes', saved.id]);
    } catch (e) {
      if (e instanceof HttpErrorResponse) {
        const err = e.error as ApiError | null;
        this.error.set(err?.message ?? e.message);
        if (err?.fields) this.fieldErrors.set(err.fields);
      } else {
        this.error.set(String(e));
      }
    } finally {
      this.saving.set(false);
    }
  }
}
