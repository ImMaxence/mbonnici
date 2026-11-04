import { expect, test } from '@playwright/test';

const ORIGIN = process.env['E2E_BASE_URL'] ?? 'http://localhost:4000';

test.describe('home', () => {
  test('is server-rendered with real content and metadata', async ({ request }) => {
    const res = await request.get('/fr');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('<h1');
    expect(html).toContain('Maxence Bonnici');
    expect(html).toMatch(/<meta name="description" content="[^"]{40,}"/);
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/fr"`);
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('application/ld+json');
    expect(html).toMatch(/<html[^>]*lang="fr"/);
    // CSP nonce is injected per request and never leaks the placeholder
    expect(html).not.toContain('__CSP_NONCE__');
    expect(res.headers()['content-security-policy']).toContain("script-src 'self' 'nonce-");
  });

  test('plays the intro once, then shows the hero, the real captures and the text navigation', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/fr');
    // first visit of the session: the intro sheet covers the page, then lifts
    await expect(page.locator('html')).toHaveClass(/intro-play/);
    await expect(page.locator('html')).not.toHaveClass(/intro-play/, { timeout: 6000 });
    await expect(page.locator('h1')).toContainText('expériences web');
    await expect(page.locator('app-header .links').getByRole('link', { name: /Projets/ })).toBeVisible();
    await expect(page.locator('app-project-card app-showcase img').first()).toBeVisible();
    // no curtain on the first page load
    await expect(page.locator('.curtain')).toHaveAttribute('data-state', 'idle');
    // same session: no intro on reload
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/intro-play/);
    expect(errors).toEqual([]);
  });

  test('there is a single visual style and the theme switch is remembered', async ({ page }) => {
    await page.goto('/fr');
    const html = page.locator('html');
    expect(await html.getAttribute('data-style')).toBeNull();
    const before = await html.getAttribute('data-theme');
    await page.locator('app-header').getByRole('button', { name: /thème/i }).click();
    await expect(html).toHaveAttribute('data-theme', before === 'dark' ? 'light' : 'dark');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', before === 'dark' ? 'light' : 'dark');
  });

  test('switches language and keeps the page', async ({ page }) => {
    await page.goto('/fr/projets');
    await page.getByRole('button', { name: /Switch to English/ }).click();
    await page.waitForURL('**/en/projects');
    await expect(page.locator('h1')).toContainText('Projects');
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
