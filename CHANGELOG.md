# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). Frontend and backend share one version number
(`frontend/package.json` and `backend/pom.xml`), shown on the back-office dashboard.

## [Unreleased]

## [1.7.3] — 2026-11-08

### Changed
- **Real-user performance panel**: a one-line verdict and three plain figures (content shown, response
  to clicks, page stability) written as sentences; the abbreviations, first paint, server response,
  devices and pages move to a "Technical detail" section. Pages count visits instead of raw
  measurements, and a page with fewer than 5 visits is no longer coloured.
- **Backups page**: placeholders while the Google Drive data loads, instead of empty panels and a
  "no archive" message that was not true yet.

### Fixed
- **Web vitals accuracy**: a tab opened in the background no longer counts its wait as display time,
  a page that never moves now scores 0 instead of sending nothing, and robots are left out.

## [1.7.2] — 2026-11-08

### Changed
- **Opening screen**: same movement as the page transitions (same curves, the name leaves as the
  sheet lifts) and slower: the name holds on screen, the sheet is gone at 2.9 s instead of 2.45 s.

## [1.7.1] — 2026-11-07

### Fixed
- **No double-tap zoom on phones**: two quick taps on the gallery arrows (or anywhere) zoomed the
  page in. `touch-action: manipulation` on the page, the controls and the gallery track; pinch zoom
  still works (accessibility).

## [1.7.0] — 2026-11-05

### Added
- **Short videos**: the media library takes MP4, WebM and iPhone MOV (80 MB, type checked from the
  bytes). ffmpeg (now in the backend image) re-encodes them to a light H.264 MP4 that plays everywhere:
  no sound, no metadata, 1280 px wide and 30 s at most, index at the front (`faststart`: playback
  starts before the download ends), real size from ffprobe and a blurred first frame shown while it
  loads. Without ffmpeg (a dev machine) MP4 / WebM up to 25 MB are stored as sent. They play muted in the gallery, the image
  viewer and the phone screens, only while on screen, and not by themselves with reduced motion.
  Served with byte ranges (Safari plays video only that way). A cover and the avatar stay pictures
  (they are the share images). The CSP allows `media-src 'self' blob:`.
- **Video in the browser frame**: a project can have a loop played in the browser window of its
  visual (cards, top of the project page); the cover stays the share image and is its poster.
  Migration V11.
- **Testimonials**: real quotes from people you worked with (author, role, quote in both languages,
  link to the source), managed on the Profile page and reorderable, shown large in the serif italic
  on the home and about pages when there is at least one. Backed up (optional table for older
  archives, selectable in the restore review).
- **Booking link**: an optional appointment page (https: Cal.com, Calendly…) in Settings; the contact
  page then offers "Book a call" next to the form.
- **Depth on the project visuals**: on a computer the browser and the phone each turn in 3D towards
  the pointer, the phone (closer) more than the browser. The phone has a real thickness: ten thin layers in
  its silhouette stepped back in depth, which form its edge as it turns; on the project page the phone
  rises and straightens in front of the browser over the first screen of scrolling (scroll-driven
  animation, nothing with reduced motion).
- **Card to page**: opening a project from its card, the card's visual glides into the big visual at
  the top of the project page while the rest fades (the curtain stays for the other links).
- **Server, live**: the dashboard follows CPU and memory every 2 seconds, for the application (the
  backend container) and for the whole server, on four small charts with their own scale, a
  crosshair shared by the four, a 1 / 5 / 15 minute window and a pause button. The backend samples
  on its own and keeps fifteen minutes (`GET /api/admin/system/live?since=`), so a pause or a hidden
  tab leaves no hole. Figures come from `/proc` and the container's cgroup (page cache excluded).
- **Picture editor**: the media library opens each picture in a dialog: the picture large with its
  focal point, its details, French and English descriptions with a length guide, and "Save and
  next" to describe a batch. Nothing is saved before "Save".
- **Zoom in the image viewer**: pinch with two fingers, double tap (or double click), mouse wheel,
  the magnifier button or + − 0; a zoomed picture is panned with a finger, the mouse or the arrows,
  and swiping to the next picture waits until it is fitted again. On phones the viewer took every
  gesture for its swipe, so pinching did nothing.
- **Stack picker**: a project's stack (and an experience's skills) is picked from the Profile
  skills: type to filter, arrows and Enter, Backspace to remove, drag to reorder. A technology
  that is not a skill can still be added as typed (dashed border).

