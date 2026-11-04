import { Component, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import type { AdminArticle } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { MissingLangComponent } from './missing-lang.component';

@Component({
  selector: 'app-admin-notes',
  imports: [RouterLink, TranslatePipe, LocalizedPipe, IconComponent, TooltipDirective, MissingLangComponent],
  template: `
    <div class="admin-head">
      <div>
        <h1>{{ 'admin.notes.title' | t }}</h1>
        <p class="muted small">{{ 'admin.notes.intro' | t }}</p>
      </div>
      <a class="btn btn-accent" routerLink="/admin/notes/new"><app-icon name="plus" [size]="16" /> {{ 'admin.notes.new' | t }}</a>
    </div>

    @if (error()) {
      <p class="field-error">{{ error() }}</p>
    }

    <div class="panel">
      @if (!notes().length && !loading()) {
        <div class="empty-state">
          <app-icon name="file" [size]="26" />
          <p>{{ 'admin.notes.empty' | t }}</p>
          <a class="btn" routerLink="/admin/notes/new"><app-icon name="plus" [size]="14" /> {{ 'admin.notes.first' | t }}</a>
        </div>
      }
      @for (n of notes(); track n.id) {
        <div class="list-row">
          <span class="mono small faint when">{{ n.publishedAt ? i18n.formatDate(n.publishedAt, { dateStyle: 'medium' }) : '—' }}</span>
          <div style="min-width: 0">
            <div class="row" style="gap: .5rem">
              <a class="title" [routerLink]="['/admin/notes', n.id]">{{ n.title | l }}</a>
              <span class="status-pill" [attr.data-status]="n.status">{{ 'admin.projects.status.' + n.status | t }}</span>
              <app-missing-lang [fields]="[n.title, n.summary, n.body]" />
            </div>
            <div class="small faint mono">/{{ n.slug }}@for (t of n.tags; track t) { · #{{ t }} }</div>
          </div>
          <div class="row" style="gap: .4rem; flex-wrap: nowrap">
            <button type="button" class="chip" (click)="toggle(n)">
              {{ (n.status === 'PUBLISHED' ? 'admin.projects.unpublish' : 'admin.projects.publish') | t }}
            </button>
            <a class="icon-btn" [href]="'/admin/preview/notes/' + n.id" target="_blank" rel="noopener" [appTip]="'admin.preview.open' | t"><app-icon name="eye" [size]="15" /></a>
            <a class="icon-btn" [routerLink]="['/admin/notes', n.id]" [appTip]="'admin.projects.edit' | t"><app-icon name="edit" [size]="15" /></a>
            <button type="button" class="icon-btn danger" (click)="remove(n)" [appTip]="'admin.projects.delete' | t"><app-icon name="trash" [size]="15" /></button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .when {
      min-width: 7.5rem;
    }
    .title {
      font-weight: 600;
    }
    .title:hover {
      color: var(--accent);
    }
    .empty-state {
      display: grid;
      justify-items: center;
      gap: 0.8rem;
      padding: 2.5rem 1rem;
      text-align: center;
      color: var(--fg-2);
    }
  `,
})
export class NotesListPage {
  private readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);
  private readonly confirmDialog = inject(ConfirmService);

  readonly notes = signal<AdminArticle[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    afterNextRender(() => this.load());
  }

  async load(): Promise<void> {
    try {
      this.notes.set(await this.api.adminArticles());
    } catch (e) {
      this.error.set(String(e));
    } finally {
      this.loading.set(false);
    }
  }

  async toggle(n: AdminArticle): Promise<void> {
    const updated = await this.api.setArticleStatus(n.id, n.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED');
    this.notes.update((list) => list.map((x) => (x.id === n.id ? updated : x)));
  }

  async remove(n: AdminArticle): Promise<void> {
    const ok = await this.confirmDialog.ask({
      title: this.i18n.t('admin.notes.confirmDelete', { title: this.i18n.l(n.title) }),
      message: this.i18n.t('admin.common.irreversible'),
      confirm: this.i18n.t('admin.projects.delete'),
      danger: true,
    });
    if (!ok) return;
    await this.api.deleteArticle(n.id);
    this.notes.update((list) => list.filter((x) => x.id !== n.id));
  }
}
