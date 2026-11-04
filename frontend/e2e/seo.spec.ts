import { expect, test } from '@playwright/test';

const ORIGIN = process.env['E2E_BASE_URL'] ?? 'http://localhost:4000';

test.describe('seo & ai feeds', () => {
  test('sitemap lists both languages with hreflang alternates', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('xml');
    const xml = await res.text();
    expect(xml).toContain('<urlset');
    expect(xml).toContain('/fr/projets/localatscv</loc>');
    expect(xml).toContain('/en/projects/localatscv</loc>');
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).not.toContain('nailsbyanastasie');
  });

  test('robots.txt welcomes AI crawlers and points to the sitemap', async ({ request }) => {
    const txt = await (await request.get('/robots.txt')).text();
    expect(txt).toContain('User-agent: GPTBot');
    expect(txt).toContain('User-agent: ClaudeBot');
    expect(txt).toContain('Disallow: /admin');
    expect(txt).toMatch(/Sitemap: .*\/sitemap\.xml/);
  });

  test('llms.txt summarises the site in markdown', async ({ request }) => {
    const res = await request.get('/llms.txt');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/markdown');
    const md = await res.text();
    expect(md).toMatch(/^# Maxence Bonnici/);
    expect(md).toContain('## Projects');
    expect(md).toContain('LocalATSCV');
    const full = await (await request.get('/llms-full.txt')).text();
    expect(full.length).toBeGreaterThan(md.length);
  });

  test('every public page has unique title, description and open graph tags', async ({ request }) => {
    const titles = new Set<string>();
    for (const path of ['/fr', '/fr/projets', '/fr/a-propos', '/fr/contact', '/en', '/en/projects']) {
      const html = await (await request.get(path)).text();
      const title = /<title>([^<]+)<\/title>/.exec(html)?.[1] ?? '';
      expect(title.length).toBeGreaterThan(5);
      titles.add(path.startsWith('/fr') ? 'fr:' + title : 'en:' + title);
      expect(html).toMatch(/<meta property="og:title" content="[^"]+"/);
      expect(html).toContain(`<meta property="og:url" content="${ORIGIN}`);
      expect(html).toMatch(/<meta name="twitter:card" content="summary_large_image"/);
    }
    expect(titles.size).toBe(6);
  });

  test('security headers are present on html responses', async ({ request }) => {
    const headers = (await request.get('/fr')).headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).toContain("object-src 'none'");
  });
});
