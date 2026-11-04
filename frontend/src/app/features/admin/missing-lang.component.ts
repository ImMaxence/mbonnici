import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Localized } from '../../core/api/models';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';

type Lang = 'fr' | 'en';

/** How many texts are written in the other language but still empty in this one. */
export function missingIn(lang: Lang, fields: readonly (Localized | null | undefined)[]): number {
  const other: Lang = lang === 'fr' ? 'en' : 'fr';
  return fields.filter((f) => !!f && !!f[other]?.trim() && !f[lang]?.trim()).length;
}

/** "EN 3": texts to translate, shown next to a project, a note or a profile entry. */
@Component({
  selector: 'app-missing-lang',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, TooltipDirective],
  template: `
    @for (m of missing(); track m.lang) {
      <span class="miss" [appTip]="(m.count === 1 ? 'admin.translate.one' : 'admin.translate.many') | t: { n: m.count, lang: m.lang.toUpperCase() }">
        {{ m.lang.toUpperCase() }} <b>{{ m.count }}</b>
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      gap: 4px;
    }
    .miss {
      display: inline-flex;
      align-items: center;
      gap: 0.3em;
      height: 20px;
      padding: 0 7px;
      border-radius: 99px;
      border: 1px dashed color-mix(in srgb, #d97706 70%, transparent);
      color: #b45309;
      font: 600 10px/1 var(--font-mono);
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .miss b {
      font-weight: 700;
    }
  `,
})
export class MissingLangComponent {
  readonly fields = input<readonly (Localized | null | undefined)[]>([]);
  readonly missing = computed(() =>
    (['fr', 'en'] as const).map((lang) => ({ lang, count: missingIn(lang, this.fields()) })).filter((m) => m.count > 0),
  );
}
