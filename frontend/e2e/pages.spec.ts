import { expect, test } from '@playwright/test';

test.describe('pages', () => {
  test('about shows experience, education and skills', async ({ page }) => {
    await page.goto('/fr/a-propos');
    await expect(page.locator('h1')).toContainText('Full stack');
    await expect(page.getByText('Sopra Steria').first()).toBeVisible();
    await expect(page.getByText(/EPITECH/).first()).toBeVisible();
    await expect(page.locator('app-toolbox .group').first()).toBeVisible();
    // the contract badge sits on the role line for every experience
    const lines = page.locator('.row-item .title-line');
    const n = await lines.count();
    expect(n).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < n; i++) {
      const role = (await lines.nth(i).locator('h3').boundingBox())!;
      const badge = (await lines.nth(i).locator('.kind').boundingBox())!;
      expect(Math.abs(role.y + role.height / 2 - (badge.y + badge.height / 2))).toBeLessThan(24);
    }
  });

  test('contact form validates then sends', async ({ page }) => {
    await page.goto('/en/contact');
    await page.getByRole('button', { name: /^Send/ }).click();
    await expect(page.locator('.field-error').first()).toBeVisible();

    await page.getByLabel('Your name').fill('Playwright Bot');
    await page.getByLabel('Your e-mail').fill('e2e@example.com');
    await page.getByLabel('Your message').fill('Automated end-to-end test message, please ignore.');
    await page.getByRole('button', { name: /^Send/ }).click();
    await expect(page.getByText('Message sent')).toBeVisible();
  });

  test('legal pages render their sections with the owner name', async ({ page }) => {
    for (const path of ['/fr/mentions-legales', '/fr/confidentialite', '/fr/conditions-utilisation', '/fr/accessibilite']) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.locator('article h2').count()).toBeGreaterThanOrEqual(4);
      // placeholders are filled from the site settings (owner name / contact e-mail)
      await expect(page.locator('article')).toContainText(/Maxence Bonnici|maxence\.bonnici@outlook\.fr/);
    }
    await page.goto('/en/privacy-policy');
    await expect(page.locator('h1')).toHaveText('Privacy policy');
  });

  test('unknown page is a 404 with a way home', async ({ page, request }) => {
    const res = await request.get('/fr/nope');
    expect(res.status()).toBe(404);
    await page.goto('/fr/nope');
    await expect(page.locator('h1')).toBeVisible();
    await page.getByRole('link', { name: /Retour/ }).click();
    await page.waitForURL('**/fr');
  });

  test('skip link reaches the main content', async ({ page }) => {
    await page.goto('/fr');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });
});
