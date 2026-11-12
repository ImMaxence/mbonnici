import { Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import type { ContactMessage } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';

type Box = 'inbox' | 'archive';

@Component({
  selector: 'app-admin-messages',
  imports: [TranslatePipe, IconComponent, TooltipDirective],
  template: `
    <div class="admin-head">
      <div>
        <h1>{{ 'admin.messages.title' | t }}</h1>
        <p class="muted small">{{ 'admin.messages.count' | t: { n: total() } }}</p>
      </div>
      <div class="row tools">
        <div class="lang-tabs" role="tablist" [attr.aria-label]="'admin.messages.boxes' | t">
          <button type="button" role="tab" [attr.aria-selected]="box() === 'inbox'" (click)="setBox('inbox')">{{ 'admin.messages.inbox' | t }}</button>
          <button type="button" role="tab" [attr.aria-selected]="box() === 'archive'" (click)="setBox('archive')">
            {{ 'admin.messages.archive' | t }}
            @if (archivedCount()) {
              <span class="count mono">{{ archivedCount() }}</span>
            }
          </button>
        </div>
        @if (box() === 'inbox') {
          <label class="row" style="gap:.6rem">
            <button type="button" class="switch" role="switch" [attr.aria-checked]="unreadOnly()" (click)="toggleUnread()"></button>
            {{ 'admin.messages.unreadOnly' | t }}
          </label>
        }
      </div>
    </div>

    <div class="search">
      <app-icon name="search" [size]="16" class="search-icon" />
      <input
        class="input"
        type="search"
        [value]="query()"
        (input)="search($any($event.target).value)"
        [placeholder]="'admin.messages.search' | t"
        [attr.aria-label]="'admin.messages.search' | t"
      />
    </div>

    @if (!items().length) {
      <div class="panel">
        <p class="muted">{{ (query() ? 'admin.messages.noMatch' : box() === 'archive' ? 'admin.messages.archiveEmpty' : 'admin.messages.empty') | t }}</p>
      </div>
    }
    <div class="stack">
      @for (m of items(); track m.id) {
        <article class="message-card" [class.is-unread]="!m.read">
          <header class="msg-head">
            <span class="avatar" aria-hidden="true">{{ m.name.charAt(0).toUpperCase() }}</span>
            <div class="who">
              <strong>{{ m.name }}</strong>
              <a class="small faint" [href]="'mailto:' + m.email">{{ m.email }}</a>
            </div>
            <div class="meta">
              @if (!m.read) {
                <span class="status-pill" data-status="PUBLISHED">{{ 'admin.messages.new' | t }}</span>
              }
              @if (m.locale) {
                <span class="status-pill">{{ m.locale.toUpperCase() }}</span>
              }
              <span class="small faint mono">{{ i18n.formatDate(m.createdAt, { dateStyle: 'medium', timeStyle: 'short' }) }}</span>
            </div>
          </header>
          <pre>{{ m.message }}</pre>
          <div class="msg-actions">
            <a class="btn" [href]="replyLink(m)" (click)="replied(m)"><app-icon name="send" [size]="14" /> {{ 'admin.messages.reply' | t }}</a>
            <button type="button" class="icon-btn" (click)="mark(m, !m.read)" [appTip]="(m.read ? 'admin.messages.markUnread' : 'admin.messages.markRead') | t">
              <app-icon [name]="m.read ? 'eye' : 'check'" [size]="15" />
            </button>
            <button type="button" class="icon-btn" (click)="archive(m, !m.archived)" [appTip]="(m.archived ? 'admin.messages.unarchive' : 'admin.messages.archiveOne') | t">
              <app-icon [name]="m.archived ? 'inbox' : 'archive'" [size]="15" />
            </button>
            <button type="button" class="icon-btn danger" (click)="remove(m)" [appTip]="'admin.messages.delete' | t"><app-icon name="trash" [size]="15" /></button>
          </div>
        </article>
      }
    </div>
  `,
  styles: `
    .tools {
      gap: 1rem;
      flex-wrap: wrap;
    }
    .count {
      margin-left: 0.35rem;
      font-size: 0.7rem;
      opacity: 0.7;
    }
    .search {
      position: relative;
      max-width: 520px;
      margin-bottom: 1rem;
    }
    .search .input {
      padding-left: 2.3rem;
    }
    .search-icon {
      position: absolute;
      left: 0.8rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--fg-3);
      pointer-events: none;
    }
    .msg-head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: var(--bg-3);
      font-weight: 700;
    }
    .who {
      display: grid;
      line-height: 1.3;
    }
    .who a:hover {
      color: var(--accent);
    }
    .who {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-left: auto;
    }
    pre {
      padding-left: 50px;
    }
    /* the icon buttons (34px) sit on the middle line of "Reply" (38px) */
    .msg-actions {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding-left: 50px;
    }
    /* phones: the text takes the full width instead of lining up under the name */
    @media (max-width: 719px) {
      pre,
      .msg-actions {
        padding-left: 0;
      }
      .meta {
        flex-basis: 100%;
        margin-left: 0;
      }
    }
  `,
})
export class MessagesPage {
  private readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);
  private readonly confirmDialog = inject(ConfirmService);

  readonly items = signal<ContactMessage[]>([]);
  readonly total = signal(0);
  readonly archivedCount = signal(0);
  readonly unreadOnly = signal(false);
  readonly box = signal<Box>('inbox');
  readonly query = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    afterNextRender(() => this.load());
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  async load(): Promise<void> {
    const archived = this.box() === 'archive';
    const [page, counts] = await Promise.all([
      this.api.messages(0, !archived && this.unreadOnly(), archived, this.query()),
      this.api.unreadCount(),
    ]);
    this.items.set(page.items);
    this.total.set(page.total);
    this.archivedCount.set(counts.archived ?? 0);
  }

  setBox(box: Box): void {
    if (box === this.box()) return;
    this.box.set(box);
    void this.load();
  }

  toggleUnread(): void {
    this.unreadOnly.update((v) => !v);
    void this.load();
  }

  /** searches as you type (debounced) */
  search(value: string): void {
    this.query.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.load(), 250);
  }

  /** mailto: with the subject and the original message quoted */
  replyLink(m: ContactMessage): string {
    const date = this.i18n.formatDate(m.createdAt, { dateStyle: 'long', timeStyle: 'short' });
    const fr = (m.locale ?? this.i18n.lang()) !== 'en';
    const intro = fr ? `Bonjour ${m.name},\n\n\n\n` : `Hello ${m.name},\n\n\n\n`;
    const quoted = m.message
      .split('\n')
      .map((l) => '> ' + l)
      .join('\n');
    const header = fr ? `Le ${date}, ${m.name} a écrit :` : `On ${date}, ${m.name} wrote:`;
    const subject = fr ? 'Re : votre message sur mbonnici.fr' : 'Re: your message on mbonnici.fr';
    return `mailto:${m.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(intro + header + '\n' + quoted)}`;
  }

  /** replying counts as reading */
  replied(m: ContactMessage): void {
    if (!m.read) void this.mark(m, true);
  }

  async mark(m: ContactMessage, read: boolean): Promise<void> {
    const updated = await this.api.markRead(m.id, read);
    this.items.update((list) => list.map((x) => (x.id === m.id ? updated : x)));
  }

  async archive(m: ContactMessage, value: boolean): Promise<void> {
    await this.api.archiveMessage(m.id, value);
    // it leaves the current box
    this.items.update((list) => list.filter((x) => x.id !== m.id));
    this.total.update((t) => Math.max(0, t - 1));
    this.archivedCount.update((n) => Math.max(0, n + (value ? 1 : -1)));
  }

  async remove(m: ContactMessage): Promise<void> {
    const ok = await this.confirmDialog.ask({
      title: this.i18n.t('admin.messages.confirmDelete'),
      message: this.i18n.t('admin.common.irreversible'),
      confirm: this.i18n.t('admin.messages.delete'),
      danger: true,
    });
    if (!ok) return;
    await this.api.deleteMessage(m.id);
    this.items.update((list) => list.filter((x) => x.id !== m.id));
    this.total.update((t) => t - 1);
  }
}
