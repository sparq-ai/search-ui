import { expect, test } from '@playwright/test';

/**
 * Live smoke against the REAL Sparq API — opt-in, credentials via env:
 *
 *   SPARQ_APP_ID=... SPARQ_API_KEY=... SPARQ_COLLECTION=... pnpm e2e
 *
 * Skipped entirely when the env vars are absent (normal CI runs).
 */
const appId = process.env.SPARQ_APP_ID;
const apiKey = process.env.SPARQ_API_KEY;
const collection = process.env.SPARQ_COLLECTION;

test.describe('live API smoke', () => {
  test.skip(!appId || !apiKey || !collection, 'SPARQ_APP_ID / SPARQ_API_KEY / SPARQ_COLLECTION not set');

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
