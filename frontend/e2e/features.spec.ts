import AxeBuilder from '@axe-core/playwright';
import { type APIRequestContext, type Page, expect, request, test } from '@playwright/test';

/** v1.4.0 features: list view, tech filter, contact from a project, CV, notes, unsaved changes. */

async function noIntro(page: Page): Promise<void> {
  await page.addInitScript(() => sessionStorage.setItem('mb.intro', '1'));
}

async function axe(page: Page): Promise<void> {
  await page.waitForTimeout(1500);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('app-cursor').analyze();
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(blocking, JSON.stringify(blocking.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
}

/** an API session signed in through the local login (DEV_LOGIN) */
async function admin(baseURL: string): Promise<{ api: APIRequestContext; headers: Record<string, string> }> {
  const api = await request.newContext({ baseURL });
  await api.get('/api/auth/dev-login', { maxRedirects: 0 }).catch(() => undefined);
  await api.get('/api/auth/me');
  const xsrf = (await api.storageState()).cookies.find((c) => c.name === 'XSRF-TOKEN')?.value ?? '';
  return { api, headers: { 'X-XSRF-TOKEN': xsrf } };
}

test.describe('projects', () => {
  test('list view shows every project and is remembered', async ({ page }) => {
    await noIntro(page);
    await page.goto('/fr/projets');
    await page.getByRole('button', { name: 'Liste' }).click();
    await expect(page.locator('.rows .row').first()).toBeVisible();
    expect(await page.locator('.rows .row').count()).toBeGreaterThanOrEqual(10);
    await axe(page);
    await page.reload();
    await expect(page.locator('.rows .row').first()).toBeVisible();
    await page.getByRole('button', { name: 'Grille' }).click();
    await expect(page.locator('app-project-card').first()).toBeVisible();
  });

  test('a skill links to the projects using it', async ({ page }) => {
    await noIntro(page);
    await page.goto('/fr/a-propos');
    const link = page.locator('app-toolbox a.tech', { hasText: 'Angular' }).first();
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page).toHaveURL(/\/fr\/projets\?tech=Angular/);
    await expect(page.locator('.filter.tech')).toContainText('Angular');
    const cards = page.locator('app-project-card');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeLessThan(11);
  });

  test('"a similar project?" opens the contact form about it', async ({ page }) => {
    await noIntro(page);
    await page.goto('/fr/projets/localatscv');
    const cta = page.locator('section.similar a');
    await cta.scrollIntoViewIfNeeded();
    await cta.click();
    await expect(page).toHaveURL(/\/fr\/contact\?project=localatscv/);
    await expect(page.locator('.about-project')).toContainText('LocalATSCV');
    await expect(page.locator('#c-message')).toHaveValue(/LocalATSCV/);
  });
});

test('the CV is a PDF in both languages', async ({ request: api }) => {
  for (const lang of ['fr', 'en']) {
    const res = await api.get(`/api/cv?lang=${lang}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
    expect((await res.body()).subarray(0, 4).toString()).toBe('%PDF');
  }
});

test('notes: published notes get a section, a page and a feed', async ({ page, baseURL }) => {
  const { api, headers } = await admin(baseURL!);
  const created = await api.post('/api/admin/articles', {
    headers,
    data: {
      title: { fr: 'Note de test e2e', en: 'E2E test note' },
      summary: { fr: 'Un résumé', en: 'A summary' },
      body: { fr: '## Titre\n\nUn paragraphe avec `du code`.\n\n```ts\nconst a = 1;\n```', en: '## Heading\n\nA paragraph.' },
      status: 'PUBLISHED',
      tags: ['e2e'],
      coverMediaId: null,
      publishedAt: null,
    },
  });
  expect(created.status()).toBe(201);
  const note = await created.json();
  try {
    await noIntro(page);
    await page.goto('/fr');
    await expect(page.locator('app-header').getByRole('link', { name: /Notes/ }).first()).toBeAttached();
    await page.goto('/fr/notes');
    await expect(page.locator('.notes .note').first()).toContainText('Note de test e2e');
    await axe(page);
    await page.locator('.notes .note', { hasText: 'Note de test e2e' }).click();
    await expect(page).toHaveURL(/\/fr\/notes\/note-de-test-e2e/);
    await expect(page.locator('h1')).toContainText('Note de test e2e');
    await expect(page.locator('pre.code')).toContainText('const a = 1;');
    await axe(page);
    const rss = await page.request.get('/en/rss.xml');
    expect(await rss.text()).toContain('<title>E2E test note</title>');
  } finally {
    await api.delete(`/api/admin/articles/${note.id}`, { headers });
    await api.dispose();
  }
});

test('leaving a form with unsaved changes asks first', async ({ page }) => {
  await page.goto('/api/auth/dev-login');
  await page.goto('/admin/settings');
  const location = page.locator('input[name="location"]');
  // ngModel writes the loaded value a tick after the form appears
  await expect(location).not.toHaveValue('');
  const before = await location.inputValue();
  await location.fill(before + ' (modifié)');
  await expect(page.locator('.unsaved')).toBeVisible();
  await page.locator('.admin-aside a', { hasText: 'Projets' }).click();
  const dialog = page.locator('dialog.confirm');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Rester sur la page' }).click();
  // the page is inert until the dialog has finished closing
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/admin\/settings/);
  await location.fill(before);
  await expect(page.locator('.unsaved')).toBeHidden();
  await page.locator('.admin-aside a', { hasText: 'Projets' }).click();
  await expect(page).toHaveURL(/\/admin\/projects/);
});

test('project pages share a generated 1200 × 630 JPEG', async ({ page, request: api }) => {
  await page.goto('/fr/projets/localatscv');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toContain('/api/og/projects/localatscv.jpg?lang=fr');
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute('content', 'image/jpeg');
  const res = await api.get(new URL(og!).pathname + new URL(og!).search);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/jpeg');
});
