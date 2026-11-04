import { Injectable, signal } from '@angular/core';

export type CursorMode = 'default' | 'link' | 'label' | 'drag' | 'text' | 'hidden';

export interface MagnetTarget {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
}

/** Shared state between the custom cursor and the elements that shape it (links, magnets, drag areas). */
@Injectable({ providedIn: 'root' })
export class CursorService {
  readonly mode = signal<CursorMode>('default');
  readonly label = signal('');
  /** When set, the ring snaps around this rectangle instead of following the pointer. */
  magnet: MagnetTarget | null = null;

  set(mode: CursorMode, label = ''): void {
    this.mode.set(mode);
    this.label.set(label);
  }

  reset(): void {
    this.mode.set('default');
    this.label.set('');
  }
}
