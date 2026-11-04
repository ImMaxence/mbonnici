import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';
import { MotionService } from '../../core/motion/motion.service';
import { Spring2 } from '../../core/motion/physics';
import { RafService } from '../../core/motion/raf.service';
import { CursorService } from './cursor.service';

/**
 * Pulls the element towards the pointer while hovered and lets the cursor ring snap around it.
 * `<button appMagnetic [magneticStrength]="0.4">` — pure spring physics, no library.
 */
@Directive({
  selector: '[appMagnetic]',
  host: { '[style.will-change]': '"transform"' },
})
export class MagneticDirective {
  readonly magneticStrength = input(0.35);
  readonly magneticRadius = input(14);
  readonly magneticSnap = input(true);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly raf = inject(RafService);
  private readonly cursor = inject(CursorService);
  private readonly motion = inject(MotionService);
  private readonly spring = new Spring2(140, 18);
  private stop: (() => void) | null = null;
  private hovering = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (!this.motion.finePointer() || this.motion.reduced()) return;
      const el = this.el.nativeElement;
      const onEnter = (): void => {
        this.hovering = true;
        this.ensureLoop();
        if (this.magneticSnap()) this.snap();
      };
      const onMove = (e: PointerEvent): void => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const k = this.magneticStrength();
        this.spring.setTarget(dx * k, dy * k);
        if (this.magneticSnap()) this.snap(dx * k * 0.6, dy * k * 0.6);
      };
      const onLeave = (): void => {
        this.hovering = false;
        this.spring.setTarget(0, 0);
        if (this.cursor.magnet) this.cursor.magnet = null;
      };
      el.addEventListener('pointerenter', onEnter);
      el.addEventListener('pointermove', onMove, { passive: true });
      el.addEventListener('pointerleave', onLeave);
      destroyRef.onDestroy(() => {
        el.removeEventListener('pointerenter', onEnter);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
        this.stop?.();
        if (this.cursor.magnet) this.cursor.magnet = null;
      });
    });
  }

  private snap(offsetX = 0, offsetY = 0): void {
    const r = this.el.nativeElement.getBoundingClientRect();
    this.cursor.magnet = {
      x: r.left + r.width / 2 + offsetX,
      y: r.top + r.height / 2 + offsetY,
      w: r.width + 16,
      h: r.height + 16,
      radius: this.magneticRadius() + 8,
    };
  }

  private ensureLoop(): void {
    if (this.stop) return;
    const el = this.el.nativeElement;
    this.stop = this.raf.add((dt) => {
      this.spring.update(dt);
      el.style.transform = `translate3d(${this.spring.x.value.toFixed(2)}px, ${this.spring.y.value.toFixed(2)}px, 0)`;
      if (!this.hovering && this.spring.settled()) {
        el.style.transform = '';
        this.stop?.();
        this.stop = null;
      }
    });
  }
}
