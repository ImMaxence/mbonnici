// Captures the project visuals (desktop + phone screenshots) from the images published in each
// GitHub README, or from the live site, into seed/shots/<slug>/… with a manifest.json. They are
// not served by the site: seed/build-starter.mjs uploads them as media into the starter archive.
//   node seed/capture-shots.mjs [slug…]
import { chromium, devices } from '../frontend/node_modules/@playwright/test/index.mjs';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'shots');
const manifestFile = join(outDir, 'manifest.json');
const raw = (repo, path) => `https://raw.githubusercontent.com/ImMaxence/${repo}/main/${path}`;

/** desktop / mobile: README images (first one that loads wins), mobileLive: phone capture of the
 *  live site at the real iPhone ratio (preferred), live: fallback capture for both */
const PROJECTS = {
  localatscv: {
    mobileLive: 'https://localatscv.mbonnici.fr/',
    desktop: [raw('LocalATSCV', 'docs/screenshots/landing-light.png')],
    mobile: [raw('LocalATSCV', 'docs/screenshots/mobile-light.png')],
    gallery: ['editor-light', 'templates-showcase', 'job-match', 'ats-robot-view'].map((n) => raw('LocalATSCV', `docs/screenshots/${n}.png`)),
  },
  localcutvideo: {
    mobileLive: 'https://localcutvideo.mbonnici.fr/',
    desktop: [raw('LocalCutVideo', 'docs/screenshots/landing-light.png'), raw('LocalCutVideo', 'docs/screenshots/landing-dark.png')],
    mobile: [raw('LocalCutVideo', 'docs/screenshots/mobile-editor.png')],
    gallery: ['editor', 'auto-edit', 'editor-cuts', 'thumbnail'].map((n) => raw('LocalCutVideo', `docs/screenshots/${n}.png`)),
  },
  meowtrix: {
    mobileLive: 'https://meowtrix.mbonnici.fr/',
    desktop: [raw('meowtrix', 'docs/screenshots/terre.png')],
    live: 'https://meowtrix.mbonnici.fr/',
    gallery: ['eau', 'ciel', 'menu-animaux', 'noel'].map((n) => raw('meowtrix', `docs/screenshots/${n}.png`)),
  },
  'a2e-environnement': {
    mobileLive: 'https://a2e.mbonnici.fr/',
    desktop: [raw('a2e', 'docs/screenshots/accueil-clair.png'), raw('a2e', 'docs/screenshots/accueil.png')],
    mobile: [raw('a2e', 'docs/screenshots/mobile.png')],
    gallery: ['accueil', 'prestations', 'references', 'contact'].map((n) => raw('a2e', `docs/screenshots/${n}.png`)),
  },
  'les-creations-de-yona': {
    mobileLive: 'https://les-creations-de-yona.fr/',
    desktop: [raw('les-creations-de-yona', 'docs/captures/pc-accueil.png')],
    mobile: [raw('les-creations-de-yona', 'docs/captures/telephone-recette.png')],
    gallery: ['pc-recette', 'pc-recettes', 'pc-administration'].map((n) => raw('les-creations-de-yona', `docs/captures/${n}.png`)),
  },
  'clienthub-crm': { live: 'https://clienthub.mbonnici.fr' },
  'epic-road-trip-planner': {
    desktop: [raw('Epic-Road-Trip-Planner', 'doc/readme/acc1.png')],
    mobile: [raw('Epic-Road-Trip-Planner', 'doc/readme/tel1.png')],
    gallery: [raw('Epic-Road-Trip-Planner', 'doc/readme/acc7.png')],
  },
  'time-manager': {
    auto: [1, 2, 3, 4, 5].map((n) => raw('Time-Manager', `doc/readme/${n}.png`)),
  },
  kryptonews: {
    desktop: [raw('Kryptonews', 'doc/for-read-me/desk/1.png')],
    mobile: [raw('Kryptonews', 'doc/for-read-me/phone/1.png')],
    gallery: [2, 3, 4].map((n) => raw('Kryptonews', `doc/for-read-me/desk/${n}.png`)),
  },
  redditech: {
    poster: true,
    auto: [
      'https://user-images.githubusercontent.com/110362553/225857144-6fb278c9-47dc-4516-a1e3-0dfedc5909af.jpg',
      'https://user-images.githubusercontent.com/110362553/225857142-ee048fc7-621c-4623-98d7-5de538ccd298.jpg',
    ],
  },
  'mern-irc': {
    auto: [
      'https://user-images.githubusercontent.com/110362553/215733617-b21c4556-4369-44a2-ba52-ea928798a982.png',
      'https://user-images.githubusercontent.com/110362553/215733623-a7ca53bf-4a33-49bd-a9c1-29f524b6b3ff.png',
      'https://user-images.githubusercontent.com/110362553/215733553-6d94e6d4-02c8-499a-8803-86fb2876ff0f.png',
    ],
  },
  nailsbyanastasie: { live: 'https://nailsbyanastasie.fr' },
};

