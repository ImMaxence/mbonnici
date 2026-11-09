import { Component, computed, effect, inject, input } from '@angular/core';
import type { Settings } from '../../core/api/models';
import { I18nService, interpolate } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { FooterComponent } from '../../shared/ui/footer.component';
import { RevealDirective } from '../../shared/ui/reveal.directive';

type LegalKey = 'legal' | 'privacy' | 'terms' | 'accessibility';

/** to move forward whenever the legal texts of the locale files change */
const TEXTS_UPDATED = '2026-11-09';

interface Section {
  h: string;
  p: string[];
}

/** Mentions légales · confidentialité · conditions d'utilisation · déclaration d'accessibilité (one component, four keys). */
@Component({
  selector: 'app-legal',
  imports: [TranslatePipe, FooterComponent, RevealDirective],
  template: `
    <main id="main" class="page">
      <header class="container-narrow head">
        <span class="eyebrow" appReveal>{{ 'meta.siteName' | t }}</span>
        <h1 class="h1" appReveal revealSplit="words">{{ 'legal.' + key() + '.title' | t }}</h1>
        <p class="small faint" appReveal>{{ 'legal.updated' | t: { date: updated() } }}</p>
      </header>
      <article class="container-narrow prose">
        @for (s of sections(); track s.h) {
          <section appReveal>
            <h2>{{ s.h }}</h2>
            @for (p of s.p; track $index) {
              @if (p.trim()) {
                <p>{{ p }}</p>
              }
            }
          </section>
        }
      </article>
      <app-footer [settings]="settings()" />
    </main>
  `,
  styles: `
    .head {
      display: grid;
      gap: var(--space-4);
      padding: var(--space-8) 0 var(--space-6);
    }
    .head h1 {
      font-size: var(--fs-h1);
    }
    article section + section {
      margin-top: var(--space-6);
    }
  `,
})
export class LegalPage {
  /** bound from route data by withComponentInputBinding() */
  readonly page = input<string>('legal');

  private readonly seo = inject(SeoService);
  readonly i18n = inject(I18nService);
  /** resolved by the route and bound as an input */
  readonly settings = input<Settings>();

  readonly key = computed<LegalKey>(() => {
    const p = this.page();
    return p === 'privacy' || p === 'terms' || p === 'accessibility' ? p : 'legal';
  });

  /** the later of the last change to the texts below and the last change to the legal identity */
  readonly updated = computed(() => {
    const saved = this.settings()?.updatedAt ?? TEXTS_UPDATED;
    return this.i18n.formatDate(saved > TEXTS_UPDATED ? saved : TEXTS_UPDATED, { day: 'numeric', month: 'long', year: 'numeric' });
  });

  readonly sections = computed<Section[]>(() => {
    const s = this.settings();
    const params = {
      owner: s?.legal.name || s?.ownerName || 'Maxence Bonnici',
      host: s?.legal.host || '—',
      email: s?.legal.contactEmail || s?.publicEmail || '',
      // the published site, even when the page is rendered by a local or preview server
      siteUrl: /localhost|127\.0\.0\.1|\[::1\]/.test(this.seo.origin) ? 'mbonnici.fr' : this.seo.origin.replace(/^https?:\/\//, ''),
      address: s?.legal.address || '',
    };
    const raw = this.i18n.get<Section[]>(`legal.${this.key()}.sections`) ?? [];
    return raw.map((sec) => ({ h: sec.h, p: sec.p.map((p) => interpolate(p, params)) }));
  });

  constructor() {
    effect(() => {
      this.i18n.lang();
      const key = this.key();
      this.seo.set({
        title: this.i18n.t(`meta.${key}.title`),
        description: this.i18n.t(`meta.${key}.description`),
        page: key,
      });
    });
  }
}
