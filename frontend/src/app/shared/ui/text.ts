import { Pipe, PipeTransform } from '@angular/core';

/**
 * House style: copy on the site never ends with a full stop (legal pages excepted). Applied to
 * content typed in the back office too, so the rule holds whatever gets written there.
 * Ellipses ("…", "...") and abbreviations inside the text are left alone.
 */
export function stripDot(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/(?<!\.)\.(\s*)$/, '$1').trimEnd();
}

@Pipe({ name: 'noDot' })
export class NoDotPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return stripDot(value);
  }
}
