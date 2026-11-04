import AxeBuilder from '@axe-core/playwright';
import { type Page, expect } from '@playwright/test';

/**
 * WCAG 2.2 A / AA rules plus axe's best practices, at every impact level (minor ones included).
 * Entrance animations finish first: contrast is measured on the final opacity.
 */
export async function expectAccessible(page: Page, settle = 1500): Promise<void> {
  await page.waitForTimeout(settle);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    // the custom cursor is decorative and aria-hidden on purpose
    .exclude('app-cursor')
    .analyze();
  const found = results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }));
  expect(found, JSON.stringify(found, null, 2)).toEqual([]);
}

/** light or dark theme, intro skipped */
export async function prepare(page: Page, theme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.addInitScript((mode) => {
    sessionStorage.setItem('mb.intro', '1');
    localStorage.setItem('mb.mode', mode);
  }, theme);
}
