# Starter content

A fresh deployment starts empty. `mbonnici-starter.zip` is a regular back-office backup holding
the original content of the portfolio: settings texts, experience, education, skills and the
projects, with their pictures as real media (cover, phone capture, gallery).

## Import it

Back office → **Sauvegardes** → **Restaurer depuis un fichier** → `mbonnici-starter.zip`, then
either tick the rows to add or choose "Tout remplacer". Everything stays editable afterwards.

## Additions for a site already in use

These archives only hold new rows (no settings, no visits), made on an empty throw-away stack.
Import them with "Restaurer depuis un fichier", then tick the rows ("cocher les lignes"), never
"Tout remplacer":

- `mbonnici-github.zip` (1.11.0, schema 13): the GitHub projects, skills and recommendations
  missing in production on 2026-11-11.
- `mbonnici-nouveaux-projets.zip` (1.13.0, schema 14): FreeRemoveBg and Politique 2027, published
  and featured, with their captures (cover, phone, 5 gallery pictures each). Deploy 1.13.0 first.

## Rebuild it

```bash
# 1. capture the pictures (README images, live sites) into seed/shots/ + manifest.json
node seed/capture-shots.mjs [slug …]
# only the phone captures (1206 × 2622, alts kept): node seed/capture-shots.mjs --phones

# 2. on a local stack (DEV_LOGIN on) holding the texts but no media, e.g. a fresh
#    docker-compose.local.yml + backend/src/test/resources/db/testdata/R__test_content.sql:
node seed/build-starter.mjs http://localhost:4000
```

`build-starter.mjs` converts each capture to PNG (uploads accept PNG and JPEG), adds an iOS status
bar to phone captures that have none, uploads them through the API (the backend re-encodes to
WebP), attaches them to the projects and exports the archive.

## Sharper phone captures on a running site

`node seed/refresh-phones.mjs http://localhost:4000` swaps the phone capture of each project for the
one in `seed/shots` (DEV_LOGIN needed) and leaves everything else as it is.
