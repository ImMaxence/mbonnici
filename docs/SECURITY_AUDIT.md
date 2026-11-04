# Security audit — mbonnici.fr v1.0.0

*Date: 2026-11-04 · Scope: frontend (Angular SSR + Express), backend (Spring Boot), Docker
Compose stack, CI. Method: threat-model review of the code, automated checks
(`npm audit`, Spring Boot dependency management, Playwright security-header tests, backend
integration tests), and manual probing of the running stack.*

## Summary

| Area | Status |
|---|---|
| Authentication & sessions | ✅ Google OIDC, e-mail allow-list, HttpOnly/SameSite/Secure session cookie |
| Authorisation | ✅ `/api/admin/**` and actuator details require `ROLE_ADMIN`; tested (401/403) |
| CSRF | ✅ Double-submit cookie (`XSRF-TOKEN` / `X-XSRF-TOKEN`); only the anonymous beacon is exempt |
| Injection | ✅ JPA parameters everywhere; native analytics queries use bound parameters; Markdown rendered through templates, never `innerHTML` |
| XSS | ✅ CSP with per-request nonces, `frame-ancestors 'none'`, Angular escaping; uploaded SVGs are sanitised and served sandboxed |
| File upload | ✅ Magic-byte detection, 10 MB / 40 Mpx limits, random keys, private bucket, streamed by the API with `nosniff` |
| Rate limiting | ✅ Per-IP token buckets on every endpoint family; proxy headers only trusted when `TRUST_PROXY=true` |
| Transport & headers | ✅ HSTS, nosniff, referrer-policy, permissions-policy, COOP, X-Frame-Options on both tiers |
| Secrets | ✅ Only from environment; `.env` git-ignored; compose refuses to start without the required secrets |
| Dependencies | ✅ `npm audit`: 0 vulnerabilities (prod and dev); Spring Boot 4.1.2 BOM; AWS SDK 2.57 |
| Privacy | ✅ No cookies for visitors, no IP storage, DNT/GPC honoured, data retention limits, legal pages |
| Containers | ✅ Non-root users, minimal Alpine/JRE images, health checks, only the frontend is published |

No critical or high-severity issue remains. Findings below were either fixed during the audit
or are accepted with a documented rationale.

## Findings fixed during the audit

### F1 — Rate limiting could be bypassed by spoofing `X-Forwarded-For` (High → fixed)
`server.forward-headers-strategy=framework` was enabled unconditionally, so Spring's
`ForwardedHeaderFilter` rewrote the remote address from a client-controlled header and every
request could claim a fresh IP. The strategy is now `none` by default and only switched to
`framework` together with `TRUST_PROXY=true` in the Docker stack, where the real IP comes from
Cloudflare's `CF-Connecting-IP`. Regression test: `RateLimitTest.proxyHeadersAreIgnoredUnlessTrusted`.

### F2 — Scripted SVG uploads (Medium → fixed)
SVG files may embed `<script>`, event handlers or external references. Uploads are now rejected
when they contain `<script`, `javascript:`, `on*=` attributes, `<foreignObject>`, `<iframe>`,
`<embed>`, `<object>` or external `xlink:href`; served media additionally carry
`Content-Security-Policy: sandbox; default-src 'none'`, so even a bypass cannot execute in the
site's origin. Test: `MediaTest.rejectsNonImagesAndScriptedSvg`.

### F3 — Path traversal on media keys (Low → fixed)
`/api/media/{*key}` only resolves keys matching `yyyy/MM/<uuid>.<ext>` that also exist in the
database; anything else is a 404 before touching storage. Test: `MediaTest.unknownOrMalformedKeysAre404`.

### F4 — Leaking an internal flag in API payloads (Info → fixed)
`Localized.isBlank()` was serialised as `"blank": false`. Marked `@JsonIgnore`.

### F5 — SSR host validation (Info → configured)
Angular 22 refuses to render for `Host` / `X-Forwarded-Host` values outside an allow-list
(SSRF / cache-poisoning protection). The server now allows the host of `APP_URL`, its
sub-domains, `localhost` and `ALLOWED_HOSTS`, and only trusts `X-Forwarded-*` when
`TRUST_PROXY=true` (behind Traefik / Cloudflare). Everything else is answered with 400.

### F6 — API rate limit too tight for legitimate bursts (Low → tuned)
240 requests/min per IP was reachable by a single visitor opening several tabs behind a
shared NAT, and by the e2e suite. Default raised to 600/min (`RATE_LIMIT_API_PER_MINUTE`),
still far below any abusive pattern; the contact (5/h), auth (20/min), upload (30/min) and
analytics (60/min) buckets are unchanged.

## 1.1.0 additions (backups, server panel)

### F7 — Google refresh token at rest (Medium → accepted with controls)
Scheduled Drive backups need a long-lived refresh token. It is stored by Spring Security's JDBC
store (`oauth2_authorized_client`, `bytea`) in a database that is never exposed outside the Docker
network, never returned by any API, scoped to `drive.file` only (the app cannot read other Drive
files), revocable from the back office (*Disconnect*) or from the Google account page. Encrypting
the column with an application key would only protect against a leaked `pg_dump`; backups made by
the app itself exclude this table on purpose.

