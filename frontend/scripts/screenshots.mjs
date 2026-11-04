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
  { name: 'home-obsidian-dark', path: '/fr', style: 'obsidian', mode: 'dark' },
  { name: 'home-editorial-light', path: '/fr', style: 'editorial', mode: 'light' },
  { name: 'home-aurora-dark', path: '/en', style: 'aurora', mode: 'dark' },
  { name: 'projects', path: '/fr/projets', style: 'obsidian', mode: 'dark' },
  { name: 'project-stack', path: '/fr/projets/localatscv', style: 'obsidian', mode: 'dark' },
  { name: 'project-iphone', path: '/en/projects/meowtrix', style: 'obsidian', mode: 'dark', scroll: 420 },
  { name: 'about', path: '/fr/a-propos', style: 'editorial', mode: 'dark' },
  { name: 'contact', path: '/en/contact', style: 'aurora', mode: 'light' },
  { name: 'dock-settings', path: '/fr', style: 'obsidian', mode: 'dark', openDock: true },
  { name: 'admin-login', path: '/admin/login', style: 'obsidian', mode: 'dark' },
];

const browser = await chromium.launch();
try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'fr-FR' });
  for (const s of shots) {
    const page = await desktop.newPage();
    await page.addInitScript(
      ([style, mode]) => {
        localStorage.setItem('mb.style', style);
        localStorage.setItem('mb.mode', mode);
      },
      [s.style, s.mode],
    );
    await page.goto(base + s.path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1400); // let reveals and scenes settle
    if (s.scroll) await page.mouse.wheel(0, s.scroll);
    if (s.openDock) {
      await page.getByRole('button', { name: /style visuel/i }).click();
      await page.waitForTimeout(500);
    }
    await page.mouse.move(900, 420);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(out, `${s.name}.png`), fullPage: false });
    await page.close();
    console.log('✓', s.name);
  }

  const mobile = await browser.newContext({ ...devices['Pixel 7'], locale: 'fr-FR' });
  for (const [name, path] of [
    ['mobile-home', '/fr'],
    ['mobile-project', '/fr/projets/localcutvideo'],
  ]) {
    const page = await mobile.newPage();
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(out, `${name}.png`), fullPage: false });
    await page.close();
    console.log('✓', name);
  }
  console.log('screenshots written to', out);
} finally {
  await browser.close();
}
