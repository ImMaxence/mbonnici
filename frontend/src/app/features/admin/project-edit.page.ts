import { Component, afterNextRender, computed, effect, inject, input, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import {
  type AdminProject,
  type ApiError,
  type MediaDto,
  type MediaKind,
  DISPLAY_MODES,
  PROJECT_CATEGORIES,
  type ProjectUpsert,
  type Skill,
} from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { Lang } from '../../core/i18n/routes';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ShowcaseComponent } from '../../shared/ui/showcase.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { MediaPickerComponent } from './media-picker.component';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { SortMove, SortableDirective, moveItem } from '../../shared/ui/sortable.directive';
import { CASE_STUDY_KEYS } from '../../core/api/models';
import { HasUnsavedChanges, snapshot, warnBeforeUnload } from './unsaved.guard';
import { missingIn } from './missing-lang.component';
import { isVideo } from '../../shared/ui/shots';
import { SkillSelectComponent } from './skill-select.component';

interface MediaRow {
  media: MediaDto;
  kind: MediaKind;
}

function emptyForm(): ProjectUpsert {
  return {
    slug: '',
    title: { fr: '', en: '' },
    tagline: { fr: '', en: '' },
    description: { fr: '', en: '' },
    caseStudy: {
      context: { fr: '', en: '' },
      role: { fr: '', en: '' },
      challenges: { fr: '', en: '' },
      results: { fr: '', en: '' },
    },
    status: 'DRAFT',
    featured: false,
    sortOrder: 0,
    year: new Date().getFullYear(),
    category: 'WEB',
    displayMode: 'BOTH',
    accentColor: '#5b9dff',
    repoUrl: '',
    liveUrl: '',
    allowIframe: false,
    stack: [],
    coverMediaId: null,
    coverVideoMediaId: null,
    media: [],
  };
}

