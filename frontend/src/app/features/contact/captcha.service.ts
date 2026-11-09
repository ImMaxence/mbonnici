import { CSP_NONCE, DOCUMENT, Injectable, inject } from '@angular/core';

interface Grecaptcha {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): PromiseLike<string>;
}

/** how long Google may take before the visitor is told to write by e-mail instead */
const TIMEOUT_MS = 15_000;

function withTimeout<T>(work: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('reCAPTCHA timed out')), TIMEOUT_MS);
  });
  return Promise.race([work, expired]).finally(() => clearTimeout(timer));
}

/**
 * Google reCAPTCHA v3 for the contact form. The script is only requested once the visitor has
 * ticked the consent box: until then nothing reaches Google (see the privacy policy).
 */
@Injectable({ providedIn: 'root' })
export class CaptchaService {
  private readonly document = inject(DOCUMENT);
  private readonly nonce = inject(CSP_NONCE, { optional: true });
  private script: Promise<Grecaptcha> | null = null;

  load(siteKey: string, lang: string): Promise<Grecaptcha> {
    this.script ??= withTimeout(this.addScript(siteKey, lang)).catch((error: unknown) => {
      this.script = null; // a later tick can try again
      throw error;
    });
    return this.script;
  }

  /** a token lives two minutes: asked for at the moment of sending */
  async token(siteKey: string, lang: string): Promise<string> {
    const grecaptcha = await this.load(siteKey, lang);
    return withTimeout(grecaptcha.execute(siteKey, { action: 'contact' }));
  }

  private addScript(siteKey: string, lang: string): Promise<Grecaptcha> {
    return new Promise((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}&hl=${lang}`;
      script.async = true;
      // reCAPTCHA passes the nonce on to the scripts it adds itself
      if (this.nonce) script.nonce = this.nonce;
      script.onerror = () => {
        script.remove();
        reject(new Error('reCAPTCHA did not load'));
      };
      script.onload = () => {
        const grecaptcha = (this.document.defaultView as (Window & { grecaptcha?: Grecaptcha }) | null)?.grecaptcha;
        if (grecaptcha) grecaptcha.ready(() => resolve(grecaptcha));
        else reject(new Error('reCAPTCHA did not start'));
      };
      this.document.head.appendChild(script);
    });
  }
}
