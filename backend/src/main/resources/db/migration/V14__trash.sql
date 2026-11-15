-- ─────────────────────────────────────────────────────────────────────────────
-- v1.13.0: the back office's bin (Corbeille). What it deletes (a project, a media,
-- a profile entry, a message, a resume) is copied here first, as the rows it took
-- away plus the links to put back, and can be restored for 30 days. Its bucket
-- objects stay in storage until the item is emptied. Not part of the backups.
-- ─────────────────────────────────────────────────────────────────────────────

create table trash_item (
  id          uuid primary key default gen_random_uuid(),
  kind        text        not null,   -- PROJECT | MEDIA | EXPERIENCE | EDUCATION | SKILL | NEWS | MESSAGE | CV
  label       text        not null default '',
  detail      text,
  -- {"rows": {table: [row as json, …]}, "links": {name: [object, …]}, "keys": [bucket key, …]}
  payload     jsonb       not null,
  deleted_at  timestamptz not null default now()
);
create index trash_item_deleted_idx on trash_item (deleted_at desc);
