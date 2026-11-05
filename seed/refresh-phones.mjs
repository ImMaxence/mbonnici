// Replaces the phone capture of each project on a running site with the one in seed/shots, and
// nothing else: texts, covers, galleries, videos and every other change made in the back office stay.
// Use it after `node seed/capture-shots.mjs --phones` (new, sharper phone captures).
//
//   node seed/refresh-phones.mjs [http://localhost:4000]      (needs DEV_LOGIN, like build-starter)
//
// For each project of the manifest: the capture is uploaded (with its status bar, as in the starter
// archive), takes the place of the project's first phone picture, and the old picture is deleted
// when nothing else uses it.
import { chromium, request as pwRequest } from '../frontend/node_modules/@playwright/test/index.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toPng } from './phone-png.mjs';

const base = process.argv[2] ?? 'http://localhost:4000';
const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, 'shots', 'manifest.json'), 'utf8'));

const browser = await chromium.launch();
const page = await browser.newPage();
const api = await pwRequest.newContext({ baseURL: base });
await api.get('/api/auth/dev-login', { maxRedirects: 0 }).catch(() => undefined);
await api.get('/api/auth/me');
const xsrf = (await api.storageState()).cookies.find((c) => c.name === 'XSRF-TOKEN')?.value;
if (!xsrf) throw new Error('no session: is DEV_LOGIN on?');
const headers = { 'X-XSRF-TOKEN': xsrf };

const projects = await (await api.get('/api/admin/projects')).json();
for (const p of projects) {
  const shot = manifest[p.slug]?.mobile;
  if (!shot) continue;
  const full = await (await api.get(`/api/admin/projects/${p.id}`)).json();
  const title = full.title.fr || full.title.en;
  const buffer = await toPng(browser, page, shot.src, !!shot.bare);
  let res;
  for (let attempt = 0; attempt < 20; attempt++) {
    res = await api.post('/api/admin/media', {
      headers,
      multipart: {
        file: { name: `${p.slug}-mobile.png`, mimeType: 'image/png', buffer },
        altFr: shot.alt?.fr ?? `${title} sur téléphone`,
        altEn: shot.alt?.en ?? `${title} on a phone`,
      },
    });
    if (res.status() !== 429) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (!res.ok()) throw new Error(`upload ${p.slug}: ${res.status()} ${await res.text()}`);
  const media = await res.json();

  const rows = full.media.map((m) => ({ mediaId: m.media.id, kind: m.kind }));
  const first = rows.findIndex((r) => r.kind === 'MOBILE');
  const old = first >= 0 ? rows[first].mediaId : null;
  if (first >= 0) rows[first] = { mediaId: media.id, kind: 'MOBILE' };
  else rows.push({ mediaId: media.id, kind: 'MOBILE' });
  const body = { ...full, coverMediaId: full.coverMediaId ?? null, coverVideoMediaId: full.coverVideoMediaId ?? null, media: rows.map((r, i) => ({ ...r, sortOrder: i })) };
  delete body.id;
  const put = await api.put(`/api/admin/projects/${p.id}`, { headers, data: body });
  if (!put.ok()) throw new Error(`project ${p.slug}: ${put.status()} ${await put.text()}`);

  if (old) {
    const unused = (await (await api.get('/api/admin/media/unused')).json()).ids ?? [];
    if (unused.includes(old)) await api.delete(`/api/admin/media/${old}`, { headers });
  }
  console.log('✓', p.slug, `${media.width}×${media.height}`);
}
await api.dispose();
await browser.close();
