-- ─────────────────────────────────────────────────────────────────────────────
-- v1.6.0: the resume is a PDF uploaded in the back office (one per language, both
-- optional), stored in the bucket; the settings row keeps its key, size and date.
-- ─────────────────────────────────────────────────────────────────────────────

alter table site_settings
  add column cv_fr_key  text,
  add column cv_fr_size integer,
  add column cv_fr_at   timestamptz,
  add column cv_en_key  text,
  add column cv_en_size integer,
  add column cv_en_at   timestamptz;
