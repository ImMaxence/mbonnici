import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { AuthService } from '../../core/auth/auth.service';
import { Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import type { AdminInfo, AnalyticsOverview, KeyCount, SystemInfo, VitalMetric, VitalsOverview, SiteHistory } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocalizedPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';
import { APP_VERSION } from '../../../environments/version';
import { LiveMetricsComponent } from './live-metrics.component';

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
  imports: [NgTemplateOutlet, RouterLink, TooltipDirective, TranslatePipe, LocalizedPipe, IconComponent, LiveMetricsComponent],
  template: `
    <div class="admin-head">
      <div>
        <h1>{{ 'admin.dashboard.hello' | t: { name: firstName() } }}</h1>
        <p class="muted small">{{ today }} · {{ 'admin.dashboard.subtitle' | t }}</p>
      </div>
      <div class="period" role="radiogroup" [attr.aria-label]="'admin.dashboard.period' | t">
        @for (d of periods; track d) {
          <button type="button" role="radio" [attr.aria-checked]="days() === d" (click)="setDays(d)">{{ 'admin.dashboard.days' | t: { n: d } }}</button>
        }
      </div>
    </div>

    @if (overview(); as o) {
      <!-- ── KPIs ── -->
      <section class="kpis">
        <article class="kpi main">
          <span class="k-label">{{ 'admin.dashboard.pageViews' | t }}</span>
          <span class="k-value num">{{ fmt(o.pageViews) }}</span>
          <span class="k-foot">
            <span class="trend" [class.up]="o.pageViews >= o.pageViewsPrevious" [class.down]="o.pageViews < o.pageViewsPrevious">{{ trend(o.pageViews, o.pageViewsPrevious) }}</span>
            <span class="faint">{{ 'admin.dashboard.vsPrevious' | t }}</span>
          </span>
          <svg class="spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><path class="spark-area" [attr.d]="spark('views', true)" /><path class="spark-line" [attr.d]="spark('views', false)" /></svg>
        </article>
        <article class="kpi">
          <span class="k-label">{{ 'admin.dashboard.visitors' | t }}</span>
          <span class="k-value num">{{ fmt(o.visitors) }}</span>
          <span class="k-foot">
            <span class="trend" [class.up]="o.visitors >= o.visitorsPrevious" [class.down]="o.visitors < o.visitorsPrevious">{{ trend(o.visitors, o.visitorsPrevious) }}</span>
            <span class="faint">{{ 'admin.dashboard.vsPrevious' | t }}</span>
          </span>
          <svg class="spark s2" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><path class="spark-area" [attr.d]="spark('visitors', true)" /><path class="spark-line" [attr.d]="spark('visitors', false)" /></svg>
        </article>
        <article class="kpi">
          <span class="k-label">{{ 'admin.dashboard.projectViews' | t }}</span>
          <span class="k-value num">{{ fmt(o.projectViews) }}</span>
          <span class="k-foot faint">{{ 'admin.dashboard.perVisitor' | t: { n: perVisitor(o.projectViews, o.visitors) } }}</span>
        </article>
        <article class="kpi">
          <span class="k-label">{{ 'admin.dashboard.outbound' | t }}</span>
          <span class="k-value num">{{ fmt(o.outboundClicks) }}</span>
          <span class="k-foot faint">{{ 'admin.dashboard.outboundHint' | t }}</span>
        </article>
        <article class="kpi">
          <span class="k-label">{{ 'admin.dashboard.cvDownloads' | t }}</span>
          <span class="k-value num">{{ fmt(o.cvDownloads ?? 0) }}</span>
          <span class="k-foot faint">{{ 'admin.dashboard.cvHint' | t }}</span>
        </article>
        <a class="kpi link" routerLink="/admin/messages">
          <span class="k-label">{{ 'admin.dashboard.contacts' | t }}</span>
          <span class="k-value num">{{ fmt(o.contactSubmits) }}</span>
          <span class="k-foot">
            @if (unread() > 0) {
              <span class="badge">{{ unread() }}</span> <span class="faint">{{ 'admin.dashboard.unread' | t }}</span>
            } @else {
              <span class="faint">{{ 'admin.dashboard.allRead' | t }}</span>
            }
            <app-icon class="go" name="arrow-right" [size]="14" />
          </span>
        </a>
      </section>

      <!-- ── traffic + top projects ── -->
      <section class="grid main-grid">
        <div class="panel traffic">
          <div class="panel-head">
            <h2>{{ 'admin.dashboard.traffic' | t }}</h2>
            <div class="row" style="gap: .9rem">
              <span class="legend"><i class="sw s1"></i>{{ 'admin.dashboard.views' | t }}</span>
              <span class="legend"><i class="sw s2"></i>{{ 'admin.dashboard.visitorsShort' | t }}</span>
              <button type="button" class="icon-btn" [attr.aria-pressed]="table()" (click)="table.set(!table())" [appTip]="(table() ? 'admin.dashboard.asChart' : 'admin.dashboard.asTable') | t">
                <app-icon [name]="table() ? 'chart' : 'grid'" [size]="15" />
              </button>
            </div>
          </div>
          @if (!points().length) {
            <div class="empty"><app-icon name="chart" [size]="22" /><p>{{ 'admin.dashboard.noData' | t }}</p></div>
          } @else if (table()) {
            <div class="table-scroll">
              <table class="table">
                <thead><tr><th>Date</th><th class="num">{{ 'admin.dashboard.views' | t }}</th><th class="num">{{ 'admin.dashboard.visitorsShort' | t }}</th></tr></thead>
                <tbody>
                  @for (p of o.daily; track p.date) {
                    <tr><td class="mono">{{ p.date }}</td><td class="num">{{ p.views }}</td><td class="num">{{ p.visitors }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="chart-wrap" (pointermove)="hover($event)" (pointerleave)="hovered.set(null)">
              <svg class="chart" [attr.viewBox]="'0 0 ' + w + ' ' + h" role="img" [attr.aria-label]="'admin.dashboard.traffic' | t">
                <defs>
                  <linearGradient id="dash-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="var(--chart-1)" stop-opacity="0.28" />
                    <stop offset="1" stop-color="var(--chart-1)" stop-opacity="0" />
                  </linearGradient>
                </defs>
                @for (g of gridLines(); track g.y) {
                  <line class="axis" [attr.x1]="pad.left" [attr.x2]="w - pad.right" [attr.y1]="g.y" [attr.y2]="g.y" />
                  <text class="label" [attr.x]="pad.left - 8" [attr.y]="g.y + 3" text-anchor="end">{{ g.value }}</text>
                }
                <path class="area" [attr.d]="areaPath()" fill="url(#dash-area)" />
                <path class="line s1" [attr.d]="linePath('yViews')" />
                <path class="line s2" [attr.d]="linePath('yVisitors')" />
                @for (lbl of xLabels(); track lbl.x) {
                  <text class="label" [attr.x]="lbl.x" [attr.y]="h - 6" text-anchor="middle">{{ lbl.text }}</text>
                }
                @if (hovered(); as hp) {
                  <line class="crosshair" [attr.x1]="hp.x" [attr.x2]="hp.x" [attr.y1]="pad.top" [attr.y2]="h - pad.bottom" />
                  <circle class="dot s1" [attr.cx]="hp.x" [attr.cy]="hp.yViews" r="4.5" />
                  <circle class="dot s2" [attr.cx]="hp.x" [attr.cy]="hp.yVisitors" r="4.5" />
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

        <div class="panel">
          <div class="panel-head"><h2>{{ 'admin.dashboard.topProjects' | t }}</h2></div>
          <p class="rank-legend small">
            <span><i class="sw s1"></i>{{ 'admin.dashboard.rankViews' | t }}</span>
            <span><app-icon name="arrow-up-right" [size]="13" />{{ 'admin.dashboard.rankClicks' | t }}</span>
          </p>
          @if (!o.topProjects.length) {
            <div class="empty"><app-icon name="layers" [size]="22" /><p>{{ 'admin.dashboard.noData' | t }}</p></div>
          } @else {
            <ol class="ranking">
              @for (p of o.topProjects.slice(0, 7); track p.slug; let i = $index) {
                <li>
                  <span class="rank mono">{{ i + 1 }}</span>
                  <span class="r-body">
                    <span class="r-line">
                      <strong>{{ p.title | l }}</strong>
                      <span class="r-views"><b class="num">{{ p.views }}</b> {{ (p.views > 1 ? 'admin.dashboard.views' : 'admin.dashboard.view') | t }}</span>
                    </span>
                    <span class="r-bar"><i [style.--w.%]="barShare(p.views, o.topProjects[0].views)"></i></span>
                    <span class="r-clicks faint small"><app-icon name="arrow-up-right" [size]="12" />{{ p.clicks }} {{ (p.clicks > 1 ? 'admin.dashboard.clicks' : 'admin.dashboard.click') | t }}</span>
                  </span>
                </li>
              }
            </ol>
          }
        </div>
      </section>

      <!-- ── audience ── -->
      <section class="grid three">
        <div class="panel">
          <div class="panel-head"><h2>{{ 'admin.dashboard.topPaths' | t }}</h2></div>
          <ng-container *ngTemplateOutlet="bars; context: { $implicit: o.topPaths.slice(0, 6) }" />
        </div>
        <div class="panel">
          <div class="panel-head"><h2>{{ 'admin.dashboard.referrers' | t }}</h2></div>
          <ng-container *ngTemplateOutlet="bars; context: { $implicit: o.referrers.slice(0, 6) }" />
        </div>
        <div class="panel shares">
          <div class="panel-head"><h2>{{ 'admin.dashboard.audience' | t }}</h2></div>
          <ng-container *ngTemplateOutlet="share; context: { $implicit: o.devices, title: ('admin.dashboard.devices' | t) }" />
          <ng-container *ngTemplateOutlet="share; context: { $implicit: o.locales, title: ('admin.dashboard.locales' | t) }" />
          <ng-container *ngTemplateOutlet="share; context: { $implicit: o.themes, title: ('admin.dashboard.themes' | t) }" />
        </div>
      </section>

      <!-- ── real-user performance ── -->
      <section class="panel vitals">
        <div class="panel-head">
          <h2>{{ 'admin.vitals.title' | t }}</h2>
          <span class="small faint">{{ 'admin.vitals.subtitle' | t }}</span>
        </div>
        @if (vitals(); as v) {
          @if (!hasVitals()) {
            <div class="empty"><app-icon name="gauge" [size]="22" /><p>{{ 'admin.vitals.none' | t }}</p></div>
          } @else {
            <p class="vital-intro small">{{ 'admin.vitals.intro' | t }}</p>
            <div class="vital-legend small">
              <span><i class="sw-r good" aria-hidden="true"></i>{{ 'admin.vitals.legend.good' | t }}</span>
              <span><i class="sw-r ni" aria-hidden="true"></i>{{ 'admin.vitals.legend.ni' | t }}</span>
              <span><i class="sw-r poor" aria-hidden="true"></i>{{ 'admin.vitals.legend.poor' | t }}</span>
              <span class="faint">{{ 'admin.vitals.legend.bar' | t }}</span>
            </div>
            <div class="vital-grid">
              @for (m of v.metrics; track m.metric) {
                <div class="vital" [attr.data-rating]="rating(m.metric, m.p75)">
                  <span class="v-name mono">{{ m.metric }}</span>
                  <strong class="v-value">{{ m.p75 == null ? '—' : format(m.metric, m.p75) }}</strong>
                  <span class="v-label small">{{ 'admin.vitals.label.' + m.metric | t }}</span>
                  <span class="v-bar" aria-hidden="true">
                    <i class="good" [style.flex-grow]="m.good"></i><i class="ni" [style.flex-grow]="m.needsImprovement"></i><i class="poor" [style.flex-grow]="m.poor"></i>
                  </span>
                  <span class="v-goal small faint">{{ 'admin.vitals.help.' + m.metric | t }}</span>
                  <span class="v-samples small faint mono">{{ 'admin.vitals.samples' | t: { n: m.samples } }}</span>
                </div>
              }
            </div>
            <div class="vital-foot">
              <div class="devices">
                @for (d of devices(); track d.key) {
                  <div class="device">
                    <span class="small"><app-icon [name]="d.key === 'mobile' ? 'phone' : 'monitor'" [size]="14" /> {{ 'admin.vitals.device.' + d.key | t }}</span>
                    @for (m of d.stats; track m.metric) {
                      <span class="mono small chip-v" [attr.data-rating]="rating(m.metric, m.p75)">{{ m.metric }} {{ m.p75 == null ? '—' : format(m.metric, m.p75) }}</span>
                    }
                  </div>
                }
              </div>
              @if (v.pages.length) {
                <table class="table vital-pages">
                  <thead>
                    <tr><th>{{ 'admin.vitals.page' | t }}</th><th class="num">LCP</th><th class="num">INP</th><th class="num">CLS</th><th class="num">{{ 'admin.vitals.n' | t }}</th></tr>
                  </thead>
                  <tbody>
                    @for (p of v.pages.slice(0, 6); track p.path) {
                      <tr>
                        <td class="mono small">{{ p.path }}</td>
                        <td class="num" [attr.data-rating]="rating('LCP', p.lcp)">{{ p.lcp == null ? '—' : format('LCP', p.lcp) }}</td>
                        <td class="num" [attr.data-rating]="rating('INP', p.inp)">{{ p.inp == null ? '—' : format('INP', p.inp) }}</td>
                        <td class="num" [attr.data-rating]="rating('CLS', p.cls)">{{ p.cls == null ? '—' : format('CLS', p.cls) }}</td>
                        <td class="num faint">{{ p.samples }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          }
        }
      </section>

      <!-- ── live sites ── -->
      @if (sites()?.length) {
        <section class="panel sites">
          <div class="panel-head">
            <h2>{{ 'admin.sites.title' | t }}</h2>
            <span class="small faint">{{ 'admin.sites.subtitle' | t }}</span>
          </div>
          <table class="table sites-table">
            <thead>
              <tr>
                <th>{{ 'admin.sites.site' | t }}</th>
                <th>{{ 'admin.sites.now' | t }}</th>
                <th class="hours-col">{{ 'admin.sites.last24' | t }}</th>
                <th class="num">24 h</th>
                <th class="num">7 j</th>
                <th class="num">{{ 'admin.sites.latency' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (site of sites(); track site.slug) {
                <tr>
                  <td>
                    <strong>{{ site.title }}</strong>
                    <a class="mono small faint url" [href]="site.url" target="_blank" rel="noopener">{{ host(site.url) }}</a>
                  </td>
                  <td>
                    @if (site.current; as c) {
                      <span class="status-pill" [attr.data-status]="c.up ? 'PUBLISHED' : 'FAILED'">{{ (c.up ? 'project.online' : 'project.offline') | t }}</span>
                    } @else {
                      <span class="faint">—</span>
                    }
                  </td>
                  <td class="hours-col">
                    <span class="hours" role="img" [attr.aria-label]="'admin.sites.barsLabel' | t">
                      @for (h of hourBars(site); track h.key) {
                        <i [attr.data-state]="h.state" [style.--h.%]="h.height" [attr.title]="h.label"></i>
                      }
                    </span>
                  </td>
                  <td class="num">{{ percent(site.uptime24h) }}</td>
                  <td class="num">{{ percent(site.uptime7d) }}</td>
                  <td class="num">{{ site.latency24h == null ? '—' : site.latency24h + ' ms' }}</td>
                </tr>
                @if (site.lastDown) {
                  <tr class="incident"><td colspan="6" class="small faint">{{ 'admin.sites.lastDown' | t: { when: i18n.formatDate(site.lastDown, { dateStyle: 'medium', timeStyle: 'short' }) } }}</td></tr>
                }
              }
            </tbody>
          </table>
        </section>
      }

      <!-- ── server, live ── -->
      <section class="panel server-live">
        <app-live-metrics [cores]="system()?.cpu?.cores ?? 0" />
      </section>

      <section class="grid two">
        <div class="panel">
          <div class="panel-head"><h2>{{ 'admin.server.storage' | t }}</h2></div>
          @if (system(); as s) {
            <div class="storage">
              <ng-container *ngTemplateOutlet="gauge; context: { v: ratio(s.disk.usedMb, s.disk.totalMb), label: ('admin.server.disk' | t), sub: mb(s.disk.freeMb) + ' ' + ('admin.server.left' | t) }" />
              <dl class="kv">
                <dt>{{ 'admin.server.database' | t }}</dt>
                <dd>{{ bytes(s.data.databaseBytes) }} · {{ fmt(s.data.analyticsEvents) }} {{ 'admin.server.events' | t }}</dd>
                <dt>{{ 'admin.server.media' | t }}</dt>
                <dd>{{ bytes(s.data.mediaBytes) }} · {{ 'admin.server.mediaCount' | t: { n: s.data.mediaCount } }}</dd>
                <dt>{{ 'admin.server.jvm' | t }}</dt>
                <dd>{{ mb(s.memory.jvmHeapUsedMb) }} / {{ mb(s.memory.jvmHeapMaxMb) }}</dd>
              </dl>
            </div>
          } @else {
            <p class="muted small">{{ 'admin.common.loading' | t }}</p>
          }
        </div>

        <div class="panel">
          <div class="panel-head"><h2>{{ 'admin.dashboard.versions' | t }}</h2></div>
          <ul class="health">
            <li><span>{{ 'admin.dashboard.frontend' | t }}</span><span class="mono">v{{ version.version }}</span></li>
            @if (info(); as inf) {
              <li><span>{{ 'admin.dashboard.backend' | t }}</span><span class="mono">v{{ inf.backend.version }}</span></li>
              <li><span>{{ 'admin.dashboard.database' | t }}</span><span><span class="status-pill" [attr.data-status]="inf.database.status === 'ok' ? 'PUBLISHED' : 'DRAFT'">{{ inf.database.status }}</span> <span class="mono small faint">{{ inf.database.version }}</span></span></li>
              <li><span>{{ 'admin.dashboard.storage' | t }}</span><span><span class="status-pill" [attr.data-status]="inf.storage.status === 'ok' ? 'PUBLISHED' : 'DRAFT'">{{ inf.storage.status }}</span></span></li>
              <li><span>{{ 'admin.dashboard.springBoot' | t }} · {{ 'admin.dashboard.java' | t }}</span><span class="mono">{{ inf.backend.springBootVersion }} · {{ inf.backend.javaVersion }}</span></li>
              <li><span>{{ 'admin.dashboard.uptime' | t }}</span><span class="mono">{{ uptime(inf.backend.uptimeSeconds) }}</span></li>
            }
            <li>
              <span>{{ 'admin.errors.title' | t }}</span>
              <a routerLink="/admin/errors">
                <span class="status-pill" [attr.data-status]="openErrors() ? 'FAILED' : 'PUBLISHED'">{{ openErrors() ? ('admin.errors.openCount' | t: { n: openErrors() }) : ('admin.errors.allClear' | t) }}</span>
              </a>
            </li>
          </ul>
        </div>
      </section>
    } @else if (error()) {
      <p class="field-error">{{ error() }}</p>
    } @else {
      <section class="kpis">
        @for (i of [1, 2, 3, 4, 5]; track i) {
          <div class="kpi loading-shimmer" style="min-height: 130px"></div>
        }
      </section>
    }

    <ng-template #bars let-rows>
      @if (!rows?.length) {
        <div class="empty small"><p>{{ 'admin.dashboard.noData' | t }}</p></div>
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

    <ng-template #share let-rows let-title="title">
      <div class="share">
        <span class="share-title small">{{ title }}</span>
        @if (!rows?.length) {
          <span class="faint small">{{ 'admin.dashboard.noData' | t }}</span>
        } @else {
          <div class="stack-bar" role="img" [attr.aria-label]="title">
            @for (r of rows.slice(0, 5); track r.key; let i = $index) {
              <i [style.flex-grow]="r.count" [attr.data-i]="i"></i>
            }
          </div>
          <div class="share-legend">
            @for (r of rows.slice(0, 5); track r.key; let i = $index) {
              <span><i class="dot" [attr.data-i]="i"></i>{{ r.key }} <b class="num">{{ pct(r, rows, true) }} %</b></span>
            }
          </div>
        }
      </div>
    </ng-template>

    <ng-template #gauge let-v="v" let-label="label" let-sub="sub">
      <div class="gauge" [class.warn]="v >= 75" [class.crit]="v >= 90">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle class="track" cx="32" cy="32" r="27" />
          <circle class="value" cx="32" cy="32" r="27" [attr.stroke-dasharray]="(v / 100) * 169.6 + ' 169.6'" />
        </svg>
        <span class="g-value num">{{ v }}<small>%</small></span>
        <span class="g-label small">{{ label }}</span>
        @if (sub) {
          <span class="g-sub faint">{{ sub }}</span>
        }
      </div>
    </ng-template>
  `,
  styles: `
    .period {
      display: inline-flex;
      padding: 3px;
      gap: 2px;
      border-radius: 10px;
      background: var(--bg-3);
    }
    .period button {
      min-height: 32px;
      padding: 0 0.85rem;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--fg-2);
    }
    .period button[aria-checked='true'] {
      background: var(--bg-2);
      color: var(--fg);
      box-shadow: var(--shadow-1);
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .kpi {
      position: relative;
      display: grid;
      align-content: start;
      gap: 0.45rem;
      padding: 1.1rem 1.25rem 1.2rem;
      border-radius: var(--admin-radius);
      background: var(--bg-2);
      border: 1px solid var(--line);
      overflow: hidden;
      min-height: 150px;
      padding-bottom: 3.2rem;
    }
    .kpi.main {
      background: var(--fg);
      color: var(--bg);
      border-color: var(--fg);
    }
    .kpi.main .trend {
      color: var(--bg);
      background: color-mix(in srgb, var(--bg) 14%, transparent);
    }
    .kpi.main .k-label,
    .kpi.main .faint {
      color: color-mix(in srgb, var(--bg) 65%, transparent);
    }
    .kpi.link {
      transition: border-color var(--dur-1), transform var(--dur-2) var(--ease-out);
    }
    .kpi.link:hover {
      border-color: var(--fg);
      transform: translateY(-2px);
    }
    .k-label {
      font-size: 0.8rem;
      color: var(--fg-2);
    }
    .k-value {
      font-family: var(--font-display);
      font-size: clamp(2rem, 3vw, 2.6rem);
      font-weight: var(--weight-display);
      letter-spacing: -0.045em;
      line-height: 1;
    }
    .k-foot .trend {
      white-space: nowrap;
    }
    .k-foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.74rem;
      position: relative;
      z-index: 1;
    }
    .k-foot .go {
      margin-left: auto;
      color: var(--fg-3);
    }
    .spark {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 2.6rem;
      pointer-events: none;
    }
    .spark-line {
      fill: none;
      stroke: var(--chart-1);
      stroke-width: 1.6;
      vector-effect: non-scaling-stroke;
    }
    .spark-area {
      fill: var(--chart-1);
      opacity: 0.14;
    }
    .kpi.main .spark-line {
      stroke: color-mix(in srgb, var(--bg) 80%, var(--accent));
    }
    .kpi.main .spark-area {
      fill: var(--bg);
      opacity: 0.1;
    }
    .spark.s2 .spark-line {
      stroke: var(--chart-2);
    }
    .spark.s2 .spark-area {
      fill: var(--chart-2);
    }
    .grid {
      display: grid;
      gap: 1.25rem;
      margin-bottom: 1.25rem;
    }
    .grid .panel + .panel {
      margin-top: 0;
    }
    @media (min-width: 1100px) {
      .main-grid {
        grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      }
      .three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .two {
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      }
    }
    .empty {
      display: grid;
      place-items: center;
      gap: 0.5rem;
      padding: 2rem 1rem;
      border-radius: 12px;
      background: var(--bg-3);
      color: var(--fg-3);
      text-align: center;
    }
    .empty.small {
      padding: 1rem;
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
    .chart .axis {
      stroke: var(--line);
      stroke-dasharray: 2 4;
    }
    .chart .line {
      fill: none;
      stroke: var(--c);
      stroke-linejoin: round;
      stroke-width: 2.2;
    }
    .chart .area {
      fill: url(#dash-area);
      opacity: 1;
    }
    .chart .crosshair {
      stroke: var(--fg-3);
      stroke-dasharray: 2 3;
    }
    .chart .dot {
      fill: var(--c);
      stroke: var(--bg-2);
      stroke-width: 2.5;
    }
    .tooltip-box {
      position: absolute;
      top: 8px;
      transform: translateX(-50%);
      display: grid;
      gap: 2px;
      padding: 0.55rem 0.75rem;
      border-radius: 10px;
      background: var(--fg);
      color: var(--bg);
      font-size: var(--fs-micro);
      white-space: nowrap;
      pointer-events: none;
      box-shadow: var(--shadow-2);
    }
    .tooltip-box span {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .vitals,
    .sites {
      margin-bottom: var(--space-5);
    }
    .sites-table td {
      vertical-align: middle;
    }
    .sites-table .url {
      display: block;
    }
    .sites-table .url:hover {
      color: var(--accent);
    }
    .incident td {
      padding-top: 0;
      border-top: 0;
    }
    .hours {
      display: flex;
      align-items: flex-end;
      gap: 2px;
      height: 28px;
      min-width: 168px;
    }
    .hours i {
      flex: 1;
      height: var(--h, 12%);
      min-height: 3px;
      border-radius: 2px;
      background: var(--line);
    }
    .hours i[data-state='up'] {
      background: #22a05a;
    }
    .hours i[data-state='partial'] {
      background: #e0a12a;
    }
    .hours i[data-state='down'] {
      background: #e5484d;
    }
    @media (max-width: 760px) {
      .hours-col {
        display: none;
      }
    }
    .vital-intro {
      max-width: 75ch;
      margin: -0.25rem 0 0.75rem;
      color: var(--fg-2);
    }
    .vital-legend {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem 1.1rem;
      margin-bottom: 1rem;
    }
    .vital-legend span {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .sw-r {
      width: 14px;
      height: 5px;
      border-radius: 99px;
    }
    .sw-r.good {
      background: #22a05a;
    }
    .sw-r.ni {
      background: #e0a12a;
    }
    .sw-r.poor {
      background: #e5484d;
    }
    .v-goal {
      line-height: 1.35;
    }
    .vital-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 0.75rem;
    }
    .vital {
      display: grid;
      gap: 0.3rem;
      padding: 0.9rem 1rem;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: var(--bg);
    }
    .v-name {
      font-size: 0.7rem;
      letter-spacing: 0.08em;
      color: var(--fg-3);
    }
    .v-value {
      font-family: var(--font-display);
      font-size: 1.9rem;
      letter-spacing: -0.03em;
      line-height: 1;
    }
    [data-rating='good'] .v-value,
    td[data-rating='good'],
    .chip-v[data-rating='good'] {
      color: var(--success);
    }
    [data-rating='ni'] .v-value,
    td[data-rating='ni'],
    .chip-v[data-rating='ni'] {
      color: var(--warning);
    }
    [data-rating='poor'] .v-value,
    td[data-rating='poor'],
    .chip-v[data-rating='poor'] {
      color: #c62828;
    }
    .v-label {
      color: var(--fg-2);
    }
    .v-bar {
      display: flex;
      gap: 2px;
      height: 5px;
      border-radius: 99px;
      overflow: hidden;
      background: var(--bg-3);
    }
    .v-bar i {
      flex-basis: 0;
    }
    .v-bar .good {
      background: #22a05a;
    }
    .v-bar .ni {
      background: #e0a12a;
    }
    .v-bar .poor {
      background: #e5484d;
    }
    .vital-foot {
      display: grid;
      gap: 1rem;
      margin-top: 1rem;
    }
    @media (min-width: 1100px) {
      .vital-foot {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
        align-items: start;
      }
    }
    .devices {
      display: grid;
      gap: 0.6rem;
    }
    .device {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem 0.8rem;
    }
    .device > span:first-child {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      min-width: 7rem;
      font-weight: 600;
    }
    .chip-v {
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      background: var(--bg);
      border: 1px solid var(--line);
    }
    .table-scroll {
      max-height: 300px;
      overflow: auto;
    }
    .rank-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem 1rem;
      margin: -0.35rem 0 1rem;
      color: var(--fg-3);
    }
    .rank-legend span,
    .r-clicks {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .rank-legend .sw {
      width: 10px;
      height: 4px;
      border-radius: 99px;
    }
    .r-views {
      flex: none;
      color: var(--fg-3);
      font-size: 0.8rem;
    }
    .r-views b {
      color: var(--fg);
      font-weight: 600;
      font-size: 0.88rem;
    }
    .ranking {
      display: grid;
      gap: 0.9rem;
    }
    .ranking li {
      display: grid;
      grid-template-columns: 28px 1fr;
      gap: 0.6rem;
      align-items: start;
    }
    .rank {
      display: grid;
      place-items: center;
      width: 26px;
      height: 26px;
      border-radius: 8px;
      background: var(--bg-3);
      font-size: 0.75rem;
      font-weight: 700;
    }
    .ranking li:first-child .rank {
      background: var(--fg);
      color: var(--bg);
    }
    .r-body {
      display: grid;
      gap: 0.3rem;
      min-width: 0;
    }
    .r-line {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: 0.88rem;
    }
    .r-line strong {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .r-bar {
      height: 6px;
      border-radius: 99px;
      background: var(--bg-3);
      overflow: hidden;
    }
    .r-bar i {
      display: block;
      height: 100%;
      width: var(--w);
      border-radius: inherit;
      background: var(--chart-1);
    }
    .shares {
      display: grid;
      align-content: start;
      gap: 1.1rem;
    }
    .share {
      display: grid;
      gap: 0.45rem;
    }
    .share-title {
      font-weight: 600;
      color: var(--fg-2);
    }
    .stack-bar {
      display: flex;
      gap: 3px;
      height: 10px;
    }
    .stack-bar i,
    .dot {
      border-radius: 99px;
      background: var(--fg-3);
    }
    .stack-bar i {
      flex-basis: 0;
      min-width: 4px;
    }
    .stack-bar i[data-i='0'], .dot[data-i='0'] { background: var(--chart-1); }
    .stack-bar i[data-i='1'], .dot[data-i='1'] { background: var(--chart-2); }
    .stack-bar i[data-i='2'], .dot[data-i='2'] { background: var(--fg-2); }
    .stack-bar i[data-i='3'], .dot[data-i='3'] { background: var(--accent); }
    .stack-bar i[data-i='4'], .dot[data-i='4'] { background: var(--line-strong); }
    .share-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem 0.9rem;
      font-size: 0.78rem;
      color: var(--fg-2);
    }
    .share-legend span {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .share-legend b {
      color: var(--fg);
      font-weight: 600;
    }
    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
    }
    .gauge {
      position: relative;
      display: grid;
      justify-items: center;
      gap: 0.2rem;
      text-align: center;
      --g: var(--chart-1);
    }
    .gauge.warn {
      --g: var(--warning);
    }
    .gauge.crit {
      --g: var(--danger);
    }
    .gauge svg {
      width: 86px;
      height: 86px;
      transform: rotate(-90deg);
    }
    .gauge circle {
      fill: none;
      stroke-width: 6;
    }
    .gauge .track {
      stroke: var(--bg-3);
    }
    .gauge .value {
      stroke: var(--g);
      stroke-linecap: round;
      transition: stroke-dasharray 0.6s var(--ease-out);
    }
    .g-value {
      position: absolute;
      top: 28px;
      left: 0;
      right: 0;
      font-family: var(--font-display);
      font-size: 1.35rem;
      font-weight: 600;
      letter-spacing: -0.03em;
    }
    .g-value small {
      font-size: 0.6em;
      margin-left: 1px;
      color: var(--fg-3);
    }
    .g-label {
      font-weight: 600;
    }
    .g-sub {
      font-size: 0.72rem;
    }
    .health {
      display: grid;
    }
    .health li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 0.7rem 0;
      border-bottom: 1px solid var(--line);
      font-size: 0.86rem;
    }
    .health li:last-child {
      border-bottom: 0;
    }
    .health li > span:first-child {
      color: var(--fg-2);
    }
    .health li > :last-child {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
    }
    .server-live {
      margin-bottom: var(--space-5);
    }
    .storage {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1.25rem 2rem;
    }
    .storage .kv {
      flex: 1 1 240px;
    }
    .health .mono {
      font-size: 0.8rem;
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

  /** the whole period day by day (the API only returns days with events), empty days at zero */
  readonly series = computed(() => {
    const daily = this.overview()?.daily ?? [];
    if (!daily.length) return [];
    const byDate = new Map(daily.map((d) => [d.date, d]));
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const last = daily[daily.length - 1].date > today ? daily[daily.length - 1].date : today;
    const end = Date.parse(last + 'T00:00:00Z');
    const day = 86_400_000;
    return Array.from({ length: this.days() }, (_, i) => {
      const date = new Date(end - (this.days() - 1 - i) * day).toISOString().slice(0, 10);
      return byDate.get(date) ?? { date, views: 0, visitors: 0 };
    });
  });

  readonly maxY = computed(() => Math.max(1, ...this.series().map((d) => Math.max(d.views, d.visitors))));

  readonly points = computed<ChartPoint[]>(() => {
    const daily = this.series();
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
  readonly unread = signal(0);
  private readonly auth = inject(AuthService);
  readonly today = new Intl.DateTimeFormat(this.i18n.locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  readonly firstName = computed(() => {
    const me = this.auth.me();
    const n = me?.name && me.name !== me.email ? me.name : 'Maxence';
    return n.split(' ')[0];
  });

  /** sparkline of the daily series, 120 × 36 */
  spark(key: 'views' | 'visitors', area: boolean): string {
    const d = this.series();
    if (!d.length) return '';
    const max = Math.max(1, ...d.map((x) => x[key]));
    const pts = d.map((x, i) => [d.length === 1 ? 60 : (i / (d.length - 1)) * 120, 34 - (x[key] / max) * 30]);
    if (pts.length === 1) pts.splice(0, 1, [0, pts[0][1]], [120, pts[0][1]]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    return area ? line + ' L120 36 L0 36 Z' : line;
  }

  barShare(v: number, max: number): number {
    return max ? Math.max(3, Math.round((v / max) * 100)) : 0;
  }

  perVisitor(views: number, visitors: number): string {
    return new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 1 }).format(visitors ? views / visitors : 0);
  }

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      void this.load();
      this.api.adminInfo().then((i) => this.info.set(i)).catch(() => undefined);
      this.api.unreadCount().then((r) => this.unread.set(r.unread)).catch(() => undefined);
      const sample = (): void => {
        this.api.systemInfo().then((s) => this.system.set(s)).catch(() => undefined);
      };
      sample();
      // disk and stored data move slowly; CPU and memory are followed live by <app-live-metrics>
      const timer = setInterval(sample, 60_000);
      destroyRef.onDestroy(() => clearInterval(timer));
    });
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
      const [overview, vitals, sites, errors] = await Promise.all([
        this.api.analytics(this.days()),
        this.api.vitals(this.days()).catch(() => null),
        this.api.siteHistory().catch(() => null),
        this.api.errorSummary().catch(() => null),
      ]);
      this.overview.set(overview);
      this.vitals.set(vitals);
      this.sites.set(sites);
      this.openErrors.set(errors?.open ?? 0);
    } catch (e) {
      this.error.set(String(e));
    }
  }

  // ── live sites ─────────────────────────────────────────────────────────
  readonly sites = signal<SiteHistory[] | null>(null);
  readonly openErrors = signal(0);

  host(url: string): string {
    return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
  }

  percent(v: number | null | undefined): string {
    return v == null ? '—' : new Intl.NumberFormat(this.i18n.locale(), { style: 'percent', maximumFractionDigits: 1 }).format(v);
  }

  /** the last 24 hours, one bar per hour: height = response time, colour = share of good checks */
  hourBars(site: SiteHistory): { key: string; state: string; height: number; label: string }[] {
    const byHour = new Map(site.hours.map((h) => [new Date(h.hour).getTime(), h]));
    const max = Math.max(300, ...site.hours.map((h) => h.latencyMs ?? 0));
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const fmt = new Intl.DateTimeFormat(this.i18n.locale(), { hour: '2-digit', minute: '2-digit' });
    const out = [];
    for (let i = 23; i >= 0; i--) {
      const t = now.getTime() - i * 3_600_000;
      const h = byHour.get(t);
      const state = !h ? 'none' : h.up >= 0.999 ? 'up' : h.up > 0 ? 'partial' : 'down';
      const height = !h ? 12 : h.latencyMs == null ? 100 : Math.max(14, Math.round((h.latencyMs / max) * 100));
      const label = fmt.format(new Date(t)) + (h ? ' · ' + (h.latencyMs ?? '—') + ' ms · ' + Math.round(h.up * 100) + ' %' : '');
      out.push({ key: String(t), state, height, label });
    }
    return out;
  }

  // ── Core Web Vitals ────────────────────────────────────────────────────
  readonly vitals = signal<VitalsOverview | null>(null);
  readonly hasVitals = computed(() => (this.vitals()?.metrics ?? []).some((m) => m.samples > 0));
  readonly devices = computed(() =>
    Object.entries(this.vitals()?.byDevice ?? {})
      .map(([key, stats]) => ({ key, stats }))
      .filter((d) => d.stats.some((s) => s.samples > 0)),
  );
  private static readonly LIMITS: Record<VitalMetric, [number, number]> = {
    LCP: [2500, 4000],
    INP: [200, 500],
    CLS: [0.1, 0.25],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
  };

  rating(metric: VitalMetric | string, value: number | null | undefined): 'good' | 'ni' | 'poor' | null {
    if (value == null) return null;
    const [good, poor] = DashboardPage.LIMITS[metric as VitalMetric];
    return value <= good ? 'good' : value <= poor ? 'ni' : 'poor';
  }

  format(metric: VitalMetric | string, value: number): string {
    if (metric === 'CLS') return value.toFixed(2);
    return value >= 1000 ? (value / 1000).toLocaleString(this.i18n.locale(), { maximumFractionDigits: 1 }) + ' s' : Math.round(value) + ' ms';
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

  /** share of the largest row (bars), or of the total (ofTotal) */
  pct(row: KeyCount, rows: KeyCount[], ofTotal = false): number {
    const base = ofTotal ? rows.reduce((n, r) => n + r.count, 0) : Math.max(...rows.map((r) => r.count));
    return Math.round((row.count / Math.max(1, base)) * 100);
  }

  uptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return d ? `${d} j ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
  }
}
