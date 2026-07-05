import { expect, test } from '@playwright/test';

/**
 * Live smoke against the REAL Sparq API — opt-in via credentials from
 * e2e/.env (gitignored; copy e2e/.env.example) or environment variables:
 *
 *   SPARQ_APP_ID=... SPARQ_API_KEY=... SPARQ_COLLECTION=... pnpm e2e
 *
 * Skipped entirely when credentials are absent (normal CI runs).
 */
const appId = process.env.SPARQ_APP_ID;
const apiKey = process.env.SPARQ_API_KEY;
const collection = process.env.SPARQ_COLLECTION;

test.describe('live API smoke', () => {
  test.skip(!appId || !apiKey || !collection, 'SPARQ_APP_ID / SPARQ_API_KEY / SPARQ_COLLECTION not set');
  // One engine is enough for the external-API smoke — be polite to the live store.
  test.skip(({ browserName }) => browserName !== 'chromium', 'live smoke runs on chromium only');

  test('searches a real store end-to-end through the built bundle', async ({ page }) => {
    const params = new URLSearchParams({ appId: appId!, apiKey: apiKey!, collection: collection! });
    await page.goto(`/e2e/fixtures/live.html?${params}`);

    // Initial load: items render, stats show a real total.
    await expect(page.locator('[data-sparq-item]')).toHaveCount(5, { timeout: 15_000 });
    await expect(page.locator('sparq-stats')).toContainText(/\d+ results in \d+ms/);

    // Facet widget received real disjunctive counts.
    await expect(page.locator('sparq-filters li').first()).toBeVisible();

    // Refining a facet narrows results and keeps the other values listed (§4).
    const facetCountBefore = await page.locator('sparq-filters li').count();
    await page.locator('sparq-filters input[type="checkbox"]').first().check();
    await expect
      .poll(async () => page.locator('sparq-filters li').count(), { timeout: 15_000 })
      .toBe(facetCountBefore);

    // Querying changes the result set.
    const before = await page.locator('sparq-stats').textContent();
    await page.locator('sparq-searchbox input').fill('the');
    await expect(page.locator('sparq-stats')).not.toHaveText(before ?? '', { timeout: 15_000 });
  });
});
