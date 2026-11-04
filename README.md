<div align="center">

<img src="frontend/public/favicon.svg" width="72" height="72" alt="mbonnici logo" />

# mbonnici.fr

### The portfolio of Maxence Bonnici, full stack developer (Java & Angular).

**One editorial style · light & dark · French & English · real project captures · back office**

[**mbonnici.fr**](https://mbonnici.fr) · [Changelog](CHANGELOG.md) · [Architecture](docs/ARCHITECTURE.md) · [Deployment](docs/DEPLOYMENT.md) · [Security audit](docs/SECURITY_AUDIT.md) · [Lighthouse](docs/LIGHTHOUSE.md)

![Lighthouse desktop 100/100/100/100](https://img.shields.io/badge/Lighthouse%20desktop-100%20·%20100%20·%20100%20·%20100-brightgreen)
![Lighthouse mobile 85–92 / 100 / 100 / 100](https://img.shields.io/badge/Lighthouse%20mobile-85–92%20·%20100%20·%20100%20·%20100-green)

![Angular 22](https://img.shields.io/badge/Angular-22-dd0031?logo=angular&logoColor=white)
![Spring Boot 4.1](https://img.shields.io/badge/Spring%20Boot-4.1-6db33f?logo=springboot&logoColor=white)
![Java 25](https://img.shields.io/badge/Java-25-ed8b00?logo=openjdk&logoColor=white)
![PostgreSQL 18](https://img.shields.io/badge/PostgreSQL-18-4169e1?logo=postgresql&logoColor=white)
![Custom CSS](https://img.shields.io/badge/CSS-100%25%20custom-1572b6?logo=css3&logoColor=white)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

![Home page, dark](docs/images/home-dark.png)

</div>

---

## What it is

A personal site that behaves like a product: server-rendered pages for search engines and AI
assistants, a cinematic front end built without a single UI library, and a private back office
to publish projects, pictures and career updates without touching the code.

| Home (light) | Projects | Project page |
| --- | --- | --- |
| ![Home, light](docs/images/home-light.png) | ![Projects](docs/images/projects.png) | ![Project](docs/images/project.png) |

## Highlights

**Experience**
- **One editorial look**: ink and paper, oversized Inter Tight display, Instrument Serif italics and
  a single ultramarine accent, in light and dark (circular reveal when switching).
- **Intro sheet** on the first visit, **one-sheet page transitions**, masked word-by-word reveals.
- **The real product on every card**: the landing page in a browser frame with the phone version
  on top, from the pictures chosen in the back office (desktop + phone, phone only or desktop
  only). The project page can load the live site in the frame and has a swipe / drag / keyboard
  **gallery slider**.
- **Native JavaScript physics**: magnetic cursor, springs, frame-rate-independent damping.
- **Text navigation** in a top bar that hides while reading; a full-screen menu on phones and tablets.
- **Projects in a grid or a list** (the cover follows the pointer), **case studies**, live status of
  each site ("Online · 120 ms") and GitHub figures, skills linked to the projects that use them,
  an image viewer with swipe and keyboard, responsive WebP copies with a focal point.
- **Notes** (Markdown articles with RSS) and a **CV as a PDF** generated from the About content.

**Content & SEO**
- French and English with localised URLs (`/fr/projets/meowtrix`, `/en/projects/meowtrix`),
  hreflang alternates and a language switch that keeps you on the same page.
- Full server-side rendering with a per-request CSP nonce; JSON-LD (Person, WebSite, ItemList,
  SoftwareSourceCode, BreadcrumbList), Open Graph and Twitter cards, canonical links.
- Feeds for machines: `sitemap.xml`, `robots.txt` that welcomes AI crawlers, and
  [`llms.txt`](https://llmstxt.org) / `llms-full.txt` generated from the database.
- Legal notice, privacy policy and terms of use, in both languages, filled from the settings.

**Back office** (`/admin`, Google sign-in restricted to one e-mail address)
- Dashboard with page views, unique visitors, project views, outbound clicks, daily traffic
  chart, most viewed projects and pages, themes / languages / devices, referrers, and **real-user
  Core Web Vitals** (p75 per metric, device and page) measured without any identifier.
- Draft **preview**, unsaved-changes guard, texts-to-translate counters, message archive and
  search, unused pictures clean-up.
- Frontend and backend versions, build date and commit, Java and Spring Boot versions, database
  and storage health — all on one card.
- Projects: bilingual editor, live card preview, accent colour, media picker (cover, gallery, mobile),
  publish / unpublish, drag-and-drop ordering. Media library with drag-and-drop upload and alt
  texts. Experience, education, skills, site settings and the contact inbox.
- **Backups**: one archive = the whole database (native `COPY` export) + every image. Download it,
  link **Google Drive** (same account, `drive.file` scope only) for one-click and daily backups
  with retention. **Restoring compares the archive with the live site row by row**: pick what to
  bring back (a project comes with its images) or replace everything.
- **Contact inbox** in the back office with an unread badge (no e-mail, no third-party relay).
- **Images**: PNG / JPEG only, magic bytes + extension checked, converted to WebP (`cwebp`), metadata
  stripped. Per project: desktop + phone, phone only or desktop only presentation.
- **Server panel**: CPU, memory, Java heap, disk space left, database and media sizes, live.
- **Releases page** rendering this repository's changelog with the running version highlighted.

| About (dark) | Contact | Phone menu |
| --- | --- | --- |
| ![About](docs/images/about.png) | ![Contact](docs/images/contact.png) | ![Menu](docs/images/mobile-menu.png) |

**Privacy & security**
- Cookieless first-party analytics: a visitor is a daily-rotating salted hash, the IP is never
  stored, Do-Not-Track and Global Privacy Control are honoured, events are purged after 13 months.
  No consent banner needed.
- Google OIDC with an e-mail allow-list, HttpOnly/SameSite session cookie, CSRF double-submit,
  per-IP rate limiting, magic-byte upload validation, sandboxed media, strict security headers on
  both tiers. Details in [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md).

**Accessibility**
- Skip link, keyboard-reachable navigation and cards, focus rings, aria labels, live route
  announcements, `prefers-reduced-motion` (no intro, no cursor, instant transitions), axe-core
  checks in light and dark in the e2e suite, and a published accessibility statement.

## Stack

| Tier | Technology |
| --- | --- |
| Frontend | Angular 22 (zoneless, signals, SSR), Express, TypeScript, hand-written CSS with design tokens, self-hosted fonts |
| Backend | Spring Boot 4.1, Java 25, Spring Security (OAuth2 client), Spring Data JPA, Flyway, Bean Validation |
| Data | PostgreSQL 18, SeaweedFS (S3 API) for images — swappable for MinIO, Garage or Cloudflare R2 |
| Tests | 37 backend integration tests (Testcontainers), Playwright e2e on desktop and phone with axe-core |
| Ops | Docker Compose on [Coolify](https://coolify.io), Cloudflare in front |

## Repository

```
frontend/   Angular app, SSR server (src/server.ts), styles, e2e tests, scripts
backend/    Spring Boot API, Flyway migrations (src/main/resources/db/migration), tests
docs/       architecture, deployment, security audit, screenshots
docker-compose.yml        production stack (Coolify)
docker-compose.dev.yml    PostgreSQL + SeaweedFS for local development
docker-compose.local.yml  full stack built from source, no .env needed
```

## Run it locally

Requirements: Node 24, a JDK 25 (Maven comes with `./mvnw`), Docker.

```bash
# 1. databases
docker compose -f docker-compose.dev.yml up -d --wait      # PostgreSQL :5433, SeaweedFS :8334

# 2. API
cd backend && ./mvnw spring-boot:run                        # http://localhost:8081

# 3. site
cd frontend && npm install && npm start                     # http://localhost:4200
```

The first start runs the migrations and leaves the site **empty** (only the owner name, legal
identity and contact e-mail). Fill it from `/admin`, or import the original content with its
pictures: **Sauvegardes → Restaurer depuis un fichier → `seed/mbonnici-starter.zip`**, then tick
what to keep (see [seed/README.md](seed/README.md)). Signing in needs a Google client, see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), or the local sign-in below.

**Everything in Docker, nothing to install but Docker** (builds frontend and backend):

```bash
docker compose -f docker-compose.local.yml up --build -d --wait
# http://localhost:4000         site
# http://localhost:4000/admin   back office → "Connexion locale" (DEV_LOGIN, localhost only)
LOCAL_PORT=4100 docker compose -f docker-compose.local.yml up --build -d --wait   # other port
```

## Tests

```bash
cd backend  && ./mvnw verify            # integration tests on a throw-away PostgreSQL (Docker)
cd frontend && npm run build && npm run e2e   # Playwright: desktop + Pixel 7, axe accessibility
```

## Versions

Frontend and backend share one version (`frontend/package.json`, `backend/pom.xml`). The build
stamps the frontend with its version, commit and date (`scripts/version.mjs`); the backend
exposes its build info, Java and Spring Boot versions through `/api/admin/info`. Both appear on
the dashboard. Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## Licence

[MIT](LICENSE) — the code is free to reuse; the texts, pictures and project screenshots belong
to their authors.
