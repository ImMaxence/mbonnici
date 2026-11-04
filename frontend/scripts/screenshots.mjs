// Captures the README screenshots from a running site (default http://localhost:4000).
//   node scripts/screenshots.mjs [baseUrl]
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] ?? 'http://localhost:4000';
const out = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'images');
mkdirSync(out, { recursive: true });

const shots = [
  { name: 'home-dark', path: '/fr', mode: 'dark' },
  { name: 'home-light', path: '/fr', mode: 'light' },
  { name: 'projects', path: '/fr/projets', mode: 'light', scroll: 520 },
  { name: 'project', path: '/fr/projets/localatscv', mode: 'light', scroll: 560 },
  { name: 'about', path: '/fr/a-propos', mode: 'dark', scroll: 1500 },
  { name: 'contact', path: '/en/contact', mode: 'light' },
  { name: 'admin-login', path: '/admin/login', mode: 'light' },
];

const browser = await chromium.launch();
try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'fr-FR' });
  for (const s of shots) {
    const page = await desktop.newPage();
    await page.addInitScript((mode) => {
      sessionStorage.setItem('mb.intro', '1'); // the intro plays once per visit, not in screenshots
      localStorage.setItem('mb.mode', mode);
    }, s.mode);
    await page.goto(base + s.path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1400); // let the reveals settle
    if (s.scroll) {
      await page.mouse.wheel(0, s.scroll);
      await page.waitForTimeout(1300);
    }
    await page.screenshot({ path: join(out, `${s.name}.png`), fullPage: false });
    await page.close();
    console.log('✓', s.name);
  }

  const mobile = await browser.newContext({ ...devices['Pixel 7'], locale: 'fr-FR' });
  for (const [name, path, menu] of [
    ['mobile-home', '/fr', false],
    ['mobile-menu', '/fr', true],
    ['mobile-project', '/fr/projets/localcutvideo', false],
  ]) {
    const page = await mobile.newPage();
    await page.addInitScript(() => sessionStorage.setItem('mb.intro', '1'));
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    if (menu) {
      await page.getByRole('button', { name: 'Menu' }).click();
      await page.waitForTimeout(1100);
    }
    await page.screenshot({ path: join(out, `${name}.png`), fullPage: false });
    await page.close();
    console.log('✓', name);
  }
  console.log('screenshots written to', out);
} finally {
  await browser.close();
}
