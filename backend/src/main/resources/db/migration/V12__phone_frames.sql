-- ─────────────────────────────────────────────────────────────────────────────
-- v1.7.0: phone frames. A frame is a mockup picture (a phone in any pose, cut out in
-- the back office: transparent background and screen) and the four corners of its
-- screen, as fractions of the picture (top left, top right, bottom right, bottom
-- left). A project can show its phone captures in one of them instead of the drawn
-- iPhone.
-- ─────────────────────────────────────────────────────────────────────────────

create table phone_frame (
  id          uuid primary key default gen_random_uuid(),
  name        text    not null,
  media_id    uuid    not null references media (id) on delete cascade,
  quad        text    not null,                       -- JSON: [[x,y],[x,y],[x,y],[x,y]], 0..1
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table project add column phone_frame_id uuid references phone_frame (id) on delete set null;
