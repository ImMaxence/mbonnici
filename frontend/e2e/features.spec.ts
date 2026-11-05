import { type APIRequestContext, type Page, expect, request, test } from '@playwright/test';
import { expectAccessible } from './axe';

/** List view, tech filter, contact from a project, the uploaded resume, unsaved changes, share pictures, CSP reports. */

async function noIntro(page: Page): Promise<void> {
  await page.addInitScript(() => sessionStorage.setItem('mb.intro', '1'));
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
    await expectAccessible(page);
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
    const cards = page.locator('.rows .row');
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

test('an uploaded resume gets a download button on the contact page', async ({ page, baseURL }) => {
  const { api, headers } = await admin(baseURL!);
  const pdf = '%PDF-1.7\n% e2e resume\n%%EOF\n';
  try {
    await noIntro(page);
    await page.goto('/fr/contact');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('link', { name: /Télécharger mon CV/ })).toHaveCount(0);

    // uploaded from the back office (Profil → CV)
    await page.goto('/api/auth/dev-login');
    await page.goto('/admin/profile');
    const french = page.locator('app-cv-panel .cv-row').first();
    await french.locator('input[type=file]').setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) });
    await expect(french).toContainText('PDF ·');
    await expect(page.locator('app-cv-panel .cv-row').nth(1)).toContainText('l’autre langue');

    await page.goto('/fr/contact');
    const link = page.getByRole('link', { name: /Télécharger mon CV/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/api/cv?lang=fr&download=true');
    const res = await page.request.get('/api/cv?lang=fr&download=true');
    expect(res.headers()['content-type']).toContain('application/pdf');
    expect(await res.text()).toBe(pdf);
    // English visitors get the French file, and are told so
    await page.goto('/en/contact');
    await expect(page.getByRole('link', { name: /Download my resume/ })).toContainText('in French');
    await expectAccessible(page);
  } finally {
    await api.delete('/api/admin/cv/fr', { headers });
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

test('a picture is described in a dialog, nothing saved before "Save"', async ({ page }) => {
  await page.goto('/api/auth/dev-login');
  await page.goto('/admin/media');
  await page.locator('.media-item').first().click();
  const dialog = page.locator('dialog.media-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#alt-fr')).toBeFocused();
  await expectAccessible(page, 600);
  const before = await dialog.locator('#alt-fr').inputValue();
  await dialog.locator('#alt-fr').fill(before + ' (brouillon)');
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(dialog).toBeHidden();
  await page.locator('.media-item').first().click();
  await expect(dialog.locator('#alt-fr')).toHaveValue(before);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('the stack is picked from the profile skills', async ({ page }) => {
  await page.goto('/api/auth/dev-login');
  await page.goto('/admin/projects/new');
  const field = page.locator('#f-stack');
  await field.fill('typesc');
  const option = page.getByRole('option', { name: 'TypeScript' });
  await expect(option).toBeVisible();
  await expectAccessible(page, 300);
  await field.press('Enter');
  await expect(page.locator('app-skill-select .pick')).toHaveText(['TypeScript']);
  // something that is not a skill is added as typed, dashed
  await field.fill('Three.js');
  await field.press('Enter');
  await expect(page.locator('app-skill-select .pick.custom')).toHaveText(['Three.js']);
  await field.press('Backspace');
  await expect(page.locator('app-skill-select .pick')).toHaveCount(1);
});

test('the dashboard follows the server live', async ({ page }) => {
  await page.goto('/api/auth/dev-login');
  await page.goto('/admin');
  const live = page.locator('app-live-metrics');
  await expect(live.locator('.tile')).toHaveCount(4);
  const first = await page.request.get('/api/admin/system/live').then((r) => r.json());
  await expect.poll(async () => (await page.request.get('/api/admin/system/live').then((r) => r.json())).length, { timeout: 8000 }).toBeGreaterThan(first.length - 1);
  await live.getByRole('button', { name: 'Mettre en pause' }).click();
  await expect(live.locator('.live')).toHaveText(/En pause/);
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

test('a resource blocked by the CSP shows in the journal', async ({ page, baseURL }) => {
  test.skip(baseURL!.startsWith('https://'), 'over HTTPS browsers batch their reports (about a minute)');
  const probe = 'https://cdn.example.com/e2e-probe.js';
  await noIntro(page);
  await page.goto('/fr/contact');
  await page.evaluate((src) => {
    const s = document.createElement('script');
    s.src = src;
    document.head.appendChild(s);
  }, probe);
  const { api, headers } = await admin(baseURL!);
  const find = async (): Promise<{ id: number; source: string; path: string } | undefined> =>
    ((await (await api.get('/api/admin/errors')).json()) as { id: number; source: string; message: string; path: string }[]).find((e) =>
      e.message.endsWith(probe),
    );
  try {
    await expect.poll(async () => (await find())?.source, { timeout: 15_000 }).toBe('CSP');
    const entry = (await find())!;
    expect(entry.path).toBe('/fr/contact');
    await api.delete(`/api/admin/errors/${entry.id}`, { headers });
  } finally {
    await api.dispose();
  }
});
