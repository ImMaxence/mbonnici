import { expect, test } from '@playwright/test';

test.describe('phone layout', () => {
  test('home fits the viewport without horizontal scroll', async ({ page }) => {
    await page.goto('/fr');
    await expect(page.locator('h1')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    // the dock is a bottom tab bar on phones
    const dock = page.locator('app-dock .dock');
    const box = await dock.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeGreaterThan(viewport.height - 40);
    expect(box!.width).toBeGreaterThan(viewport.width * 0.8);
    // no custom cursor on touch devices
    await expect(page.locator('app-cursor')).toHaveCount(0);
  });

  test('style sheet opens from the dock and applies', async ({ page }) => {
    await page.goto('/fr');
    await page.getByRole('button', { name: /style visuel/i }).tap();
    await page.getByRole('radio', { name: /Aurora/ }).tap();
    await expect(page.locator('html')).toHaveAttribute('data-style', 'aurora');
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
