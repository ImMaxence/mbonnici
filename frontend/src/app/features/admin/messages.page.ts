import { Component, afterNextRender, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import type { ContactMessage } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-admin-messages',
  imports: [TranslatePipe, IconComponent],
  template: `
    <div class="admin-head">
      <h1>{{ 'admin.messages.title' | t }} <span class="faint">({{ total() }})</span></h1>
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
          <div class="row between">
            <div>
              <strong>{{ m.name }}</strong> <span class="faint">&lt;{{ m.email }}&gt;</span>
              @if (m.locale) {
                <span class="chip" style="margin-left:.5rem">{{ m.locale }}</span>
              }
            </div>
            <span class="small faint mono">{{ i18n.formatDate(m.createdAt, { dateStyle: 'medium', timeStyle: 'short' }) }}</span>
          </div>
          <pre>{{ m.message }}</pre>
          <div class="row" style="gap:.4rem">
            <a class="chip" [href]="'mailto:' + m.email + '?subject=Re: mbonnici.fr'"><app-icon name="send" [size]="12" /> {{ 'admin.messages.reply' | t }}</a>
            <button type="button" class="chip" (click)="mark(m, !m.read)">
              <app-icon [name]="m.read ? 'eye' : 'check'" [size]="12" /> {{ (m.read ? 'admin.messages.markUnread' : 'admin.messages.markRead') | t }}
            </button>
            <button type="button" class="chip" (click)="remove(m)"><app-icon name="trash" [size]="12" /> {{ 'admin.messages.delete' | t }}</button>
          </div>
        </article>
      }
    </div>
  `,
})
export class MessagesPage {
  private readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);

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
    if (!confirm(this.i18n.t('admin.messages.confirmDelete'))) return;
    await this.api.deleteMessage(m.id);
    this.items.update((list) => list.filter((x) => x.id !== m.id));
    this.total.update((t) => t - 1);
  }
}
