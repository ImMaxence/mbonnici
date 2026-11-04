# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). Frontend and backend share one version number
(`frontend/package.json` and `backend/pom.xml`), shown on the back-office dashboard.

## [Unreleased]

## [1.1.0] — 2026-11-04

### Added

**Back office**
- **Backups**: one archive = the whole database (native PostgreSQL `COPY` export of every content
  table) + every image of the bucket, as a zip with a manifest. Download it on demand, restore from
  a file, or link **Google Drive** (same Google account, `drive.file` permission only) to back up
  with one click, daily at a chosen hour, with retention of the last N archives; restore from any
  Drive archive, download or delete them. Restores are atomic for the database and refuse an
  archive from another schema version unless forced.
- **Server panel** on the dashboard: CPU (application and host), memory, Java heap, disk space
  left on the server, database size, image count and size, refreshed every 10 s.
- **Releases page** rendering this changelog, with the running version highlighted.

**Backend**
- `oauth2_authorized_client` table (Spring Security JDBC store) so the Drive refresh token
  survives restarts; second OAuth registration `google-drive` with offline access.
- `GET /api/admin/system`, `/api/admin/backups/*` endpoints; 2 GB multipart limit for archive
  imports (image uploads keep their own 10 MB limit).

### Changed
- **Performance** (Lighthouse desktop 100 on every page, mobile 85–92, see
  `docs/LIGHTHOUSE.md`): public pages load their data through route resolvers instead of
  `httpResource` (no loading-state flash during hydration, CLS ≈ 0); server-rendered text stays
  visible until the app hydrates (entrance animations only when hydration is fast); autoplay
  scenes start after the page is idle, run at 30 fps on phones and use pre-computed palettes.
- Project card headings are `h2` on the projects page (heading order), `h3` elsewhere.
- Project API accepts missing `featured` / `sortOrder` / `allowIframe` fields (Jackson 3 is strict
  about primitives).
- PostgreSQL driver moved to compile scope (COPY API); frontend Docker build context is the
  repository root so the changelog ships with the image.

## [1.0.0] — 2026-11-04

First release of mbonnici.fr.

### Added

**Public site**
- Angular 22 (zoneless, signals) rendered on the server with per-request CSP nonces.
- French and English with localised URLs (`/fr/projets`, `/en/projects`), hreflang alternates and
  a language switch that keeps the current page.
- Three complete visual styles (Obsidian, Editorial, Aurora) × light / dark, chosen from the dock
  and remembered per device.
- Custom magnetic cursor, cinematic curtain page transitions, scroll-reveal typography, parallax
  cover cards.
- Interactive 3D scenes drawn with native canvas and CSS 3D (hero particle orb, orbit, terrain,
  helix, layered stack) and an iPhone Pro simulator (live iframe or swipeable screenshots).
- Floating frosted-glass dock with macOS-style magnification; tab bar on phones.
- Pages: home, projects (filterable), project detail (scene, markdown description, gallery,
  lightbox, prev/next), about (experience, education, skills), contact (form with honeypot),
  legal notice, privacy policy, terms of use, 404.
- SEO: titles, descriptions, Open Graph / Twitter cards, canonical, JSON-LD (Person, WebSite,
  ItemList, SoftwareSourceCode, BreadcrumbList), `sitemap.xml`, `robots.txt` welcoming AI
  crawlers, `llms.txt` and `llms-full.txt`.
- Accessibility: skip link, keyboard-reachable dock, reduced-motion fallbacks, aria labels,
  screen-reader route announcements, axe-checked pages.

**Back office** (`/admin`, Google sign-in restricted to the owner's e-mail)
- Dashboard: page views, unique visitors, project views, outbound clicks, daily traffic chart,
  top projects / pages / styles / themes / languages / devices / referrers, frontend and backend
  versions, Java / Spring Boot versions, database and storage health.
- Projects: create, edit (FR/EN tabs, scene picker with live previews, accent colour, media
  library picker), publish / unpublish, drag-and-drop ordering, delete.
- Media library with drag-and-drop upload, alt texts and safe-type detection.
- Profile (experience, education, skills), site settings (identity, SEO, legal) and contact inbox.

**Backend**
- Spring Boot 4.1 / Java 25 REST API, PostgreSQL 18 with Flyway migrations and seed data.
- Google OIDC login with e-mail allow-list, session cookie + CSRF double-submit, security headers.
- Dependency-free token-bucket rate limiting per IP and endpoint family.
- Cookieless, privacy-friendly analytics (daily-salted visitor hash, DNT / GPC honoured,
  automatic purge).
- S3-compatible image storage (SeaweedFS in Docker Compose) with magic-byte validation,
  SVG sanitising, blur placeholders and immutable caching.

**Operations**
- Docker Compose stack for Coolify (frontend SSR + API proxy, backend, PostgreSQL, SeaweedFS),
  local dev compose, GitHub Actions CI (backend tests with Testcontainers, frontend build +
  Playwright e2e, image builds).
- Security audit report in `docs/SECURITY_AUDIT.md`.

[Unreleased]: https://github.com/ImMaxence/mbonnici/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ImMaxence/mbonnici/releases/tag/v1.0.0