@Component({
  selector: 'app-admin-project-edit',
  imports: [FormsModule, RouterLink, TranslatePipe, UpperCasePipe, IconComponent, ShowcaseComponent, MediaPickerComponent, TooltipDirective, SortableDirective, SkillSelectComponent],
  template: `
    <div class="admin-head">
      <div>
        <a class="small link" routerLink="/admin/projects">← {{ 'admin.nav.projects' | t }}</a>
        <h1>{{ (id() ? 'admin.projectForm.titleEdit' : 'admin.projectForm.titleNew') | t }}</h1>
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
          <a class="btn btn-ghost" [href]="'/admin/preview/projects/' + id()" target="_blank" rel="noopener" [appTip]="'admin.preview.tip' | t">
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

    <form (ngSubmit)="save()" novalidate>
      <div class="panel">
        <h2 class="panel-title">{{ 'admin.projectForm.content' | t }} — {{ lang() | uppercase }}</h2>
        <div class="form-grid cols-2">
          <div class="field span-2">
            <label for="f-title">{{ 'admin.projectForm.title' | t }}</label>
            <input id="f-title" class="input" name="title" [(ngModel)]="form.title[lang()]" required />
            @if (fieldErrors()['title']) {
              <span class="field-error">{{ fieldErrors()['title'] }}</span>
            }
          </div>
          <div class="field span-2">
            <label for="f-tagline">{{ 'admin.projectForm.tagline' | t }}</label>
            <input id="f-tagline" class="input" name="tagline" [(ngModel)]="form.tagline[lang()]" />
          </div>
          <div class="field span-2">
            <label for="f-desc">{{ 'admin.projectForm.description' | t }}</label>
            <textarea id="f-desc" class="textarea" name="description" rows="10" [(ngModel)]="form.description[lang()]"></textarea>
            <span class="field-hint">{{ 'admin.projectForm.descriptionHint' | t }}</span>
          </div>
        </div>
      </div>

      <div class="panel">
        <h2 class="panel-title">{{ 'admin.projectForm.caseStudy' | t }} — {{ lang() | uppercase }}</h2>
        <p class="small faint" style="margin: -0.4rem 0 1rem; max-width: 70ch">{{ 'admin.projectForm.caseStudyHint' | t }}</p>
        <div class="form-grid cols-2">
          @for (k of caseKeys; track k) {
            <div class="field">
              <label [for]="'f-case-' + k">{{ 'project.case.' + k | t }}</label>
              <textarea [id]="'f-case-' + k" class="textarea" [name]="'case-' + k" rows="5" [(ngModel)]="form.caseStudy[k][lang()]" [placeholder]="'admin.projectForm.casePlaceholder.' + k | t"></textarea>
            </div>
          }
        </div>
      </div>

      <div class="panel">
        <h2 class="panel-title">{{ 'admin.projectForm.general' | t }}</h2>
        <div class="form-grid cols-2">
          <div class="field">
            <label for="f-slug">{{ 'admin.projectForm.slug' | t }}</label>
            <input id="f-slug" class="input mono" name="slug" [(ngModel)]="form.slug" [attr.aria-invalid]="fieldErrors()['slug'] ? 'true' : null" />
            <span class="field-hint">{{ 'admin.projectForm.slugHint' | t }}</span>
          </div>
          <div class="field">
            <label for="f-year">{{ 'admin.projectForm.year' | t }}</label>
            <input id="f-year" class="input" name="year" type="number" min="1990" max="2100" [(ngModel)]="form.year" />
          </div>
          <div class="field">
            <label for="f-category">{{ 'admin.projectForm.category' | t }}</label>
            <select id="f-category" class="select" name="category" [(ngModel)]="form.category">
              @for (c of categories; track c) {
                <option [value]="c">{{ 'categories.' + c | t }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="f-status">{{ 'admin.projectForm.status' | t }}</label>
            <select id="f-status" class="select" name="status" [(ngModel)]="form.status">
              <option value="DRAFT">{{ 'admin.projects.status.DRAFT' | t }}</option>
              <option value="PUBLISHED">{{ 'admin.projects.status.PUBLISHED' | t }}</option>
            </select>
          </div>
          <div class="field">
            <label for="f-accent">{{ 'admin.projectForm.accent' | t }}</label>
            <div class="row" style="gap:.5rem">
              <input id="f-accent" type="color" name="accentColor" [(ngModel)]="form.accentColor" class="color" />
              <input class="input mono" name="accentHex" [attr.aria-label]="('admin.projectForm.accent' | t) + ' (hex)'" [(ngModel)]="form.accentColor" pattern="^#[0-9a-fA-F]{6}$" style="max-width: 140px" />
            </div>
            @if (fieldErrors()['accentColor']) {
              <span class="field-error">{{ fieldErrors()['accentColor'] }}</span>
            }
          </div>
          <div class="field">
            <label for="f-order">{{ 'admin.projectForm.sortOrder' | t }}</label>
            <input id="f-order" class="input" name="sortOrder" type="number" [(ngModel)]="form.sortOrder" />
          </div>
          <div class="field">
            <label for="f-repo">{{ 'admin.projectForm.repoUrl' | t }}</label>
            <input id="f-repo" class="input" name="repoUrl" type="url" [(ngModel)]="form.repoUrl" placeholder="https://github.com/…" />
          </div>
          <div class="field">
            <label for="f-live">{{ 'admin.projectForm.liveUrl' | t }}</label>
            <input id="f-live" class="input" name="liveUrl" type="url" [(ngModel)]="form.liveUrl" placeholder="https://…" />
          </div>
          <div class="field span-2">
            <label for="f-stack">{{ 'admin.projectForm.stack' | t }}</label>
            <app-skill-select inputId="f-stack" [(value)]="form.stack" [skills]="skills()" />
            <span class="field-hint">{{ 'admin.projectForm.stackHint' | t }}</span>
          </div>
          <label class="row" style="gap:.6rem">
            <button type="button" class="switch" role="switch" [attr.aria-checked]="form.featured" (click)="form.featured = !form.featured"></button>
            {{ 'admin.projectForm.featured' | t }}
          </label>
          <label class="row" style="gap:.6rem">
            <button type="button" class="switch" role="switch" [attr.aria-checked]="form.allowIframe" (click)="form.allowIframe = !form.allowIframe"></button>
            <span>{{ 'admin.projectForm.allowIframe' | t }} <span class="faint small">— {{ 'admin.projectForm.allowIframeHint' | t }}</span></span>
          </label>
        </div>
      </div>

      <div class="panel">
        <h2 class="panel-title">{{ 'admin.projectForm.preview' | t }}</h2>
        <p class="small faint" style="margin-bottom: 1rem; max-width: 70ch">{{ 'admin.projectForm.previewHint' | t }}</p>
        <div class="seg-modes" role="radiogroup" [attr.aria-label]="'admin.projectForm.display' | t" style="margin-bottom: 1rem">
          @for (m of displayModes; track m) {
            <button type="button" role="radio" class="chip" [class.is-active]="form.displayMode === m" [attr.aria-checked]="form.displayMode === m" (click)="form.displayMode = m; bump()">
              <app-icon [name]="m === 'MOBILE' ? 'phone' : m === 'DESKTOP' ? 'monitor' : 'layers'" [size]="14" /> {{ 'admin.projectForm.displayModes.' + m | t }}
            </button>
          }
        </div>
        <div style="max-width: 640px">
          <app-showcase
            [slug]="form.slug || ''"
            [title]="form.title[lang()]"
            [accent]="form.accentColor"
            [cover]="cover()"
            [coverVideo]="coverVideo()"
            [mobileMedia]="firstMobile()"
            [mode]="form.displayMode"
            [mobileList]="mobiles()"
            [site]="form.liveUrl || null"
          />
        </div>
      </div>

      <div class="panel">
        <h2 class="panel-title">{{ 'admin.projectForm.media' | t }}</h2>
        <div class="form-grid cols-2">
          <div class="field">
            <span class="field-label">{{ 'admin.projectForm.cover' | t }}</span>
            @if (cover(); as c) {
              <div class="media-item is-selected" style="max-width: 220px"><img [src]="c.url" [alt]="c.alt.fr" /></div>
              <button type="button" class="chip" (click)="form.coverMediaId = null; bump()">{{ 'admin.projectForm.removeMedia' | t }}</button>
            } @else {
              <p class="faint small">{{ 'admin.projectForm.noCover' | t }}</p>
            }
            <button type="button" class="btn btn-ghost" (click)="pick('cover')"><app-icon name="image" [size]="16" /> {{ 'admin.projectForm.pickMedia' | t }}</button>
            <span class="field-label" style="margin-top: 1rem">{{ 'admin.projectForm.coverVideo' | t }}</span>
            @if (coverVideo(); as v) {
              <div class="media-item is-selected" style="max-width: 220px">
                <video [src]="v.url + '#t=0.1'" muted preload="metadata" playsinline aria-hidden="true"></video>
              </div>
              <button type="button" class="chip" (click)="form.coverVideoMediaId = null; bump()">{{ 'admin.projectForm.removeMedia' | t }}</button>
            } @else {
              <p class="faint small">{{ 'admin.projectForm.coverVideoHint' | t }}</p>
            }
            <button type="button" class="btn btn-ghost" (click)="pick('coverVideo')"><app-icon name="play" [size]="16" /> {{ 'admin.projectForm.pickVideo' | t }}</button>
          </div>
          <div class="field">
            <span class="field-label">{{ 'admin.projectForm.gallery' | t }} / {{ 'admin.projectForm.mobile' | t }}</span>
            <div class="media-grid" appSortable (sortMove)="moveRow($event)">
              @for (row of rows(); track row.media.id) {
                <div class="media-item" data-sort-item>
                  <button type="button" class="icon-btn grip" data-sort-handle [appTip]="'admin.projects.dragTip' | t"><app-icon name="drag" [size]="14" /></button>
                  @if (isVideo(row.media)) {
                    <video [src]="row.media.url + '#t=0.1'" muted preload="metadata" playsinline aria-hidden="true" class="row-video"></video>
                  } @else {
                    <img [src]="row.media.url" [alt]="row.media.alt.fr" />
                  }
                  <button type="button" class="chip kind" (click)="toggleKind(row)">{{ row.kind === 'MOBILE' ? 'MOBILE' : 'GALLERY' }}</button>
                  <button type="button" class="icon-btn remove" (click)="removeRow(row)" [appTip]="'admin.projectForm.removeMedia' | t"><app-icon name="close" [size]="14" /></button>
                </div>
              }
            </div>
            <button type="button" class="btn btn-ghost" (click)="pick('rows')"><app-icon name="plus" [size]="16" /> {{ 'admin.projectForm.pickMedia' | t }}</button>
          </div>
        </div>
      </div>
    </form>

    @if (picking()) {
      <app-media-picker [multiple]="picking() === 'rows'" [imagesOnly]="picking() === 'cover'" [videosOnly]="picking() === 'coverVideo'" (picked)="onPicked($event)" (closed)="picking.set(null)" />
    }
  `,
  styles: `
    .color {
      width: 44px;
      height: 44px;
      padding: 0;
      border: 0;
      border-radius: 10px;
      background: none;
    }
    .media-item .grip {
      position: absolute;
      top: 6px;
      left: 6px;
      width: 28px;
      height: 28px;
      background: var(--bg-2);
      cursor: grab;
      touch-action: none;
    }
    .media-item .remove {
      position: absolute;
      top: 6px;
      right: 6px;
      padding: 4px;
    }
  `,
})
export class ProjectEditPage implements HasUnsavedChanges {
  readonly id = input<string>();
  readonly langs: Lang[] = ['fr', 'en'];
  readonly caseKeys = CASE_STUDY_KEYS;
  /** the last saved state, to tell whether the form holds changes */
  private savedState = '';
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly i18n = inject(I18nService);

