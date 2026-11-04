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
