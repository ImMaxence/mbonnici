import { Directive, ElementRef, inject, output } from '@angular/core';

export interface SortMove {
  from: number;
  to: number;
}

/**
 * Drag-to-reorder for back-office lists and grids, with pointer (mouse, touch, pen) and keyboard.
 *
 *   <div appSortable (sortMove)="move($event)" (sortDrop)="save()">
 *     @for (x of list(); track x.id) {
 *       <div data-sort-item> <button data-sort-handle>⋮⋮</button> … </div>
 *     }
 *   </div>
 *
 * The component owns the array: `sortMove` asks it to move one item (it re-renders, the dragged
 * element follows the pointer), `sortDrop` says the gesture is over (persist the order). Works for
 * vertical lists and wrapped grids alike (the target is the item under the pointer). On a focused
 * handle, ArrowUp / ArrowLeft and ArrowDown / ArrowRight move the item by one.
 */
@Directive({
  selector: '[appSortable]',
  host: {
    '(pointerdown)': 'down($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'up()',
    '(pointercancel)': 'up()',
    '(keydown)': 'key($event)',
  },
})
export class SortableDirective {
  readonly sortMove = output<SortMove>();
  readonly sortDrop = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private index: number | null = null;
  private dragged: HTMLElement | null = null;

  private items(): HTMLElement[] {
    // items of this list only (a sortable can contain other sortables, e.g. skill groups)
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[data-sort-item]')).filter(
      (el) => el.parentElement?.closest('[appsortable]') === this.host.nativeElement,
    );
  }

  down(e: PointerEvent): void {
    const handle = (e.target as HTMLElement).closest('[data-sort-handle]');
    if (!handle || !this.host.nativeElement.contains(handle) || e.button !== 0) return;
    const item = handle.closest<HTMLElement>('[data-sort-item]');
    const index = item ? this.items().indexOf(item) : -1;
    if (index < 0) return;
    e.preventDefault();
    this.index = index;
    this.dragged = item;
    item!.classList.add('is-dragging');
    this.host.nativeElement.classList.add('is-sorting');
    this.host.nativeElement.setPointerCapture(e.pointerId);
  }

  move(e: PointerEvent): void {
    if (this.index === null) return;
    const items = this.items();
    let over = items.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    });
    if (over < 0) {
      // between rows: the nearest item centre
      let best = Infinity;
      items.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
        if (d < best) {
          best = d;
          over = i;
        }
      });
    }
    if (over >= 0 && over !== this.index) {
      this.sortMove.emit({ from: this.index, to: over });
      this.index = over;
    }
  }

  up(): void {
    if (this.index === null) return;
    this.index = null;
    this.dragged?.classList.remove('is-dragging');
    this.dragged = null;
    // the element may have been re-created: clear any leftover state
    this.items().forEach((el) => el.classList.remove('is-dragging'));
    this.host.nativeElement.classList.remove('is-sorting');
    this.sortDrop.emit();
  }

  key(e: KeyboardEvent): void {
    const handle = (e.target as HTMLElement).closest('[data-sort-handle]');
    if (!handle) return;
    const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
    const fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight';
    if (!back && !fwd) return;
    const items = this.items();
    const from = items.indexOf(handle.closest<HTMLElement>('[data-sort-item]')!);
    const to = from + (back ? -1 : 1);
    if (from < 0 || to < 0 || to >= items.length) return;
    e.preventDefault();
    this.sortMove.emit({ from, to });
    this.sortDrop.emit();
    // keep the focus on the moved item's handle once it re-renders
    setTimeout(() => this.items()[to]?.querySelector<HTMLElement>('[data-sort-handle]')?.focus());
  }
}

/** Moves one element of an array (immutable). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
