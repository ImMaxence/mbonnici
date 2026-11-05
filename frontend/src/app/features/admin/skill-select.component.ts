import { Component, ElementRef, computed, input, model, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Skill } from '../../core/api/models';
import { SKILL_CATEGORIES } from '../../core/api/models';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';
import { SortMove, SortableDirective, moveItem } from '../../shared/ui/sortable.directive';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';

interface Option {
  /** id of the <li>, for aria-activedescendant */
  id: string;
  name: string;
  /** null for "add what I typed" */
  category: string | null;
  /** first option of its category: shows the group name above it */
  groupStart: boolean;
}

let nextId = 0;

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/**
 * Multi-select over the skills entered on the Profile page: type to filter, arrows and Enter to pick,
 * Backspace on the empty field removes the last one, chips can be dragged to reorder (the order is
 * the one shown on the site). Something that is not a skill yet can still be added as typed; it is
 * marked so it can be added to the profile later.
 */
@Component({
  selector: 'app-skill-select',
  imports: [FormsModule, TranslatePipe, IconComponent, SortableDirective, TooltipDirective],
  template: `
    <div class="box" [class.open]="open()" (click)="focusInput($event)">
      <div class="chips" appSortable (sortMove)="move($event)">
        @for (v of value(); track v; let i = $index) {
          <span class="pick" data-sort-item [class.custom]="!known().has(norm(v))">
            <span class="name" data-sort-handle tabindex="0" [attr.aria-label]="v + ' — ' + ('admin.skillSelect.reorder' | t)" [appTip]="known().has(norm(v)) ? '' : ('admin.skillSelect.notInProfile' | t)" [tipLabel]="false">{{ v }}</span>
            <button type="button" class="remove" (click)="remove(i)" [attr.aria-label]="('admin.skillSelect.remove' | t) + ' ' + v"><app-icon name="close" [size]="11" /></button>
          </span>
        }
      </div>
      <input
        #field
        class="query"
        [id]="inputId()"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="open() && options()[active()] ? options()[active()].id : null"
        [placeholder]="value().length ? '' : ('admin.skillSelect.placeholder' | t)"
        [ngModel]="query()"
        (ngModelChange)="query.set($event); active.set(0); open.set(true)"
        [ngModelOptions]="{ standalone: true }"
        (focus)="open.set(true)"
        (blur)="close()"
        (keydown)="key($event)"
      />
    </div>
    @if (open() && options().length) {
      <ul class="list" role="listbox" [id]="listId" [attr.aria-label]="'admin.skillSelect.options' | t">
        @for (o of options(); track o.id; let i = $index) {
          @if (o.groupStart) {
            <li class="group" role="presentation">{{ 'about.skillCategories.' + o.category | t }}</li>
          }
          <li
            class="option"
            role="option"
            [id]="o.id"
            [attr.aria-selected]="i === active()"
            [class.active]="i === active()"
            (pointerdown)="$event.preventDefault()"
            (click)="pick(o)"
            (pointerenter)="active.set(i)"
          >
            @if (o.category == null) {
              <app-icon name="plus" [size]="13" /> {{ 'admin.skillSelect.add' | t: { name: o.name } }}
            } @else {
              {{ o.name }}
            }
          </li>
        }
      </ul>
    } @else if (open() && !skills().length) {
      <p class="list empty small faint">{{ 'admin.skillSelect.noSkills' | t }}</p>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
    }
    .box {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.35rem;
      min-height: 46px;
      padding: 0.4rem 0.5rem;
      border-radius: 10px;
      border: 1px solid var(--line-strong);
      background: var(--bg);
      cursor: text;
      transition: border-color var(--dur-1), box-shadow var(--dur-1);
    }
    .box:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
    .chips {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      max-width: 100%;
    }
    .chips:empty {
      display: none;
    }
    .pick {
      display: inline-flex;
      align-items: center;
      gap: 0.1rem;
      padding: 0 0.15rem 0 0.6rem;
      min-height: 30px;
      border-radius: 8px;
      background: var(--bg-3);
      border: 1px solid var(--line);
      font-size: 0.84rem;
    }
    .pick.custom {
      border-style: dashed;
      border-color: var(--line-strong);
    }
    .name {
      cursor: grab;
      outline-offset: 2px;
    }
    .remove {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      color: var(--fg-3);
    }
    .remove:hover {
      color: var(--fg);
      background: var(--bg-2);
    }
    .query {
      flex: 1 1 8rem;
      min-width: 8rem;
      min-height: 30px;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--fg);
      font: inherit;
      font-size: 0.92rem;
      padding: 0 0.3rem;
    }
    .list {
      position: absolute;
      z-index: 30;
      left: 0;
      right: 0;
      top: calc(100% + 6px);
      max-height: 280px;
      overflow: auto;
      margin: 0;
      padding: 0.35rem;
      list-style: none;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: var(--bg-2);
      box-shadow: var(--shadow-3);
    }
    .list.empty {
      padding: 0.8rem 0.9rem;
    }
    .group {
      padding: 0.55rem 0.6rem 0.25rem;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--fg-3);
    }
    .option {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 0.6rem;
      border-radius: 8px;
      font-size: 0.88rem;
      cursor: pointer;
    }
    .option.active {
      background: var(--bg-3);
      color: var(--fg);
    }
  `,
})
export class SkillSelectComponent {
  /** the chosen names, in display order */
  readonly value = model<string[]>([]);
  /** the profile's skills, offered in the list */
  readonly skills = input<Skill[]>([]);
  readonly inputId = input('skill-select-' + nextId);

