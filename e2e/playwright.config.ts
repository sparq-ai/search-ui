import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:4517',
  },
  webServer: {
    command: 'node serve.mjs 4517',
    url: 'http://127.0.0.1:4517/e2e/fixtures/basic.html',
    reuseExistingServer: true,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
