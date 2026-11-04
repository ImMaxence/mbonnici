# Deployment — Coolify + Cloudflare

The whole site runs from one `docker-compose.yml` on a personal server managed by
[Coolify](https://coolify.io), fronted by Cloudflare.

```
Internet ─► Cloudflare (DNS proxy, WAF, cache, TLS) ─► Coolify / Traefik (origin TLS)
         ─► frontend:4000  (Angular SSR + /api reverse proxy)
              ├─► backend:8080  (Spring Boot API)
              │     ├─► db:5432       (PostgreSQL 18)
              │     └─► seaweed:8333  (SeaweedFS, S3 API)
```

Only the `frontend` container is published. It renders pages, serves the static bundle and
proxies `/api/*`, `/sitemap.xml`, `/robots.txt`, `/llms.txt` and `/llms-full.txt` to the backend
over the private Docker network.

## 1. Google OAuth client

1. Open <https://console.cloud.google.com/apis/credentials>, create an **OAuth client ID** of type
   *Web application*.
2. Authorised JavaScript origin: `https://mbonnici.fr`.
3. Authorised redirect URI: `https://mbonnici.fr/api/auth/oauth2/code/google`
   (add `http://localhost:4200/api/auth/oauth2/code/google` and
   `http://localhost:8081/api/auth/oauth2/code/google` for local development).
4. Keep the client ID and secret for Coolify's environment variables below.

Only the address in `ADMIN_EMAIL` can sign in; every other Google account is rejected before a
session is created.

### Google Drive backups (optional)

Backups use the **same OAuth client and the same Google account**, with one extra permission:
`https://www.googleapis.com/auth/drive.file` (the app only sees files it created itself, in a
folder named *mbonnici.fr backups*).

1. In the Google Cloud console open **APIs & Services → Library** and enable the **Google Drive
   API** for the project.
2. **OAuth consent screen → Data access**: add the scope `…/auth/drive.file`. Then **Audience →
   Publish app** (publishing status *In production*): in *Testing* mode Google makes every refresh
   token expire after 7 days as soon as a scope beyond name / e-mail / profile is asked, so the
   scheduled backups would stop after a week. `drive.file` is a non-sensitive scope: publishing needs
   no verification (at most an "unverified app" notice, shown only to you when you connect).
3. The redirect URI is the same as the login (`/api/auth/oauth2/code/google`), nothing to add.
4. In the back office open **Sauvegardes → Connecter Google Drive** and accept. Google issues a
   refresh token (offline access) that the backend stores in the `oauth2_authorized_client` table;
   scheduled backups use it without anyone being logged in. *Disconnect* deletes it.

Without Drive you can still download archives and restore from a file from the same page.

## 2. Coolify

1. **Projects → New resource → Docker Compose** (from the Git repository, branch `main`).
   Coolify reads `docker-compose.yml` at the repository root.
2. **Environment variables**: only `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are entered by hand.
   The database and storage users and passwords and the analytics secret are Coolify magic variables
   (`SERVICE_USER_*`, `SERVICE_PASSWORD_64_*`): generated on the first deployment, kept after. Never
   regenerate the `POSTGRES` ones: the database keeps the user and password it was created with.
   Everything else (domain, admin e-mail, proxy settings) is written in `docker-compose.yml`.
3. **Domains**: on the `frontend` service set `https://mbonnici.fr` and port `4000`.
   Leave the other services without a domain; they are not exposed.
4. Deploy. The first start runs the Flyway migrations; the backend waits for PostgreSQL and
   SeaweedFS to be healthy. The site starts **empty** (owner name, legal identity and contact
   e-mail only): sign in at `/admin` and add projects, experience and skills, or import
   `seed/mbonnici-starter.zip` from **Sauvegardes → Restaurer depuis un fichier** and tick what
   to keep.
5. Enable **automatic deployments** on push (webhook) if you want `main` to go live.

Persistent data lives in the named volumes `db-data` (PostgreSQL) and `seaweed-data` (images).
Back them up with Coolify's volume backups or `pg_dump` + a copy of the SeaweedFS directory.

### Updating

Push to `main` (or click *Redeploy*): Coolify rebuilds the images; the back-office dashboard shows
the version of each tier.

## 3. Cloudflare

- DNS: `A`/`AAAA` record for `mbonnici.fr` pointing to the server, **proxied** (orange cloud).
- SSL/TLS: **Full (strict)**. Issue a Cloudflare *Origin Certificate* and paste it in Coolify's
  certificate settings for the domain (or let Traefik use Let's Encrypt through the DNS challenge).
- Recommended: enable *Always Use HTTPS*, *HTTP/3*, *Brotli* and *Early Hints*.
- **Cache rules** (Caching → Cache Rules), in this order:

  | Match (URI path) | Setting | Why |
  |---|---|---|
  | starts with `/api/media/` | Eligible for cache, edge TTL: respect origin | immutable pictures (1 year, ETag) |
  | starts with `/api/og/` | Eligible for cache, edge TTL: respect origin | share pictures (1 day, ETag) |
  | equals `/sitemap.xml`, `/llms.txt`, `/llms-full.txt` | Eligible for cache, respect origin | 1 hour |
  | starts with `/api/` (anything else) | **Bypass cache** | sessions, CSRF, admin, beacons |
  | everything else (HTML) | **Bypass cache** | each page carries a per-request CSP nonce |

  `/api/cv` (the uploaded resume) stays in the bypass rule: it is revalidated so a new upload shows at
  once.
- The backend reads the real visitor IP from `CF-Connecting-IP` (`TRUST_PROXY=true`), so rate
  limits and analytics work behind the proxy. That header is trusted as is: let ports 80 / 443 of the
  server accept **Cloudflare's addresses only** (<https://www.cloudflare.com/ips/>, firewall or the
  hosting provider's), or use a Cloudflare Tunnel; otherwise a client reaching the server directly
  could pick its own IP and slip past the rate limits.

## Pre-production checklist

1. **Dependencies**: `npm audit` in `frontend` (0 vulnerabilities at 1.5.0) and the Maven versions
   (Spring Boot 4.1.2 and AWS SDK 2.57.8 were the latest at 1.5.0; libraries managed by the Spring Boot
   BOM follow Spring Boot, do not bump them by hand).
2. **Secrets** in Coolify: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`; the `SERVICE_*` values are
   generated. `DEV_LOGIN` must **not** be set (it is refused anyway unless the site URL is
   localhost).
3. **Google console**: authorised redirect URI `https://mbonnici.fr/api/auth/oauth2/code/google`
   (and the Drive scope if backups go to Drive).
4. **Cloudflare**: DNS proxied, Full (strict), the cache rules above.
5. **First start**: sign in at `/admin`, import `seed/mbonnici-starter.zip` (Sauvegardes → Restaurer
   depuis un fichier), check the dashboard (Versions & santé all "ok", Sites en ligne filled after a
   few minutes), make a first backup.
6. **Checks**: `https://mbonnici.fr/robots.txt`, `/sitemap.xml`, a project page shared in the
   LinkedIn Post Inspector (share picture), the resume (Profil → CV, then the button on the contact
   page), the contact form (a message appears in
   the back office).

## 4. Sub-projects on the same domain

Each sub-project (`localatscv.mbonnici.fr`, `meowtrix.mbonnici.fr`, …) is its own Coolify
resource with its own sub-domain. Register it as a project in the back office with its *live
URL*; it then appears in the portfolio, in `sitemap.xml` (as a project page) and in `llms.txt`
with a direct link, and can be shown live in the browser frame of its page if it allows framing.

## 5. Local development

```bash
docker compose -f docker-compose.dev.yml up -d --wait   # PostgreSQL :5433, SeaweedFS :8334
cd backend  && ./mvnw spring-boot:run                     # API on :8081
cd frontend && npm install && npm start                   # http://localhost:4200 (proxies /api)
```

Full production-like stack on your machine (local sign-in, no Google client needed):

```bash
docker compose -f docker-compose.local.yml up --build -d --wait
# http://localhost:4000, back office at /admin
```

`docker-compose.yml` is the Coolify one: it refuses to start without the Google client (`:?`
guards) and expects the `SERVICE_*` values Coolify generates (see `.env.example`).

## 6. Health and observability

| Check | URL |
|---|---|
| Frontend liveness | `GET /healthz` → `ok` |
| Backend liveness | `GET /api/actuator/health` → `{"status":"UP"}` |
| Versions, DB and storage health | back office → *Dashboard* → *Versions & health* |

Logs are plain stdout (Coolify shows them per container). The backend logs rejected sign-ins,
rate-limit hits (debug level) and analytics purges.
