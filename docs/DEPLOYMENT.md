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
4. Keep the client ID and secret for the `.env` below.

Only the address in `ADMIN_EMAIL` can sign in; every other Google account is rejected before a
session is created.

### Google Drive backups (optional)

Backups use the **same OAuth client and the same Google account**, with one extra permission:
`https://www.googleapis.com/auth/drive.file` (the app only sees files it created itself, in a
folder named *mbonnici.fr backups*).

1. In the Google Cloud console open **APIs & Services → Library** and enable the **Google Drive
   API** for the project.
2. **OAuth consent screen → Data access**: add the scope `…/auth/drive.file`. While the app stays in
   *Testing* mode, add your own address under *Test users*; no verification is needed for a
   single-user app (Google shows an "unverified app" warning only to you).
3. The redirect URI is the same as the login (`/api/auth/oauth2/code/google`), nothing to add.
4. In the back office open **Sauvegardes → Connecter Google Drive** and accept. Google issues a
   refresh token (offline access) that the backend stores in the `oauth2_authorized_client` table;
   scheduled backups use it without anyone being logged in. *Disconnect* deletes it.

Without Drive you can still download archives and restore from a file from the same page.

## 2. Coolify

1. **Projects → New resource → Docker Compose** (from the Git repository, branch `main`).
   Coolify reads `docker-compose.yml` at the repository root.
2. **Environment variables**: paste the content of `.env.example` and fill every secret
   (`openssl rand -hex 32` makes good values for `POSTGRES_PASSWORD`, `S3_SECRET_KEY` and
   `ANALYTICS_SALT_SECRET`). Set `APP_URL=https://mbonnici.fr`.
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

Push to `main` (or click *Redeploy*). Images are rebuilt with `GIT_SHA` so the back-office
dashboard shows which commit is running on each tier.

## 3. Cloudflare

- DNS: `A`/`AAAA` record for `mbonnici.fr` pointing to the server, **proxied** (orange cloud).
- SSL/TLS: **Full (strict)**. Issue a Cloudflare *Origin Certificate* and paste it in Coolify's
  certificate settings for the domain (or let Traefik use Let's Encrypt through the DNS challenge).
- Recommended: enable *Always Use HTTPS*, *HTTP/3*, *Brotli*, *Early Hints*, and a cache rule
  "Cache everything" on `/api/media/*` (responses are immutable). Do **not** cache HTML:
  pages carry a per-request CSP nonce.
- The backend reads the real visitor IP from `CF-Connecting-IP` (`TRUST_PROXY=true`), so rate
  limits and analytics work behind the proxy.

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

Full production-like stack on your machine:

```bash
cp .env.example .env            # fill the secrets
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
# http://localhost:4000
```

`docker-compose.yml` refuses to start (or even build) without the required secrets (`:?` guards).
To only check that the images build, pass placeholders:

```bash
POSTGRES_PASSWORD=x S3_SECRET_KEY=x ANALYTICS_SALT_SECRET=x GOOGLE_CLIENT_ID=x GOOGLE_CLIENT_SECRET=x \
  docker compose build
```

## 6. Health and observability

| Check | URL |
|---|---|
| Frontend liveness | `GET /healthz` → `ok` |
| Backend liveness | `GET /api/actuator/health` → `{"status":"UP"}` |
| Versions, DB and storage health | back office → *Dashboard* → *Versions & health* |

Logs are plain stdout (Coolify shows them per container). The backend logs rejected sign-ins,
rate-limit hits (debug level) and analytics purges.
