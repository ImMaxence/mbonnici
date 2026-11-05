import { expect, test } from '@playwright/test';

const ORIGIN = process.env['E2E_BASE_URL'] ?? 'http://localhost:4000';

test.describe('projects', () => {
  test('a computer gets the list by default, rendered by the server', async ({ page, request }) => {
    const html = await (await request.get('/fr/projets')).text();
    expect(html).toContain('class="rows');
    await page.goto('/fr/projets');
    await expect(page.getByRole('button', { name: 'Liste' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('app-project-card')).toHaveCount(0);
  });

  test('lists published projects with category filters', async ({ page }) => {
    await page.goto('/fr/projets');
    // one row per project in the list view
    const cards = page.locator('.rows .row');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(10);
    // the draft project is never listed
    await expect(page.getByText('Nails by Anastasie')).toHaveCount(0);

    await page.getByRole('button', { name: /^Outil/ }).click();
    await expect(page.locator('.rows .row')).toHaveCount(2);
    await page.getByRole('button', { name: /^Tous/ }).click();
    await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(10);
  });

  test('filters can be switched quickly without moving the mouse away', async ({ page }) => {
    await page.goto('/fr/projets');
    const tool = page.getByRole('button', { name: /^Outil/ });
    const all = page.getByRole('button', { name: /^Tous/ });
    await tool.click();
    await all.click({ delay: 0 });
    await tool.click({ delay: 0 });
    await expect(page.locator('.rows .row')).toHaveCount(2);
    await expect(tool).toHaveAttribute('aria-pressed', 'true');
  });

  test('opens a project through the curtain transition', async ({ page }) => {
    await page.goto('/fr/projets');
    await page.locator('.rows .row').first().click();
    await page.waitForURL('**/fr/projets/localatscv');
    await expect(page.locator('h1')).toHaveText('LocalATSCV');
    await expect(page.locator('app-showcase img').first()).toBeVisible();
    await expect(page.locator('app-slider .slide').first()).toBeVisible();
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
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/en/projects/meowtrix"`);
    expect(html).toContain(`href="${ORIGIN}/fr/projets/meowtrix"`);
  });

  test('unknown project answers 404', async ({ request }) => {
    const res = await request.get('/fr/projets/does-not-exist');
    expect(res.status()).toBe(404);
    expect(await res.text()).toContain('404');
  });

  test('gallery slider moves with the arrows', async ({ page }) => {
    await page.goto('/fr/projets/localatscv');
    const slider = page.locator('app-slider');
    await slider.scrollIntoViewIfNeeded();
    await expect(slider.locator('.count')).toContainText('01');
    await slider.getByRole('button', { name: 'Suivant' }).click();
    await expect(slider.locator('.count')).toContainText('02');
  });

  test('the gallery starts at the first picture on the next project', async ({ page }) => {
    await page.goto('/fr/projets/localatscv');
    const slider = page.locator('app-slider');
    await slider.scrollIntoViewIfNeeded();
    await slider.getByRole('button', { name: 'Suivant' }).click();
    await slider.getByRole('button', { name: 'Suivant' }).click();
    await expect(slider.locator('.count')).toContainText('03');
    // client-side navigation reuses the page component
    await page.locator('a[href="/fr/projets/localcutvideo"]').last().click();
    await expect(page).toHaveURL(/localcutvideo/);
    await page.locator('app-slider').scrollIntoViewIfNeeded();
    await expect(page.locator('app-slider .count')).toContainText('01 /');
    expect(await page.locator('app-slider .track').evaluate((e) => e.scrollLeft)).toBe(0);
  });

  test('gallery images open in a viewer with navigation', async ({ page }) => {
    await page.goto('/fr/projets/localatscv');
    const slider = page.locator('app-slider');
    await slider.scrollIntoViewIfNeeded();
    await slider.locator('.slide .open').first().click();
    const viewer = page.locator('dialog.viewer');
    await expect(viewer).toBeVisible();
    await expect(viewer.locator('.lb-count')).toContainText('01');
    await viewer.getByRole('button', { name: 'Suivant' }).click();
    await expect(viewer.locator('.lb-count')).toContainText('02');
    await page.keyboard.press('ArrowLeft');
    await expect(viewer.locator('.lb-count')).toContainText('01');
    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
  });

  test('a picture in the viewer zooms with a double click and the wheel', async ({ page }) => {
    await page.goto('/fr/projets/localatscv');
    await page.locator('app-slider').scrollIntoViewIfNeeded();
    await page.locator('app-slider .slide .open').first().click();
    const viewer = page.locator('dialog.viewer');
    const pic = viewer.locator('.pic');
    await page.waitForTimeout(700);
    const scale = () => pic.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    await pic.dblclick();
    await expect.poll(scale).toBeGreaterThan(2);
    // arrows pan instead of changing picture while zoomed
    await page.keyboard.press('ArrowRight');
    await expect(viewer.locator('.lb-count')).toContainText('01');
    await page.keyboard.press('0');
    await expect.poll(scale).toBe(1);
    const box = (await pic.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -400);
    await expect.poll(scale).toBeGreaterThan(1.5);
    await viewer.getByRole('button', { name: 'Dézoomer' }).click();
    await expect.poll(scale).toBe(1);
  });

  test('mobile version is shown in the phone mock-up', async ({ page }) => {
    await page.goto('/fr/projets/meowtrix');
    // the phone capture sits in the top visual, in front of the browser
    const phone = page.locator('.hero-shot app-phone').first();
    await phone.scrollIntoViewIfNeeded();
    await expect(phone.locator('img.shot')).toBeVisible();
    await expect(phone.locator('.bezel')).toBeAttached();
  });
});
