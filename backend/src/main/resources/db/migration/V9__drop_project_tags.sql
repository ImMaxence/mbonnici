-- ─────────────────────────────────────────────────────────────────────────────
-- v1.7.0: project tags are gone. They only fed the page's meta keywords, which
-- the stack already covers; the stack is now picked from the profile's skills.
-- ─────────────────────────────────────────────────────────────────────────────

alter table project drop column tags;
