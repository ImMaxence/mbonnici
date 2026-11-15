import { HttpErrorResponse } from '@angular/common/http';
import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import type { TrashItem, TrashKind } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';

type Filter = 'ALL' | 'PROJECT' | 'MEDIA' | 'PROFILE' | 'MESSAGE' | 'CV';

const PROFILE: TrashKind[] = ['EXPERIENCE', 'EDUCATION', 'SKILL', 'NEWS'];
const ICON: Record<TrashKind, string> = {
  PROJECT: 'layers',
  MEDIA: 'image',
  EXPERIENCE: 'briefcase',
  EDUCATION: 'graduation-cap',
  SKILL: 'code',
  NEWS: 'sparkles',
  MESSAGE: 'inbox',
  CV: 'file',
};
const DAY = 86_400_000;

/**
 * The bin: what was deleted in the back office in the last 30 days (projects, media, profile
 * entries, messages, resumes), newest first, to put back where it was or to delete for good.
 */
@Component({
  selector: 'app-admin-trash',
  imports: [RouterLink, TranslatePipe, IconComponent, TooltipDirective],
  template: `
    <div class="admin-head">
      <div>
        <h1>{{ 'admin.trash.title' | t }}</h1>
        <p class="muted small">{{ 'admin.trash.intro' | t }}</p>
      </div>
      @if (items().length) {
        <button type="button" class="btn btn-ghost" (click)="empty()"><app-icon name="trash" [size]="15" /> {{ 'admin.trash.empty' | t }}</button>
      }
    </div>

    @if (filters().length > 2) {
      <div class="lang-tabs filters" role="tablist" [attr.aria-label]="'admin.trash.filter' | t">
        @for (f of filters(); track f.key) {
          <button type="button" role="tab" [attr.aria-selected]="filter() === f.key" (click)="filter.set(f.key)">
            {{ 'admin.trash.filters.' + f.key | t }} <span class="n">{{ f.count }}</span>
          </button>
        }
      </div>
    }

    @if (error()) {
      <p class="field-error banner" role="alert">{{ error() }}</p>
    }

    @if (loading() && !items().length) {
      <div class="panel skeleton" aria-hidden="true">
        @for (i of [1, 2, 3]; track i) {
          <div class="row-skel"></div>
        }
      </div>
    } @else if (!items().length) {
      <div class="panel empty-state">
        <app-icon name="trash" [size]="26" />
        <p>{{ 'admin.trash.none' | t }}</p>
      </div>
    } @else {
      <ul class="panel bin" role="list">
        @for (it of shown(); track it.id) {
          <li class="bin-row">
            <span class="thumb" [class.has-img]="!!it.preview">
              @if (it.preview) {
                <img [src]="it.preview" alt="" loading="lazy" decoding="async" />
              } @else {
                <app-icon [name]="icon(it.kind)" [size]="18" />
              }
            </span>
            <div class="what">
              <p class="line">
                <span class="status-pill kind">{{ 'admin.trash.kinds.' + it.kind | t }}</span>
                <strong class="label">{{ title(it) }}</strong>
              </p>
              @if (subtitle(it); as sub) {
                <p class="small muted sub">{{ sub }}</p>
              }
              <p class="small faint when">
                {{ 'admin.trash.deleted' | t: { date: date(it.deletedAt) } }} ·
                <span [class.soon]="daysLeft(it) <= 3">{{ left(it) }}</span>
              </p>
            </div>
            <div class="actions">
              <button type="button" class="btn" (click)="restore(it)" [disabled]="busy() === it.id">
                <app-icon name="undo" [size]="14" /> {{ 'admin.trash.restore' | t }}
              </button>
              <button type="button" class="icon-btn danger" (click)="purge(it)" [disabled]="busy() === it.id" [appTip]="'admin.trash.purge' | t">
                <app-icon name="trash" [size]="15" />
              </button>
            </div>
          </li>
        }
      </ul>
    }

    @if (notice(); as n) {
      <p class="toast" role="status">
        {{ n.text }}
        @if (n.link) {
          <a [routerLink]="n.link">{{ 'admin.trash.open' | t }}</a>
        }
      </p>
    }
  `,
  styles: `
    .filters {
      flex-wrap: wrap;
      margin-bottom: 1.25rem;
    }
    .filters .n {
      margin-left: 0.35em;
      color: var(--fg-3);
    }
    .banner {
      margin-bottom: 1rem;
    }
    .empty-state {
      display: grid;
      justify-items: center;
      gap: 0.6rem;
      padding: 2.5rem 1rem;
      color: var(--fg-2);
    }
    .bin {
      margin: 0;
      padding-block: 0.35rem;
      list-style: none;
    }
    .bin-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: center;
      padding: 0.85rem 0.25rem;
      border-bottom: 1px solid var(--line);
    }
    .bin-row:last-child {
      border-bottom: 0;
    }
    .thumb {
      display: grid;
      place-items: center;
      width: 64px;
      height: 44px;
      overflow: hidden;
      border-radius: 8px;
      background: var(--bg-3);
      color: var(--fg-2);
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .what {
      display: grid;
      gap: 0.2rem;
      min-width: 0;
    }
    .line {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      min-width: 0;
      margin: 0;
    }
    .kind {
      flex: none;
    }
    .label,
    .sub {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sub,
    .when {
      margin: 0;
    }
    .soon {
      color: var(--warning);
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .toast a {
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 0.2em;
    }
    .skeleton {
      display: grid;
      gap: 0.9rem;
    }
    .row-skel {
      height: 44px;
      border-radius: 8px;
      background: var(--bg-3);
    }
    @media (max-width: 719px) {
      .bin-row {
        grid-template-columns: auto minmax(0, 1fr);
        align-items: start;
      }
      .actions {
        grid-column: 2;
      }
      .line {
        flex-wrap: wrap;
        gap: 0.35rem 0.6rem;
      }
      .label {
        white-space: normal;
      }
    }
  `,
})
export class TrashPage {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly confirmDialog = inject(ConfirmService);

