import { Directive, inject, input } from '@angular/core';
import { TransitionService } from './transition.service';

/**
 * `<a [appLink]="'/fr/projets'" linkLabel="Projets">` — a real href for crawlers and middle-clicks,
 * a curtain transition for everybody else.
 */
@Directive({
  selector: 'a[appLink]',
  host: {
    '[attr.href]': 'appLink()',
    '(click)': 'onClick($event)',
  },
})
export class LinkDirective {
  readonly appLink = input.required<string>();
  readonly linkLabel = input('');
  /** a selector inside the link whose element glides into the next page (project cards) */
  readonly linkMorph = input<string | null>(null);

  private readonly transition = inject(TransitionService);

  onClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    const morph = this.linkMorph();
    if (morph) {
      const source = (event.currentTarget as HTMLElement).querySelector<HTMLElement>(morph);
      void this.transition.navigateMorph(this.appLink(), this.linkLabel(), source);
      return;
    }
    void this.transition.navigate(this.appLink(), this.linkLabel());
  }
}
