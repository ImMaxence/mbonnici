import { Directive, ElementRef, Injector, afterNextRender, inject, output } from '@angular/core';

export interface SortMove {
  from: number;
  to: number;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const EASE = 'cubic-bezier(0.2, 0.75, 0.25, 1)';

/**
 * Drag-to-reorder for back-office lists and grids, with pointer (mouse, touch, pen) and keyboard.
 *
 *   <div appSortable (sortMove)="move($event)" (sortDrop)="save()">
 *     @for (x of list(); track x.id) {
 *       <div data-sort-item> <button data-sort-handle>⋮⋮</button> … </div>
 *     }
 *   </div>
 *
 * The component owns the array: `sortMove` asks it to move one item, `sortDrop` says the gesture is
 * over (persist the order). The picked item is lifted and follows the pointer; the others glide to
 * their new place (FLIP with the Web Animations API) and the item settles into its slot on drop.
 * Works for vertical lists and wrapped grids alike. On a focused handle, ArrowUp / ArrowLeft and
 * ArrowDown / ArrowRight move the item by one. No animation with reduced motion.
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
  private readonly injector = inject(Injector);
  private index: number | null = null;
  private dragged: HTMLElement | null = null;
  /** pointer position inside the item when it was picked up */
  private grab = { x: 0, y: 0 };
  private pointer = { x: 0, y: 0 };
  /** translation currently applied to the dragged item */
  private offset = { x: 0, y: 0 };
  /** the item just swapped with: ignored until the pointer enters another item (no ping-pong) */
  private cooldown: HTMLElement | null = null;

  private items(): HTMLElement[] {
    // items of this list only (a sortable can contain other sortables, e.g. skill groups)
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[data-sort-item]')).filter(
      (el) => el.parentElement?.closest('[appsortable]') === this.host.nativeElement,
    );
  }

  private get reduced(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  down(e: PointerEvent): void {
    const handle = (e.target as HTMLElement).closest('[data-sort-handle]');
    if (!handle || !this.host.nativeElement.contains(handle) || e.button !== 0) return;
    const item = handle.closest<HTMLElement>('[data-sort-item]');
    const index = item ? this.items().indexOf(item) : -1;
    if (!item || index < 0) return;
    e.preventDefault();
    item.getAnimations().forEach((a) => a.cancel());
    const box = layoutBox(item);
    this.index = index;
    this.dragged = item;
    this.cooldown = null;
    this.grab = { x: e.clientX - box.left, y: e.clientY - box.top };
    this.pointer = { x: e.clientX, y: e.clientY };
    this.offset = { x: 0, y: 0 };
    item.classList.add('is-dragging');
    this.host.nativeElement.classList.add('is-sorting');
    this.host.nativeElement.setPointerCapture(e.pointerId);
  }

  move(e: PointerEvent): void {
    if (this.index === null || !this.dragged) return;
    this.pointer = { x: e.clientX, y: e.clientY };
    this.follow();

    const items = this.items();
    const boxes = items.map(layoutBox);
    const inside = (b: Box) =>
      e.clientX >= b.left && e.clientX <= b.left + b.width && e.clientY >= b.top && e.clientY <= b.top + b.height;
    const hit = boxes.findIndex(inside);
    if (hit >= 0 && items[hit] !== this.cooldown) this.cooldown = null;
    let over = hit;
    if (over < 0) {
      // between rows: the nearest item centre (the dragged item's own slot included)
      let best = Infinity;
      boxes.forEach((b, i) => {
        const d = Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2));
        if (d < best) {
          best = d;
          over = i;
        }
      });
    }
    if (over >= 0 && over !== this.index && items[over] !== this.cooldown) {
      this.cooldown = items[over];
      this.reorder(this.index, over);
      this.index = over;
    }
  }

  up(): void {
    if (this.index === null) return;
    this.index = null;
    const el = this.dragged;
    this.dragged = null;
    this.cooldown = null;
    if (el) {
      const { x, y } = this.offset;
      el.style.transform = '';
      el.classList.remove('is-dragging');
      if (!this.reduced && (Math.abs(x) > 0.5 || Math.abs(y) > 0.5)) {
        el.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }], { duration: 240, easing: EASE });
      }
    }
    this.offset = { x: 0, y: 0 };
    this.host.nativeElement.classList.remove('is-sorting');
    this.sortDrop.emit();
  }

  key(e: KeyboardEvent): void {
    const handle = (e.target as HTMLElement).closest('[data-sort-handle]');
    if (!handle || this.index !== null) return;
    const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
    const fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight';
    if (!back && !fwd) return;
    const items = this.items();
    const from = items.indexOf(handle.closest<HTMLElement>('[data-sort-item]')!);
    const to = from + (back ? -1 : 1);
    if (from < 0 || to < 0 || to >= items.length) return;
    e.preventDefault();
    this.reorder(from, to, () => this.items()[to]?.querySelector<HTMLElement>('[data-sort-handle]')?.focus());
    this.sortDrop.emit();
  }

  /** asks the component to move the item, then animates every other item from where it was */
  private reorder(from: number, to: number, done?: () => void): void {
    const before = new Map(this.items().map((el) => [el, el.getBoundingClientRect()]));
    this.sortMove.emit({ from, to });
    afterNextRender(
      () => {
        for (const [el, prev] of before) {
          if (el === this.dragged || !el.isConnected) continue;
          el.getAnimations().forEach((a) => a.cancel());
          const now = el.getBoundingClientRect();
          const dx = prev.left - now.left;
          const dy = prev.top - now.top;
          if (this.reduced || (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5)) continue;
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: 260, easing: EASE });
        }
        this.follow();
        done?.();
      },
      { injector: this.injector },
    );
  }

  /** keeps the dragged item under the pointer, wherever its slot is now */
  private follow(): void {
    const el = this.dragged;
    if (!el) return;
    const slot = layoutBox(el);
    this.offset = { x: this.pointer.x - this.grab.x - slot.left, y: this.pointer.y - this.grab.y - slot.top };
    el.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px)`;
  }
}

/** Where the element sits in the layout (viewport coordinates), ignoring transforms and animations. */
function layoutBox(el: HTMLElement): Box {
  const parent = el.offsetParent as HTMLElement | null;
  let left = el.offsetLeft;
  let top = el.offsetTop;
  if (parent) {
    const r = parent.getBoundingClientRect();
    left += r.left + parent.clientLeft - parent.scrollLeft;
    top += r.top + parent.clientTop - parent.scrollTop;
  }
  return { left, top, width: el.offsetWidth, height: el.offsetHeight };
}

/** Moves one element of an array (immutable). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
