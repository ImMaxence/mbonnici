-- ─────────────────────────────────────────────────────────────────────────────
-- v1.7.0: phone frames (V12) are gone. The mockups were meant for the pictures of
-- the project slider, made outside the site and uploaded like any picture; the
-- visual at the top of a project keeps the drawn iPhone.
-- ─────────────────────────────────────────────────────────────────────────────

alter table project drop column phone_frame_id;
drop table phone_frame;
