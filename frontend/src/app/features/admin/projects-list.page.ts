import { Component, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import type { AdminProject } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-admin-projects',
  imports: [RouterLink, TranslatePipe, LocalizedPipe, IconComponent],
  template: `
    <div class="admin-head">
      <div>
        <h1>{{ 'admin.projects.title' | t }}</h1>
        <p class="muted small">{{ 'admin.projects.reorderHint' | t }}</p>
      </div>
      <a class="btn btn-accent" routerLink="/admin/projects/new"><app-icon name="plus" [size]="16" /> {{ 'admin.projects.new' | t }}</a>
    </div>

    @if (error()) {
      <p class="field-error">{{ error() }}</p>
    }

    <div class="panel">
      @if (!projects().length && !loading()) {
        <p class="muted">{{ 'admin.projects.empty' | t }}</p>
      }
      <div class="rows" (pointermove)="dragMove($event)" (pointerup)="dragEnd()" (pointercancel)="dragEnd()">
        @for (p of projects(); track p.id; let i = $index) {
          <div class="list-row" [class.is-dragging]="dragIndex() === i" [attr.data-index]="i">
            <button type="button" class="drag-handle" (pointerdown)="dragStart($event, i)" aria-label="Drag"><app-icon name="drag" [size]="18" /></button>
            <div class="row" style="gap: 1rem; min-width: 0">
              <span class="swatch" [style.background]="p.accentColor"></span>
              <div style="min-width: 0">
                <div class="row" style="gap: .5rem">
                  <strong>{{ p.title | l }}</strong>
                  @if (p.featured) {
                    <app-icon name="star" [size]="14" />
                  }
                  <span class="status-pill" [attr.data-status]="p.status">{{ 'admin.projects.status.' + p.status | t }}</span>
                </div>
                <div class="small faint mono">/{{ p.slug }} · {{ 'categories.' + p.category | t }} · {{ p.year ?? '—' }}</div>
              </div>
            </div>
            <div class="row" style="gap: .4rem; flex-wrap: nowrap">
              <button type="button" class="chip" (click)="toggleStatus(p)">
                {{ (p.status === 'PUBLISHED' ? 'admin.projects.unpublish' : 'admin.projects.publish') | t }}
              </button>
              <a class="chip" [routerLink]="['/admin/projects', p.id]"><app-icon name="edit" [size]="12" /> {{ 'admin.projects.edit' | t }}</a>
              <button type="button" class="chip" (click)="remove(p)"><app-icon name="trash" [size]="12" /></button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .swatch {
      width: 14px;
      height: 14px;
      border-radius: 4px;
      flex: none;
    }
    .rows {
      touch-action: pan-y;
    }
  `,
})
export class ProjectsListPage {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);

  readonly projects = signal<AdminProject[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly dragIndex = signal<number | null>(null);
  private pointerY = 0;

  constructor() {
    afterNextRender(() => this.load());
  }

  async load(): Promise<void> {
    try {
      this.projects.set(await this.api.adminProjects());
    } catch (e) {
      this.error.set(String(e));
    } finally {
      this.loading.set(false);
    }
  }

  async toggleStatus(p: AdminProject): Promise<void> {
    const next = p.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    const updated = await this.api.setProjectStatus(p.id, next);
    this.projects.update((list) => list.map((x) => (x.id === p.id ? updated : x)));
  }

  async remove(p: AdminProject): Promise<void> {
    if (!confirm(this.i18n.t('admin.projects.confirmDelete', { title: this.i18n.l(p.title) }))) return;
    await this.api.deleteProject(p.id);
    this.projects.update((list) => list.filter((x) => x.id !== p.id));
  }

  // ── pointer-based reordering ───────────────────────────────────────────────
  dragStart(e: PointerEvent, i: number): void {
    e.preventDefault();
    this.dragIndex.set(i);
    this.pointerY = e.clientY;
  }

  dragMove(e: PointerEvent): void {
    const from = this.dragIndex();
    if (from === null) return;
    const rows = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('.list-row'));
    const over = rows.findIndex((r) => {
      const b = r.getBoundingClientRect();
      return e.clientY >= b.top && e.clientY <= b.bottom;
    });
    if (over >= 0 && over !== from) {
      this.projects.update((list) => {
        const next = [...list];
        const [moved] = next.splice(from, 1);
        next.splice(over, 0, moved);
        return next;
      });
      this.dragIndex.set(over);
    }
  }

  async dragEnd(): Promise<void> {
    if (this.dragIndex() === null) return;
    this.dragIndex.set(null);
    try {
      await this.api.reorderProjects(this.projects().map((p) => p.id));
    } catch (e) {
      this.error.set(String(e));
    }
  }
}
