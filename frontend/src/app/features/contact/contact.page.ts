import { Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { ApiService } from '../../core/api/api.service';
import type { ProjectCard, Settings } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { ThemeService } from '../../core/theme/theme.service';
import { LinkDirective } from '../../shared/curtain/link.directive';
import { MagneticDirective } from '../../shared/cursor/magnetic.directive';
import { FooterComponent } from '../../shared/ui/footer.component';
import { cvLink } from '../../shared/ui/cv';
import { IconComponent } from '../../shared/ui/icon.component';
import { RevealDirective } from '../../shared/ui/reveal.directive';
import { CaptchaService } from './captcha.service';

type State = 'idle' | 'sending' | 'sent' | 'error' | 'limited' | 'captchaBlocked' | 'captchaFailed';

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
  consent?: string;
}

@Component({
  selector: 'app-contact',
  imports: [FormsModule, TranslatePipe, LinkDirective, MagneticDirective, FooterComponent, IconComponent, RevealDirective],
  template: `
    <main id="main" class="page">
      <header class="container head">
        <span class="eyebrow" appReveal>{{ 'nav.contact' | t }}</span>
        <h1 class="display" appReveal revealSplit="words">
          {{ 'contact.titleA' | t }} <span class="accent-word">{{ 'contact.titleB' | t }}</span>
        </h1>
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
          @if (settings()?.bookingUrl; as booking) {
            <div class="block" appReveal [revealDelay]="60">
              <span class="eyebrow">{{ 'contact.booking' | t }}</span>
              <a class="btn btn-ghost" [href]="booking" target="_blank" rel="noopener noreferrer" appMagnetic>
                <app-icon name="calendar" [size]="16" /> {{ 'contact.bookingCta' | t }}
              </a>
              <p class="small faint booking-hint">{{ 'contact.bookingHint' | t }}</p>
            </div>
          }
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
          @if (cv(); as c) {
            <div class="block" appReveal [revealDelay]="150">
              <span class="eyebrow">{{ 'contact.cv' | t }}</span>
              <a class="btn btn-ghost cv" [href]="c.href" download (click)="cvDownloaded()" appMagnetic>
                <app-icon name="download" [size]="16" /> {{ 'contact.cvDownload' | t }}
                <span class="cv-meta">PDF · {{ c.size }}@if (c.lang !== i18n.lang()) { · {{ 'contact.cvIn.' + c.lang | t }}}</span>
              </a>
            </div>
          }
        </div>

        <div class="card form-card" appReveal [revealDelay]="150">
          @if (state() === 'sent') {
            <div class="sent">
              <span class="check"><app-icon name="check" [size]="28" /></span>
              <h2 class="h3">{{ 'contact.form.sent' | t }}</h2>
              <p class="muted">{{ 'contact.form.sentSub' | t }}</p>
              <button type="button" class="btn btn-ghost" (click)="reset()" appMagnetic>{{ 'contact.form.another' | t }}</button>
            </div>
          } @else {
            <form (ngSubmit)="submit()" novalidate>
              <h2 class="h3">{{ 'contact.form.title' | t }}</h2>
              @if (about(); as p) {
                <p class="about-project small">
                  <span class="faint">{{ 'contact.form.about' | t }}</span>
                  <strong>{{ i18n.l(p.title) }}</strong>
                </p>
              }
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
              @if (captchaKey()) {
                <div class="consent">
                  @if (captchaStage() !== 'on') {
                    <p class="field-hint">{{ 'contact.form.captchaConsent' | t }}</p>
                    <button type="button" class="btn btn-ghost" [disabled]="captchaStage() === 'loading'" (click)="activateCaptcha()" appMagnetic>
                      {{ (captchaStage() === 'loading' ? 'contact.form.captchaLoading' : 'contact.form.captchaActivate') | t }}
                    </button>
                  }
                  <div #captchaSlot class="captcha-slot"></div>
                  @if (errors().consent) {
                    <span class="field-error">{{ errors().consent }}</span>
                  }
                </div>
              }
              <p class="field-hint privacy">
                <span>{{ 'contact.form.privacy' | t }}</span>
                <a class="link" [appLink]="i18n.path('privacy')" [linkLabel]="'footer.privacy' | t">{{ 'contact.form.privacyLink' | t }}</a>
              </p>
              @if (state() === 'error') {
                <p class="field-error" role="alert">{{ 'contact.form.error' | t }}</p>
              }
              @if (state() === 'limited') {
                <p class="field-error" role="alert">{{ 'contact.form.rateLimited' | t }}</p>
              }
              @if (state() === 'captchaBlocked') {
                <p class="field-error" role="alert">{{ 'contact.form.captchaBlocked' | t }}</p>
              }
              @if (state() === 'captchaFailed') {
                <p class="field-error" role="alert">{{ 'contact.form.captchaFailed' | t }}</p>
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
    .booking-hint {
      margin-top: 0.5rem;
    }
    .cv-meta {
      font-family: var(--font-mono);
      font-size: var(--fs-micro);
      letter-spacing: 0.02em;
      color: var(--fg-3);
      font-weight: 400;
    }
    .about-project {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin: -0.4rem 0 0.2rem;
      padding: 0.6rem 0.8rem;
      border-radius: 10px;
      background: var(--accent-soft);
    }
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
      font-family: var(--font-display);
      font-size: clamp(1.5rem, 1rem + 2.4vw, 3rem);
      font-weight: var(--weight-display);
      letter-spacing: -0.04em;
      line-height: 1.05;
      overflow-wrap: anywhere;
      transition: color var(--dur-2);
    }
    @media (hover: hover) {
      .big-mail:hover {
        color: var(--accent);
      }
    }
    .form-card {
      padding: clamp(1.5rem, 4vw, 2.75rem);
      background: var(--bg-2);
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
    .consent {
      display: grid;
      gap: 0.6rem;
      justify-items: start;
    }
    .captcha-slot {
      justify-self: stretch;
      /* Google's frame is a light page: on the dark theme the mismatch paints its transparent edge white */
      color-scheme: light;
    }
    .privacy {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 0.75rem;
      align-items: baseline;
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
  private readonly captcha = inject(CaptchaService);
  private readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);

  /** resolved by the route and bound as an input */
  readonly settings = input<Settings>();
  /** published projects (to name the one in ?project=) */
  readonly projects = input<ProjectCard[]>();
  /** ?project=slug: coming from "a similar project?" on a project page */
  readonly project = input<string | undefined>();
  readonly about = computed(() => {
    const slug = this.project();
    return slug ? ((this.projects() ?? []).find((p) => p.slug === slug) ?? null) : null;
  });
  readonly cv = computed(() => cvLink(this.settings(), this.i18n.lang(), this.i18n.locale()));
  readonly state = signal<State>('idle');
  readonly copied = signal(false);
  /** present once the site has its reCAPTCHA keys */
  readonly captchaKey = computed(() => this.settings()?.captchaSiteKey);
  /** Google's box is only requested when the visitor asks for it */
  readonly captchaStage = signal<'off' | 'loading' | 'on'>('off');
  private readonly captchaToken = signal<string | null>(null);
  private readonly captchaSlot = viewChild<ElementRef<HTMLElement>>('captchaSlot');
  readonly model = { name: '', email: '', message: '', website: '' };
  private prefilled = '';
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
    if (all && this.captchaKey() && !this.captchaToken()) out['consent'] = dict.captchaRequired;
    return out;
  });


  constructor() {
    // Google sets the box's colours and language when drawing it
    effect(() => {
      this.theme.resolved();
      this.i18n.lang();
      untracked(() => {
        if (this.captchaStage() === 'on') void this.drawCaptcha();
      });
    });
    // a first line about the project the visitor came from (kept if they already typed something)
    effect(() => {
      const p = this.about();
      this.i18n.lang();
      untracked(() => {
        if (!p) return;
        const text = this.i18n.t('contact.form.prefill', { title: this.i18n.l(p.title) });
        if (!this.model.message.trim() || this.model.message === this.prefilled) {
          this.model.message = text;
          this.prefilled = text;
          this.version.update((v) => v + 1);
        }
      });
    });
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

  /** this click is the visitor's agreement: Google is contacted from here on, not before */
  activateCaptcha(): void {
    if (this.state() === 'captchaBlocked') this.state.set('idle');
    this.captchaStage.set('loading');
    void this.drawCaptcha();
  }

  private async drawCaptcha(): Promise<void> {
    const key = this.captchaKey();
    const slot = this.captchaSlot()?.nativeElement;
    if (!key || !slot) return;
    this.captchaToken.set(null);
    try {
      await this.captcha.show(slot, key, { theme: this.theme.resolved(), lang: this.i18n.lang() }, {
        token: (token) => this.captchaToken.set(token),
        failed: () => this.captchaUnavailable(),
      });
      this.captchaStage.set('on');
    } catch {
      this.captchaUnavailable();
    }
  }

  private captchaUnavailable(): void {
    this.captchaToken.set(null);
    this.captchaStage.set('off');
    this.state.set('captchaBlocked');
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
        captcha: this.captchaToken() ?? undefined,
      });
      this.analytics.contactSubmitted(this.i18n.path('contact'));
      this.state.set('sent');
    } catch (e) {
      const status = e instanceof HttpErrorResponse ? e.status : 0;
      this.state.set(status === 429 ? 'limited' : status === 422 ? 'captchaFailed' : 'error');
      // the token may have been used: the box is ticked again, the only message shown is the one above
      this.captchaToken.set(null);
      this.captcha.reset();
      this.submitted.set(false);
    }
  }

  reset(): void {
    this.model.name = '';
    this.model.email = '';
    this.model.message = '';
    this.captchaStage.set('off');
    this.captchaToken.set(null);
    this.touched.set({});
    this.submitted.set(false);
    this.state.set('idle');
  }

  cvDownloaded(): void {
    this.analytics.cvDownload(this.i18n.path('contact'));
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
