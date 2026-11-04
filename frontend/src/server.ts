import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { type NextFunction, type Request, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { Readable } from 'node:stream';

/**
 * Production server for the portfolio:
 *  - renders Angular pages on the server with a per-request CSP nonce,
 *  - serves the hashed browser bundle with long-lived caching,
 *  - optionally proxies /api and the SEO feeds to the Spring Boot backend (PROXY_API, default on),
 *  - redirects / to the visitor's language.
 */
const browserDistFolder = join(import.meta.dirname, '../browser');
const API_BASE_URL = (process.env['API_BASE_URL'] ?? 'http://localhost:8080').replace(/\/$/, '');
const PROXY_API = process.env['PROXY_API'] !== 'false';
const IS_PROD = process.env['NODE_ENV'] === 'production';
const PROXIED_FILES = new Set(['/sitemap.xml', '/robots.txt', '/llms.txt', '/llms-full.txt', '/fr/rss.xml', '/en/rss.xml']);
const LANGS = ['fr', 'en'];

// Hop-by-hop and body-framing headers that must never be copied through the proxy.
const STRIP_REQUEST = new Set(['host', 'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'content-length', 'expect']);
const STRIP_RESPONSE = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-encoding',
  'content-length', 'set-cookie']);

/**
 * Angular validates the Host / X-Forwarded-Host headers (SSRF protection). Allowed: the public
 * host of APP_URL and its sub-domains, localhost for health checks / dev, plus ALLOWED_HOSTS.
 */
const APP_HOST = (() => {
  try {
    return new URL(process.env['APP_URL'] ?? 'http://localhost:4000').hostname;
  } catch {
    return 'localhost';
  }
})();
const ALLOWED_HOSTS = [
  ...new Set([
    APP_HOST,
    `*.${APP_HOST}`,
    'localhost',
    '127.0.0.1',
    ...(process.env['ALLOWED_HOSTS'] ?? '').split(',').map((h) => h.trim()).filter(Boolean),
  ]),
];
/** Behind Coolify/Traefik + Cloudflare the forwarded headers describe the real origin. */
const TRUST_PROXY = process.env['TRUST_PROXY'] === 'true';

const app = express();
const angularApp = new AngularNodeAppEngine({
  allowedHosts: ALLOWED_HOSTS,
  trustProxyHeaders: TRUST_PROXY ? ['x-forwarded-proto', 'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-for'] : [],
});

app.disable('x-powered-by');
app.set('trust proxy', TRUST_PROXY);

function contentSecurityPolicy(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self'",
    'frame-src https:',
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
  ];
  if (IS_PROD) {
    directives.push('upgrade-insecure-requests');
  }
  return directives.join('; ');
}

function baseSecurityHeaders(res: Response): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

app.use((_req, res, next) => {
  baseSecurityHeaders(res);
  next();
});

app.get('/healthz', (_req, res) => {
  res.type('text/plain').send('ok');
});

/** Language negotiation for the bare root: French first, English for everybody else. */
app.get('/', (req, res) => {
  const header = String(req.headers['accept-language'] ?? '');
  const tags = header.split(',').map((t) => t.trim().slice(0, 2).toLowerCase());
  const lang = tags.find((t) => LANGS.includes(t)) ?? 'fr';
  res.setHeader('Vary', 'Accept-Language');
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, `/${lang}`);
});

/** Transparent reverse proxy to the API (so a single container can serve everything). */
if (PROXY_API) {
  app.use(async (req, res, next) => {
    if (!(req.path.startsWith('/api/') || PROXIED_FILES.has(req.path))) {
      next();
      return;
    }
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (value === undefined || STRIP_REQUEST.has(name)) continue;
        headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      headers.set('x-forwarded-host', req.headers.host ?? '');
      headers.set('x-forwarded-proto', req.protocol);
      const forwardedFor = req.headers['x-forwarded-for'];
      headers.set('x-forwarded-for', forwardedFor ? String(forwardedFor) : (req.socket.remoteAddress ?? ''));

      const hasBody = !['GET', 'HEAD'].includes(req.method);
      const upstream = await fetch(API_BASE_URL + req.originalUrl, {
        method: req.method,
        headers,
        body: hasBody ? (Readable.toWeb(req) as unknown as ReadableStream) : undefined,
        redirect: 'manual',
        // @ts-expect-error duplex is required by undici for streamed request bodies
        duplex: 'half',
      });

      res.status(upstream.status);
      upstream.headers.forEach((value, name) => {
        if (!STRIP_RESPONSE.has(name)) res.setHeader(name, value);
      });
      const cookies = upstream.headers.getSetCookie();
      if (cookies.length) res.setHeader('set-cookie', cookies);

      if (upstream.body) {
        Readable.fromWeb(upstream.body as unknown as import('node:stream/web').ReadableStream).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      console.error('[proxy]', req.method, req.originalUrl, error);
      res.status(502).json({ status: 502, error: 'Bad Gateway', message: 'API unavailable' });
    }
  });
}

/** Hashed bundles are immutable; everything else (favicons, manifest) is revalidated hourly. */
app.use(
  express.static(browserDistFolder, {
    index: false,
    redirect: false,
    setHeaders: (res, filePath) => {
      const immutable = /-[A-Z0-9]{8}\.[a-z0-9]+$/i.test(filePath) || /[\\/]media[\\/]/.test(filePath);
      res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
    },
  }),
);

/** Angular SSR. The `__CSP_NONCE__` placeholder in index.html becomes a fresh nonce per response. */
app.use(async (req, res, next) => {
  try {
    const response = await angularApp.handle(req);
    if (!response) {
      next();
      return;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      await writeResponseToNodeResponse(response, res);
      return;
    }
    const nonce = randomBytes(16).toString('base64');
    const html = (await response.text()).replaceAll('__CSP_NONCE__', nonce);
    response.headers.forEach((value, name) => {
      if (name !== 'content-length') res.setHeader(name, value);
    });
    res.setHeader('Content-Security-Policy', contentSecurityPolicy(nonce));
    res.setHeader('Cache-Control', 'private, no-cache');
    res.status(response.status).send(html);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ssr]', error);
  res.status(500).type('text/plain').send('Internal server error');
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = Number(process.env['PORT'] || 4000);
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(
      `mbonnici frontend listening on http://localhost:${port} (api: ${API_BASE_URL}, proxy: ${PROXY_API}, ` +
        `hosts: ${ALLOWED_HOSTS.join(' ')}, trust proxy: ${TRUST_PROXY})`,
    );
  });
}

export const reqHandler = createNodeRequestHandler(app);
