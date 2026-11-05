import { Component, afterNextRender, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import type { MediaDto, Settings, SettingsUpdate } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { Lang } from '../../core/i18n/routes';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../../shared/ui/icon.component';
import { MediaPickerComponent } from './media-picker.component';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { HasUnsavedChanges, snapshot, warnBeforeUnload } from './unsaved.guard';
import { missingIn } from './missing-lang.component';

@Component({
  selector: 'app-admin-settings',
  imports: [FormsModule, TranslatePipe, IconComponent, MediaPickerComponent, TooltipDirective],
  template: `
    <div class="admin-head">
      <div>
        <h1>{{ 'admin.settings.title' | t }}</h1>
        @if (dirty()) {
          <span class="unsaved" role="status"><i aria-hidden="true"></i>{{ 'admin.unsaved.badge' | t }}</span>
        }
      </div>
      <div class="row">
        <div class="lang-tabs" role="tablist">
          @for (l of langs; track l) {
            <button type="button" role="tab" [attr.aria-selected]="lang() === l" (click)="lang.set(l)">
              {{ l.toUpperCase() }}
              @if (missing(l); as n) {
                <span class="tab-miss" [appTip]="(n === 1 ? 'admin.translate.one' : 'admin.translate.many') | t: { n: n, lang: l.toUpperCase() }">{{ n }}</span>
              }
            </button>
          }
        </div>
        <button type="button" class="btn btn-accent" (click)="save()" [disabled]="saving() || !form">{{ 'admin.settings.save' | t }}</button>
      </div>
    </div>
    @if (toast()) {
      <p class="toast">{{ toast() }}</p>
    }
    @if (error()) {
      <p class="field-error">{{ error() }}</p>
    }

    @if (ready() && form; as f) {
      <form (ngSubmit)="save()" novalidate>
        <div class="panel">
          <h2 class="panel-title">{{ 'admin.settings.identity' | t }}</h2>
          <div class="avatar-row">
            <span class="avatar-preview" aria-hidden="true">
              @if (avatar(); as a) {
                <img [src]="a.url" alt="" />
              } @else {
                {{ (f.ownerName || 'M').charAt(0) }}
              }
            </span>
            <div class="stack" style="gap: .4rem">
              <span class="field-label">{{ 'admin.settings.avatar' | t }}</span>
              <span class="small faint">{{ 'admin.settings.avatarHint' | t }}</span>
              <div class="row" style="gap: .4rem">
                <button type="button" class="btn btn-ghost" (click)="picking.set(true)"><app-icon name="image" [size]="16" /> {{ 'admin.projectForm.pickMedia' | t }}</button>
                @if (avatar()) {
                  <button type="button" class="chip" (click)="setAvatar(null)">{{ 'admin.projectForm.removeMedia' | t }}</button>
                }
              </div>
            </div>
          </div>
          <div class="form-grid cols-2">
            <div class="field"><label for="s-ownerName">{{ 'admin.settings.ownerName' | t }}</label><input id="s-ownerName" class="input" name="ownerName" [(ngModel)]="f.ownerName" required /></div>
            <div class="field"><label for="s-location">{{ 'admin.settings.location' | t }}</label><input id="s-location" class="input" name="location" [(ngModel)]="f.location" /></div>
            <div class="field span-2"><label for="s-headline">{{ 'admin.settings.headline' | t }} ({{ lang() }})</label><input id="s-headline" class="input" name="headline" [(ngModel)]="f.headline[lang()]" /></div>
            <div class="field span-2"><label for="s-bio">{{ 'admin.settings.bio' | t }} ({{ lang() }})</label><textarea id="s-bio" class="textarea" rows="8" name="bio" [(ngModel)]="f.bio[lang()]"></textarea></div>
            <div class="field"><label for="s-publicEmail">{{ 'admin.settings.publicEmail' | t }}</label><input id="s-publicEmail" class="input" type="email" name="publicEmail" [(ngModel)]="f.publicEmail" /></div>
            <div class="field">
              <label for="s-availability">{{ 'admin.settings.availability' | t }}</label>
              <select id="s-availability" class="select" name="availability" [(ngModel)]="f.availability">
                <option value="OPEN">{{ 'availability.OPEN' | t }}</option>
                <option value="LISTENING">{{ 'availability.LISTENING' | t }}</option>
                <option value="BUSY">{{ 'availability.BUSY' | t }}</option>
              </select>
            </div>
            <div class="field"><label for="s-githubUrl">{{ 'admin.settings.githubUrl' | t }}</label><input id="s-githubUrl" class="input" type="url" name="githubUrl" [(ngModel)]="f.githubUrl" /></div>
            <div class="field"><label for="s-linkedinUrl">{{ 'admin.settings.linkedinUrl' | t }}</label><input id="s-linkedinUrl" class="input" type="url" name="linkedinUrl" [(ngModel)]="f.linkedinUrl" /></div>
            <div class="field span-2">
              <label for="s-bookingUrl">{{ 'admin.settings.bookingUrl' | t }}</label>
              <input id="s-bookingUrl" class="input" type="url" name="bookingUrl" [(ngModel)]="f.bookingUrl" placeholder="https://cal.com/…" />
              <span class="field-hint">{{ 'admin.settings.bookingHint' | t }}</span>
            </div>
          </div>
        </div>
        <div class="panel">
          <h2 class="panel-title">{{ 'admin.settings.seo' | t }}</h2>
          <div class="form-grid">
            <div class="field"><label for="s-seoTitle">{{ 'admin.settings.seoTitle' | t }} ({{ lang() }})</label><input id="s-seoTitle" class="input" name="seoTitle" [(ngModel)]="f.seoTitle[lang()]" maxlength="70" /></div>
            <div class="field"><label for="s-seoDescription">{{ 'admin.settings.seoDescription' | t }} ({{ lang() }})</label><textarea id="s-seoDescription" class="textarea" rows="3" name="seoDescription" [(ngModel)]="f.seoDescription[lang()]" maxlength="170"></textarea></div>
          </div>
        </div>
        <div class="panel">
          <h2 class="panel-title">{{ 'admin.settings.legal' | t }}</h2>
          <div class="form-grid cols-2">
            <div class="field"><label for="s-legalName">{{ 'admin.settings.legalName' | t }}</label><input id="s-legalName" class="input" name="legalName" [(ngModel)]="f.legalName" /></div>
            <div class="field"><label for="s-legalContactEmail">{{ 'admin.settings.legalContactEmail' | t }}</label><input id="s-legalContactEmail" class="input" type="email" name="legalContactEmail" [(ngModel)]="f.legalContactEmail" /></div>
            <div class="field span-2"><label for="s-legalAddress">{{ 'admin.settings.legalAddress' | t }}</label><input id="s-legalAddress" class="input" name="legalAddress" [(ngModel)]="f.legalAddress" /></div>
            <div class="field span-2"><label for="s-legalHost">{{ 'admin.settings.legalHost' | t }}</label><textarea id="s-legalHost" class="textarea" rows="2" name="legalHost" [(ngModel)]="f.legalHost"></textarea></div>
          </div>
        </div>
      </form>
    }
    @if (picking()) {
      <app-media-picker [multiple]="false" [imagesOnly]="true" (picked)="setAvatar($event[0] ?? null); picking.set(false)" (closed)="picking.set(false)" />
    }
  `,
  styles: `
    .avatar-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .avatar-preview {
      display: grid;
      place-items: center;
      flex: none;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      overflow: hidden;
      background: var(--fg);
      color: var(--bg);
      font: 700 1.4rem/1 var(--font-display);
    }
    .avatar-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
})
export class AdminSettingsPage implements HasUnsavedChanges {
  readonly langs: Lang[] = ['fr', 'en'];
  private savedState = '';
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);

  readonly lang = signal<Lang>('fr');
  readonly saving = signal(false);
  readonly toast = signal('');
  readonly error = signal('');
  form: SettingsUpdate | null = null;
  readonly avatar = signal<MediaDto | null>(null);
  readonly picking = signal(false);
  /** zoneless: the plain form object is rendered once this flips */
  readonly ready = signal(false);

  constructor() {
    afterNextRender(() => this.load());
    warnBeforeUnload(() => this.dirty());
  }

  dirty(): boolean {
    return !!this.form && this.savedState !== '' && snapshot(this.form) !== this.savedState;
  }

  missing(lang: Lang): number {
    const f = this.form;
    return f ? missingIn(lang, [f.headline, f.bio, f.seoTitle, f.seoDescription]) : 0;
  }

  private async load(): Promise<void> {
    const s: Settings = await this.api.adminSettings();
    this.form = {
      ownerName: s.ownerName,
      headline: { ...s.headline },
      bio: { ...s.bio },
      location: s.location,
      publicEmail: s.publicEmail,
      githubUrl: s.githubUrl,
      linkedinUrl: s.linkedinUrl,
      bookingUrl: s.bookingUrl ?? null,
      availability: s.availability,
      seoTitle: { ...s.seoTitle },
      seoDescription: { ...s.seoDescription },
      legalName: s.legal.name,
      legalAddress: s.legal.address,
      legalHost: s.legal.host,
      legalContactEmail: s.legal.contactEmail,
      avatarMediaId: s.avatar?.id ?? null,
    };
    this.avatar.set(s.avatar ?? null);
    this.savedState = snapshot(this.form);
    this.ready.set(true);
  }

  setAvatar(m: MediaDto | null): void {
    this.avatar.set(m);
    if (this.form) this.form.avatarMediaId = m?.id ?? null;
  }

  async save(): Promise<void> {
    if (!this.form) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.updateSettings(this.form);
      this.savedState = snapshot(this.form);
      this.toast.set(this.i18n.t('admin.settings.saved'));
      setTimeout(() => this.toast.set(''), 1800);
    } catch (e) {
      this.error.set((e as { error?: { message?: string } }).error?.message ?? String(e));
    } finally {
      this.saving.set(false);
    }
  }
}
