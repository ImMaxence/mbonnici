-- ─────────────────────────────────────────────────────────────────────────────
-- Backups to Google Drive + persisted OAuth2 clients (refresh token for scheduled runs)
-- ─────────────────────────────────────────────────────────────────────────────

-- Spring Security JdbcOAuth2AuthorizedClientService schema (PostgreSQL flavour)
create table oauth2_authorized_client (
  client_registration_id  varchar(100) not null,
  principal_name          varchar(200) not null,
  access_token_type       varchar(100) not null,
  access_token_value      bytea        not null,
  access_token_issued_at  timestamp    not null,
  access_token_expires_at timestamp    not null,
  access_token_scopes     varchar(1000),
  refresh_token_value     bytea,
  refresh_token_issued_at timestamp,
  created_at              timestamp    not null default current_timestamp,
  primary key (client_registration_id, principal_name)
);

create table backup_settings (
  id                 smallint primary key default 1 check (id = 1),
  auto_enabled       boolean     not null default false,
  hour_utc           smallint    not null default 3 check (hour_utc between 0 and 23),
  keep_count         smallint    not null default 14 check (keep_count between 1 and 100),
  google_principal   text,
  google_email       text,
  drive_folder_id    text,
  updated_at         timestamptz not null default now()
);
insert into backup_settings (id) values (1);

create table backup_run (
  id             uuid primary key default gen_random_uuid(),
  kind           text        not null,                 -- BACKUP | RESTORE
  trigger        text        not null,                 -- MANUAL | SCHEDULED | DOWNLOAD | UPLOAD
  status         text        not null default 'RUNNING', -- RUNNING | SUCCESS | FAILED
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  file_name      text,
  drive_file_id  text,
  size_bytes     bigint,
  message        text
);
create index backup_run_started_idx on backup_run (started_at desc);