  readonly categories = PROJECT_CATEGORIES;
  readonly lang = signal<Lang>('fr');
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly picking = signal<'cover' | 'coverVideo' | 'rows' | null>(null);
  readonly rows = signal<MediaRow[]>([]);
  private readonly tick = signal(0);
  private coverMedia = signal<MediaDto | null>(null);
  private coverVideoMedia = signal<MediaDto | null>(null);
  readonly coverVideo = computed(() => {
    this.tick();
    return this.form.coverVideoMediaId ? this.coverVideoMedia() : null;
  });
  readonly displayModes = DISPLAY_MODES;
  readonly mobiles = computed(() => this.rows().filter((r) => r.kind === 'MOBILE').map((r) => r.media));
  readonly firstMobile = computed(() => this.rows().find((r) => r.kind === 'MOBILE')?.media ?? null);
  readonly cover = computed(() => {
    this.tick();
    return this.form.coverMediaId ? this.coverMedia() : null;
  });

  form: ProjectUpsert = emptyForm();
  /** the profile's skills, offered for the stack */
  readonly skills = signal<Skill[]>([]);
  readonly isVideo = isVideo;

  constructor() {
    afterNextRender(() => {
      this.api.adminProfile().then((p) => this.skills.set(p.skills)).catch(() => undefined);
      const id = this.id();
      if (id) this.load(id);
      else this.savedState = this.state();
    });
    warnBeforeUnload(() => this.dirty());
    effect(() => {
      // keep form in sync with route changes new → edit
      this.id();
    });
  }

