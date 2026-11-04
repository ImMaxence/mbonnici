import { expect, test } from '@playwright/test';
import { expectAccessible, prepare } from './axe';

/**
 * Automated accessibility checks of every page, public and back office, in both themes. The phone
 * menu is checked in mobile.spec.ts, the contact page with a resume in features.spec.ts.
 * Automated rules cover part of RGAA only: they complement a manual review, they do not replace it.
 */
const publicPages = [
  '/fr',
  '/en',
  '/fr/projets',
  '/fr/projets/localatscv',
  '/en/projects/meowtrix',
  '/fr/a-propos',
  '/en/about',
  '/fr/contact',
  '/fr/mentions-legales',
  '/fr/confidentialite',
  '/fr/conditions-utilisation',
  '/fr/accessibilite',
  '/fr/page-inexistante',
];
const adminPages = [
  '/admin',
  '/admin/projects',
  '/admin/projects/new',
  '/admin/media',
  '/admin/messages',
  '/admin/settings',
  '/admin/backups',
  '/admin/errors',
  '/admin/changelog',
];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => prepare(page, theme));

    for (const path of publicPages) {
      test(`${path} passes axe`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await expectAccessible(page);
      });
    }

    test('projects list view passes axe', async ({ page }) => {
      await page.goto('/fr/projets');
      await page.getByRole('button', { name: 'Liste' }).click();
      await expect(page.locator('.rows .row').first()).toBeVisible();
      await expectAccessible(page);
      await page.getByRole('button', { name: 'Grille' }).click();
    });

    test('contact form showing its errors passes axe', async ({ page }) => {
      await page.goto('/fr/contact');
      await page.waitForLoadState('networkidle');
      await page.locator('form button[type=submit]').click();
      await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
      await expectAccessible(page, 600);
    });

    test('image viewer passes axe', async ({ page }) => {
      await page.goto('/fr/projets/localatscv');
      await page.waitForLoadState('networkidle');
      const open = page.locator('app-slider button.open').first();
      await open.scrollIntoViewIfNeeded();
      await open.click({ force: true });
      await expect(page.locator('dialog.viewer')).toBeVisible();
      await expectAccessible(page, 900);
    });

    for (const path of adminPages) {
      test(`admin ${path} passes axe`, async ({ page }) => {
        await page.goto('/api/auth/dev-login');
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await expectAccessible(page);
      });
    }

    test('admin project editor passes axe', async ({ page }) => {
      await page.goto('/api/auth/dev-login');
      const projects = (await (await page.request.get('/api/admin/projects')).json()) as { id: string }[];
      await page.goto(`/admin/projects/${projects[0].id}`);
      await page.waitForLoadState('networkidle');
      await expectAccessible(page);
    });

    test('admin profile and its editors pass axe', async ({ page }) => {
      await page.goto('/api/auth/dev-login');
      await page.goto('/admin/profile');
      await page.waitForLoadState('networkidle');
      await expectAccessible(page);
      // experience, education, skill
      for (let i = 0; i < 3; i++) {
        await page.getByRole('button', { name: 'Ajouter' }).nth(i).click();
        await expect(page.getByRole('button', { name: 'Annuler' })).toBeVisible();
        await expectAccessible(page, 500);
        await page.getByRole('button', { name: 'Annuler' }).click();
      }
    });
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
