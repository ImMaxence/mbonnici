import { Component, afterNextRender, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import type { ContactMessage } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';

@Component({
  selector: 'app-admin-messages',
  imports: [TranslatePipe, IconComponent, TooltipDirective],
  template: `
    <div class="admin-head">
      <div>
        <h1>{{ 'admin.messages.title' | t }}</h1>
        <p class="muted small">{{ 'admin.messages.count' | t: { n: total() } }}</p>
      </div>
      <label class="row" style="gap:.6rem">
        <button type="button" class="switch" role="switch" [attr.aria-checked]="unreadOnly()" (click)="toggleUnread()"></button>
        {{ 'admin.messages.unreadOnly' | t }}
      </label>
    </div>

    @if (!items().length) {
      <div class="panel"><p class="muted">{{ 'admin.messages.empty' | t }}</p></div>
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
            <a class="btn" [href]="'mailto:' + m.email + '?subject=Re: mbonnici.fr'"><app-icon name="send" [size]="14" /> {{ 'admin.messages.reply' | t }}</a>
            <button type="button" class="icon-btn" (click)="mark(m, !m.read)" [appTip]="(m.read ? 'admin.messages.markUnread' : 'admin.messages.markRead') | t">
              <app-icon [name]="m.read ? 'eye' : 'check'" [size]="15" />
            </button>
            <button type="button" class="icon-btn danger" (click)="remove(m)" [appTip]="'admin.messages.delete' | t"><app-icon name="trash" [size]="15" /></button>
          </div>
        </article>
      }
    </div>
  `,
  styles: `
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
    .meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-left: auto;
    }
    pre {
      padding-left: 50px;
    }
    .msg-actions {
      display: flex;
      gap: 0.4rem;
      padding-left: 50px;
    }
  `,
})
export class MessagesPage {
  private readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);
  private readonly confirmDialog = inject(ConfirmService);

  readonly items = signal<ContactMessage[]>([]);
  readonly total = signal(0);
  readonly unreadOnly = signal(false);

  constructor() {
    afterNextRender(() => this.load());
  }

  async load(): Promise<void> {
    const page = await this.api.messages(0, this.unreadOnly());
    this.items.set(page.items);
    this.total.set(page.total);
  }

  toggleUnread(): void {
    this.unreadOnly.update((v) => !v);
    void this.load();
  }

  async mark(m: ContactMessage, read: boolean): Promise<void> {
    const updated = await this.api.markRead(m.id, read);
    this.items.update((list) => list.map((x) => (x.id === m.id ? updated : x)));
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