  readonly listId = 'skill-list-' + nextId++;
  readonly query = signal('');
  readonly open = signal(false);
  readonly active = signal(0);
  readonly norm = norm;

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  /** normalised names of the profile's skills */
  readonly known = computed(() => new Set(this.skills().map((s) => norm(s.name))));

  readonly options = computed<Option[]>(() => {
    const q = norm(this.query());
    const chosen = new Set(this.value().map(norm));
    const out: Option[] = [];
    for (const cat of SKILL_CATEGORIES) {
      const matches = this.skills().filter((s) => s.category === cat && !chosen.has(norm(s.name)) && (!q || norm(s.name).includes(q)));
      // exact and prefix matches first, then the profile's order
      matches.sort((a, b) => rank(a.name, q) - rank(b.name, q));
      matches.forEach((s, i) => out.push({ id: `${this.listId}-${s.id}`, name: s.name, category: cat, groupStart: i === 0 }));
    }
    const typed = this.query().trim();
    if (typed && !chosen.has(q) && !this.known().has(q)) {
      out.push({ id: `${this.listId}-add`, name: typed, category: null, groupStart: false });
    }
    return out;
  });

  focusInput(e: MouseEvent): void {
    if ((e.target as HTMLElement).closest('.pick')) return;
    this.field().nativeElement.focus();
  }

  key(e: KeyboardEvent): void {
    const opts = this.options();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.open.set(true);
        this.active.set(Math.min(opts.length - 1, this.active() + 1));
        this.scrollActive();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.active.set(Math.max(0, this.active() - 1));
        this.scrollActive();
        break;
      case 'Enter':
      case ',':
        if (this.open() && opts[this.active()]) {
          e.preventDefault();
          this.pick(opts[this.active()]);
        } else if (this.query().trim()) {
          e.preventDefault();
          this.add(this.query());
        }
        break;
      case 'Backspace':
        if (!this.query() && this.value().length) this.remove(this.value().length - 1);
        break;
      case 'Escape':
        if (this.open()) {
          e.preventDefault();
          e.stopPropagation();
          this.open.set(false);
        }
        break;
    }
  }

  pick(o: Option): void {
    this.add(o.name);
  }

  remove(i: number): void {
    this.value.update((v) => v.filter((_, j) => j !== i));
  }

  move(m: SortMove): void {
    this.value.update((v) => moveItem(v, m.from, m.to));
  }

  close(): void {
    // keep what was typed: leaving the field adds it, like a comma would
    if (this.query().trim()) this.add(this.query());
    this.open.set(false);
  }

  private add(name: string): void {
    const n = name.trim().replace(/,+$/, '');
    if (!n) return;
    // use the profile's spelling when it is a known skill
    const canonical = this.skills().find((s) => norm(s.name) === norm(n))?.name ?? n;
    if (!this.value().some((v) => norm(v) === norm(canonical))) this.value.update((v) => [...v, canonical]);
    this.query.set('');
    this.active.set(0);
  }

  private scrollActive(): void {
    setTimeout(() => {
      const o = this.options()[this.active()];
      if (o) document.getElementById(o.id)?.scrollIntoView({ block: 'nearest' });
    });
  }
}

/** 0 = exact, 1 = starts with, 2 = contains */
function rank(name: string, q: string): number {
  if (!q) return 0;
  const n = norm(name);
  return n === q ? 0 : n.startsWith(q) ? 1 : 2;
}
