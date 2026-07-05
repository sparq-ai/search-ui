import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

// Load e2e/.env (gitignored — see .env.example) for the live-store smoke test.
// Real environment variables always win over the file.
try {
  const env = readFileSync(join(__dirname, '.env'), 'utf-8');
  for (const line of env.split('\n')) {
    const m = /^\s*([\w.]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || m[1]!.startsWith('#')) continue;
    process.env[m[1]!] ??= m[2]!.replace(/^["']|["']$/g, '');
  }
} catch {
  /* no .env file — live smoke will be skipped */
}

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
  // All three engines = Chrome/Edge (chromium), Safari (webkit), Firefox.
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
