import { Component, afterNextRender, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import type { Settings, SettingsUpdate } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { Lang } from '../../core/i18n/routes';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-admin-settings',
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="admin-head">
      <h1>{{ 'admin.settings.title' | t }}</h1>
      <div class="row">
        <div class="lang-tabs" role="tablist">
          <button type="button" role="tab" [attr.aria-selected]="lang() === 'fr'" (click)="lang.set('fr')">FR</button>
          <button type="button" role="tab" [attr.aria-selected]="lang() === 'en'" (click)="lang.set('en')">EN</button>
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

    @if (form; as f) {
      <form (ngSubmit)="save()" novalidate>
        <div class="panel">
          <h2 class="panel-title">{{ 'admin.settings.identity' | t }}</h2>
          <div class="form-grid cols-2">
            <div class="field"><label>{{ 'admin.settings.ownerName' | t }}</label><input class="input" name="ownerName" [(ngModel)]="f.ownerName" required /></div>
            <div class="field"><label>{{ 'admin.settings.location' | t }}</label><input class="input" name="location" [(ngModel)]="f.location" /></div>
            <div class="field span-2"><label>{{ 'admin.settings.headline' | t }} ({{ lang() }})</label><input class="input" name="headline" [(ngModel)]="f.headline[lang()]" /></div>
            <div class="field span-2"><label>{{ 'admin.settings.bio' | t }} ({{ lang() }})</label><textarea class="textarea" rows="8" name="bio" [(ngModel)]="f.bio[lang()]"></textarea></div>
            <div class="field"><label>{{ 'admin.settings.publicEmail' | t }}</label><input class="input" type="email" name="publicEmail" [(ngModel)]="f.publicEmail" /></div>
            <div class="field">
              <label>{{ 'admin.settings.availability' | t }}</label>
              <select class="select" name="availability" [(ngModel)]="f.availability">
                <option value="OPEN">{{ 'availability.OPEN' | t }}</option>
                <option value="LISTENING">{{ 'availability.LISTENING' | t }}</option>
                <option value="BUSY">{{ 'availability.BUSY' | t }}</option>
              </select>
            </div>
            <div class="field"><label>{{ 'admin.settings.githubUrl' | t }}</label><input class="input" type="url" name="githubUrl" [(ngModel)]="f.githubUrl" /></div>
            <div class="field"><label>{{ 'admin.settings.linkedinUrl' | t }}</label><input class="input" type="url" name="linkedinUrl" [(ngModel)]="f.linkedinUrl" /></div>
          </div>
        </div>
        <div class="panel">
          <h2 class="panel-title">{{ 'admin.settings.seo' | t }}</h2>
          <div class="form-grid">
            <div class="field"><label>{{ 'admin.settings.seoTitle' | t }} ({{ lang() }})</label><input class="input" name="seoTitle" [(ngModel)]="f.seoTitle[lang()]" maxlength="70" /></div>
            <div class="field"><label>{{ 'admin.settings.seoDescription' | t }} ({{ lang() }})</label><textarea class="textarea" rows="3" name="seoDescription" [(ngModel)]="f.seoDescription[lang()]" maxlength="170"></textarea></div>
          </div>
        </div>
        <div class="panel">
          <h2 class="panel-title">{{ 'admin.settings.legal' | t }}</h2>
          <div class="form-grid cols-2">
            <div class="field"><label>{{ 'admin.settings.legalName' | t }}</label><input class="input" name="legalName" [(ngModel)]="f.legalName" /></div>
            <div class="field"><label>{{ 'admin.settings.legalContactEmail' | t }}</label><input class="input" type="email" name="legalContactEmail" [(ngModel)]="f.legalContactEmail" /></div>
            <div class="field span-2"><label>{{ 'admin.settings.legalAddress' | t }}</label><input class="input" name="legalAddress" [(ngModel)]="f.legalAddress" /></div>
            <div class="field span-2"><label>{{ 'admin.settings.legalHost' | t }}</label><textarea class="textarea" rows="2" name="legalHost" [(ngModel)]="f.legalHost"></textarea></div>
          </div>
        </div>
      </form>
    }
  `,
})
export class AdminSettingsPage {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);

  readonly lang = signal<Lang>('fr');
  readonly saving = signal(false);
  readonly toast = signal('');
  readonly error = signal('');
  form: SettingsUpdate | null = null;

  constructor() {
    afterNextRender(() => this.load());
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
      availability: s.availability,
      seoTitle: { ...s.seoTitle },
      seoDescription: { ...s.seoDescription },
      legalName: s.legal.name,
      legalAddress: s.legal.address,
      legalHost: s.legal.host,
      legalContactEmail: s.legal.contactEmail,
    };
  }

  async save(): Promise<void> {
    if (!this.form) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.updateSettings(this.form);
      this.toast.set(this.i18n.t('admin.settings.saved'));
      setTimeout(() => this.toast.set(''), 1800);
    } catch (e) {
      this.error.set((e as { error?: { message?: string } }).error?.message ?? String(e));
    } finally {
      this.saving.set(false);
    }
  }
}