const only = process.argv.slice(2);
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};

const browser = await chromium.launch();
const encoder = await (await browser.newContext()).newPage();

/** Downloads an image and re-encodes it as WebP (resized) inside Chromium — no native image lib needed. */
async function toWebp(url, maxWidth) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  return encode(bytes, res.headers.get('content-type') ?? 'image/png', maxWidth);
}

async function encode(bytes, type, maxWidth) {
  const out = await encoder.evaluate(
    async ([b64, mime, max]) => {
      const blob = await (await fetch(`data:${mime};base64,${b64}`)).blob();
      const bmp = await createImageBitmap(blob);
      const scale = Math.min(1, max / bmp.width);
      const w = Math.round(bmp.width * scale);
      const h = Math.round(bmp.height * scale);
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, 0, 0, w, h);
      const webp = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
      const buf = new Uint8Array(await webp.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { b64: btoa(s), w, h, ratio: bmp.width / bmp.height };
    },
    [bytes.toString('base64'), type, maxWidth],
  );
  return { bytes: Buffer.from(out.b64, 'base64'), w: out.w, h: out.h, ratio: out.ratio };
}

async function capture(url, mobile) {
  const ctx = await browser.newContext(
    // iPhone 16 screen: 393 × 852 pt, the exact ratio of the phone mock-up
    mobile
      ? { ...devices['iPhone 15 Pro'], viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  );
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.waitForTimeout(2500);
    const png = await page.screenshot({ type: 'png' });
    return encode(png, 'image/png', mobile ? 640 : 1600);
  } finally {
    await ctx.close();
  }
}

async function firstOf(urls, max) {
  for (const u of urls ?? []) {
    try {
      return await toWebp(u, max);
    } catch (e) {
      console.warn('  skip', u, e.message);
    }
  }
  return null;
}

function save(slug, name, img) {
  mkdirSync(join(outDir, slug), { recursive: true });
  writeFileSync(join(outDir, slug, `${name}.webp`), img.bytes);
  return { src: `${slug}/${name}.webp`, w: img.w, h: img.h };
}

for (const [slug, cfg] of Object.entries(PROJECTS)) {
  if (only.length && !only.includes(slug)) continue;
  console.log(slug);
  const entry = { gallery: [] };
  if (cfg.poster) entry.poster = true;
  let desktop = await firstOf(cfg.desktop, 1600);
  let mobile = null;
  if (cfg.mobileLive) {
    try {
      mobile = { ...(await capture(cfg.mobileLive, true)), bare: true };
    } catch (e) {
      console.warn('  live mobile capture failed', cfg.mobileLive, e.message);
    }
  }
  mobile ??= await firstOf(cfg.mobile, 640);
  const extra = [];
  for (const u of cfg.auto ?? []) {
    try {
      const img = await toWebp(u, 1600);
      if (img.ratio < 0.8) {
        if (!mobile) mobile = await toWebp(u, 640);
      } else if (!desktop) desktop = img;
      else extra.push(img);
    } catch (e) {
      console.warn('  skip', u, e.message);
    }
  }
  if (cfg.live) {
    try {
      if (!desktop) desktop = await capture(cfg.live, false);
      if (!mobile) mobile = await capture(cfg.live, true);
    } catch (e) {
      console.warn('  live capture failed', cfg.live, e.message);
    }
  }
  if (desktop) entry.desktop = save(slug, 'desktop', desktop);
  // README and live phone captures come from a browser viewport, without a status bar: the starter
  // archive bakes one in (see build-starter.mjs)
  if (mobile) entry.mobile = { ...save(slug, 'mobile', mobile), bare: true };
  let n = 1;
  for (const u of cfg.gallery ?? []) {
    try {
      entry.gallery.push(save(slug, `gallery-${n++}`, await toWebp(u, 1600)));
    } catch (e) {
      console.warn('  skip', u, e.message);
    }
  }
  for (const img of extra) entry.gallery.push(save(slug, `gallery-${n++}`, img));
  manifest[slug] = entry;
}

await browser.close();

writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
console.log('manifest written', manifestFile);

