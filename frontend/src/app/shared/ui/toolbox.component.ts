import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SKILL_CATEGORIES, type Skill, type SkillCategory } from '../../core/api/models';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { RevealDirective } from './reveal.directive';

/**
 * Skills grouped by what they are for, one row per family (back office → Profil → Compétences).
 * No self-rated bars: level 5 only marks the everyday tools; the order is the back-office order.
 */
@Component({
  selector: 'app-toolbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RevealDirective],
  template: `
    <dl class="toolbox">
      @for (g of groups(); track g.key; let i = $index) {
        <div class="group" appReveal [revealDelay]="i * 50">
          <dt>
            <span class="mono n">{{ (i + 1).toString().padStart(2, '0') }}</span>
            <span class="name">{{ 'about.skillCategories.' + g.key | t }}</span>
          </dt>
          <dd>
            <ul>
              @for (s of g.items; track s.id) {
                <li [class.daily]="s.level >= 5">{{ s.name }}</li>
              }
            </ul>
          </dd>
        </div>
      }
    </dl>
    @if (hasDaily()) {
      <p class="legend small faint"><i aria-hidden="true"></i>{{ 'about.daily' | t }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .toolbox {
      border-top: 1px solid var(--line);
    }
    .group {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-5) 0;
      border-bottom: 1px solid var(--line);
    }
    @media (min-width: 900px) {
      .group {
        grid-template-columns: minmax(180px, 3fr) 9fr;
        align-items: baseline;
      }
    }
    dt {
      display: flex;
      gap: 0.8rem;
      align-items: baseline;
    }
    .n {
      font-size: var(--fs-micro);
      color: var(--fg-3);
    }
    .name {
      font-weight: 600;
    }
    ul {
      display: flex;
      flex-wrap: wrap;
      gap: 0.2em 0;
    }
    li {
      font-family: var(--font-display);
      font-size: clamp(1.25rem, 0.9rem + 1.4vw, 2.1rem);
      font-weight: var(--weight-display);
      letter-spacing: -0.035em;
      line-height: 1.2;
      color: var(--fg-2);
      transition: color var(--dur-1);
    }
    li:not(:last-child)::after {
      content: '/';
      margin: 0 0.45em;
      color: var(--line-strong);
      font-weight: 300;
    }
    li:hover {
      color: var(--fg);
    }
    li.daily {
      color: var(--fg);
    }
    li.daily::before {
      content: '';
      display: inline-block;
      width: 0.28em;
      height: 0.28em;
      margin-right: 0.3em;
      border-radius: 50%;
      background: var(--accent);
      vertical-align: 0.55em;
    }
    .legend {
      display: flex;
      align-items: center;
      gap: 0.6em;
      margin-top: var(--space-4);
    }
    .legend i {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
    }
  `,
})
export class ToolboxComponent {
  readonly skills = input<Skill[]>([]);

  readonly groups = computed(() => {
    const map = new Map<SkillCategory, Skill[]>();
    for (const s of this.skills()) map.set(s.category, [...(map.get(s.category) ?? []), s]);
    return SKILL_CATEGORIES.filter((k) => map.has(k)).map((key) => ({ key, items: map.get(key)! }));
  });
  readonly hasDaily = computed(() => this.skills().some((s) => s.level >= 5));
}
