-- ─────────────────────────────────────────────────────────────────────────────
-- A fresh site starts empty: only the single settings row (identity and legal
-- notice, required by the legal pages) exists. Everything else is created from
-- the back office, or imported from seed/mbonnici-starter.zip (Sauvegardes →
-- Restaurer depuis un fichier, then tick what to keep).
-- ─────────────────────────────────────────────────────────────────────────────

insert into site_settings (
  id, owner_name, headline_fr, headline_en, bio_fr, bio_en, public_email, availability,
  legal_name, legal_address, legal_host, legal_contact_email
) values (
  1, 'Maxence Bonnici', '', '', '', '', 'maxence.bonnici@outlook.fr', 'OPEN',
  'Maxence Bonnici', '', 'Serveur personnel auto-hébergé en France, exposé via Cloudflare, Inc. (101 Townsend St, San Francisco, CA 94107, USA)', 'maxence.bonnici@outlook.fr'
);
