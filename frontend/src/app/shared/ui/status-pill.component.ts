import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { SiteStatus } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** "● Online · 120 ms": the live site of a project answered the last check (every 5 minutes). */
@Component({
  selector: 'app-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <span class="pill" [attr.data-up]="site().up" [attr.title]="checked()">
      <i aria-hidden="true"></i>
      {{ (site().up ? 'project.online' : 'project.offline') | t }}
      @if (site().up && site().latencyMs != null) {
        <span class="ms">· {{ site().latencyMs }} ms</span>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 0.45em;
      font-family: var(--font-mono);
      font-size: var(--fs-micro);
      letter-spacing: 0.02em;
      color: var(--fg-2);
      white-space: nowrap;
    }
    i {
      position: relative;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--fg-3);
    }
    [data-up='true'] i {
      background: #1f9d55;
    }
    [data-up='true'] i::after {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      border: 1px solid #1f9d55;
      opacity: 0;
      animation: ping 2.4s var(--ease-out) infinite;
    }
    .ms {
      color: var(--fg-3);
    }
    @keyframes ping {
      0% {
        transform: scale(0.6);
        opacity: 0.7;
      }
      100% {
        transform: scale(1.8);
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      [data-up='true'] i::after {
        animation: none;
      }
    }
  `,
})
export class StatusPillComponent {
  readonly site = input.required<SiteStatus>();
  private readonly i18n = inject(I18nService);
  readonly checked = computed(() =>
    this.i18n.t('project.checkedAt', {
      time: new Intl.DateTimeFormat(this.i18n.locale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(this.site().checkedAt)),
    }),
  );
}
