-- ─────────────────────────────────────────────────────────────────────────────
-- v1.7.0
--  * project.scene_type is gone: the 3D scenes it chose were removed long ago and
--    nothing read it any more.
--  * testimonials: short quotes from people the owner worked with, shown on the
--    home and about pages (author, their role, the quote, a link to the source).
--  * site_settings.booking_url: an optional appointment link (Cal.com, Calendly…)
--    offered on the contact page next to the form.
-- ─────────────────────────────────────────────────────────────────────────────

alter table project drop column scene_type;

create table testimonial (
  id          uuid primary key default gen_random_uuid(),
  author      text    not null,
  url         text,
  role_fr     text    not null default '',
  role_en     text    not null default '',
  quote_fr    text    not null default '',
  quote_en    text    not null default '',
  sort_order  integer not null default 0
);

alter table site_settings add column booking_url text;