### F8 — Restore endpoints replace all data (High impact by design → guarded)
`POST /api/admin/backups/import` and `/restore/{fileId}` wipe and replace content tables and
media. They require the admin session + CSRF token like every write, run under the single-flight
lock (`409` when busy), validate the manifest, the schema version (`409` unless `force`) and every
media key (`^yyyy/MM/<uuid>.<ext>$`, so an archive cannot write outside the bucket namespace).
Archives are read into memory table by table; the multipart limit is 2 GB because archives embed
every image — the upload policy of the rate limiter does not apply to this admin-only route.

### F9 — Drive file ids in URLs (Low → validated)
`fileId` path variables are restricted to `[A-Za-z0-9_-]{10,128}` before reaching the Drive API,
and the API itself only resolves files the app created.

### F10 — `/api/admin/system` discloses host metrics (Info → admin-only)
CPU, memory, disk, database and media sizes are useful for capacity planning and are only
readable by the authenticated owner.

## Accepted risks and rationale

| # | Item | Rationale |
|---|---|---|
| A1 | `style-src-attr 'unsafe-inline'` in the CSP | Angular style bindings (`[style.--i]`) need inline style *attributes*. Scripts remain nonce-only; inline style attributes cannot exfiltrate data without script execution. |
| A2 | `frame-src https:` | The iPhone simulator embeds the owner's own sub-projects; the list is admin-controlled and limited to `https://` URLs validated server-side. |
| A3 | Iframe `sandbox="allow-scripts allow-same-origin …"` | Both flags are required for a cross-origin site to work; they do not grant access to *this* origin. |
| A4 | In-memory rate limiting and caches | Single-instance deployment. Scaling out would need a shared store (Redis), documented in the code. |
| A5 | No CSRF on `POST /api/analytics/events` | Anonymous endpoint with no session side effects; abuse is bounded by the per-IP bucket (60/min) and the 20-event batch cap. |
| A6 | Google profile picture allowed in `img-src` | Only the admin's own avatar (`*.googleusercontent.com`), rendered with `referrerpolicy="no-referrer"`. |
| A7 | Session timeout 8 h | Convenience for the single owner; logout invalidates the session and deletes both cookies. |

## Recommendations (not blocking)

1. **Cloudflare**: enable the WAF managed rules and a rate-limiting rule on `/api/contact` and
   `/api/auth/*` at the edge for a second layer; keep *Full (strict)* TLS.
2. **Backups**: schedule PostgreSQL dumps and SeaweedFS volume snapshots in Coolify.
3. **Dependabot / Renovate** on both `package.json` and `pom.xml`; `npm audit` and the Spring
   Boot BOM were clean on 2026-11-04 but will drift.
4. **Google OAuth**: keep the client restricted to the exact redirect URIs listed in
   `docs/DEPLOYMENT.md`; rotate the secret if it is ever pasted outside Coolify.
5. **Contact spam**: the honeypot + rate limit are enough for a personal site; add a
   proof-of-work or Turnstile challenge if abuse appears (the inbox lets you spot it).
6. **Logs**: rejected sign-ins and 5xx errors are logged; consider shipping container logs to a
   retention-limited store for forensics.

## Checklist used

- [x] OWASP Top 10 (2021) walkthrough per endpoint
- [x] Spring Security configuration review (session fixation, CSRF, headers, entry points)
- [x] Express server review (header injection in proxy, hop-by-hop stripping, body streaming)
- [x] Upload pipeline (type confusion, decompression bombs via pixel cap, SVG scripts)
- [x] Secrets and configuration (`.env.example`, compose `:?` guards, no secrets in images)
- [x] Dependency audit (`npm audit`, managed Maven versions)
- [x] Privacy / GDPR (cookieless analytics, retention, legal pages, DNT/GPC)
- [x] Automated regression tests for the security-relevant behaviours (29 backend tests, e2e header and access tests)

## v1.2.0 additions

- **Local sign-in (`/api/auth/dev-login`)**: opens an admin session without Google, for local
  testing only. It answers 404 unless `DEV_LOGIN=true` **and** `APP_URL` resolves to `localhost`,
  `127.0.0.1` or `[::1]`, so a production deployment (`APP_URL=https://mbonnici.fr`) cannot expose it
  even if the variable were set by mistake. Covered by `DevLoginTest`.
- **Selective restore**: staged archives live in the JVM temp dir for one hour (three at most),
  media keys are validated against the storage pattern before anything is read, table and column
  names come from a fixed allow-list / `information_schema` (never from the archive), and the merge
  runs in one transaction. Endpoints are under `/api/admin/**` (admin session + CSRF).
- **Contact notifications**: outbound only, off the request thread, short timeouts; the visitor's
  name is stripped of line breaks before reaching the e-mail subject (header injection), the
  message body is plain text.
