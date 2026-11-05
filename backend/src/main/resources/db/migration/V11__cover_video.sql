-- ─────────────────────────────────────────────────────────────────────────────
-- v1.7.0: an optional video for the browser frame of a project (cards and the top
-- of the project page). The cover stays a picture: it is the share image and the
-- poster shown while the video loads.
-- ─────────────────────────────────────────────────────────────────────────────

alter table project add column cover_video_media_id uuid references media (id) on delete set null;