### Changed
- **Projects page**: the cards stand in a straight grid (every other one was shifted down), and a
  computer opens the list view by default (a phone or a tablet keeps the cards). The server picks
  the view from the browser, so there is no flash; the visitor's own choice still wins.
- **Home**: the selected projects are all the same size (the first one was full width), in an
  even number so the two columns end level.
- The project page's **"On mobile"** section no longer repeats the phone capture already in the top
  visual: it shows the other phone screens, side by side, and only when there are some.
- Public cards and project pages show **"Online"** without the response time, and nothing when a
  site is down (the dashboard keeps both).
- **Touch screens**: hover effects (the letters rolling into the blue italic, colour changes, lifted
  cards) no longer fire at the tap, right before the page changes; the keyboard focus still shows
  them. In the phone menu, the entry you tap no longer turns blue, then blue italic, while the new
  page renders under the menu: the menu keeps its look until it has lifted.
- Phone layout of the project page: previous / next project are centred, one above the other.
- **Sharp phone screens**: the phone captures are taken at the real size of an iPhone screen,
  402 × 874 pt at 3x = 1206 × 2622 px (they were 640 px wide, then enlarged: blurry text).
  `node seed/capture-shots.mjs --phones` redoes only them (alts kept), and
  `node seed/refresh-phones.mjs <url>` swaps them into a running site without touching anything
  else; the starter archive carries the new ones.
- **Side buttons in 3D**: the action, volume and side buttons are built on the phone's edge, at mid
  depth, and stand out of it: face on they show as a slight bump, turned they read as buttons on the
  side (they were drawn flat on the front). The phone loads its full capture on dense screens and
  turns a little less (7°), without being pushed towards the eye: the screen stays sharp when tilted.
- **Phone frame**: the Dynamic Island has its real size (126 × 37 pt; it was a small pill) with a
  faint rim, and the right side gains the camera control. The status bar of phone captures takes
  the page's own top colour with ink that reads on it, like iOS (it was black, which swallowed the
  island): in the starter archive (rebuilt, now at schema 10) and, for captures without a bar, in
  the browser. Still an original drawing (Apple's artwork may not be used on a website).
- The cursor over pictures ("View", "Drag") is a dark lens instead of an inversion of the colours
  underneath.
- The home heading of the selected projects reads "Des projets en ligne, à essayer" / "Live projects,
  ready to try"; the project page no longer shows the GitHub star count; the back-office sign-in
  page shows the MBONNICI.FR wordmark.
- Section labels (PROJETS, CONTACT…) carry an orange mark instead of the blue dot.
- Every public button moves towards the pointer with the cursor ring around it: "All projects",
  "Full story", the project filters, the grid / list switch, the header language and theme
  switches, the screenshot / live switch and "Send another message" did not.
- Real-user performance explains what the figure is (the value 75% of visits reach or beat), shows
  the good / poor thresholds under each metric and has a legend for the green, yellow and red bars.
- The database schema line on Backups is plain text under the import help, not a chip that looked
  like a button. Non-interactive chips in the back office no longer react to the pointer.
- The storage figures (disk, database, pictures, Java heap) have their own panel next to versions.

### Removed
- `project.scene_type` (the 3D scenes it chose were removed long ago; nothing read it). Migration V10.
- Project **tags** (they only fed the meta keywords; the stack does that). Migration V9 drops the
  column; older archives still restore, their tags are ignored.

### Fixed
- Dark mode: a reload showed the light page for half a second. The critical CSS inlined by the server
  left the dark palette out (the server renders the light theme); `scripts/shell.mjs` now copies it
  into the inline style of `index.html` at every build.
- The first-visit intro started in the system font, then switched: its fonts are preloaded from
  `/fonts` and declared inline (the site uses the same files). It reads **MBONNICI.FR**, like the
  footer wordmark, sized to fill the width.
- Two quick clicks on the gallery's "Next" moved one picture only: the second click started from
  the picture the smooth scroll had not reached yet.
- The project gallery kept the previous project's position (picture 4 of project A → picture 4 of
  project B): it now starts at the first picture on every project.
- Dashboard: the database status and the PostgreSQL version were stuck together; the Drive archive
  actions (restore, download, delete) too.

## [1.6.0] — 2026-11-04

