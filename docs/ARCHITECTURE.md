# Architecture

## Repository layout

```
mbonnici/
├── frontend/                 Angular 22 (zoneless, signals, SSR) + Express server
│   ├── src/app/core/         i18n, theme, motion (physics, rAF, pointer, scroll), api, seo, analytics, auth
│   ├── src/app/shared/       cursor, curtain, dock, scenes (canvas + CSS 3D), iphone, ui
│   ├── src/app/features/     home, projects, about, contact, legal, not-found, admin
│   ├── src/styles/           reset, tokens (3 styles × 2 schemes), typography, layout, components, motion, admin
│   ├── src/server.ts         SSR, CSP nonce, API proxy, language redirect, security headers
│   ├── e2e/                  Playwright specs (desktop + mobile, axe accessibility)
│   └── scripts/              version.mjs (build stamp), assets.mjs (OG/icons), screenshots.mjs (README)
├── backend/                  Spring Boot 4.1 / Java 25
│   └── src/main/java/fr/mbonnici/portfolio/
│       ├── config/           SecurityConfig, RateLimitFilter, AppProperties, StorageConfig
│       ├── auth/             Google OIDC user service (e-mail allow-list), /api/auth/me
│       ├── project/ media/ profile/ settings/ contact/ analytics/ seo/ admin/
│       └── storage/          StorageService (S3 via AWS SDK v2)
├── docker-compose.yml        production (Coolify)
├── docker-compose.dev.yml    local PostgreSQL + SeaweedFS
└── docs/                     this file, DEPLOYMENT.md, SECURITY_AUDIT.md, images/
```

## Request flow

1. The browser hits `frontend` (Express). HTML routes are rendered by Angular on the server;
   each response gets a fresh CSP nonce (`__CSP_NONCE__` placeholder in `index.html`).
2. During SSR, Angular calls the API directly (`API_BASE_URL`, the Docker service name) and the
   responses are embedded in the HTML transfer cache, so the browser does not refetch them.
3. In the browser, calls go to `/api/*` on the same origin; Express proxies them to the backend
   (`PROXY_API=true`). Cookies, redirects (OAuth) and streaming uploads pass through unchanged.
4. The backend answers JSON. Public reads are cached in memory (settings, profile, project
   list/details) and invalidated on every admin write.

## Internationalisation

Runtime dictionaries (`core/i18n/locales/fr.ts`, `en.ts`) typed from the French source; a missing
English key fails the build. Pages live under `/fr` and `/en` with localised segments defined once
in `core/i18n/routes.ts` and mirrored in `seo/SiteRoutes.java` for the sitemap. Content from the
database is bilingual at the column level (`title_fr`, `title_en` → `{fr, en}` in the API) so the
language switch never refetches.

## Visual styles

All colours, fonts, radii and motion curves are CSS custom properties on `:root`, overridden by
`[data-style]` (obsidian / editorial / aurora) and `[data-theme]` (light / dark). `ThemeService`
sets both attributes; an inline script in `index.html` applies the stored choice before first
paint so there is no flash. Fonts are self-hosted (`@fontsource`) — no Google Fonts requests.

## Motion system

- `RafService`: one `requestAnimationFrame` loop, pauses when the tab is hidden.
- `physics.ts`: `damp` (frame-rate independent lerp), `Spring`, 3D rotation/projection,
  Fibonacci sphere, cheap noise, colour helpers.
- `PointerService` / `ScrollService`: smoothed pointer and scroll values read every frame
  without triggering change detection.
- Effects are gated by `MotionService` (reduced motion, fine pointer, touch, narrow viewport):
  the cursor and magnetic effects only exist with a mouse; scenes draw a single static frame
  when motion is reduced; canvas particle counts scale with the quality budget.
- Scenes implement `BaseScene.frame(dt, t, pointer, intensity)` and are mounted by
  `SceneHostComponent`, which handles DPR sizing, visibility (IntersectionObserver) and theme
  colour changes. STACK (layered CSS 3D cards) and DEVICE (iPhone simulator) are DOM scenes.

## Data model

`site_settings` (single row) · `project` (bilingual texts, status, scene type, accent, stack[],
tags[]) · `media` (object key, dimensions, blur placeholder, alt texts) · `project_media`
(gallery / mobile ordering) · `experience` · `education` · `skill` · `contact_message` ·
`analytics_event` (type, path, project, locale, theme, style, device, referrer host, daily
visitor hash). Migrations: `backend/src/main/resources/db/migration` (Flyway, plain SQL).

## Security model

- Single admin: Google OIDC; `AdminOidcUserService` rejects any e-mail outside `ADMIN_EMAIL`
  before a session exists. Session cookie `PSESSION` (HttpOnly, SameSite=Lax, Secure in prod).
- CSRF: readable `XSRF-TOKEN` cookie echoed by Angular in `X-XSRF-TOKEN`; only the anonymous
  analytics beacon is exempt.
- Authorisation: `/api/admin/**` and actuator details require `ROLE_ADMIN`; everything else
  is public read-only or validated writes (contact).
- Rate limiting: in-memory token buckets per client IP and endpoint family
  (`api`, `contact`, `analytics`, `upload`, `auth`), 429 with `Retry-After`.
- Uploads: magic-byte sniffing, SVG script rejection, size/pixel limits, immutable keys,
  `Content-Security-Policy: sandbox` on served media.
- Headers: CSP with nonces, `frame-ancestors 'none'`, HSTS, nosniff, referrer policy,
  permissions policy, COOP — on both tiers.
- Analytics: no cookies, no IP storage, daily-rotating salted hash, DNT/GPC honoured,
  retention limit.
