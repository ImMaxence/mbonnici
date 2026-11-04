import { expect, test } from '@playwright/test';

test.describe('projects', () => {
  test('lists published projects with category filters', async ({ page }) => {
    await page.goto('/fr/projets');
    const cards = page.locator('app-project-card');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(10);
    // the draft project is never listed
    await expect(page.getByText('Nails by Anastasie')).toHaveCount(0);

    await page.getByRole('button', { name: /^Outil/ }).click();
    await expect(page.locator('app-project-card')).toHaveCount(2);
    await page.getByRole('button', { name: /^Tous/ }).click();
    await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(10);
  });

  test('opens a project through the curtain transition', async ({ page }) => {
    await page.goto('/fr/projets');
    await page.locator('app-project-card a').first().click();
    await page.waitForURL('**/fr/projets/localatscv');
    await expect(page.locator('h1')).toHaveText('LocalATSCV');
    await expect(page.locator('app-stack-scene, app-scene, app-iphone').first()).toBeVisible();
    await expect(page.locator('app-md p').first()).toContainText('ATS');
    // prev / next navigation
    await expect(page.getByRole('link', { name: /Projet suivant/ })).toBeVisible();
  });

  test('project page is server-rendered with structured data', async ({ request }) => {
    const res = await request.get('/en/projects/meowtrix');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('Meowtrix');
    expect(html).toContain('"@type":"SoftwareSourceCode"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('<link rel="canonical" href="http://localhost:4000/en/projects/meowtrix"');
    expect(html).toContain('href="http://localhost:4000/fr/projets/meowtrix"');
  });

  test('unknown project answers 404', async ({ request }) => {
    const res = await request.get('/fr/projets/does-not-exist');
    expect(res.status()).toBe(404);
    expect(await res.text()).toContain('404');
  });

  test('device scene renders the iPhone simulator', async ({ page }) => {
    await page.goto('/fr/projets/meowtrix');
    await expect(page.locator('app-iphone .phone')).toBeVisible();
    await expect(page.locator('app-iphone .island')).toBeVisible();
  });
});
