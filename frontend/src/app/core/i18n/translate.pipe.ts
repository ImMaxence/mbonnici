import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

/** `{{ 'nav.home' | t }}` — impure so templates re-render when the language signal changes. */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}

/** `{{ project.title | l }}` — picks the current language from a {fr, en} pair. */
@Pipe({ name: 'l', pure: false })
export class LocalizedPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(text: { fr: string; en: string } | null | undefined): string {
    return this.i18n.l(text);
  }
}
