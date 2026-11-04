import { expect, test } from '@playwright/test';

test.describe('home', () => {
  test('is server-rendered with real content and metadata', async ({ request }) => {
    const res = await request.get('/fr');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('<h1');
    expect(html).toContain('Maxence Bonnici');
    expect(html).toMatch(/<meta name="description" content="[^"]{40,}"/);
    expect(html).toContain('<link rel="canonical" href="http://localhost:4000/fr"');
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('application/ld+json');
    expect(html).toMatch(/<html[^>]*lang="fr"/);
    // CSP nonce is injected per request and never leaks the placeholder
    expect(html).not.toContain('__CSP_NONCE__');
    expect(res.headers()['content-security-policy']).toContain("script-src 'self' 'nonce-");
  });

  test('shows the hero, featured work and the dock', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/fr');
    await expect(page.locator('h1')).toContainText('expériences web');
    await expect(page.locator('app-dock nav')).toBeVisible();
    await expect(page.locator('app-project-card').first()).toBeVisible();
    await expect(page.locator('canvas').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('switches theme and style from the dock and remembers them', async ({ page }) => {
    await page.goto('/fr');
    const html = page.locator('html');
    const before = await html.getAttribute('data-theme');
    await page.getByRole('button', { name: /thème/i }).click();
    await expect(html).toHaveAttribute('data-theme', before === 'dark' ? 'light' : 'dark');

    await page.getByRole('button', { name: /style visuel/i }).click();
    await page.getByRole('radio', { name: /Éditorial/ }).click();
    await expect(html).toHaveAttribute('data-style', 'editorial');
    await page.reload();
    await expect(html).toHaveAttribute('data-style', 'editorial');
    await expect(html).toHaveAttribute('data-theme', before === 'dark' ? 'light' : 'dark');
  });

  test('switches language and keeps the page', async ({ page }) => {
    await page.goto('/fr/projets');
    await page.getByRole('button', { name: /Switch to English/ }).click();
    await page.waitForURL('**/en/projects');
    await expect(page.locator('h1')).toHaveText('Projects');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('root redirects by Accept-Language', async ({ request }) => {
    const en = await request.get('/', { maxRedirects: 0, headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
    expect(en.status()).toBe(302);
    expect(en.headers()['location']).toBe('/en');
    const fr = await request.get('/', { maxRedirects: 0, headers: { 'Accept-Language': 'fr-FR,fr;q=0.9' } });
    expect(fr.headers()['location']).toBe('/fr');
  });
});