  private state(): string {
    return snapshot({ form: this.form, rows: this.rows().map((r) => [r.media.id, r.kind]) });
  }

  dirty(): boolean {
    return this.savedState !== '' && this.state() !== this.savedState;
  }

  /** texts written in the other language but empty in this one */
  missing(lang: Lang): number {
    const f = this.form;
    return missingIn(lang, [f.title, f.tagline, f.description, ...CASE_STUDY_KEYS.map((k) => f.caseStudy[k])]);
  }

  moveRow(m: SortMove): void {
    this.rows.update((rows) => moveItem(rows, m.from, m.to));
  }

  bump(): void {
    this.tick.update((v) => v + 1);
  }

  private async load(id: string): Promise<void> {
    try {
      const p: AdminProject = await this.api.adminProject(id);
      this.form = {
        slug: p.slug,
        title: { ...p.title },
        tagline: { ...p.tagline },
        description: { ...p.description },
        caseStudy: {
          context: { ...(p.caseStudy?.context ?? { fr: '', en: '' }) },
          role: { ...(p.caseStudy?.role ?? { fr: '', en: '' }) },
          challenges: { ...(p.caseStudy?.challenges ?? { fr: '', en: '' }) },
          results: { ...(p.caseStudy?.results ?? { fr: '', en: '' }) },
        },
        status: p.status,
        featured: p.featured,
        sortOrder: p.sortOrder,
        year: p.year,
        category: p.category,
        displayMode: p.displayMode ?? 'BOTH',
        accentColor: p.accentColor,
        repoUrl: p.repoUrl ?? '',
        liveUrl: p.liveUrl ?? '',
        allowIframe: p.allowIframe,
        stack: [...p.stack],
        coverMediaId: p.coverMediaId,
        coverVideoMediaId: p.coverVideoMediaId ?? null,
        media: [],
      };
      this.coverMedia.set(p.cover);
      this.coverVideoMedia.set(p.coverVideo ?? null);
      this.rows.set(p.media.map((m) => ({ media: m.media, kind: m.kind })));
      this.bump();
      this.savedState = this.state();
    } catch (e) {
      this.error.set(String(e));
    }
  }

