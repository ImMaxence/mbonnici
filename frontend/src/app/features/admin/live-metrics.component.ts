import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ApiService } from '../../core/api/api.service';
import type { SystemSample } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';

type MetricKey = 'appCpu' | 'serverCpu' | 'appMem' | 'serverMem';

interface Metric {
  key: MetricKey;
  /** s1 = the application, s2 = the whole server (same colours in both rows) */
  series: 's1' | 's2';
  kind: 'cpu' | 'mem';
  value: (s: SystemSample) => number;
  /** top of the scale for the visible samples */
  scale: (pts: SystemSample[], peak: number) => number;
}

const METRICS: Metric[] = [
  { key: 'appCpu', series: 's1', kind: 'cpu', value: (s) => s.appCpu * 100, scale: (_, p) => nice(Math.max(2, p * 1.25), 100) },
  { key: 'serverCpu', series: 's2', kind: 'cpu', value: (s) => s.serverCpu * 100, scale: (_, p) => nice(Math.max(10, p * 1.25), 100) },
  { key: 'appMem', series: 's1', kind: 'mem', value: (s) => s.appMemMb, scale: (_, p) => nice(Math.max(64, p * 1.25)) },
  { key: 'serverMem', series: 's2', kind: 'mem', value: (s) => s.serverMemMb, scale: (pts, p) => Math.max(p, pts.at(-1)?.serverTotalMb ?? p) || 1 },
];

const POLL_MS = 2_000;
const KEEP_MS = 15 * 60_000;
const VW = 300;
const VH = 84;
const TOP = 6;
/** a hole in the series (backend restarted) longer than this breaks the line */
const GAP_MS = 6_000;

