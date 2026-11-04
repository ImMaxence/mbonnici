import { expect, test } from '@playwright/test';

test.describe('phone layout', () => {
  test('home fits the viewport without horizontal scroll', async ({ page }) => {
    await page.goto('/fr');
    await expect(page.locator('h1')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
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
    await menu.getByRole('link', { name: /À propos/ }).tap();
    await page.waitForURL('**/fr/a-propos');
    await expect(menu).toBeHidden();
  });

  test('project cards stack in one column and the detail page works', async ({ page }) => {
    await page.goto('/fr/projets');
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
});
