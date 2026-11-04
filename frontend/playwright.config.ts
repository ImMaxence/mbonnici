import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production SSR server (dist/) which proxies /api to a running
 * backend (default http://localhost:8080 — start it with `docker compose -f docker-compose.dev.yml up -d`
 * and `./mvnw spring-boot:run`). Set E2E_BASE_URL to test an already running deployment instead.
 */
const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4000';

export default defineConfig({
  testDir: './e2e',
  // a fresh site is empty: the starter archive is imported first (see e2e/global-setup.ts)
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'fr-FR',
  },
  webServer: process.env['E2E_BASE_URL']
    ? undefined
    : {
        command: 'node dist/mbonnici/server/server.mjs',
        url: 'http://localhost:4000/healthz',
        reuseExistingServer: !process.env['CI'],
        timeout: 60_000,
        env: {
          PORT: '4000',
          API_BASE_URL: process.env['API_BASE_URL'] ?? 'http://localhost:8081',
          APP_URL: 'http://localhost:4000',
          PROXY_API: 'true',
        },
      },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
});