  readonly items = signal<TrashItem[]>([]);
  readonly loading = signal(true);
  readonly filter = signal<Filter>('ALL');
  /** the item being restored or deleted */
  readonly busy = signal<string | null>(null);
  readonly error = signal('');
  readonly notice = signal<{ text: string; link?: string } | null>(null);
  private noticeTimer?: ReturnType<typeof setTimeout>;

  /** "Tout" plus one tab per kind of thing in the bin */
  readonly filters = computed(() => {
    const list = this.items();
    const tabs: { key: Filter; count: number }[] = [{ key: 'ALL', count: list.length }];
    for (const key of ['PROJECT', 'MEDIA', 'PROFILE', 'MESSAGE', 'CV'] as Filter[]) {
      const count = list.filter((it) => this.matches(it, key)).length;
      if (count) tabs.push({ key, count });
    }
    return tabs;
  });

  readonly shown = computed(() => {
    const f = this.filters().some((t) => t.key === this.filter()) ? this.filter() : 'ALL';
    return this.items().filter((it) => this.matches(it, f));
  });

  constructor() {
    afterNextRender(() => void this.load());
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.items.set(await this.api.trash());
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.loading.set(false);
    }
  }

  icon(kind: TrashKind): string {
    return ICON[kind];
  }

  title(it: TrashItem): string {
    if (it.kind === 'MEDIA' && it.count > 1) return this.i18n.t('admin.trash.mediaBatch', { n: it.count });
    if (it.kind === 'MEDIA' && !it.label) return this.i18n.t('admin.trash.mediaUnnamed');
    if (it.kind === 'CV') return this.i18n.t('admin.trash.cvTitle', { lang: this.i18n.t('admin.cv.lang.' + it.detail) });
    return it.label || '—';
  }

  subtitle(it: TrashItem): string {
    switch (it.kind) {
      case 'PROJECT':
        return `/${it.detail ?? ''}`;
      case 'SKILL':
        return it.detail ? this.i18n.t('about.skillCategories.' + it.detail) : '';
      case 'CV':
        return it.label;
      default:
        return it.detail ?? '';
    }
  }

  date(iso: string): string {
    return this.i18n.formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' });
  }

  daysLeft(it: TrashItem): number {
    return Math.max(0, Math.ceil((new Date(it.expiresAt).getTime() - Date.now()) / DAY));
  }

  left(it: TrashItem): string {
    const n = this.daysLeft(it);
    return n <= 1 ? this.i18n.t('admin.trash.lastDay') : this.i18n.t('admin.trash.daysLeft', { n });
  }

  async restore(it: TrashItem): Promise<void> {
    this.busy.set(it.id);
    this.error.set('');
    try {
      const r = await this.api.restoreTrash(it.id);
      this.items.update((list) => list.filter((x) => x.id !== it.id));
      const link = r.kind === 'PROJECT' && r.id ? `/admin/projects/${r.id}` : r.kind === 'MEDIA' ? '/admin/media' : PROFILE.includes(r.kind) ? '/admin/profile' : r.kind === 'MESSAGE' ? '/admin/messages' : r.kind === 'CV' ? '/admin/profile' : undefined;
      this.show({ text: this.i18n.t('admin.trash.restored', { label: this.title(it) }), link });
    } catch (e) {
      this.error.set(this.message(e, it));
    } finally {
      this.busy.set(null);
    }
  }

  async purge(it: TrashItem): Promise<void> {
    const ok = await this.confirmDialog.ask({
      title: this.i18n.t('admin.trash.confirmPurge', { label: this.title(it) }),
      message: this.i18n.t('admin.common.irreversible'),
      confirm: this.i18n.t('admin.trash.purge'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(it.id);
    try {
      await this.api.purgeTrash(it.id);
      this.items.update((list) => list.filter((x) => x.id !== it.id));
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.busy.set(null);
    }
  }

  async empty(): Promise<void> {
    const ok = await this.confirmDialog.ask({
      title: this.i18n.t('admin.trash.confirmEmpty'),
      message: this.i18n.t('admin.common.irreversible'),
      confirm: this.i18n.t('admin.trash.empty'),
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.emptyTrash();
      this.items.set([]);
    } catch (e) {
      this.error.set(this.message(e));
    }
  }

  private matches(it: TrashItem, f: Filter): boolean {
    return f === 'ALL' || (f === 'PROFILE' ? PROFILE.includes(it.kind) : it.kind === f);
  }

  private show(n: { text: string; link?: string }): void {
    this.notice.set(n);
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice.set(null), 5000);
  }

  /** the server says why a restore can't happen with a code ("trash.slug · …") */
  private message(e: unknown, it?: TrashItem): string {
    if (e instanceof HttpErrorResponse) {
      const raw = (e.error as { message?: string } | null)?.message ?? '';
      const code = raw.split(' · ')[0];
      if (e.status === 409 && ['trash.back', 'trash.slug', 'trash.twin', 'trash.cv'].includes(code)) {
        return this.i18n.t('admin.trash.conflict.' + code.slice(6), { label: it ? this.title(it) : '', slug: it?.detail ?? '' });
      }
      if (e.status === 404) return this.i18n.t('admin.trash.gone');
      return raw || e.message;
    }
    return String(e);
  }
}
