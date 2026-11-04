import { DestroyRef, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { CanDeactivateFn } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { ConfirmService } from '../../shared/ui/confirm.service';

/** A back-office page with a form that can hold changes not saved yet. */
export interface HasUnsavedChanges {
  dirty(): boolean;
}

/** Leaving a page with unsaved changes asks first (a real dialog, focus on "Stay"). */
export const unsavedGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component?.dirty?.()) return true;
  const i18n = inject(I18nService);
  return inject(ConfirmService).ask({
    title: i18n.t('admin.unsaved.title'),
    message: i18n.t('admin.unsaved.message'),
    confirm: i18n.t('admin.unsaved.leave'),
    cancel: i18n.t('admin.unsaved.stay'),
    danger: true,
  });
};

/** Closing or reloading the tab with unsaved changes: the browser's own warning. */
export function warnBeforeUnload(dirty: () => boolean): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
  const handler = (e: BeforeUnloadEvent) => {
    if (dirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  addEventListener('beforeunload', handler);
  inject(DestroyRef).onDestroy(() => removeEventListener('beforeunload', handler));
}

/**
 * Stable JSON of a form model, to compare it with the last saved state. An emptied field and a
 * field that was never filled are the same ("" vs null), and numbers typed in inputs equal numbers.
 */
export function snapshot(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (v === undefined || v === '' ? null : typeof v === 'number' ? String(v) : v));
}
