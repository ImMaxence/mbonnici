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
} from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { Lang } from '../../core/i18n/routes';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { SortMove, SortableDirective, moveItem } from '../../shared/ui/sortable.directive';

type Section = 'experience' | 'education' | 'skill';

@Component({
  selector: 'app-admin-profile',
  imports: [FormsModule, TranslatePipe, LocalizedPipe, IconComponent, TooltipDirective, SortableDirective],
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
          <div><strong>{{ e.role | l }}</strong><span class="muted"> · {{ e.company }}</span></div>
          <div class="row" style="gap:.4rem">
            <button type="button" class="icon-btn" (click)="startExperience(e)" [appTip]="'admin.projects.edit' | t"><app-icon name="edit" [size]="15" /></button>
            <button type="button" class="icon-btn danger" (click)="deleteItem('experience', e.id)" [appTip]="'admin.profile.delete' | t"><app-icon name="trash" [size]="15" /></button>
          </div>
        </div>
      }
      </div>
      @if (editing() === 'experience' && exp) {
        <form class="form-grid cols-2 editor" (ngSubmit)="saveExperience()">
          <div class="field"><label>{{ 'admin.profile.company' | t }}</label><input class="input" name="company" [(ngModel)]="exp.company" required /></div>
          <div class="field"><label>{{ 'admin.profile.companyUrl' | t }}</label><input class="input" name="companyUrl" [(ngModel)]="exp.companyUrl" /></div>
          <div class="field"><label>{{ 'admin.profile.role' | t }} ({{ lang() }})</label><input class="input" name="role" [(ngModel)]="exp.role[lang()]" required /></div>
          <div class="field"><label>{{ 'admin.profile.location' | t }}</label><input class="input" name="location" [(ngModel)]="exp.location" /></div>
          <div class="field span-2"><label>{{ 'admin.profile.description' | t }} ({{ lang() }})</label><textarea class="textarea" name="description" rows="4" [(ngModel)]="exp.description[lang()]"></textarea></div>
          <div class="field">
            <label>{{ 'admin.profile.contract' | t }}</label>
            <select class="select" name="contractType" [(ngModel)]="exp.contractType">
              @for (c of contracts; track c) {
                <option [value]="c">{{ 'about.contract.' + c | t }}</option>
              }
            </select>
          </div>
          <div class="field"><label>{{ 'admin.profile.order' | t }}</label><input class="input" type="number" name="sortOrder" [(ngModel)]="exp.sortOrder" /></div>
          <div class="field"><label>{{ 'admin.profile.start' | t }}</label><input class="input" type="date" name="startDate" [(ngModel)]="exp.startDate" required /></div>
          <div class="field"><label>{{ 'admin.profile.end' | t }}</label><input class="input" type="date" name="endDate" [(ngModel)]="exp.endDate" /></div>
          <div class="field span-2"><label>{{ 'admin.profile.skillsList' | t }}</label><input class="input" name="skills" [ngModel]="exp.skills.join(', ')" (ngModelChange)="exp.skills = split($event)" /></div>
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
          <div><strong>{{ e.degree | l }}</strong><span class="muted"> · {{ e.school }}</span></div>
          <div class="row" style="gap:.4rem">
            <button type="button" class="icon-btn" (click)="startEducation(e)" [appTip]="'admin.projects.edit' | t"><app-icon name="edit" [size]="15" /></button>
            <button type="button" class="icon-btn danger" (click)="deleteItem('education', e.id)" [appTip]="'admin.profile.delete' | t"><app-icon name="trash" [size]="15" /></button>
          </div>
        </div>
      }
      </div>
      @if (editing() === 'education' && edu) {
        <form class="form-grid cols-2 editor" (ngSubmit)="saveEducation()">
          <div class="field"><label>{{ 'admin.profile.school' | t }}</label><input class="input" name="school" [(ngModel)]="edu.school" required /></div>
          <div class="field"><label>{{ 'admin.profile.schoolUrl' | t }}</label><input class="input" name="schoolUrl" [(ngModel)]="edu.schoolUrl" /></div>
          <div class="field"><label>{{ 'admin.profile.degree' | t }} ({{ lang() }})</label><input class="input" name="degree" [(ngModel)]="edu.degree[lang()]" required /></div>
          <div class="field"><label>{{ 'admin.profile.location' | t }}</label><input class="input" name="location" [(ngModel)]="edu.location" /></div>
          <div class="field"><label>{{ 'admin.profile.start' | t }}</label><input class="input" type="date" name="startDate" [(ngModel)]="edu.startDate" required /></div>
          <div class="field"><label>{{ 'admin.profile.end' | t }}</label><input class="input" type="date" name="endDate" [(ngModel)]="edu.endDate" /></div>
          <div class="field"><label>{{ 'admin.profile.order' | t }}</label><input class="input" type="number" name="sortOrder" [(ngModel)]="edu.sortOrder" /></div>
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
          <div class="field"><label>{{ 'admin.profile.name' | t }}</label><input class="input" name="name" [(ngModel)]="sk.name" required /></div>
          <div class="field">
            <label>{{ 'admin.profile.category' | t }}</label>
            <select class="select" name="category" [(ngModel)]="sk.category">
              @for (c of skillCategories; track c) {
                <option [value]="c">{{ 'about.skillCategories.' + c | t }}</option>
              }
            </select>
          </div>
          <div class="field"><label>{{ 'admin.profile.level' | t }}</label><input class="input" type="number" min="1" max="5" name="level" [(ngModel)]="sk.level" /></div>
          <div class="field"><label>{{ 'admin.profile.order' | t }}</label><input class="input" type="number" name="sortOrder" [(ngModel)]="sk.sortOrder" /></div>
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
  `,
  styles: `
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
    .skill-chip.is-dragging,
    [data-sort-item].is-dragging {
      opacity: 0.55;
      box-shadow: var(--shadow-2);
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
export class AdminProfilePage {
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

  constructor() {
    afterNextRender(() => this.load());
  }

  async load(): Promise<void> {
    this.profile.set(await this.api.adminProfile());
  }

  split(v: string): string[] {
    return v.split(',').map((s) => s.trim()).filter(Boolean);
  }

  startExperience(e?: Experience): void {
    this.expId = e?.id;
    this.exp = e
      ? { ...e, role: { ...e.role }, description: { ...e.description }, skills: [...e.skills] }
      : { company: '', companyUrl: null, role: { fr: '', en: '' }, description: { fr: '', en: '' }, location: null, contractType: 'CDI', startDate: '', endDate: null, skills: [], sortOrder: 0 };
    this.editing.set('experience');
  }

  startEducation(e?: Education): void {
    this.eduId = e?.id;
    this.edu = e
      ? { ...e, degree: { ...e.degree } }
      : { school: '', schoolUrl: null, degree: { fr: '', en: '' }, location: null, startDate: '', endDate: null, sortOrder: 0 };
    this.editing.set('education');
  }

  startSkill(s?: Skill): void {
    this.skId = s?.id;
    this.sk = s ? { name: s.name, category: s.category, level: s.level, sortOrder: s.sortOrder } : { name: '', category: 'TOOL', level: 3, sortOrder: 0 };
    this.editing.set('skill');
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

  async saveOrder(section: 'experiences' | 'education' | 'skills'): Promise<void> {
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
      section === 'experience' ? this.api.deleteExperience(id) : section === 'education' ? this.api.deleteEducation(id) : this.api.deleteSkill(id),
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
