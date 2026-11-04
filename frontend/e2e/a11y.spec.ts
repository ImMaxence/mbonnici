import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = ['/fr', '/fr/projets', '/fr/projets/localatscv', '/fr/a-propos', '/fr/contact', '/fr/confidentialite', '/fr/accessibilite', '/en'];

for (const theme of ['light', 'dark'] as const)
for (const path of pages) {
  test(`accessibility (${theme}): ${path} has no serious or critical violations`, async ({ page }) => {
    await page.addInitScript((mode) => {
      sessionStorage.setItem('mb.intro', '1');
      localStorage.setItem('mb.mode', mode);
    }, theme);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    // let the entrance animations finish: axe measures contrast on the final opacity
    await page.waitForTimeout(1800);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // decorative canvases and the custom cursor are aria-hidden on purpose
      .exclude('app-cursor')
      .analyze();
    const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(blocking, JSON.stringify(blocking.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
  });
}

test('every image has alternative text and the document has one h1', async ({ page }) => {
  await page.goto('/fr/a-propos');
  const missingAlt = await page.locator('img:not([alt])').count();
  expect(missingAlt).toBe(0);
  expect(await page.locator('h1').count()).toBe(1);
});

test('header links are reachable by keyboard', async ({ page }) => {
  await page.goto('/fr');
  const links = page.locator('app-header .links a');
  await links.first().focus();
  await expect(links.first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(links.nth(1)).toBeFocused();
});
