-- ─────────────────────────────────────────────────────────────────────────────
-- mbonnici.fr — initial schema
-- Localised text is stored as paired *_fr / *_en columns (two languages only,
-- explicit columns keep queries simple and indexable).
-- ─────────────────────────────────────────────────────────────────────────────

create table site_settings (
  id                  smallint primary key default 1 check (id = 1),
  owner_name          text        not null,
  headline_fr         text        not null,
  headline_en         text        not null,
  bio_fr              text        not null default '',
  bio_en              text        not null default '',
  location            text,
  public_email        text,
  github_url          text,
  linkedin_url        text,
  availability        text        not null default 'OPEN',        -- OPEN | LISTENING | BUSY
  seo_title_fr        text,
  seo_title_en        text,
  seo_description_fr  text,
  seo_description_en  text,
  legal_name          text,
  legal_address       text,
  legal_host          text,
  legal_contact_email text,
  updated_at          timestamptz not null default now()
);

create table media (
  id                uuid primary key default gen_random_uuid(),
  object_key        text        not null unique,
  content_type      text        not null,
  size_bytes        bigint      not null,
  width             integer,
  height            integer,
  blur_data_url     text,
  original_filename text,
  alt_fr            text        not null default '',
  alt_en            text        not null default '',
  created_at        timestamptz not null default now()
);

create table project (
  id              uuid primary key default gen_random_uuid(),
  slug            text        not null unique,
  title_fr        text        not null,
  title_en        text        not null,
  tagline_fr      text        not null default '',
  tagline_en      text        not null default '',
  description_fr  text        not null default '',
  description_en  text        not null default '',
  status          text        not null default 'DRAFT',          -- DRAFT | PUBLISHED
  featured        boolean     not null default false,
  sort_order      integer     not null default 0,
  year            integer,
  category        text        not null default 'WEB',            -- WEB | MOBILE | GAME | TOOL | DESIGN | DATA | OTHER
  scene_type      text        not null default 'ORBIT',          -- ORBIT | TERRAIN | HELIX | STACK | DEVICE
  accent_color    text        not null default '#0a84ff',
  cover_media_id  uuid references media (id) on delete set null,
  repo_url        text,
  live_url        text,
  allow_iframe    boolean     not null default false,
  stack           text[]      not null default '{}',
  tags            text[]      not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  published_at    timestamptz
);
create index project_listing_idx on project (status, featured, sort_order);

create table project_media (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid    not null references project (id) on delete cascade,
  media_id    uuid    not null references media (id) on delete cascade,
  kind        text    not null default 'GALLERY',                -- GALLERY | MOBILE
  sort_order  integer not null default 0,
  unique (project_id, media_id)
);
create index project_media_project_idx on project_media (project_id, kind, sort_order);

create table experience (
  id              uuid primary key default gen_random_uuid(),
  company         text    not null,
  company_url     text,
  role_fr         text    not null,
  role_en         text    not null,
  description_fr  text    not null default '',
  description_en  text    not null default '',
  location        text,
  contract_type   text    not null default 'CDI',                -- CDI | ALTERNANCE | STAGE | FREELANCE | CDD
  start_date      date    not null,
  end_date        date,
  skills          text[]  not null default '{}',
  sort_order      integer not null default 0
);

create table education (
  id          uuid primary key default gen_random_uuid(),
  school      text    not null,
  school_url  text,
  degree_fr   text    not null,
  degree_en   text    not null,
  location    text,
  start_date  date    not null,
  end_date    date,
  sort_order  integer not null default 0
);

create table skill (
  id          uuid primary key default gen_random_uuid(),
  name        text     not null,
  category    text     not null,                                 -- LANGUAGE | FRAMEWORK | DATABASE | DEVOPS | TOOL | PRACTICE
  level       smallint not null default 3 check (level between 1 and 5),
  sort_order  integer  not null default 0
);

create table contact_message (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  email         text        not null,
  message       text        not null,
  locale        text,
  visitor_hash  text,
  read          boolean     not null default false,
  created_at    timestamptz not null default now()
);
create index contact_message_created_idx on contact_message (read, created_at desc);

create table analytics_event (
  id             bigserial primary key,
  type           text        not null,                           -- PAGE_VIEW | PROJECT_VIEW | OUTBOUND_CLICK | CONTACT_SUBMIT
  path           text        not null,
  project_id     uuid references project (id) on delete set null,
  locale         text,
  theme          text,
  style          text,
  device         text,
  referrer_host  text,
  visitor_hash   text        not null,
  created_at     timestamptz not null default now()
);
create index analytics_event_created_idx on analytics_event (created_at);
create index analytics_event_project_idx on analytics_event (project_id, created_at);
