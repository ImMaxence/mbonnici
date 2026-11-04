import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import type { AdminInfo, AnalyticsOverview, KeyCount, SystemInfo } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';
import { APP_VERSION } from '../../../environments/version';

interface ChartPoint {
  x: number;
  yViews: number;
  yVisitors: number;
  date: string;
  views: number;
  visitors: number;
}

const W = 720;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 36 };

@Component({
  selector: 'app-admin-dashboard',
  imports: [NgTemplateOutlet, TranslatePipe, LocalizedPipe, IconComponent],
  template: `
    <div class="admin-head">
      <h1>{{ 'admin.dashboard.title' | t }}</h1>
      <div class="admin-toolbar" role="group" [attr.aria-label]="'admin.dashboard.period' | t">
        @for (d of periods; track d) {
          <button type="button" class="chip" [attr.aria-pressed]="days() === d" (click)="setDays(d)">{{ 'admin.dashboard.days' | t: { n: d } }}</button>
        }
      </div>
    </div>

    @if (overview(); as o) {
      <div class="tiles">
        <div class="tile">
          <span class="stat-label">{{ 'admin.dashboard.pageViews' | t }}</span>
          <span class="stat-value num">{{ fmt(o.pageViews) }}</span>
          <span class="trend" [class.up]="o.pageViews >= o.pageViewsPrevious" [class.down]="o.pageViews < o.pageViewsPrevious">{{ trend(o.pageViews, o.pageViewsPrevious) }} {{ 'admin.dashboard.vsPrevious' | t }}</span>
        </div>
        <div class="tile">
          <span class="stat-label">{{ 'admin.dashboard.visitors' | t }}</span>
          <span class="stat-value num">{{ fmt(o.visitors) }}</span>
          <span class="trend" [class.up]="o.visitors >= o.visitorsPrevious" [class.down]="o.visitors < o.visitorsPrevious">{{ trend(o.visitors, o.visitorsPrevious) }} {{ 'admin.dashboard.vsPrevious' | t }}</span>
        </div>
        <div class="tile"><span class="stat-label">{{ 'admin.dashboard.projectViews' | t }}</span><span class="stat-value num">{{ fmt(o.projectViews) }}</span></div>
        <div class="tile"><span class="stat-label">{{ 'admin.dashboard.outbound' | t }}</span><span class="stat-value num">{{ fmt(o.outboundClicks) }}</span></div>
        <div class="tile"><span class="stat-label">{{ 'admin.dashboard.contacts' | t }}</span><span class="stat-value num">{{ fmt(o.contactSubmits) }}</span></div>
      </div>

      <!-- ── Daily traffic: two series, one axis, crosshair tooltip, table view ── -->
      <div class="panel">
        <div class="row between" style="margin-bottom: 1rem">
          <h2 class="panel-title" style="margin: 0">{{ 'admin.dashboard.traffic' | t }}</h2>
          <div class="row" style="gap: 1rem">
            <span class="legend"><i class="sw s1"></i>{{ 'admin.dashboard.views' | t }}</span>
            <span class="legend"><i class="sw s2"></i>{{ 'admin.dashboard.visitorsShort' | t }}</span>
            <button type="button" class="chip" [attr.aria-pressed]="table()" (click)="table.set(!table())">
              <app-icon name="grid" [size]="12" /> table
            </button>
          </div>
        </div>
        @if (!points().length) {
          <p class="muted">{{ 'admin.dashboard.noData' | t }}</p>
        } @else if (table()) {
          <table class="table">
            <thead><tr><th>Date</th><th class="num">{{ 'admin.dashboard.views' | t }}</th><th class="num">{{ 'admin.dashboard.visitorsShort' | t }}</th></tr></thead>
            <tbody>
              @for (p of o.daily; track p.date) {
                <tr><td class="mono">{{ p.date }}</td><td class="num">{{ p.views }}</td><td class="num">{{ p.visitors }}</td></tr>
              }
            </tbody>
          </table>
        } @else {
          <div class="chart-wrap" (pointermove)="hover($event)" (pointerleave)="hovered.set(null)">
            <svg class="chart" [attr.viewBox]="'0 0 ' + w + ' ' + h" role="img" [attr.aria-label]="'admin.dashboard.traffic' | t">
              @for (g of gridLines(); track g.y) {
                <line class="axis" [attr.x1]="pad.left" [attr.x2]="w - pad.right" [attr.y1]="g.y" [attr.y2]="g.y" />
                <text class="label" [attr.x]="pad.left - 6" [attr.y]="g.y + 3" text-anchor="end">{{ g.value }}</text>
              }
              <path class="area" [attr.d]="areaPath()" />
              <path class="line s1" [attr.d]="linePath('yViews')" />
              <path class="line s2" [attr.d]="linePath('yVisitors')" />
              @for (lbl of xLabels(); track lbl.x) {
                <text class="label" [attr.x]="lbl.x" [attr.y]="h - 8" text-anchor="middle">{{ lbl.text }}</text>
              }
              @if (hovered(); as hp) {
                <line class="crosshair" [attr.x1]="hp.x" [attr.x2]="hp.x" [attr.y1]="pad.top" [attr.y2]="h - pad.bottom" />
                <circle class="dot s1" [attr.cx]="hp.x" [attr.cy]="hp.yViews" r="4" />
                <circle class="dot s2" [attr.cx]="hp.x" [attr.cy]="hp.yVisitors" r="4" />
              }
            </svg>
            @if (hovered(); as hp) {
              <div class="tooltip-box" [style.left.%]="(hp.x / w) * 100">
                <strong class="mono">{{ hp.date }}</strong>
                <span><i class="sw s1"></i>{{ hp.views }} {{ 'admin.dashboard.views' | t }}</span>
                <span><i class="sw s2"></i>{{ hp.visitors }} {{ 'admin.dashboard.visitorsShort' | t }}</span>
              </div>
            }
          </div>
        }
      </div>

      <div class="two">
        <div class="panel">
          <h2 class="panel-title">{{ 'admin.dashboard.topProjects' | t }}</h2>
          @if (!o.topProjects.length) {
            <p class="muted">{{ 'admin.dashboard.noData' | t }}</p>
          } @else {
            <table class="table">
              <thead><tr><th>Projet</th><th class="num">{{ 'admin.dashboard.views' | t }}</th><th class="num">{{ 'admin.dashboard.clicks' | t }}</th></tr></thead>
              <tbody>
                @for (p of o.topProjects; track p.slug) {
                  <tr><td>{{ p.title | l }}</td><td class="num">{{ p.views }}</td><td class="num">{{ p.clicks }}</td></tr>
                }
              </tbody>
            </table>
          }
        </div>
        <div class="panel">
          <h2 class="panel-title">{{ 'admin.dashboard.topPaths' | t }}</h2>
          <ng-container *ngTemplateOutlet="bars; context: { $implicit: o.topPaths }" />
        </div>
        <div class="panel">
          <h2 class="panel-title">{{ 'admin.dashboard.styles' | t }}</h2>
          <ng-container *ngTemplateOutlet="bars; context: { $implicit: o.styles }" />
        </div>
        <div class="panel">
          <h2 class="panel-title">{{ 'admin.dashboard.themes' | t }}</h2>
          <ng-container *ngTemplateOutlet="bars; context: { $implicit: o.themes }" />
        </div>
        <div class="panel">
          <h2 class="panel-title">{{ 'admin.dashboard.locales' | t }}</h2>
          <ng-container *ngTemplateOutlet="bars; context: { $implicit: o.locales }" />
        </div>
        <div class="panel">
          <h2 class="panel-title">{{ 'admin.dashboard.devices' | t }}</h2>
          <ng-container *ngTemplateOutlet="bars; context: { $implicit: o.devices }" />
        </div>
        <div class="panel">
          <h2 class="panel-title">{{ 'admin.dashboard.referrers' | t }}</h2>
          <ng-container *ngTemplateOutlet="bars; context: { $implicit: o.referrers }" />
        </div>

        <div class="panel">
          <div class="row between" style="margin-bottom: 1rem">
            <h2 class="panel-title" style="margin: 0">{{ 'admin.server.title' | t }}</h2>
            @if (system(); as s) {
              <span class="faint small mono">{{ 'admin.server.cores' | t: { n: s.cpu.cores } }} · {{ 'admin.server.sampled' | t: { time: i18n.formatDate(s.sampledAt, { timeStyle: 'medium' }) } }}</span>
            }
          </div>
          @if (system(); as s) {
            <div class="bars">
              <div class="bar-row">
                <div class="bar"><i [style.--w.%]="pctOf(s.cpu.processLoad)"></i><span>{{ 'admin.server.cpuProcess' | t }}</span></div>
                <span class="num mono">{{ pctOf(s.cpu.processLoad) }} %</span>
              </div>
              <div class="bar-row">
                <div class="bar"><i [style.--w.%]="pctOf(s.cpu.systemLoad)"></i><span>{{ 'admin.server.cpuSystem' | t }}</span></div>
                <span class="num mono">{{ pctOf(s.cpu.systemLoad) }} %</span>
              </div>
              <div class="bar-row">
                <div class="bar"><i [style.--w.%]="ratio(s.memory.usedMb, s.memory.totalMb)"></i><span>{{ 'admin.server.memory' | t }} · {{ 'admin.server.free' | t: { free: mb(s.memory.freeMb), total: mb(s.memory.totalMb) } }}</span></div>
                <span class="num mono">{{ ratio(s.memory.usedMb, s.memory.totalMb) }} %</span>
              </div>
              <div class="bar-row">
                <div class="bar"><i [style.--w.%]="ratio(s.memory.jvmHeapUsedMb, s.memory.jvmHeapMaxMb)"></i><span>{{ 'admin.server.jvm' | t }} · {{ mb(s.memory.jvmHeapUsedMb) }} / {{ mb(s.memory.jvmHeapMaxMb) }}</span></div>
                <span class="num mono">{{ ratio(s.memory.jvmHeapUsedMb, s.memory.jvmHeapMaxMb) }} %</span>
              </div>
              <div class="bar-row">
                <div class="bar"><i [style.--w.%]="ratio(s.disk.usedMb, s.disk.totalMb)"></i><span>{{ 'admin.server.disk' | t }} {{ s.disk.path }} · {{ 'admin.server.free' | t: { free: mb(s.disk.freeMb), total: mb(s.disk.totalMb) } }}</span></div>
                <span class="num mono">{{ ratio(s.disk.usedMb, s.disk.totalMb) }} %</span>
              </div>
            </div>
            <dl class="kv" style="margin-top: 1rem">
              <dt>{{ 'admin.server.database' | t }}</dt>
              <dd>{{ bytes(s.data.databaseBytes) }} · {{ fmt(s.data.analyticsEvents) }} {{ 'admin.server.events' | t }}</dd>
              <dt>{{ 'admin.server.media' | t }}</dt>
              <dd>{{ bytes(s.data.mediaBytes) }} · {{ 'admin.server.mediaCount' | t: { n: s.data.mediaCount } }}</dd>
            </dl>
            <p class="faint small" style="margin-top: .8rem">{{ 'admin.server.hint' | t }}</p>
          } @else {
            <p class="muted small">{{ 'admin.common.loading' | t }}</p>
          }
        </div>

        <div class="panel">
          <h2 class="panel-title">{{ 'admin.dashboard.versions' | t }}</h2>
          <dl class="kv">
            <dt>{{ 'admin.dashboard.frontend' | t }}</dt>
            <dd>v{{ version.version }}{{ version.commit ? ' · ' + version.commit : '' }} · {{ i18n.formatDate(version.builtAt, { dateStyle: 'medium', timeStyle: 'short' }) }}</dd>
            @if (info(); as inf) {
              <dt>{{ 'admin.dashboard.backend' | t }}</dt>
              <dd>v{{ inf.backend.version }}{{ inf.backend.gitSha ? ' · ' + inf.backend.gitSha : '' }}@if (inf.backend.buildTime) { · {{ i18n.formatDate(inf.backend.buildTime, { dateStyle: 'medium', timeStyle: 'short' }) }}}</dd>
              <dt>{{ 'admin.dashboard.springBoot' | t }}</dt>
              <dd>{{ inf.backend.springBootVersion }}</dd>
              <dt>{{ 'admin.dashboard.java' | t }}</dt>
              <dd>{{ inf.backend.javaVersion }}</dd>
              <dt>{{ 'admin.dashboard.uptime' | t }}</dt>
              <dd>{{ uptime(inf.backend.uptimeSeconds) }}</dd>
              <dt>{{ 'admin.dashboard.database' | t }}</dt>
              <dd><span class="status-pill" [attr.data-status]="inf.database.status === 'ok' ? 'PUBLISHED' : 'DRAFT'">{{ inf.database.status }}</span> {{ inf.database.version }}</dd>
              <dt>{{ 'admin.dashboard.storage' | t }}</dt>
              <dd><span class="status-pill" [attr.data-status]="inf.storage.status === 'ok' ? 'PUBLISHED' : 'DRAFT'">{{ inf.storage.status }}</span> {{ inf.storage.description }}</dd>
              <dt>{{ 'admin.dashboard.memory' | t }}</dt>
              <dd>{{ inf.system.memoryUsedMb }} / {{ inf.system.memoryMaxMb }} MB · {{ inf.system.processors }} CPU · {{ inf.system.os }}</dd>
            }
          </dl>
        </div>
      </div>
    } @else if (error()) {
      <p class="field-error">{{ error() }}</p>
    } @else {
      <p class="muted">{{ 'admin.common.loading' | t }}</p>
    }

    <ng-template #bars let-rows>
      @if (!rows?.length) {
        <p class="muted small">{{ 'admin.dashboard.noData' | t }}</p>
      } @else {
        <div class="bars">
          @for (r of rows; track r.key) {
            <div class="bar-row">
              <div class="bar"><i [style.--w.%]="pct(r, rows)"></i><span>{{ r.key }}</span></div>
              <span class="num mono">{{ r.count }}</span>
            </div>
          }
        </div>
      }
    </ng-template>
  `,
  styles: `
    .two {
      display: grid;
      gap: var(--space-5);
      margin-top: var(--space-5);
    }
    @media (min-width: 1100px) {
      .two {
        grid-template-columns: 1fr 1fr;
      }
      .two .panel + .panel {
        margin-top: 0;
      }
    }
    .tiles {
      margin-bottom: var(--space-5);
    }
    .legend {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: var(--fs-small);
      color: var(--fg-2);
    }
    .sw {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      display: inline-block;
    }
    .s1 {
      --c: var(--chart-1);
    }
    .s2 {
      --c: var(--chart-2);
    }
    .sw.s1 {
      background: var(--chart-1);
    }
    .sw.s2 {
      background: var(--chart-2);
    }
    .chart-wrap {
      position: relative;
    }
    .chart .line {
      stroke: var(--c);
      stroke-width: 2;
    }
    .chart .area {
      fill: var(--chart-1);
      opacity: 0.1;
    }
    .chart .crosshair {
      stroke: var(--fg-3);
      stroke-dasharray: 2 3;
    }
    .chart .dot {
      fill: var(--c);
      stroke: var(--bg-2);
      stroke-width: 2;
    }
    .tooltip-box {
      position: absolute;
      top: 8px;
      transform: translateX(-50%);
      display: grid;
      gap: 2px;
      padding: 0.5rem 0.7rem;
      border-radius: var(--radius-xs);
      background: var(--bg-2);
      border: 1px solid var(--line-strong);
      box-shadow: var(--shadow-1);
      font-size: var(--fs-micro);
      pointer-events: none;
      white-space: nowrap;
    }
    .tooltip-box span {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
  `,
})
export class DashboardPage {
  private readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);
  readonly version = APP_VERSION;
  readonly periods = [7, 30, 90];
  readonly w = W;
  readonly h = H;
  readonly pad = PAD;

  readonly days = signal(30);
  readonly overview = signal<AnalyticsOverview | null>(null);
  readonly info = signal<AdminInfo | null>(null);
  readonly error = signal('');
  readonly table = signal(false);
  readonly hovered = signal<ChartPoint | null>(null);

  readonly maxY = computed(() => Math.max(1, ...(this.overview()?.daily ?? []).map((d) => Math.max(d.views, d.visitors))));

  readonly points = computed<ChartPoint[]>(() => {
    const daily = this.overview()?.daily ?? [];
    if (!daily.length) return [];
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const max = this.maxY();
    return daily.map((d, i) => ({
      x: PAD.left + (daily.length === 1 ? innerW / 2 : (i / (daily.length - 1)) * innerW),
      yViews: PAD.top + innerH - (d.views / max) * innerH,
      yVisitors: PAD.top + innerH - (d.visitors / max) * innerH,
      date: d.date,
      views: d.views,
      visitors: d.visitors,
    }));
  });

  readonly gridLines = computed(() => {
    const max = this.maxY();
    const innerH = H - PAD.top - PAD.bottom;
    return [0, 0.5, 1].map((f) => ({ y: PAD.top + innerH - f * innerH, value: Math.round(max * f) }));
  });

  readonly xLabels = computed(() => {
    const pts = this.points();
    if (!pts.length) return [];
    const pick = pts.length > 2 ? [0, Math.floor(pts.length / 2), pts.length - 1] : pts.map((_, i) => i);
    return pick.map((i) => ({ x: pts[i].x, text: pts[i].date.slice(5) }));
  });

  readonly system = signal<SystemInfo | null>(null);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      void this.load();
      this.api.adminInfo().then((i) => this.info.set(i)).catch(() => undefined);
      const sample = (): void => {
        this.api.systemInfo().then((s) => this.system.set(s)).catch(() => undefined);
      };
      sample();
      const timer = setInterval(sample, 10_000);
      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  pctOf(load: number): number {
    return Math.round(Math.max(0, Math.min(1, load)) * 100);
  }

  ratio(used: number, total: number): number {
    return total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  }

  mb(v: number): string {
    return v >= 1024 ? (v / 1024).toFixed(1) + ' Go' : v + ' Mo';
  }

  bytes(v: number): string {
    if (v >= 1024 ** 3) return (v / 1024 ** 3).toFixed(2) + ' Go';
    if (v >= 1024 ** 2) return (v / 1024 ** 2).toFixed(1) + ' Mo';
    return Math.max(1, Math.round(v / 1024)) + ' ko';
  }

  setDays(d: number): void {
    this.days.set(d);
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.overview.set(await this.api.analytics(this.days()));
    } catch (e) {
      this.error.set(String(e));
    }
  }

  linePath(key: 'yViews' | 'yVisitors'): string {
    return this.points().map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p[key].toFixed(1)}`).join(' ');
  }

  areaPath(): string {
    const pts = this.points();
    if (!pts.length) return '';
    const base = H - PAD.bottom;
    return `${this.linePath('yViews')} L${pts[pts.length - 1].x.toFixed(1)} ${base} L${pts[0].x.toFixed(1)} ${base} Z`;
  }

  hover(event: PointerEvent): void {
    const svg = (event.currentTarget as HTMLElement).querySelector('svg');
    const pts = this.points();
    if (!svg || !pts.length) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    this.hovered.set(best);
  }

  fmt(n: number): string {
    return this.i18n.formatNumber(n);
  }

  trend(now: number, before: number): string {
    if (!before) return now ? '+100 %' : '0 %';
    const pct = Math.round(((now - before) / before) * 100);
    return `${pct >= 0 ? '+' : ''}${pct} %`;
  }

  pct(row: KeyCount, rows: KeyCount[]): number {
    const max = Math.max(1, ...rows.map((r) => r.count));
    return Math.round((row.count / max) * 100);
  }

  uptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return d ? `${d} j ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
  }
}
