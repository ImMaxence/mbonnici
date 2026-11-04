import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { ApiService } from '../../core/api/api.service';
import type { Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { LinkDirective } from '../../shared/curtain/link.directive';
import { MagneticDirective } from '../../shared/cursor/magnetic.directive';
import { FooterComponent } from '../../shared/ui/footer.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { RevealDirective } from '../../shared/ui/reveal.directive';

type State = 'idle' | 'sending' | 'sent' | 'error' | 'limited';

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

@Component({
  selector: 'app-contact',
  imports: [FormsModule, TranslatePipe, LinkDirective, MagneticDirective, FooterComponent, IconComponent, RevealDirective],
  template: `
    <main id="main" class="page">
      <header class="container head">
        <span class="eyebrow" appReveal>{{ 'nav.contact' | t }}</span>
        <h1 class="display" appReveal revealSplit="words">{{ 'home.letsTalk' | t }}</h1>
        <p class="lead" appReveal [revealDelay]="200">{{ 'contact.subtitle' | t }}</p>
      </header>

      <section class="container layout">
        <div class="direct">
          <div class="block" appReveal>
            <span class="eyebrow">{{ 'contact.direct' | t }}</span>
            @if (settings()?.publicEmail; as mail) {
              <a class="big-mail" [href]="'mailto:' + mail">{{ mail }}</a>
              <button type="button" class="btn btn-ghost" (click)="copy(mail)" appMagnetic>
                <app-icon [name]="copied() ? 'check' : 'copy'" [size]="16" />
                {{ (copied() ? 'common.copied' : 'common.copyEmail') | t }}
              </button>
            }
            @if (settings()?.availability; as state) {
              <span class="availability" [attr.data-state]="state"><i class="dot"></i>{{ 'availability.' + state | t }}</span>
            }
          </div>
          <div class="block" appReveal [revealDelay]="100">
            <span class="eyebrow">{{ 'contact.socials' | t }}</span>
            <div class="row">
              @if (settings()?.githubUrl; as gh) {
                <a class="btn btn-ghost" [href]="gh" target="_blank" rel="noopener noreferrer me" appMagnetic><app-icon name="github" [size]="16" /> GitHub</a>
              }
              @if (settings()?.linkedinUrl; as li) {
                <a class="btn btn-ghost" [href]="li" target="_blank" rel="noopener noreferrer me" appMagnetic><app-icon name="linkedin" [size]="16" /> LinkedIn</a>
              }
            </div>
          </div>
        </div>

        <div class="card form-card" appReveal [revealDelay]="150">
          @if (state() === 'sent') {
            <div class="sent">
              <span class="check"><app-icon name="check" [size]="28" /></span>
              <h2 class="h3">{{ 'contact.form.sent' | t }}</h2>
              <p class="muted">{{ 'contact.form.sentSub' | t }}</p>
              <button type="button" class="btn btn-ghost" (click)="reset()">{{ 'contact.form.another' | t }}</button>
            </div>
          } @else {
            <form (ngSubmit)="submit()" novalidate>
              <h2 class="h3">{{ 'contact.form.title' | t }}</h2>
              <div class="field">
                <label for="c-name">{{ 'contact.form.name' | t }}</label>
                <input id="c-name" class="input" name="name" autocomplete="name" [(ngModel)]="model.name" [placeholder]="'contact.form.namePh' | t" [attr.aria-invalid]="errors().name ? 'true' : null" (blur)="touch('name')" />
                @if (errors().name) {
                  <span class="field-error">{{ errors().name }}</span>
                }
              </div>
              <div class="field">
                <label for="c-email">{{ 'contact.form.email' | t }}</label>
                <input id="c-email" class="input" name="email" type="email" autocomplete="email" [(ngModel)]="model.email" [placeholder]="'contact.form.emailPh' | t" [attr.aria-invalid]="errors().email ? 'true' : null" (blur)="touch('email')" />
                @if (errors().email) {
                  <span class="field-error">{{ errors().email }}</span>
                }
              </div>
              <div class="field">
                <label for="c-message">{{ 'contact.form.message' | t }}</label>
                <textarea id="c-message" class="textarea" name="message" [(ngModel)]="model.message" [placeholder]="'contact.form.messagePh' | t" [attr.aria-invalid]="errors().message ? 'true' : null" (blur)="touch('message')"></textarea>
                @if (errors().message) {
                  <span class="field-error">{{ errors().message }}</span>
                }
              </div>
              <div class="honeypot" aria-hidden="true">
                <label for="c-website">Website</label>
                <input id="c-website" name="website" tabindex="-1" autocomplete="off" [(ngModel)]="model.website" />
              </div>
              <p class="field-hint">
                {{ privacyPrefix() }}<a class="link" [appLink]="i18n.path('privacy')" [linkLabel]="'footer.privacy' | t">{{ 'contact.form.privacyLink' | t }}</a>{{ privacySuffix() }}
              </p>
              @if (state() === 'error') {
                <p class="field-error" role="alert">{{ 'contact.form.error' | t }}</p>
              }
              @if (state() === 'limited') {
                <p class="field-error" role="alert">{{ 'contact.form.rateLimited' | t }}</p>
              }
              <button type="submit" class="btn btn-accent btn-lg" [disabled]="state() === 'sending'" appMagnetic>
                {{ (state() === 'sending' ? 'contact.form.sending' : 'contact.form.send') | t }}
                <app-icon class="arrow" name="send" [size]="16" />
              </button>
            </form>
          }
        </div>
      </section>

      <app-footer [settings]="settings()" />
    </main>
  `,
  styles: `
    .head {
      display: grid;
      gap: var(--space-4);
      padding: var(--space-9) 0 var(--space-7);
      justify-items: start;
    }
    .head > * {
      max-width: 900px;
    }
    .layout {
      display: grid;
      gap: var(--space-7);
    }
    @media (min-width: 900px) {
      .layout {
        grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
        align-items: start;
      }
    }
    .direct {
      display: grid;
      gap: var(--space-7);
    }
    .block {
      display: grid;
      gap: var(--space-4);
      justify-items: start;
    }
    .big-mail {
      font-family: var(--font-mono);
      font-size: clamp(1.1rem, 2.1vw, 1.7rem);
      letter-spacing: -0.01em;
      overflow-wrap: anywhere;
      transition: color var(--dur-2);
    }
    .big-mail:hover {
      color: var(--accent);
    }
    .form-card {
      padding: clamp(1.5rem, 4vw, 2.5rem);
    }
    form {
      display: grid;
      gap: var(--space-5);
    }
    .sent {
      display: grid;
      gap: var(--space-3);
      justify-items: start;
      padding: var(--space-4) 0;
    }
    .check {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--success);
      color: #fff;
    }
  `,
})
export class ContactPage {
  private readonly api = inject(ApiService);
  private readonly seo = inject(SeoService);
  private readonly analytics = inject(AnalyticsService);
  readonly i18n = inject(I18nService);

  /** resolved by the route and bound as an input */
  readonly settings = input<Settings>();
  readonly state = signal<State>('idle');
  readonly copied = signal(false);
  readonly model = { name: '', email: '', message: '', website: '' };
  private readonly touched = signal<Record<string, boolean>>({});
  private readonly submitted = signal(false);
  private readonly version = signal(0);

  readonly errors = computed<FormErrors>(() => {
    this.version();
    const t = this.touched();
    const all = this.submitted();
    const dict = this.i18n.dict().contact.form;
    const out: FormErrors = {};
    const show = (k: string): boolean => all || !!t[k];
    if (show('name') && this.model.name.trim().length < 2) out['name'] = dict.required;
    if (show('email')) {
      if (!this.model.email.trim()) out['email'] = dict.required;
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.model.email.trim())) out['email'] = dict.invalidEmail;
    }
    if (show('message') && this.model.message.trim().length < 10) out['message'] = dict.tooShort;
    return out;
  });

  readonly privacyPrefix = computed(() => this.i18n.t('contact.form.privacy').split('{link}')[0]);
  readonly privacySuffix = computed(() => this.i18n.t('contact.form.privacy').split('{link}')[1] ?? '');

  constructor() {
    effect(() => {
      this.i18n.lang();
      this.seo.set({
        title: this.i18n.t('meta.contact.title'),
        description: this.i18n.t('meta.contact.description'),
        page: 'contact',
        jsonLd: { '@type': 'ContactPage', url: this.seo.origin + this.i18n.path('contact'), about: { '@id': `${this.seo.origin}/#person` } },
      });
    });
  }

  touch(field: string): void {
    this.touched.update((t) => ({ ...t, [field]: true }));
    this.version.update((v) => v + 1);
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.version.update((v) => v + 1);
    if (Object.keys(this.errors()).length) return;
    this.state.set('sending');
    try {
      await this.api.sendContact({
        name: this.model.name.trim(),
        email: this.model.email.trim(),
        message: this.model.message.trim(),
        locale: this.i18n.lang(),
        website: this.model.website,
      });
      this.analytics.contactSubmitted(this.i18n.path('contact'));
      this.state.set('sent');
    } catch (e) {
      this.state.set(e instanceof HttpErrorResponse && e.status === 429 ? 'limited' : 'error');
    }
  }

  reset(): void {
    this.model.name = '';
    this.model.email = '';
    this.model.message = '';
    this.touched.set({});
    this.submitted.set(false);
    this.state.set('idle');
  }

  async copy(mail: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(mail);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }
}
