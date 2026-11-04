-- ─────────────────────────────────────────────────────────────────────────────
-- v1.5.0: history of the live-site checks and an error log, both read in the
-- back office only (no notification anywhere).
-- ─────────────────────────────────────────────────────────────────────────────

-- one row per check of a published project's site (every 5 minutes, kept 30 days)
create table site_check (
  id          bigserial primary key,
  project_id  uuid        not null references project (id) on delete cascade,
  checked_at  timestamptz not null default now(),
  up          boolean     not null,
  status      integer,
  latency_ms  integer
);
create index site_check_project_idx on site_check (project_id, checked_at desc);

-- errors of the site (browser) and of the API (server), grouped by fingerprint
create table error_log (
  id           bigserial primary key,
  fingerprint  text        not null unique,
  source       text        not null,                      -- CLIENT | SERVER
  message      text        not null,
  detail       text,                                      -- stack trace (shortened)
  path         text,
  occurrences  integer     not null default 1,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  resolved     boolean     not null default false
);
create index error_log_seen_idx on error_log (resolved, last_seen desc);