  pick(target: 'cover' | 'coverVideo' | 'rows'): void {
    this.picking.set(target);
  }

  onPicked(items: MediaDto[]): void {
    if (this.picking() === 'cover') {
      const m = items[0];
      if (m) {
        this.form.coverMediaId = m.id;
        this.coverMedia.set(m);
      }
    } else if (this.picking() === 'coverVideo') {
      const m = items[0];
      if (m) {
        this.form.coverVideoMediaId = m.id;
        this.coverVideoMedia.set(m);
      }
    } else {
      this.rows.update((rows) => {
        const ids = new Set(rows.map((r) => r.media.id));
        const added = items.filter((m) => !ids.has(m.id)).map((media) => ({ media, kind: 'GALLERY' as MediaKind }));
        return [...rows, ...added];
      });
    }
    this.picking.set(null);
    this.bump();
  }

  toggleKind(row: MediaRow): void {
    this.rows.update((rows) => rows.map((r) => (r === row ? { ...r, kind: r.kind === 'MOBILE' ? 'GALLERY' : 'MOBILE' } : r)));
  }

  removeRow(row: MediaRow): void {
    this.rows.update((rows) => rows.filter((r) => r !== row));
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    this.fieldErrors.set({});
    const body: ProjectUpsert = {
      ...this.form,
      slug: this.form.slug?.trim() || null,
      repoUrl: this.form.repoUrl?.trim() || null,
      liveUrl: this.form.liveUrl?.trim() || null,
      year: this.form.year ? Number(this.form.year) : null,
      sortOrder: Number(this.form.sortOrder) || 0,
      media: this.rows().map((r, i) => ({ mediaId: r.media.id, kind: r.kind, sortOrder: i })),
    };
    try {
      const id = this.id();
      const saved = id ? await this.api.updateProject(id, body) : await this.api.createProject(body);
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 2000);
      this.form.slug = saved.slug;
      this.savedState = this.state();
      if (!id) await this.router.navigate(['/admin/projects', saved.id]);
    } catch (e) {
      if (e instanceof HttpErrorResponse) {
        const body = e.error as ApiError | null;
        this.error.set(body?.message ?? e.message);
        if (body?.fields) this.fieldErrors.set(body.fields);
      } else {
        this.error.set(String(e));
      }
    } finally {
      this.saving.set(false);
    }
  }
}
