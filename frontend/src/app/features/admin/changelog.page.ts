import { Component, afterNextRender, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MarkdownComponent } from '../../shared/ui/markdown.component';
import { APP_VERSION } from '../../../environments/version';

interface Release {
  version: string;
  date: string | null;
  body: string;
  current: boolean;
  unreleased: boolean;
}

/** Renders CHANGELOG.md (copied to /changelog.md at build time) as a version timeline. */
@Component({
  selector: 'app-admin-changelog',
  imports: [TranslatePipe, MarkdownComponent],
  template: `
    <div class="admin-head">
      <div>
        <h1>{{ 'admin.changelog.title' | t }}</h1>
        <p class="muted small">{{ 'admin.changelog.intro' | t }}</p>
      </div>
      <span class="chip mono">v{{ version.version }}</span>
    </div>

    @if (error()) {
      <p class="field-error">{{ 'admin.changelog.error' | t }}</p>
    }

    <ol class="timeline">
      @for (r of releases(); track r.version) {
        <li class="release" [class.is-current]="r.current">
          <div class="marker"></div>
          <div class="panel">
            <div class="row between" style="margin-bottom: .6rem">
              <h2 class="h3 mono">{{ r.unreleased ? ('admin.changelog.unreleased' | t) : 'v' + r.version }}</h2>
              <span class="row" style="gap:.5rem">
                @if (r.date) {
                  <span class="faint small mono">{{ r.date }}</span>
                }
                @if (r.current) {
                  <span class="chip chip-accent">{{ 'admin.changelog.current' | t }}</span>
                }
              </span>
            </div>
            @if (r.body.trim()) {
              <app-md [text]="r.body" />
            } @else {
              <p class="faint small">—</p>
            }
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    .timeline {
      display: grid;
      gap: var(--space-5);
      position: relative;
      padding-left: 28px;
    }
    .timeline::before {
      content: '';
      position: absolute;
      left: 7px;
      top: 8px;
      bottom: 8px;
      width: 2px;
      background: var(--line);
    }
    /* min-width: a long path or URL in a release note no longer widens the page */
    .release {
      position: relative;
      min-width: 0;
    }
    .release app-md {
      overflow-wrap: anywhere;
    }
    .marker {
      position: absolute;
      left: -28px;
      top: 22px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--bg-3);
      border: 2px solid var(--line-strong);
    }
    .release.is-current .marker {
      background: var(--accent);
      border-color: var(--accent);
      box-shadow: 0 0 0 6px var(--accent-soft);
    }
    .release .panel {
      margin: 0;
    }
    .release app-md {
      font-size: var(--fs-small);
      max-width: none;
    }
  `,
})
export class ChangelogPage {
  private readonly http = inject(HttpClient);
  readonly version = APP_VERSION;
  readonly releases = signal<Release[]>([]);
  readonly error = signal(false);

  constructor() {
    afterNextRender(() => void this.load());
  }

  private async load(): Promise<void> {
    try {
      const md = await firstValueFrom(this.http.get('/changelog.md', { responseType: 'text' }));
      this.releases.set(parseChangelog(md, this.version.version));
    } catch {
      this.error.set(true);
    }
  }
}

export function parseChangelog(markdown: string, current: string): Release[] {
  const out: Release[] = [];
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let active: Release | null = null;
  let buffer: string[] = [];
  const flush = (): void => {
    if (active) {
      active.body = buffer.join('\n').trim();
      out.push(active);
    }
    buffer = [];
  };
  for (const line of lines) {
    const head = /^##\s+\[?([^\]\s]+)\]?\s*(?:[—–-]+\s*(\S.*))?$/.exec(line);
    if (head) {
      flush();
      const version = head[1];
      const unreleased = /unreleased/i.test(version);
      active = { version, date: head[2]?.trim() ?? null, body: '', current: version === current, unreleased };
      continue;
    }
    if (/^\[[^\]]+\]:\s+https?:\/\//.test(line)) continue; // link reference definitions
    if (active) buffer.push(line);
  }
  flush();
  // an empty "Unreleased" section is only a placeholder
  return out.filter((r) => !(r.unreleased && !r.body));
}
