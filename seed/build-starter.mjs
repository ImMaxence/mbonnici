// Builds seed/mbonnici-starter.zip: a regular back-office backup archive holding the original
// portfolio content (texts, experience, skills, projects) with the README / live-site captures
// uploaded as real media and attached to each project (cover, phone capture, gallery).
//
// A fresh deployment starts empty; import this archive from Back office → Sauvegardes →
// "Restaurer depuis un fichier" and tick what you want to keep.
//
//   1. start a stack that still has the content (e.g. the e2e fixtures), DEV_LOGIN on
//   2. node seed/build-starter.mjs [http://localhost:4000]
import { chromium, request as pwRequest } from '../frontend/node_modules/@playwright/test/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] ?? 'http://localhost:4000';
const here = dirname(fileURLToPath(import.meta.url));
const shotsDir = join(here, 'shots');
const manifest = JSON.parse(readFileSync(join(shotsDir, 'manifest.json'), 'utf8'));

const browser = await chromium.launch();
const page = await browser.newPage();

/** WebP capture → PNG (uploads accept PNG / JPEG only); phone captures get an iOS status bar. */
async function toPng(file, statusBar) {
  const b64 = readFileSync(join(shotsDir, file)).toString('base64');
  if (!statusBar) {
    return Buffer.from(
      await page.evaluate(async (b64) => {
        const bmp = await createImageBitmap(await (await fetch('data:image/webp;base64,' + b64)).blob());
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        c.getContext('2d').drawImage(bmp, 0, 0);
        const buf = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
        let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return btoa(s);
      }, b64),
      'base64',
    );
  }
  // iPhone screen: 402 × 874 pt at 3x = 1206 × 2622 px, status bar 54 pt around the Dynamic Island
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3 });
  const p = await ctx.newPage();
  await p.setContent(`<!doctype html><html><body style="margin:0;background:#000;width:402px;height:874px;overflow:hidden;font-family:-apple-system,'SF Pro Text','Inter',system-ui,sans-serif">
    <div style="height:54px;display:flex;align-items:center;justify-content:space-between;padding:4px 30px 0 44px;color:#fff;box-sizing:border-box">
      <b style="font-size:17px;font-weight:600;letter-spacing:-.2px">9:41</b>
      <span style="display:flex;align-items:center;gap:6px">
        <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#fff"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#fff"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#fff"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#fff"/></svg>
        <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 12 0 3.8a11.5 11.5 0 0 1 16 0z" fill="#fff"/></svg>
        <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="#fff" stroke-opacity=".45"/><rect x="2" y="2" width="19" height="9" rx="2" fill="#fff"/><rect x="24.6" y="4.3" width="1.6" height="4.4" rx=".8" fill="#fff" fill-opacity=".45"/></svg>
      </span>
    </div>
    <img src="data:image/webp;base64,${b64}" style="display:block;width:402px">
  </body></html>`);
  await p.waitForTimeout(150);
  const png = await p.screenshot({ type: 'png' });
  await ctx.close();
  return png;
}

const api = await pwRequest.newContext({ baseURL: base });
await api.get('/api/auth/dev-login', { maxRedirects: 0 }).catch(() => undefined);
await api.get('/api/auth/me');
const xsrf = (await api.storageState()).cookies.find((c) => c.name === 'XSRF-TOKEN')?.value;
if (!xsrf) throw new Error('no session: is DEV_LOGIN on?');
const headers = { 'X-XSRF-TOKEN': xsrf };

async function upload(file, name, altFr, altEn, statusBar = false) {
  const buffer = await toPng(file, statusBar);
  let res;
  // uploads are rate limited (30 / min): wait and retry
  for (let attempt = 0; attempt < 20; attempt++) {
    res = await api.post('/api/admin/media', { headers, multipart: { file: { name, mimeType: 'image/png', buffer }, altFr, altEn } });
    if (res.status() !== 429) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (!res.ok()) throw new Error(`upload ${file}: ${res.status()} ${await res.text()}`);
  return (await res.json()).id;
}

const projects = await (await api.get('/api/admin/projects')).json();
for (const p of projects) {
  const shots = manifest[p.slug];
  if (!shots) continue;
  const title = p.title.fr || p.title.en;
  const media = [];
  let cover = null;
  if (shots.desktop) {
    cover = await upload(shots.desktop.src, `${p.slug}-desktop.png`, shots.desktop.alt?.fr ?? `Page d’accueil de ${title}`, shots.desktop.alt?.en ?? `Home page of ${title}`);
  }
  if (shots.mobile) {
    const id = await upload(shots.mobile.src, `${p.slug}-mobile.png`, shots.mobile.alt?.fr ?? `${title} sur téléphone`, shots.mobile.alt?.en ?? `${title} on a phone`, !!shots.mobile.bare);
    media.push({ mediaId: id, kind: 'MOBILE', sortOrder: media.length });
  }
  for (const [i, g] of shots.gallery.entries()) {
    const id = await upload(g.src, `${p.slug}-gallery-${i + 1}.png`, g.alt?.fr ?? `${title}, capture ${i + 1}`, g.alt?.en ?? `${title}, screenshot ${i + 1}`);
    media.push({ mediaId: id, kind: 'GALLERY', sortOrder: media.length });
  }
  const full = await (await api.get(`/api/admin/projects/${p.id}`)).json();
  const body = {
    slug: full.slug,
    title: full.title,
    tagline: full.tagline,
    description: full.description,
    status: full.status,
    featured: full.featured,
    sortOrder: full.sortOrder,
    year: full.year,
    category: full.category,
    sceneType: full.sceneType,
    // a composed README banner reads better in the browser frame alone
    displayMode: shots.poster ? 'DESKTOP' : full.displayMode ?? 'BOTH',
    accentColor: full.accentColor,
    repoUrl: full.repoUrl,
    liveUrl: full.liveUrl,
    allowIframe: full.allowIframe,
    stack: full.stack,
    tags: full.tags,
    coverMediaId: cover,
    media,
  };
  const res = await api.put(`/api/admin/projects/${p.id}`, { headers, data: body });
  if (!res.ok()) throw new Error(`project ${p.slug}: ${res.status()} ${await res.text()}`);
  console.log('✓', p.slug, `${media.length + (cover ? 1 : 0)} images`);
}

const zip = await api.get('/api/admin/backups/export');
writeFileSync(join(here, 'mbonnici-starter.zip'), await zip.body());
console.log('archive written', join(here, 'mbonnici-starter.zip'));
await api.dispose();
await browser.close();
