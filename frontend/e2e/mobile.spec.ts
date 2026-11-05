import { expect, test } from '@playwright/test';
import { expectAccessible, prepare } from './axe';

test.describe('phone layout', () => {
  test('home fits the viewport without horizontal scroll', async ({ page }) => {
    await page.goto('/fr');
    await expect(page.locator('h1')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    // the Menu button is vertically centred with the name
    const brand = await page.locator('app-header .brand').boundingBox();
    const btn = await page.getByRole('button', { name: 'Menu' }).boundingBox();
    expect(Math.abs(brand!.y + brand!.height / 2 - (btn!.y + btn!.height / 2))).toBeLessThan(2);
    // no custom cursor on touch devices
    await expect(page.locator('app-cursor')).toHaveCount(0);
  });

  test('the menu lists the pages as text and navigates', async ({ page }) => {
    await page.goto('/fr');
    await page.getByRole('button', { name: 'Menu' }).tap();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    for (const label of ['Accueil', 'Projets', 'À propos', 'Contact']) {
      await expect(menu.getByRole('link', { name: new RegExp(label) })).toBeVisible();
    }
    // closing really closes (it used to replay the opening animation)
    await menu.getByRole('button', { name: /Fermer/ }).tap();
    await expect(menu).toBeHidden();
    await page.waitForTimeout(900);
    await expect(menu).toBeHidden();
    await page.getByRole('button', { name: 'Menu' }).tap();
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: /À propos/ }).tap();
    // the menu covers the screen until the new page is there (the old page never shows again)
    await page.waitForURL('**/fr/a-propos');
    await expect(menu).toBeVisible();
    await expect(page.locator('h1')).toBeAttached();
    await expect(menu).toBeHidden();
  });

  test('the menu passes axe and links to the back office when signed in', async ({ page }) => {
    await prepare(page);
    await page.goto('/fr');
    await page.getByRole('button', { name: 'Menu' }).tap();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu.getByRole('link', { name: 'Administration' })).toHaveCount(0);
    await expectAccessible(page, 1000);
    await page.goto('/api/auth/dev-login');
    await page.goto('/fr');
    await page.getByRole('button', { name: 'Menu' }).tap();
    await expect(menu.getByRole('link', { name: 'Administration' })).toBeVisible();
  });

  test('project cards stack in one column and the detail page works', async ({ page }) => {
    await page.goto('/fr/projets');
    // a phone gets the cards, from the server already
    await expect(page.getByRole('button', { name: 'Grille' })).toHaveAttribute('aria-pressed', 'true');
    const first = page.locator('app-project-card').first();
    const second = page.locator('app-project-card').nth(1);
    const a = await first.boundingBox();
    const b = await second.boundingBox();
    expect(a!.y).toBeLessThan(b!.y);
    expect(Math.abs(a!.x - b!.x)).toBeLessThan(2);
    await first.locator('a').tap();
    await page.waitForURL('**/fr/projets/**');
    await expect(page.locator('h1')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
  test('a gallery picture can be zoomed with two fingers, a double tap, and panned', async ({ page }) => {
    await page.goto('/fr/projets/localatscv');
    const slider = page.locator('app-slider');
    await slider.scrollIntoViewIfNeeded();
    await slider.locator('.slide .open').first().tap();
    const viewer = page.locator('dialog.viewer');
    await expect(viewer).toBeVisible();
    const pic = viewer.locator('.pic');
    await page.waitForTimeout(700); // entrance animation
    const box = (await pic.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, points: { x: number; y: number }[]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, id) => ({ x: p.x, y: p.y, id })) });
    const scale = () => pic.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);

    // pinch: two fingers move apart
    await touch('touchStart', [{ x: cx - 20, y: cy }, { x: cx + 20, y: cy }]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [{ x: cx - 20 - i * 12, y: cy }, { x: cx + 20 + i * 12, y: cy }]);
    await touch('touchEnd', []);
    expect(await scale()).toBeGreaterThan(2.5);
    await expect(viewer.getByRole('button', { name: 'Dézoomer' })).toBeVisible();

    // one finger pans the zoomed picture and does not change picture
    const before = (await pic.boundingBox())!.x;
    await touch('touchStart', [{ x: cx, y: cy }]);
    for (let i = 1; i <= 5; i++) await touch('touchMove', [{ x: cx + i * 15, y: cy }]);
    await touch('touchEnd', []);
    expect((await pic.boundingBox())!.x).toBeGreaterThan(before + 30);
    await expect(viewer.locator('.lb-count')).toContainText('01');

    // double tap: back to fitted, then in again
    await page.waitForTimeout(400);
    await page.touchscreen.tap(cx, cy);
    await page.touchscreen.tap(cx, cy);
    await expect.poll(scale).toBe(1);
    await page.waitForTimeout(400);
    await page.touchscreen.tap(cx, cy);
    await page.touchscreen.tap(cx, cy);
    await expect.poll(scale).toBeGreaterThan(2);
    await viewer.getByRole('button', { name: 'Fermer' }).tap();
    await expect(viewer).toBeHidden();
  });
});
