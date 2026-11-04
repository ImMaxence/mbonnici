import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { I18nService } from './i18n.service';
import type { Lang } from './routes';

/** Sets the active language before any child of /fr or /en renders (server and client). */
export function langGuard(lang: Lang): CanActivateFn {
  return () => {
    inject(I18nService).setLang(lang);
    return true;
  };
}