### Added
- **Your own resume**: upload a PDF per language in the back office (Profil → CV; drag and drop or
  pick a file, 10 MB, replace or remove). Once there is one, a **Download my resume** button appears
  on the contact page (with its size, and the language when the visitor gets the other one), and the
  links on About and in the footer come back. Stored in the bucket, so backups and restores carry it.
  Migration V8 (resume columns).

### Changed
- `/api/cv` serves the uploaded file instead of generating one; it is revalidated on every request
  and kept out of search engines (`X-Robots-Tag: noindex`, no longer allowed in `robots.txt`).
- The share-picture fonts moved to `resources/fonts`.
- **Deployment**: Coolify generates the database, storage and analytics secrets (`SERVICE_USER_*`,
  `SERVICE_PASSWORD_64_*`); only the Google client and `ADMIN_EMAIL` are entered by hand, everything
  else is written in `docker-compose.yml`. `ADMIN_EMAIL` is required (no address in the code any more)
  and takes several addresses separated by `;`. `GIT_SHA`, `GITHUB_TOKEN` and `INSIGHTS_ENABLED` are gone (the back office no
  longer shows a commit). Container logs are rotated (3 files of 10 MB).

### Removed
- The **PDF resume generated** from the site content (OpenHTMLtoPDF / PDFBox dependency dropped).
- The **notes** section, its back-office pages, its share pictures and the **RSS feeds**
  (`/fr/rss.xml`, `/en/rss.xml`); notes leave the sitemap and `llms.txt`. The `article` table is gone
  from the schema (migration V6 no longer creates it: nothing was deployed yet, local databases start
  again from scratch).

## [1.5.1] — 2026-11-04

### Added
- **CSP violations in the Journal**: the pages' Content-Security-Policy asks browsers to report what
  it blocks (`report-to` with `Reporting-Endpoints`, and `report-uri` for older browsers) to
  `/api/analytics/csp`. Violations are grouped like the other errors (source "CSP"); resources of
  browser extensions are ignored. The privacy policy mentions these reports.
- Phone menu: an **Administration** link when signed in (it was only in the desktop bar).

### Changed
- Phone menu: choosing a page no longer flashes the current page before the transition. The new page
  renders under the menu, which then lifts: the menu is the transition.
- The **Menu button** holds its two strokes in a round knob, drawn on whole pixels (crisp on every
  screen).
- Accessibility tests now cover every public and back-office page in both themes, the image viewer,
  the contact form errors, the profile editors and the phone menu, with the WCAG 2.2 AA and
  best-practice rules at every impact level (they used to fail on serious and critical issues only).

### Fixed
- Back office: status colours (published, online, trends, performance ratings, missing translation)
  were below the 4.5:1 contrast ratio. The light theme's success, warning and danger colours and its
  faint text are darker; the dashboard's ink card has its own trend chip.
- Back office: the settings and profile fields were not tied to their labels, the project's accent
  code field had no name, and the note preview could not be scrolled with the keyboard.

## [1.5.0] — 2026-11-04

### Added
- **Share pictures**: every project and note gets a 1200 × 630 JPEG for Open Graph / Twitter cards,
  drawn by the backend in the site's style (title, tagline, the cover in a browser window or the
  note cover, signature), cached until the content changes (`/api/og/projects/{slug}.jpg`,
  `/api/og/notes/{slug}.jpg`, `?lang=`). WebP covers are decoded with `dwebp`: social networks do not
  all read WebP. Pages declare the picture's size, type and alternative text; `robots.txt` lets the
  link-preview crawlers fetch them.
- **Error log** (back office → Journal): JavaScript errors of visitors' browsers (anonymous beacon,
  DNT / GPC honoured, browser extensions ignored) and unexpected API errors, grouped by fingerprint
  with a counter, first and last time seen, stack, resolve / reopen / delete; open errors are counted
  in the sidebar and the dashboard health card. Migration V7.
- **Live sites** panel on the dashboard: status now, one bar per hour over the last 24 hours (response
  time and availability), uptime over 24 hours and 7 days, last outage. The 5-minute checks are now
  stored (`site_check`, 30 days).
- **Resume downloads** counted as their own event, with a dashboard tile.
- Notes: **table of contents** (sticky, the section being read is highlighted), **reading progress**
  bar and **code highlighting** (keywords, strings, comments, numbers, keys; rendered as tokens,
  never as HTML).

