import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';
import { CursorMode, CursorService } from './cursor.service';

/**
 * Shapes the custom cursor while hovering the host:
 * `<a appCursor="label" cursorLabel="View">` turns the ring into a pill with text.
 */
@Directive({
  selector: '[appCursor]',
  host: { 'data-cursor': '' },
})
export class CursorDirective {
  readonly appCursor = input<CursorMode | ''>('');
  readonly cursorLabel = input('');

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cursor = inject(CursorService);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.el.nativeElement;
      const enter = (): void => this.cursor.set(this.appCursor() || 'link', this.cursorLabel());
      const leave = (): void => this.cursor.reset();
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
      destroyRef.onDestroy(() => {
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('pointerleave', leave);
        if (this.cursor.mode() !== 'default') this.cursor.reset();
      });
    });
  }
}
