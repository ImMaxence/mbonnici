# Starter content

A fresh deployment starts empty. `mbonnici-starter.zip` is a regular back-office backup holding
the original content of the portfolio: settings texts, experience, education, skills and the
projects, with their pictures as real media (cover, phone capture, gallery).

## Import it

Back office → **Sauvegardes** → **Restaurer depuis un fichier** → `mbonnici-starter.zip`, then
either tick the rows to add or choose "Tout remplacer". Everything stays editable afterwards.

## Rebuild it

```bash
# 1. capture the pictures (README images, live sites) into seed/shots/ + manifest.json
node seed/capture-shots.mjs [slug …]

# 2. on a local stack (DEV_LOGIN on) holding the texts but no media, e.g. a fresh
#    docker-compose.local.yml + backend/src/test/resources/db/testdata/R__test_content.sql:
node seed/build-starter.mjs http://localhost:4000
```

`build-starter.mjs` converts each capture to PNG (uploads accept PNG and JPEG), adds an iOS status
bar to phone captures that have none, uploads them through the API (the backend re-encodes to
WebP), attaches them to the projects and exports the archive.