### Changed
- Every capture of the starter content has a **descriptive alternative text** in French and English
  (`seed/shots/manifest.json`, used by `seed/build-starter.mjs`); the accessibility statement lists no
  known non-compliance any more (still "partially compliant" until a full RGAA audit).
- Privacy policy: the error reports are described.
- Deployment guide: pre-production checklist and Cloudflare cache rules.

### Fixed
- The dashboard crashed when a performance metric or a response time had no value yet (fields left
  out of the JSON were compared with `null`).

## [1.4.0] — 2026-11-04

### Added
- **CV as a PDF** generated from the site content (settings, experience, education, skills,
  featured projects), in French and English, one A4 page in the site's typography (fonts embedded,
  OFL): "Download my resume" on About and in the footer (`GET /api/cv?lang=fr|en`, cached until the
  content changes, ETag).
- **Notes**: short Markdown articles written in the back office (FR / EN, summary, cover, tags,
  back-datable publication date, live preview), a Notes section in the navigation once a note is
  published, note pages with `BlogPosting` data, RSS feeds (`/fr/rss.xml`, `/en/rss.xml`), sitemap
  and `llms.txt` entries. Markdown gains fenced code blocks and quotes. Migration V6, `article` table
  (backed up and restored like the other content; archives made before it still restore).
- **Case studies**: four optional Markdown sections per project (context, role, challenges, results)
  shown under the description.
- **Live status and GitHub figures**: each published project's site is checked every 5 minutes
  ("Online · 120 ms" on cards and pages) and its repository read every 6 hours (stars, last push,
  languages), with conditional requests; optional `GITHUB_TOKEN`, `INSIGHTS_ENABLED`.
- **Projects list view** next to the grid (remembered): large titles, the cover follows the pointer
  with a spring; a small picture per row on touch screens.
- **Skills ↔ projects**: a skill used by published projects links to the projects page filtered on it
  (`?tech=`), and every technology of a project page links back.
- **Contact from a project**: "Something similar in mind?" opens the contact form about that project,
  with a first line already written.
- **Responsive images**: 640, 1280 and 1920 px WebP copies made at upload (and in the background for
  existing pictures, after a restore, or on demand), served with `srcset`; **focal point** per picture
  (click where it must stay visible when cropped).
- **Real-user performance** (Core Web Vitals): LCP, INP, CLS, FCP and TTFB measured in visitors'
  browsers with the Performance APIs, sent once as an anonymous beacon (no identifier, DNT / GPC
  honoured, 13-month retention), p75 per metric, device and page on the dashboard.
- Back office: **draft preview** of projects and notes (the public page as it will be), **unsaved
  changes** guard (dialog when leaving, browser warning when closing the tab, "Unsaved changes"
  badge), **texts to translate** counters on the FR / EN tabs and in the lists, **message archive and
  search** with a "Reply" that quotes the message, **unused pictures** filter and clean-up, count of
  pictures without alternative text.

### Changed
- Texts are stored per language as typed; the fallback to the other language happens when reading,
  so an empty translation stays visible (and fixable) in the back office.
- Privacy policy: the performance measurements are described. Accessibility statement updated.

### Fixed
- Saving a project that already had pictures failed (unique key on the gallery links).
- The landing page of a visit was counted as "/" in the audience figures.
- A full restore of an archive made before a migration added columns failed.

## [1.3.1] — 2026-11-04

### Added
- **Image viewer** on project pages: the picture grows out of the gallery thumbnail and shrinks
  back into the one being viewed on close; previous / next buttons, ← → Home End, swipe or drag,
  counter and caption, click outside or Escape to close, the gallery follows the last image seen
  (replaces the bare lightbox that opened at once without any navigation).

### Changed
- **Drag and drop feels physical**: the picked row, chip or tile is lifted and follows the pointer,
  the others glide to their new place (FLIP, Web Animations) and it settles into its slot on drop;
  the projects list uses the same mechanism.
- Back-office pages fade in and their panels rise in turn when navigating.
- Dashboard ranking: legend (project page views, clicks to the live site or repository) and units.
- Footer wordmark reads **MBONNICI** and always fits the column exactly (sized in container units).
- Home and About sections are no longer numbered: their (01)…(04) clashed with the page numbers of
  the header.

