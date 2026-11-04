-- ─────────────────────────────────────────────────────────────────────────────
-- v1.3.0: how a project is staged (browser + phone / phone only / browser only)
-- and an optional picture next to the name in the site header.
-- scene_type is kept for archive compatibility but no longer used by the site.
-- ─────────────────────────────────────────────────────────────────────────────
alter table project add column display_mode text not null default 'BOTH';   -- BOTH | MOBILE | DESKTOP

alter table site_settings add column avatar_media_id uuid references media (id) on delete set null;
