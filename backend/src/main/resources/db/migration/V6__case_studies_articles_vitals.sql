-- ─────────────────────────────────────────────────────────────────────────────
-- v1.4.0: responsive images, focal points, case studies, articles, archived
-- messages and real-user performance metrics.
-- ─────────────────────────────────────────────────────────────────────────────

-- media: smaller WebP copies stored next to the original (<key>-w640.webp …) and the point of the
-- picture to keep in view when a frame crops it (0..1 from the left / top; top centre by default)
alter table media
  add column variant_widths integer[]        not null default '{}',
  add column focal_x        double precision not null default 0.5 check (focal_x between 0 and 1),
  add column focal_y        double precision not null default 0   check (focal_y between 0 and 1);

-- project: a structured case study next to the free description (Markdown, both languages)
alter table project
  add column context_fr    text not null default '',
  add column context_en    text not null default '',
  add column role_fr       text not null default '',
  add column role_en       text not null default '',
  add column challenges_fr text not null default '',
  add column challenges_en text not null default '',
  add column results_fr    text not null default '',
  add column results_en    text not null default '';

-- contact messages can be put away without deleting them
alter table contact_message add column archived boolean not null default false;
create index contact_message_archived_idx on contact_message (archived, created_at desc);

-- notes / articles (Markdown)
create table article (
  id              uuid primary key default gen_random_uuid(),
  slug            text        not null unique,
  title_fr        text        not null,
  title_en        text        not null,
  summary_fr      text        not null default '',
  summary_en      text        not null default '',
  body_fr         text        not null default '',
  body_en         text        not null default '',
  status          text        not null default 'DRAFT',          -- DRAFT | PUBLISHED
  cover_media_id  uuid references media (id) on delete set null,
  tags            text[]      not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  published_at    timestamptz
);
create index article_listing_idx on article (status, published_at desc);

-- Core Web Vitals measured in visitors' browsers (no identifier at all)
create table web_vital (
  id          bigserial primary key,
  metric      text        not null,                              -- LCP | INP | CLS | FCP | TTFB
  value       double precision not null,
  path        text        not null,
  device      text,
  created_at  timestamptz not null default now()
);
create index web_vital_created_idx on web_vital (created_at);