### Fixed
- The footer wordmark was cut on wide screens.
- Markdown (project texts, Versions page): headings no longer need a blank line around them, list
  items can wrap on several lines, no stray spaces around bold, code and links; an empty
  Unreleased section is hidden.

## [1.3.0] — 2026-11-04

### Added
- **Project presentation** chosen in the back office: desktop + phone, phone only (up to three
  phones from the mobile captures) or desktop only (`project.display_mode`, migration V5).
- **Header picture**: pick any image of the media library in Settings, shown in a circle next to
  the name (`site_settings.avatar_media_id`); the initial is used otherwise.
- Default illustrations (`/img/project-placeholder*.svg`) for projects without any picture.
- Light / dark / **Auto** switch in the header.
- **Drag and drop ordering** in the back office: experience, education, skills (within their
  family) and the pictures of a project, with the mouse, touch or the arrow keys on the handle
  (`PUT /api/admin/profile/experiences/reorder`, `…/education/reorder`).
- **Dashboard**: greeting, KPI tiles with sparklines (views, visitors, project views per visitor,
  outbound clicks, unread messages), traffic chart with a table view, top projects ranking,
  pages / sources / audience shares, system gauges and health; the chart covers every day of
  the period, days without visits at zero.
- **Starter archive** `seed/mbonnici-starter.zip`: the original content with the README and
  live-site captures as real media, importable from Backups (`seed/build-starter.mjs`,
  `seed/capture-shots.mjs`).

### Changed
- **Uploads**: PNG and JPEG only (`.png`, `.jpg`, `.jpeg`), magic bytes and extension must agree,
  dimensions read from the header before decoding (40 MP max), then **converted to WebP**
  (quality 82, metadata stripped, 2560 px wide at most) with `cwebp` (libwebp-tools, now in the
  backend image). SVG, GIF, WebP and AVIF uploads are refused.
- **Fresh deployments start empty**: migration V2 only creates the settings row (owner name,
  legal identity, contact e-mail) and V4 no longer rewrites content; the original content moved
  to the starter archive and, for the tests, to `src/test/resources/db/testdata`. Home and About
  hide their sections until they have content. The static README captures
  (`frontend/public/shots`, `shots.generated.ts`) are gone: every picture comes from the media
  library.
- **One phone everywhere** (cards, project page, back-office preview): a realistic black frame
  (thin border, aluminium band, Dynamic Island with its lens, side buttons) drawn as an original
  SVG, laid over the capture and cropped at the bottom by the stage; the old iPhone simulator
  component is gone. Captures without a status bar get one. Browser windows have macOS traffic
  lights.
- **Intro** styles are inlined in `index.html`: on a first visit the sheet covers the page from
  the first paint (the hero no longer shows for half a second before the intro).
- Count badges (unread messages) are centred, with tabular figures.
- Privacy policy: the only cookie of the public site (`XSRF-TOKEN`, anti-CSRF, session, strictly
  necessary) and the back-office session cookie are named; still no consent banner needed.
- Empty headline (fresh deployment): no stray dot or dash in the hero, About and footer.
- **Back office redesign**: ink sidebar grouped by Overview / Content / Site with the header
  picture, sticky page headers, calmer panels, compact controls, icon buttons with **tooltips**,
  **confirmation dialogs** instead of the browser's confirm() (focus on Cancel for destructive
  actions), message cards with avatar and status, media tiles with inline actions and a missing
  alt-text marker, drawer navigation on small screens; new split-screen **sign-in page**.
- Project filters animate with FLIP on the Web Animations API: clicks are never blocked, filters
  can be switched as fast as you like (the View Transition swallowed clicks).
- The custom cursor blends with `difference`, visible on the ink footer and in both themes.
- Word masks are wider: italic overhangs and tight tracking are no longer clipped in titles.
- Hover on "Discutons" and on previous / next projects: letters roll from the grotesk to the
  serif italic instead of switching at once.
- Header: Home link, availability pill centred with the buttons, Menu button centred with the name;
  the phone menu no longer replays its opening animation when closed.
- Phones: page transitions are a short fade through the page colour.
- Legal pages always name `mbonnici.fr`, even when rendered by a local server.
- `/api/auth/me` and `/api/auth/providers` are no longer counted in the sign-in rate limit.

### Removed
- The GitHub Actions workflow.
- Contact notifications (e-mail, WhatsApp, webhooks) and the mail dependency: messages are only
  read in the back office.

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
