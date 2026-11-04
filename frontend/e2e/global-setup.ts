import { request, type FullConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A fresh site is empty. The suite runs against the original portfolio content: when the target
 * has no project yet, seed/mbonnici-starter.zip is imported through the regular restore flow
 * (local sign-in, stage, replace). Needs DEV_LOGIN (docker-compose.local.yml has it).
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0].use.baseURL!;
  const api = await request.newContext({ baseURL });
  try {
    const projects = await (await api.get('/api/projects')).json();
    if (Array.isArray(projects) && projects.length) return;
    const providers = await (await api.get('/api/auth/providers')).json();
    if (!providers.devLogin) throw new Error('the site is empty and DEV_LOGIN is off: import seed/mbonnici-starter.zip from the back office first');
    await api.get('/api/auth/dev-login', { maxRedirects: 0 }).catch(() => undefined);
    await api.get('/api/auth/me');
    const xsrf = (await api.storageState()).cookies.find((c) => c.name === 'XSRF-TOKEN')?.value ?? '';
    const zip = readFileSync(join(__dirname, '..', '..', 'seed', 'mbonnici-starter.zip'));
    const staged = await api.post('/api/admin/backups/stage', {
      headers: { 'X-XSRF-TOKEN': xsrf },
      multipart: { file: { name: 'mbonnici-starter.zip', mimeType: 'application/zip', buffer: zip } },
    });
    if (!staged.ok()) throw new Error(`staging the starter archive failed: ${staged.status()} ${await staged.text()}`);
    const { id } = await staged.json();
    const applied = await api.post(`/api/admin/backups/stage/${id}/apply`, {
      headers: { 'X-XSRF-TOKEN': xsrf },
      data: { mode: 'REPLACE' },
    });
    if (!applied.ok()) throw new Error(`restoring the starter archive failed: ${applied.status()} ${await applied.text()}`);
    await api.post('/api/auth/logout', { headers: { 'X-XSRF-TOKEN': xsrf } });
  } finally {
    await api.dispose();
  }
}
