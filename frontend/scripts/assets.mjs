// Renders the Open Graph image and PWA icons from HTML with headless Chromium (Playwright),
// so the brand assets are generated from code rather than checked in as opaque binaries.
//   node scripts/assets.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public');
mkdirSync(out, { recursive: true });

const font = `-apple-system, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif`;

const og = (title, subtitle) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1200px;height:630px;background:#0a0a0c;font-family:${font};color:#f5f5f7;overflow:hidden}
  .bg{position:absolute;inset:0;background:
    radial-gradient(55% 60% at 78% 30%, rgba(91,157,255,.45), transparent 70%),
    radial-gradient(45% 50% at 85% 80%, rgba(180,139,255,.35), transparent 70%),
    radial-gradient(35% 40% at 15% 85%, rgba(255,138,214,.25), transparent 70%)}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:60px 60px;mask-image:radial-gradient(circle at 70% 40%, #000 20%, transparent 75%)}
  .wrap{position:absolute;inset:0;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between}
  .eyebrow{display:flex;align-items:center;gap:14px;font:600 22px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#a8a8b3}
  .eyebrow i{width:12px;height:12px;border-radius:50%;background:#5b9dff;box-shadow:0 0 0 8px rgba(91,157,255,.18)}
  h1{margin:0;font-size:104px;line-height:.98;letter-spacing:-.04em;font-weight:700;max-width:900px}
  h1 span{background:linear-gradient(120deg,#5b9dff,#b48bff 55%,#ff8ad6);-webkit-background-clip:text;background-clip:text;color:transparent}
  p{margin:0;font-size:32px;color:#a8a8b3;max-width:760px;line-height:1.3}
  .foot{display:flex;justify-content:space-between;align-items:flex-end}
  .mark{display:flex;align-items:center;gap:16px;font-size:26px;font-weight:600}
  .mark b{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#5b9dff,#b48bff,#ff8ad6);display:grid;place-items:center;color:#0a0a0c;font-weight:800;font-size:22px}
  .url{font:500 24px/1 ui-monospace,Menlo,monospace;color:#6e6e78}
  .orb{position:absolute;right:-40px;top:70px;width:560px;height:560px;border-radius:50%;
    background:radial-gradient(circle at 40% 35%, rgba(91,157,255,.55), rgba(180,139,255,.25) 45%, transparent 70%);
    filter:blur(2px)}
  .ring{position:absolute;right:110px;top:220px;width:420px;height:150px;border:2px solid rgba(255,255,255,.14);border-radius:50%;transform:rotate(-18deg)}
  .ring.b{right:70px;top:300px;width:500px;height:170px;transform:rotate(14deg);border-color:rgba(91,157,255,.35)}
</style></head><body>
  <div class="bg"></div><div class="grid"></div><div class="orb"></div><div class="ring"></div><div class="ring b"></div>
  <div class="wrap">
    <div class="eyebrow"><i></i>Portfolio</div>
    <div><h1>${title}</h1><p style="margin-top:28px">${subtitle}</p></div>
    <div class="foot"><div class="mark"><b>M</b>Maxence Bonnici</div><div class="url">mbonnici.fr</div></div>
  </div>
</body></html>`;

const icon = (size) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${size}px;height:${size}px;background:#0a0a0c;overflow:hidden}
  .m{width:100%;height:100%;display:grid;place-items:center;background:#0a0a0c}
  svg{width:${size * 0.78}px;height:${size * 0.78}px}
</style></head><body><div class="m">
  <svg viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b9dff"/><stop offset=".55" stop-color="#b48bff"/><stop offset="1" stop-color="#ff8ad6"/></linearGradient></defs>
  <path d="M14 46V18h6l12 17 12-17h6v28h-6V29L32 44 20 29v17z" fill="url(#g)"/></svg>
</div></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(og('Développeur <span>Full Stack</span> Java &amp; Angular', 'Applications web complètes, du schéma de base de données au dernier pixel.'));
  await page.screenshot({ path: join(out, 'og-default.png'), type: 'png' });

  for (const [name, size] of [
    ['apple-touch-icon.png', 180],
    ['icon-512.png', 512],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(icon(size));
    await page.screenshot({ path: join(out, name), type: 'png' });
  }
  console.log('assets written to', out);
} finally {
  await browser.close();
}
