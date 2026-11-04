# Architecture

## Repository layout

```
mbonnici/
├── frontend/                 Angular 22 (zoneless, signals, SSR) + Express server
│   ├── src/app/core/         i18n, theme, motion (physics, rAF, pointer, scroll), api, seo, analytics, auth
│   ├── src/app/shared/       cursor, curtain, header, ui (showcase, phone, slider, toolbox, tooltip, confirm dialog…)
│   ├── src/app/features/     home, projects, about, contact, legal, not-found, admin
│   ├── src/styles/           reset, tokens (one style × 2 schemes), typography, layout, components, motion (intro), admin
│   ├── src/server.ts         SSR, CSP nonce, API proxy, language redirect, security headers
│   ├── e2e/                  Playwright specs (desktop + mobile, axe accessibility)
│   └── scripts/              version.mjs (build stamp), assets.mjs (OG/icons), screenshots.mjs (README), device-svg.mjs (phone frame)
├── backend/                  Spring Boot 4.1 / Java 25
│   └── src/main/java/fr/mbonnici/portfolio/
│       ├── config/           SecurityConfig, RateLimitFilter, AppProperties, StorageConfig
│       ├── auth/             Google OIDC user service (e-mail allow-list), /api/auth/me, local dev sign-in
│       ├── project/ media/ profile/ settings/ contact/ analytics/ seo/ admin/
│       └── storage/          StorageService (S3 via AWS SDK v2)
├── seed/                     starter archive (original content + captures) and the scripts that build it
├── docker-compose.yml        production (Coolify)
├── docker-compose.dev.yml    local PostgreSQL + SeaweedFS
├── docker-compose.local.yml  full stack built from source (DEV_LOGIN on)
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

## Visual style

One editorial style. Colours, fonts, radii and motion curves are CSS custom properties on
`:root` (light) overridden by `[data-theme='dark']`. An inline script in `index.html` applies the
stored scheme before first paint; `ThemeService` keeps it in sync and animates the switch with a
View Transition (circular reveal from the button, cross-fade fallback).

- Fonts: Inter (text), Inter Tight (display), Instrument Serif italic (emphasis), JetBrains Mono
  (labels), all SIL OFL, bundled through `@fontsource` and served by the site itself.
- Icons: hand-drawn 24 px SVG paths inlined by `IconComponent` — no icon font, no sprite request.
- Intro: plain HTML in `index.html` (`.intro`), shown when the inline script adds
  `html.intro-play` (once per session, never with reduced motion), animated in pure CSS so it
  paints with the first frame. `RevealDirective` delays the entrance of the content it covers.
- Page transitions: `TransitionService` + `CurtainComponent`, one sheet; the first navigation
  (the server-rendered page) is never covered.
- Project visuals: `ShowcaseComponent` (browser frame + phones, per `display_mode`) reads the
  cover and the mobile media of the project, else `/img/project-placeholder*.svg`. `PhoneComponent`
  lays `/img/devices/phone.svg` (an original drawing, `scripts/device-svg.mjs`) over the capture;
  another frame only needs the image and the screen rectangle.
- Copy never ends with a full stop outside `legal.*` (`NoDotPipe`, also applied to Markdown).

## Motion system

- `RafService`: one `requestAnimationFrame` loop, pauses when the tab is hidden.
- `physics.ts`: `damp` (frame-rate independent lerp), `Spring`, 3D rotation/projection,
  Fibonacci sphere, cheap noise, colour helpers.
- `PointerService` / `ScrollService`: smoothed pointer and scroll values read every frame
  without triggering change detection.
- Effects are gated by `MotionService` (reduced motion, fine pointer, touch, narrow viewport):
  the cursor and magnetic effects only exist with a mouse; with reduced motion the intro, the
  transitions and the reveals are skipped.

## Data model

`site_settings` (single row) · `project` (bilingual texts, status, scene type, accent, stack[],
tags[]) · `media` (object key, dimensions, blur placeholder, alt texts) · `project_media`
(gallery / mobile ordering) · `experience` · `education` · `skill` · `contact_message` ·
`analytics_event` (type, path, project, locale, theme, style (legacy, unused), device, referrer host, daily
visitor hash). Migrations: `backend/src/main/resources/db/migration` (Flyway, plain SQL); they
create the schema and a single settings row, no content, so a deployment starts empty. The tests
add `src/test/resources/db/testdata/R__test_content.sql` (repeatable migration, test profile only)
with the original texts.

## Backups and selective restore

An archive is a zip: `manifest.json`, one CSV per content table (`COPY … TO STDOUT`), the media
objects and their content types. Restoring is two-step: `RestoreStagingService` stages the
archive (temp file, 1 h) and diffs every table against the live data by primary key (`NEW`,
`CHANGED` with the differing columns, `CONFLICT` on a unique slug / object key, `CURRENT_ONLY`,
`SAME`). The admin then replaces everything (`TRUNCATE` + `COPY` in one transaction) or merges a
selection: `ArchiveMerger` copies the chosen rows into temporary tables and upserts them
(`INSERT … ON CONFLICT (id) DO UPDATE`) in one transaction; a project brings its gallery links and
missing images, analytics events can be added without touching existing ones.

## Media pipeline

`MediaService` accepts PNG and JPEG only: the type comes from the magic bytes (`ImageSniffer`), the
file extension must agree, the dimensions are read from the header before any decoding (40 MP
max), then the picture is decoded (blur placeholder) and re-encoded to WebP by `WebpEncoder`
(`cwebp`, libwebp-tools in the backend image; no shell, temp files, 30 s timeout, metadata
stripped, 2560 px max). Without `cwebp` the original is kept. Objects are served with a sandbox
CSP and immutable caching. Projects without pictures fall back to `/img/project-placeholder*.svg`.

Responsive copies: at upload `WebpEncoder` also makes 640, 1280 and 1920 px WebP copies (only those
narrower than the picture), stored next to the original as `<key>-w640.webp`; `media.variant_widths`
lists them and `MediaDto.srcset` gives the browser the choice. Pictures stored before (or restored
without their copies) get them from a background job at start-up and after a restore. Each picture
also has a focal point (`focal_x`, `focal_y`, top centre by default) used as `object-position`.

## Notes, CV, insights and web vitals (1.4.0)

- **Notes** (`article` table): Markdown in both languages, `ArticleService` (cache `articles`,
  evicts `settings` too because `PublicSettings.hasNotes` shows the Notes section). Public
  `/api/articles`, admin `/api/admin/articles` (+ `/{id}/preview`), RSS at `/fr/rss.xml` and
  `/en/rss.xml` (`SeoController`, proxied by the SSR server like `sitemap.xml`).
- **Case study**: `project.context_*`, `role_*`, `challenges_*`, `results_*` (Markdown).
- **CV**: `CvService` builds XHTML from settings, profile and featured projects and renders it with
  OpenHTMLtoPDF (PDFBox) using the TTF fonts in `resources/cv/fonts` (OFL). The PDF is cached per
  language until the content fingerprint changes; `GET /api/cv?lang=&download=`.
- **Insights**: `InsightsService` keeps in memory the live status of each published project's site
  (GET every 5 min, 8 s timeout) and GitHub figures (stars, last push, languages, every 6 h with
  ETags). Exposed at `/api/insights`, fetched by the browser only (`InsightsStore`), never part of the
  server render. Disabled in tests (`app.insights.enabled`).
- **Web vitals**: `core/analytics/vitals.service.ts` observes LCP, FCP, TTFB (navigation timing),
  CLS (session windows) and INP (event timing) and sends one beacon when the landing page is hidden;
  `VitalsService` stores rows in `web_vital` (metric, value, path, device: no identifier) and
  computes p75 with `percentile_cont`. Not part of backups (measurements, not content).
- **Texts per language** are stored as typed (`Localized.clean`); public DTOs apply `filled()` (the
  other language stands in), the back office reads them raw to show what is left to translate.

## Share pictures, monitoring (1.5.0)

- **Share pictures**: `OgImageService` draws 1200 × 630 JPEGs with Java2D and the TTF fonts of
  `resources/cv/fonts` (eyebrow, Inter Tight title fitted on three lines, tagline, signature; the cover
  in a browser window, or a note cover, or the project initial on its accent colour). Covers are
  decoded from WebP with `dwebp` (`WebpEncoder.decode`), the 1280 px copy when there is one. Cached in
  memory per page and language until the content fingerprint changes.
- **Site checks**: every check of `InsightsService` is also stored in `site_check` (30 days);
  `/api/admin/insights/sites` aggregates them per hour for the dashboard.
- **Error log**: `ErrorLogService` keeps `error_log` rows grouped by fingerprint (source, message
  with numbers and ids masked, first stack frames without line numbers). Server errors come from
  `GlobalExceptionHandler` (5xx), browser errors from `ReportingErrorHandler` (Angular's
  `ErrorHandler`, fed by `provideBrowserGlobalErrorListeners`) through `/api/analytics/errors`.

## Contact messages

Every message is stored (`contact_message`) and only read in the back office (Messages, unread
badge in the sidebar). Nothing is forwarded by e-mail or to a third party.

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
