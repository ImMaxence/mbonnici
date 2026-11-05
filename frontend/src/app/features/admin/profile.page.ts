import { Component, afterNextRender, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import {
  CONTRACT_TYPES,
  type Education,
  type EducationInput,
  type Experience,
  type ExperienceInput,
  type Profile,
  SKILL_CATEGORIES,
  type Skill,
  type SkillInput,
  type Testimonial,
  type TestimonialInput,
} from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { Lang } from '../../core/i18n/routes';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { SortMove, SortableDirective, moveItem } from '../../shared/ui/sortable.directive';
import { CvPanelComponent } from './cv-panel.component';
import { SkillSelectComponent } from './skill-select.component';
import { MissingLangComponent } from './missing-lang.component';
import { HasUnsavedChanges, snapshot, warnBeforeUnload } from './unsaved.guard';

type Section = 'experience' | 'education' | 'skill' | 'testimonial';

@Component({
  selector: 'app-admin-profile',
  imports: [FormsModule, TranslatePipe, LocalizedPipe, IconComponent, TooltipDirective, SortableDirective, MissingLangComponent, CvPanelComponent, SkillSelectComponent],
  template: `
    <div class="admin-head">
      <h1>{{ 'admin.profile.title' | t }}</h1>
      <div class="row">
        <div class="lang-tabs" role="tablist">
          <button type="button" role="tab" [attr.aria-selected]="lang() === 'fr'" (click)="lang.set('fr')">FR</button>
          <button type="button" role="tab" [attr.aria-selected]="lang() === 'en'" (click)="lang.set('en')">EN</button>
        </div>
      </div>
    </div>
    @if (toast()) {
      <p class="toast">{{ toast() }}</p>
    }
    @if (error()) {
      <p class="field-error">{{ error() }}</p>
    }

    <!-- ── Resume (PDF) ─────────────────────────────────────────────── -->
    <app-cv-panel />

    <!-- ── Experiences ─────────────────────────────────────────────── -->
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title" style="margin:0">{{ 'admin.profile.experiences' | t }}</h2>
        <button type="button" class="btn btn-ghost" (click)="startExperience()"><app-icon name="plus" [size]="14" /> {{ 'admin.profile.add' | t }}</button>
      </div>
      <p class="small faint hint">{{ 'admin.profile.dragHint' | t }}</p>
      <div appSortable (sortMove)="move('experiences', $event)" (sortDrop)="saveOrder('experiences')">
      @for (e of profile()?.experiences ?? []; track e.id) {
        <div class="list-row sortable" data-sort-item>
          <button type="button" class="drag-handle" data-sort-handle [appTip]="'admin.projects.dragTip' | t"><app-icon name="drag" [size]="16" /></button>
          <span class="mono small faint dates">{{ e.startDate }} → {{ e.endDate ?? '…' }}</span>
          <div><strong>{{ e.role | l }}</strong><span class="muted"> · {{ e.company }}</span> <app-missing-lang [fields]="[e.role, e.description]" /></div>
          <div class="row" style="gap:.4rem">
            <button type="button" class="icon-btn" (click)="startExperience(e)" [appTip]="'admin.projects.edit' | t"><app-icon name="edit" [size]="15" /></button>
            <button type="button" class="icon-btn danger" (click)="deleteItem('experience', e.id)" [appTip]="'admin.profile.delete' | t"><app-icon name="trash" [size]="15" /></button>
          </div>
        </div>
      }
      </div>
      @if (editing() === 'experience' && exp) {
        <form class="form-grid cols-2 editor" (ngSubmit)="saveExperience()">
          <div class="field"><label for="prof-company">{{ 'admin.profile.company' | t }}</label><input id="prof-company" class="input" name="company" [(ngModel)]="exp.company" required /></div>
          <div class="field"><label for="prof-companyUrl">{{ 'admin.profile.companyUrl' | t }}</label><input id="prof-companyUrl" class="input" name="companyUrl" [(ngModel)]="exp.companyUrl" /></div>
          <div class="field"><label for="prof-role">{{ 'admin.profile.role' | t }} ({{ lang() }})</label><input id="prof-role" class="input" name="role" [(ngModel)]="exp.role[lang()]" required /></div>
          <div class="field"><label for="prof-location">{{ 'admin.profile.location' | t }}</label><input id="prof-location" class="input" name="location" [(ngModel)]="exp.location" /></div>
          <div class="field span-2"><label for="prof-description">{{ 'admin.profile.description' | t }} ({{ lang() }})</label><textarea id="prof-description" class="textarea" name="description" rows="4" [(ngModel)]="exp.description[lang()]"></textarea></div>
          <div class="field">
            <label for="prof-contractType">{{ 'admin.profile.contract' | t }}</label>
            <select id="prof-contractType" class="select" name="contractType" [(ngModel)]="exp.contractType">
              @for (c of contracts; track c) {
                <option [value]="c">{{ 'about.contract.' + c | t }}</option>
              }
            </select>
          </div>
          <div class="field"><label for="prof-sortOrder">{{ 'admin.profile.order' | t }}</label><input id="prof-sortOrder" class="input" type="number" name="sortOrder" [(ngModel)]="exp.sortOrder" /></div>
          <div class="field"><label for="prof-startDate">{{ 'admin.profile.start' | t }}</label><input id="prof-startDate" class="input" type="date" name="startDate" [(ngModel)]="exp.startDate" required /></div>
          <div class="field"><label for="prof-endDate">{{ 'admin.profile.end' | t }}</label><input id="prof-endDate" class="input" type="date" name="endDate" [(ngModel)]="exp.endDate" /></div>
          <div class="field span-2"><label for="prof-skills">{{ 'admin.profile.skillsList' | t }}</label><app-skill-select inputId="prof-skills" [(value)]="exp.skills" [skills]="profile()?.skills ?? []" /></div>
          <div class="row span-2">
            <button type="submit" class="btn btn-accent">{{ 'admin.profile.save' | t }}</button>
            <button type="button" class="btn btn-ghost" (click)="editing.set(null)">{{ 'admin.projectForm.cancel' | t }}</button>
          </div>
        </form>
      }
    </div>

    <!-- ── Education ───────────────────────────────────────────────── -->
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title" style="margin:0">{{ 'admin.profile.education' | t }}</h2>
        <button type="button" class="btn btn-ghost" (click)="startEducation()"><app-icon name="plus" [size]="14" /> {{ 'admin.profile.add' | t }}</button>
      </div>
      <div appSortable (sortMove)="move('education', $event)" (sortDrop)="saveOrder('education')">
      @for (e of profile()?.education ?? []; track e.id) {
        <div class="list-row sortable" data-sort-item>
          <button type="button" class="drag-handle" data-sort-handle [appTip]="'admin.projects.dragTip' | t"><app-icon name="drag" [size]="16" /></button>
          <span class="mono small faint dates">{{ e.startDate }} → {{ e.endDate ?? '…' }}</span>
          <div><strong>{{ e.degree | l }}</strong><span class="muted"> · {{ e.school }}</span> <app-missing-lang [fields]="[e.degree]" /></div>
          <div class="row" style="gap:.4rem">
            <button type="button" class="icon-btn" (click)="startEducation(e)" [appTip]="'admin.projects.edit' | t"><app-icon name="edit" [size]="15" /></button>
            <button type="button" class="icon-btn danger" (click)="deleteItem('education', e.id)" [appTip]="'admin.profile.delete' | t"><app-icon name="trash" [size]="15" /></button>
          </div>
        </div>
      }
      </div>
      @if (editing() === 'education' && edu) {
        <form class="form-grid cols-2 editor" (ngSubmit)="saveEducation()">
          <div class="field"><label for="edu-school">{{ 'admin.profile.school' | t }}</label><input id="edu-school" class="input" name="school" [(ngModel)]="edu.school" required /></div>
          <div class="field"><label for="edu-schoolUrl">{{ 'admin.profile.schoolUrl' | t }}</label><input id="edu-schoolUrl" class="input" name="schoolUrl" [(ngModel)]="edu.schoolUrl" /></div>
          <div class="field"><label for="edu-degree">{{ 'admin.profile.degree' | t }} ({{ lang() }})</label><input id="edu-degree" class="input" name="degree" [(ngModel)]="edu.degree[lang()]" required /></div>
          <div class="field"><label for="edu-location">{{ 'admin.profile.location' | t }}</label><input id="edu-location" class="input" name="location" [(ngModel)]="edu.location" /></div>
          <div class="field"><label for="edu-startDate">{{ 'admin.profile.start' | t }}</label><input id="edu-startDate" class="input" type="date" name="startDate" [(ngModel)]="edu.startDate" required /></div>
          <div class="field"><label for="edu-endDate">{{ 'admin.profile.end' | t }}</label><input id="edu-endDate" class="input" type="date" name="endDate" [(ngModel)]="edu.endDate" /></div>
          <div class="field"><label for="edu-sortOrder">{{ 'admin.profile.order' | t }}</label><input id="edu-sortOrder" class="input" type="number" name="sortOrder" [(ngModel)]="edu.sortOrder" /></div>
          <div class="row span-2">
            <button type="submit" class="btn btn-accent">{{ 'admin.profile.save' | t }}</button>
            <button type="button" class="btn btn-ghost" (click)="editing.set(null)">{{ 'admin.projectForm.cancel' | t }}</button>
          </div>
        </form>
      }
    </div>

    <!-- ── Skills ──────────────────────────────────────────────────── -->
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title" style="margin:0">{{ 'admin.profile.skills' | t }}</h2>
        <button type="button" class="btn btn-ghost" (click)="startSkill()"><app-icon name="plus" [size]="14" /> {{ 'admin.profile.add' | t }}</button>
      </div>
      <div class="skill-groups">
        @for (g of skillGroups(); track g.key) {
          <div class="skill-group">
            <span class="group-name">{{ 'about.skillCategories.' + g.key | t }}</span>
            <div class="skill-chips" appSortable (sortMove)="moveSkill(g.key, $event)" (sortDrop)="saveOrder('skills')">
              @for (s of g.items; track s.id) {
                <span class="skill-chip" data-sort-item>
                  <button type="button" class="grip" data-sort-handle [appTip]="'admin.projects.dragTip' | t"><app-icon name="drag" [size]="13" /></button>
                  <button type="button" class="name" (click)="startSkill(s)">{{ s.name }} <span class="faint">{{ s.level }}/5</span></button>
                </span>
              }
            </div>
          </div>
        }
      </div>
      @if (editing() === 'skill' && sk) {
        <form class="form-grid cols-2 editor" (ngSubmit)="saveSkill()">
          <div class="field"><label for="sk-name">{{ 'admin.profile.name' | t }}</label><input id="sk-name" class="input" name="name" [(ngModel)]="sk.name" required /></div>
          <div class="field">
            <label for="sk-category">{{ 'admin.profile.category' | t }}</label>
            <select id="sk-category" class="select" name="category" [(ngModel)]="sk.category">
              @for (c of skillCategories; track c) {
                <option [value]="c">{{ 'about.skillCategories.' + c | t }}</option>
              }
            </select>
          </div>
          <div class="field"><label for="sk-level">{{ 'admin.profile.level' | t }}</label><input id="sk-level" class="input" type="number" min="1" max="5" name="level" [(ngModel)]="sk.level" /></div>
          <div class="field"><label for="sk-sortOrder">{{ 'admin.profile.order' | t }}</label><input id="sk-sortOrder" class="input" type="number" name="sortOrder" [(ngModel)]="sk.sortOrder" /></div>
          <div class="row span-2">
            <button type="submit" class="btn btn-accent">{{ 'admin.profile.save' | t }}</button>
            @if (skId) {
              <button type="button" class="btn btn-ghost" (click)="deleteItem('skill', skId)">{{ 'admin.profile.delete' | t }}</button>
            }
            <button type="button" class="btn btn-ghost" (click)="editing.set(null)">{{ 'admin.projectForm.cancel' | t }}</button>
          </div>
        </form>
      }
    </div>

    <!-- ── Testimonials ────────────────────────────────────────────── -->
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title" style="margin:0">{{ 'admin.profile.testimonials' | t }}</h2>
        <button type="button" class="btn btn-ghost" (click)="startTestimonial()"><app-icon name="plus" [size]="14" /> {{ 'admin.profile.add' | t }}</button>
      </div>
      <p class="small faint hint">{{ 'admin.profile.testimonialsHint' | t }}</p>
      <div appSortable (sortMove)="moveTestimonial($event)" (sortDrop)="saveOrder('testimonials')">
        @for (q of profile()?.testimonials ?? []; track q.id) {
          <div class="list-row sortable" data-sort-item>
            <button type="button" class="drag-handle" data-sort-handle [appTip]="'admin.projects.dragTip' | t"><app-icon name="drag" [size]="16" /></button>
            <div class="quote-row">
              <strong>{{ q.author }}</strong>
              @if (q.role | l; as role) {
                <span class="muted"> · {{ role }}</span>
              }
              <app-missing-lang [fields]="[q.quote, q.role]" />
              <p class="small faint quote-text">« {{ q.quote | l }} »</p>
            </div>
            <div class="row" style="gap:.4rem">
              <button type="button" class="icon-btn" (click)="startTestimonial(q)" [appTip]="'admin.projects.edit' | t"><app-icon name="edit" [size]="15" /></button>
              <button type="button" class="icon-btn danger" (click)="deleteItem('testimonial', q.id)" [appTip]="'admin.profile.delete' | t"><app-icon name="trash" [size]="15" /></button>
            </div>
          </div>
        } @empty {
          <p class="muted small">{{ 'admin.profile.testimonialsNone' | t }}</p>
        }
      </div>
      @if (editing() === 'testimonial' && tm) {
        <form class="form-grid cols-2 editor" (ngSubmit)="saveTestimonial()">
          <div class="field"><label for="tm-author">{{ 'admin.profile.author' | t }}</label><input id="tm-author" class="input" name="author" [(ngModel)]="tm.author" required maxlength="120" /></div>
          <div class="field"><label for="tm-role">{{ 'admin.profile.authorRole' | t }} ({{ lang() }})</label><input id="tm-role" class="input" name="role" [(ngModel)]="tm.role[lang()]" [placeholder]="'admin.profile.authorRolePlaceholder' | t" /></div>
          <div class="field span-2">
            <label for="tm-quote">{{ 'admin.profile.quote' | t }} ({{ lang() }})</label>
            <textarea id="tm-quote" class="textarea" name="quote" rows="4" maxlength="600" [(ngModel)]="tm.quote[lang()]" required></textarea>
            <span class="field-hint">{{ (tm.quote[lang()] || '').length }} / 600</span>
          </div>
          <div class="field span-2"><label for="tm-url">{{ 'admin.profile.quoteUrl' | t }}</label><input id="tm-url" class="input" type="url" name="url" [(ngModel)]="tm.url" placeholder="https://www.linkedin.com/in/…" /></div>
          <div class="row span-2">
            <button type="submit" class="btn btn-accent">{{ 'admin.profile.save' | t }}</button>
            <button type="button" class="btn btn-ghost" (click)="editing.set(null)">{{ 'admin.projectForm.cancel' | t }}</button>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    .quote-row {
      min-width: 0;
    }
    .quote-text {
      margin-top: 0.2rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .editor {
      margin-top: var(--space-4);
      padding-top: var(--space-4);
      border-top: 1px solid var(--line);
    }
    .dates {
      min-width: 23ch;
    }
    .hint {
      margin: -0.5rem 0 0.75rem;
    }
    .list-row.sortable {
      grid-template-columns: auto auto minmax(0, 1fr) auto;
    }
    .skill-groups {
      display: grid;
      gap: 1rem;
    }
    .skill-group {
      display: grid;
      gap: 0.5rem;
    }
    .group-name {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--fg-3);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .skill-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .skill-chip {
      display: inline-flex;
      align-items: center;
      border-radius: 8px;
      border: 1px solid var(--line-strong);
      background: var(--bg-2);
      font-size: 0.82rem;
      transition: border-color var(--dur-1), box-shadow var(--dur-2);
    }
    .skill-chip:hover {
      border-color: var(--fg);
    }
    .grip {
      display: grid;
      place-items: center;
      align-self: stretch;
      padding: 0 0.3rem 0 0.45rem;
      color: var(--fg-3);
      cursor: grab;
      touch-action: none;
    }
    .grip:active {
      cursor: grabbing;
    }
    .skill-chip .name {
      padding: 0.35rem 0.7rem 0.35rem 0.2rem;
    }
    .drag-handle {
      touch-action: none;
    }
  `,
})
export class AdminProfilePage implements HasUnsavedChanges {
  /** the entry being edited, as it was when the form opened */
  private editState = '';
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly confirmDialog = inject(ConfirmService);

  readonly contracts = CONTRACT_TYPES;
  readonly skillCategories = SKILL_CATEGORIES;
  readonly skillGroups = computed(() => {
    const skills = this.profile()?.skills ?? [];
    return SKILL_CATEGORIES.map((key) => ({ key, items: skills.filter((s) => s.category === key) })).filter((g) => g.items.length);
  });
  readonly lang = signal<Lang>('fr');
  readonly profile = signal<Profile | null>(null);
  readonly editing = signal<Section | null>(null);
  readonly toast = signal('');
  readonly error = signal('');

  exp: ExperienceInput | null = null;
  expId: string | undefined;
  edu: EducationInput | null = null;
  eduId: string | undefined;
  sk: SkillInput | null = null;
  skId: string | undefined;
  tm: TestimonialInput | null = null;
  tmId: string | undefined;

  constructor() {
    afterNextRender(() => this.load());
    warnBeforeUnload(() => this.dirty());
  }

  private current(): unknown {
    const s = this.editing();
    return s === 'experience' ? this.exp : s === 'education' ? this.edu : s === 'skill' ? this.sk : s === 'testimonial' ? this.tm : null;
  }

  /** an open form holds changes */
  dirty(): boolean {
    return this.editing() !== null && snapshot(this.current()) !== this.editState;
  }

  async load(): Promise<void> {
    this.profile.set(await this.api.adminProfile());
  }

  startExperience(e?: Experience): void {
    this.expId = e?.id;
    this.exp = e
      ? { ...e, role: { ...e.role }, description: { ...e.description }, skills: [...e.skills] }
      : { company: '', companyUrl: null, role: { fr: '', en: '' }, description: { fr: '', en: '' }, location: null, contractType: 'CDI', startDate: '', endDate: null, skills: [], sortOrder: 0 };
    this.editing.set('experience');
    this.editState = snapshot(this.exp);
  }

  startEducation(e?: Education): void {
    this.eduId = e?.id;
    this.edu = e
      ? { ...e, degree: { ...e.degree } }
      : { school: '', schoolUrl: null, degree: { fr: '', en: '' }, location: null, startDate: '', endDate: null, sortOrder: 0 };
    this.editing.set('education');
    this.editState = snapshot(this.edu);
  }

  startSkill(s?: Skill): void {
    this.skId = s?.id;
    this.sk = s ? { name: s.name, category: s.category, level: s.level, sortOrder: s.sortOrder } : { name: '', category: 'TOOL', level: 3, sortOrder: 0 };
    this.editing.set('skill');
    this.editState = snapshot(this.sk);
  }

  startTestimonial(q?: Testimonial): void {
    this.tmId = q?.id;
    this.tm = q
      ? { author: q.author, url: q.url ?? null, role: { ...q.role }, quote: { ...q.quote }, sortOrder: q.sortOrder }
      : { author: '', url: null, role: { fr: '', en: '' }, quote: { fr: '', en: '' }, sortOrder: this.profile()?.testimonials.length ?? 0 };
    this.editing.set('testimonial');
    this.editState = snapshot(this.tm);
  }

  async saveTestimonial(): Promise<void> {
    if (!this.tm) return;
    await this.run(() => this.api.saveTestimonial({ ...this.tm!, url: this.tm!.url || null }, this.tmId));
  }

  moveTestimonial(m: SortMove): void {
    this.profile.update((pr) => (pr ? { ...pr, testimonials: moveItem(pr.testimonials, m.from, m.to) } : pr));
  }

  async saveExperience(): Promise<void> {
    if (!this.exp) return;
    await this.run(() => this.api.saveExperience({ ...this.exp!, endDate: this.exp!.endDate || null, companyUrl: this.exp!.companyUrl || null, location: this.exp!.location || null }, this.expId));
  }

  async saveEducation(): Promise<void> {
    if (!this.edu) return;
    await this.run(() => this.api.saveEducation({ ...this.edu!, endDate: this.edu!.endDate || null, schoolUrl: this.edu!.schoolUrl || null, location: this.edu!.location || null }, this.eduId));
  }

  async saveSkill(): Promise<void> {
    if (!this.sk) return;
    await this.run(() => this.api.saveSkill({ ...this.sk!, level: Number(this.sk!.level), sortOrder: Number(this.sk!.sortOrder) }, this.skId));
  }

  /** live reordering while dragging (the order is saved on drop) */
  move(section: 'experiences' | 'education', m: SortMove): void {
    this.profile.update((pr) => {
      if (!pr) return pr;
      return section === 'experiences'
        ? { ...pr, experiences: moveItem(pr.experiences, m.from, m.to) }
        : { ...pr, education: moveItem(pr.education, m.from, m.to) };
    });
  }

  moveSkill(category: string, m: SortMove): void {
    this.profile.update((pr) => {
      if (!pr) return pr;
      const groups = SKILL_CATEGORIES.map((key) => pr.skills.filter((s) => s.category === key));
      const i = SKILL_CATEGORIES.indexOf(category as (typeof SKILL_CATEGORIES)[number]);
      groups[i] = moveItem(groups[i], m.from, m.to);
      return { ...pr, skills: groups.flat() };
    });
  }

  async saveOrder(section: 'experiences' | 'education' | 'skills' | 'testimonials'): Promise<void> {
    const pr = this.profile();
    if (!pr) return;
    const ids = (section === 'skills' ? pr.skills : pr[section]).map((x) => x.id);
    try {
      await this.api.reorderProfile(section, ids);
      this.toast.set(this.i18n.t('admin.profile.orderSaved'));
      setTimeout(() => this.toast.set(''), 1500);
    } catch (e) {
      this.error.set(String(e));
    }
  }

  async deleteItem(section: Section, id: string): Promise<void> {
    const ok = await this.confirmDialog.ask({
      title: this.i18n.t('admin.profile.confirmDelete'),
      message: this.i18n.t('admin.common.irreversible'),
      confirm: this.i18n.t('admin.profile.delete'),
      danger: true,
    });
    if (!ok) return;
    await this.run(() =>
      section === 'experience'
        ? this.api.deleteExperience(id)
        : section === 'education'
          ? this.api.deleteEducation(id)
          : section === 'testimonial'
            ? this.api.deleteTestimonial(id)
            : this.api.deleteSkill(id),
    );
  }

  private async run(op: () => Promise<unknown>): Promise<void> {
    this.error.set('');
    try {
      await op();
      await this.load();
      this.editing.set(null);
      this.toast.set(this.i18n.t('admin.profile.saved'));
      setTimeout(() => this.toast.set(''), 1800);
    } catch (e) {
      this.error.set((e as { error?: { message?: string } }).error?.message ?? String(e));
    }
  }
}
