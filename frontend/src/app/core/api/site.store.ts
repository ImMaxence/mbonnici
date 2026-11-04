import { Injectable, signal } from '@angular/core';
import type { Settings } from './models';

/** Last site settings resolved by a page, for the shell (header avatar) which has no resolver. */
@Injectable({ providedIn: 'root' })
export class SiteStore {
  readonly settings = signal<Settings | null>(null);
}
