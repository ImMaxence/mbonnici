import { CSP_NONCE, DOCUMENT, Injectable, inject } from '@angular/core';

interface Grecaptcha {
  ready(callback: () => void): void;
  render(container: HTMLElement, options: Record<string, unknown>): number;
  reset(widget: number): void;
}

export interface CaptchaLook {
  theme: 'light' | 'dark';
  lang: string;
}

export interface CaptchaEvents {
  /** null when the tick has expired */
  token: (token: string | null) => void;
  failed: () => void;
}

/** how long Google may take before the visitor is told to write by e-mail instead */
const TIMEOUT_MS = 15_000;

function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('reCAPTCHA timed out')), TIMEOUT_MS);
  });
  return Promise.race([work, expired]).finally(() => clearTimeout(timer));
}

/**
 * Google's "I'm not a robot" box. Only the contact page asks for it, so the other pages of the
 * site never contact Google (see the privacy policy).
 */
@Injectable({ providedIn: 'root' })
export class CaptchaService {
  private readonly document = inject(DOCUMENT);
  private readonly nonce = inject(CSP_NONCE, { optional: true });
  private script: Promise<Grecaptcha> | null = null;
  private widget: number | null = null;

  /** draws the box in `slot`, replacing the one already there (colours and language are set when drawn) */
  async show(slot: HTMLElement, siteKey: string, look: CaptchaLook, events: CaptchaEvents): Promise<void> {
    const grecaptcha = await this.load(look.lang);
    const box = this.document.createElement('div');
    slot.replaceChildren(box);
    this.widget = grecaptcha.render(box, {
      sitekey: siteKey,
      theme: look.theme,
      hl: look.lang,
      callback: events.token,
      'expired-callback': () => events.token(null),
      'error-callback': events.failed,
    });
  }

  /** a token only works once: the box has to be ticked again after a refused send */
  reset(): void {
    const widget = this.widget;
    if (widget !== null) void this.script?.then((grecaptcha) => grecaptcha.reset(widget));
  }

  private load(lang: string): Promise<Grecaptcha> {
    this.script ??= withTimeout(this.addScript(lang)).catch((error: unknown) => {
      this.script = null; // the next drawing can try again
      throw error;
    });
    return this.script;
  }

  private addScript(lang: string): Promise<Grecaptcha> {
    return new Promise((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=explicit&hl=${lang}`;
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