/** the smallest 1 / 2 / 2.5 / 5 × 10^n at or above v (capped) */
function nice(v: number, cap = Infinity): number {
  const p = 10 ** Math.floor(Math.log10(Math.max(v, 1e-9)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= v) ?? 10 * p;
  return Math.min(step, cap);
}

/**
 * CPU and memory of the application and of the server, followed live: a sample every two seconds
 * (taken by the backend, which keeps fifteen minutes of them, so a pause or a hidden tab leaves no
 * hole). Four small charts, each on its own scale, with a crosshair shared by the four.
 */
@Component({
  selector: 'app-live-metrics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent, TooltipDirective],
  template: `
    <div class="panel-head">
      <div class="title">
        <h2>{{ 'admin.server.title' | t }}</h2>
        <span class="live small" [class.on]="!paused()">
          <i aria-hidden="true"></i>{{ (paused() ? 'admin.server.paused' : 'admin.server.live') | t }}
        </span>
      </div>
      <div class="row tools">
        <span class="faint small mono">{{ 'admin.server.cores' | t: { n: cores() } }}</span>
        <div class="period" role="radiogroup" [attr.aria-label]="'admin.server.window' | t">
          @for (m of windows; track m) {
            <button type="button" role="radio" [attr.aria-checked]="minutes() === m" (click)="minutes.set(m)">{{ m }} min</button>
          }
        </div>
        <button type="button" class="icon-btn" [attr.aria-pressed]="paused()" (click)="toggle()" [appTip]="(paused() ? 'admin.server.resume' : 'admin.server.pause') | t">
          <app-icon [name]="paused() ? 'play' : 'pause'" [size]="15" />
        </button>
      </div>
    </div>

    @if (!samples().length) {
      <p class="muted small">{{ 'admin.common.loading' | t }}</p>
    } @else {
      <div class="tiles">
        @for (tile of tiles(); track tile.key) {
          <figure class="tile" [attr.data-series]="tile.series">
            <figcaption>
              <span class="t-label small"><i class="sw" aria-hidden="true"></i>{{ 'admin.server.metric.' + tile.key | t }}</span>
              <strong class="t-value num" [class.reading]="tile.hover">{{ tile.current }}</strong>
              <span class="t-sub small faint">{{ tile.sub }}</span>
            </figcaption>
            <div class="plot" (pointermove)="hover($event)" (pointerleave)="hoverT.set(null)">
              <svg [attr.viewBox]="'0 0 ' + vw + ' ' + vh" preserveAspectRatio="none" role="img" [attr.aria-label]="('admin.server.metric.' + tile.key | t) + ' : ' + tile.current">
                <line class="grid" x1="0" [attr.x2]="vw" [attr.y1]="top" [attr.y2]="top" />
                <line class="grid base" x1="0" [attr.x2]="vw" [attr.y1]="vh - 1" [attr.y2]="vh - 1" />
                <path class="area" [attr.d]="tile.area" />
                <path class="line" [attr.d]="tile.line" />
                @if (tile.hover; as h) {
                  <line class="cross" [attr.x1]="h.x" [attr.x2]="h.x" [attr.y1]="0" [attr.y2]="vh" />
                }
              </svg>
              <span class="max mono">{{ tile.max }}</span>
              @if (tile.hover; as h) {
                <span class="dot" [style.left.%]="(h.x / vw) * 100" [style.top.%]="(h.y / vh) * 100"></span>
              }
            </div>
          </figure>
        }
      </div>
      <p class="small faint hint">{{ 'admin.server.hint' | t }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .title {
      display: flex;
      align-items: baseline;
      gap: 0.9rem;
    }
    .live {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--fg-3);
    }
    .live i {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--fg-3);
    }
    .live.on {
      color: var(--success);
    }
    .live.on i {
      background: var(--success);
      animation: beat 2s ease-out infinite;
    }
    @keyframes beat {
      0% {
        box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 55%, transparent);
      }
      70%,
      100% {
        box-shadow: 0 0 0 7px transparent;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .live.on i {
        animation: none;
      }
    }
    .tools {
      gap: 0.6rem;
      flex-wrap: wrap;
    }
    .period {
      display: inline-flex;
      padding: 3px;
      gap: 2px;
      border-radius: 10px;
      background: var(--bg-3);
    }
    .period button {
      min-height: 28px;
      padding: 0 0.65rem;
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--fg-2);
    }
    .period button[aria-checked='true'] {
      background: var(--bg-2);
      color: var(--fg);
      box-shadow: var(--shadow-1);
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.75rem;
    }
    .tile {
      --c: var(--chart-1);
      display: grid;
      gap: 0.6rem;
      margin: 0;
      padding: 0.9rem 1rem 0.8rem;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: var(--bg);
    }
    .tile[data-series='s2'] {
      --c: var(--chart-2);
    }
    figcaption {
      display: grid;
      gap: 0.2rem;
    }
    .t-label {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      color: var(--fg-2);
    }
    .sw {
      width: 10px;
      height: 3px;
      border-radius: 99px;
      background: var(--c);
    }
    .t-value {
      font-family: var(--font-display);
      font-size: 1.7rem;
      letter-spacing: -0.03em;
      line-height: 1.05;
    }
    .t-value.reading {
      color: var(--fg-2);
    }
    .plot {
      position: relative;
      height: 84px;
      touch-action: pan-y;
    }
    .plot svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .grid {
      stroke: var(--line);
      stroke-dasharray: 2 3;
      vector-effect: non-scaling-stroke;
    }
    .grid.base {
      stroke-dasharray: none;
    }
    .line {
      fill: none;
      stroke: var(--c);
      stroke-width: 2;
      stroke-linejoin: round;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }
    .area {
      fill: var(--c);
      opacity: 0.12;
    }
    .cross {
      stroke: var(--fg-3);
      stroke-dasharray: 2 3;
      vector-effect: non-scaling-stroke;
    }
    .max {
      position: absolute;
      top: -2px;
      right: 0;
      transform: translateY(-100%);
      font-size: 0.68rem;
      color: var(--fg-3);
    }
    .dot {
      position: absolute;
      width: 8px;
      height: 8px;
      margin: -4px 0 0 -4px;
      border-radius: 50%;
      background: var(--c);
      box-shadow: 0 0 0 2px var(--bg);
      pointer-events: none;
    }
    .hint {
      margin-top: 0.9rem;
    }
  `,
})
export class LiveMetricsComponent {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly doc = inject(DOCUMENT);

  /** logical processors of the server, from the full system info */
  readonly cores = input(0);

  readonly windows = [1, 5, 15];
  readonly minutes = signal(5);
  readonly paused = signal(false);
  readonly samples = signal<SystemSample[]>([]);
  readonly hoverT = signal<number | null>(null);
  readonly vw = VW;
  readonly vh = VH;
  readonly top = TOP;

  private busy = false;

  readonly tiles = computed(() => {
    const all = this.samples();
    const end = all.at(-1)?.t ?? 0;
    const start = end - this.minutes() * 60_000;
    const pts = all.filter((s) => s.t >= start);
    const hoverT = this.hoverT();
    const time = new Intl.DateTimeFormat(this.i18n.locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return METRICS.map((m) => {
      const values = pts.map(m.value);
      const peak = Math.max(0, ...values);
      const avg = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
      const max = m.scale(pts, peak);
      const x = (t: number): number => ((t - start) / Math.max(1, end - start)) * VW;
      const y = (v: number): number => VH - 1 - (Math.min(v, max) / max) * (VH - 1 - TOP);
      let line = '';
      let area = '';
      let run: [number, number][] = [];
      const flush = (): void => {
        if (!run.length) return;
        const d = run.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
        line += d;
        area += `${d} L${run.at(-1)![0].toFixed(1)} ${VH - 1} L${run[0][0].toFixed(1)} ${VH - 1} Z`;
        run = [];
      };
      pts.forEach((s, i) => {
        if (i && s.t - pts[i - 1].t > GAP_MS) flush();
        run.push([x(s.t), y(values[i])]);
      });
      flush();
      let hover: { x: number; y: number; value: string; time: string } | null = null;
      if (hoverT != null && pts.length) {
        let best = 0;
        pts.forEach((s, i) => {
          if (Math.abs(s.t - hoverT) < Math.abs(pts[best].t - hoverT)) best = i;
        });
        hover = { x: x(pts[best].t), y: y(values[best]), value: this.fmt(m, values[best]), time: time.format(new Date(pts[best].t)) };
      }
      const last = values.at(-1) ?? 0;
      const sub =
        m.key === 'serverMem'
          ? this.i18n.t('admin.server.ofTotal', { total: this.mb(pts.at(-1)?.serverTotalMb ?? 0) })
          : this.i18n.t('admin.server.avgPeak', { avg: this.fmt(m, avg), peak: this.fmt(m, peak) });
      // hovering a chart reads the value under the pointer in the big figure, its time below
      return {
        key: m.key,
        series: m.series,
        current: hover ? hover.value : this.fmt(m, last),
        sub: hover ? this.i18n.t('admin.server.at', { time: hover.time }) : sub,
        max: this.fmt(m, max),
        line,
        area,
        hover,
      };
    });
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      void this.poll();
      const timer = setInterval(() => void this.poll(), POLL_MS);
      const onVisible = (): void => {
        if (!this.doc.hidden) void this.poll();
      };
      this.doc.addEventListener('visibilitychange', onVisible);
      destroyRef.onDestroy(() => {
        clearInterval(timer);
        this.doc.removeEventListener('visibilitychange', onVisible);
      });
    });
  }

  toggle(): void {
    this.paused.update((p) => !p);
    // the backend kept sampling: resuming fetches what was missed, the line has no hole
    if (!this.paused()) void this.poll();
  }

  hover(event: PointerEvent): void {
    const pts = this.samples();
    if (!pts.length) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const end = pts.at(-1)!.t;
    const span = this.minutes() * 60_000;
    this.hoverT.set(end - span + ((event.clientX - rect.left) / rect.width) * span);
  }

  private async poll(): Promise<void> {
    if (this.busy || this.paused() || this.doc.hidden) return;
    this.busy = true;
    try {
      const since = this.samples().at(-1)?.t ?? 0;
      const fresh = await this.api.systemLive(since);
      if (fresh.length && !this.paused()) {
        const end = fresh.at(-1)!.t;
        this.samples.update((old) => [...old, ...fresh].filter((s) => s.t > end - KEEP_MS));
      }
    } catch {
      // a missed sample is not worth an error message: the next poll fills the gap
    } finally {
      this.busy = false;
    }
  }

  private fmt(m: Metric, v: number): string {
    if (m.kind === 'mem') return this.mb(v);
    const digits = v < 10 ? 1 : 0;
    return new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v) + ' %';
  }

  private mb(v: number): string {
    const nf = (n: number, d: number): string => new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: d }).format(n);
    return v >= 1024 ? nf(v / 1024, 1) + (this.i18n.locale().startsWith('fr') ? ' Go' : ' GB') : nf(Math.round(v), 0) + (this.i18n.locale().startsWith('fr') ? ' Mo' : ' MB');
  }
}
