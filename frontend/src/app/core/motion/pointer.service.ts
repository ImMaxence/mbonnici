import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RafService } from './raf.service';
import { damp } from './physics';

/**
 * Global pointer state read by scenes, the cursor and parallax. Plain mutable numbers on purpose:
 * these values change every frame and must not trigger change detection.
 */
@Injectable({ providedIn: 'root' })
export class PointerService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly raf = inject(RafService);

  /** raw position in CSS px */
  x = -1000;
  y = -1000;
  /** smoothed position */
  sx = -1000;
  sy = -1000;
  /** normalised -1 … 1 relative to the viewport centre (smoothed) */
  nx = 0;
  ny = 0;
  /** px per second */
  vx = 0;
  vy = 0;
  /** true after the first move, false when the pointer leaves the window */
  active = false;
  down = false;

  private started = false;
  private lastX = 0;
  private lastY = 0;
  private lastT = 0;
  private stop: (() => void) | null = null;

  start(): void {
    if (!this.browser || this.started) {
      return;
    }
    this.started = true;
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerdown', () => (this.down = true), { passive: true });
    window.addEventListener('pointerup', () => (this.down = false), { passive: true });
    window.addEventListener('blur', () => (this.down = false));
    document.documentElement.addEventListener('pointerleave', () => (this.active = false));
    this.stop = this.raf.add((dt) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.sx = damp(this.sx, this.x, 14, dt);
      this.sy = damp(this.sy, this.y, 14, dt);
      const tx = this.active ? (this.x / w) * 2 - 1 : 0;
      const ty = this.active ? (this.y / h) * 2 - 1 : 0;
      this.nx = damp(this.nx, tx, 6, dt);
      this.ny = damp(this.ny, ty, 6, dt);
      // decay velocity when no move events arrive
      this.vx = damp(this.vx, 0, 8, dt);
      this.vy = damp(this.vy, 0, 8, dt);
    });
  }

  destroy(): void {
    window.removeEventListener('pointermove', this.onMove);
    this.stop?.();
    this.started = false;
  }

  private readonly onMove = (e: PointerEvent): void => {
    const now = performance.now();
    if (!this.active) {
      // first contact: snap smoothed values so the cursor does not fly in from a corner
      this.sx = e.clientX;
      this.sy = e.clientY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.lastT = now;
    }
    this.active = true;
    this.x = e.clientX;
    this.y = e.clientY;
    const dt = Math.max(1, now - this.lastT) / 1000;
    this.vx = (e.clientX - this.lastX) / dt;
    this.vy = (e.clientY - this.lastY) / dt;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.lastT = now;
  };
}
