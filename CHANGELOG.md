# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). Frontend and backend share one version number
(`frontend/package.json` and `backend/pom.xml`), shown on the back-office dashboard.

## [Unreleased]

## [1.2.0] — 2026-11-04

### Changed

**Design — one style instead of three**
- A single editorial look (ink & paper, oversized Inter Tight display, Instrument Serif italics,
  one ultramarine accent) in light and dark; the Obsidian / Editorial / Aurora switcher, the
  `data-style` attribute and the style analytics panel are gone (no more flash of another style
  on load).
- **Navigation**: the icon-only dock is replaced by a top bar with text links (hidden while
  scrolling down, back on scroll up) and, below 900 px, a full-screen menu with large labels
  (modal `<dialog>`: focus trap, Escape).
- **Intro**: a plain sheet with the name, painted with the first frame and lifted after 1.4 s, once
  per visit; the page reveals play as it lifts. The first page load no longer triggers the curtain.
- **Page transition**: one solid sheet (no strips, gaps or rounded corners) with the destination
  name.
- **Light ↔ dark**: circular reveal from the button (View Transitions), cross-fade elsewhere.
- **Projects show the real product**: the landing page in a browser frame and the phone version
  overlapping it, from the back-office cover / first mobile capture or, by default, from the
  screenshots published in each GitHub README (`scripts/project-shots.mjs`). The 3D scenes are
  removed. The project page can load the live site in the frame ("Live", when framing is
  allowed), and its gallery is a swipe / drag / arrow-key **slider**.
- Projects filter: cards glide to their new place (View Transitions) or re-enter in cascade.
- Toolbox grouped by purpose (no more linear marquee); skill levels are no longer shown as
  bars, level 5 only marks the everyday tools. New "Network & security" family.
- About: experience rows keep the contract badge on the role line; education introduced as a
  100 % technical path.
- House style: no full stop at the end of sentences outside the legal pages (also applied to
  taglines, descriptions and Markdown typed in the back office).

### Added
- **Accessibility statement** (`/fr/accessibilite`, `/en/accessibility`, in the sitemap), with the
  compliance status in the footer.
- Legal notice: typefaces (SIL OFL, self-hosted through Fontsource, no Google Fonts request),
  icons and logos, publication director. Privacy policy: contact notifications, third-party frames.
- **Selective restore**: an archive is staged and compared with the live data row by row (new,
  modified, conflict, only on the site, identical); pick what to import (a project brings its
  images and gallery) or replace everything. `POST /api/admin/backups/stage`,
  `/stage/drive/{id}`, `/stage/{id}/apply`; staged archives expire after an hour.
- **Contact notifications**: e-mail through any SMTP server (Reply-To = visitor) and/or a webhook
  (ntfy, Discord, Slack, generic JSON); both optional (`NOTIFY_*`, `SMTP_*`).
- **Local sign-in** for development (`DEV_LOGIN=true`, refused unless `APP_URL` is localhost) and
  `GET /api/auth/providers`; the login page explains when Google is not configured.
- `docker-compose.local.yml` is now self-contained: builds frontend and backend, no `.env` needed.
- Project cards expose `mobileCover`; the project editor previews the card visual.

### Content (migration V4, only where the seed was untouched)
- Public and legal e-mail `maxence.bonnici@outlook.fr`; bio rewritten (technical path, agile
  teamwork, no "no server" claim); Sopra Steria stack (Python, Flask, Redis, HiveMQ, OpenShift,
  Azure Stack, S3); skills added (C++/ESP32, Dart, Flutter, GitLab CI, Jira & Confluence, Claude
  Code, Scrum, SEO for AI engines, network & security); "Tests automatisés" removed.

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
