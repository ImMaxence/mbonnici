import { expect, test } from '@playwright/test';

test.describe('back office access', () => {
  test('admin area redirects anonymous visitors to the login screen', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL('**/admin/login');
    await expect(page.getByRole('link', { name: /Google/ })).toHaveAttribute('href', '/api/auth/oauth2/authorization/google');
  });

  test('admin API is closed without a session', async ({ request }) => {
    for (const path of [
      '/api/admin/projects',
      '/api/admin/info',
      '/api/admin/analytics/overview',
      '/api/admin/media',
      '/api/admin/backups',
      '/api/admin/backups/export',
      '/api/admin/system',
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(401);
    }
    const write = await request.post('/api/admin/projects', { data: {} });
    expect([401, 403]).toContain(write.status());
  });

  test('google sign-in starts an oauth redirect', async ({ request }) => {
    const res = await request.get('/api/auth/oauth2/authorization/google', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toContain('accounts.google.com');
  });

  test('the changelog is shipped with the site for the back office', async ({ request }) => {
    const res = await request.get('/changelog.md');
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('# Changelog');
  });

  test('a rejected account lands back on the login page with an error', async ({ page }) => {
    await page.goto('/admin/login?error=not_allowed');
    await expect(page.getByRole('alert')).toContainText(/autoris|allowed/i);
  });
});
