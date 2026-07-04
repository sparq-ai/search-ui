import { expect, test } from '@playwright/test';

/** Wire-format response matching the REAL API (verified against a production store). */
const WIRE_RESPONSE = {
  query: { q: 'ignored' },
  results: [
    { title: 'Alpha Widget', brand: 'Acme', price: 10 },
    { title: 'Beta Widget', brand: 'Zenith', price: 20 },
  ],
  // attr → [{label: <facet value>, value: <count>}]
  textFacets: {
    brand: [
      { label: 'Acme', value: 12 },
      { label: 'Zenith', value: 8 },
    ],
  },
  numericFacets: {},
  stats: {},
  totalHits: 42,
  responseTime: 7,
};

test.describe('real Sparq adapter against the documented wire format', () => {
  test('sends the documented request shape and renders the mapped response', async ({ page }) => {
    let captured: { headers: Record<string, string>; body: Record<string, unknown> } | null = null;

    await page.route('https://test-app.fast.sparq.ai/v2', async (route) => {
      captured = {
        headers: route.request().headers(),
        body: route.request().postDataJSON() as Record<string, unknown>,
      };
      await route.fulfill({ json: WIRE_RESPONSE });
    });

    await page.goto('/e2e/fixtures/api.html');
    await expect(page.locator('[data-sparq-item]')).toHaveCount(2);

    // Request: documented field names, Bearer auth, offset pagination.
    expect(captured).not.toBeNull();
    expect(captured!.headers.authorization).toBe('Bearer pk_test_key');
    expect(captured!.body).toMatchObject({
      query: '',
      collection: 'products',
      skip: 0,
      count: 5,
      fields: ['*'],
      textFacets: ['brand'],
    });

    // Response mapping: results→items, totalHits→totalItems, responseTime→processingTimeMs.
    await expect(page.locator('sparq-stats')).toContainText('42 results in 7ms');
    await expect(page.locator('[data-sparq-item]').first()).toContainText('Alpha Widget');
    await expect(page.locator('sparq-filters label', { hasText: 'Acme' })).toContainText('12');
  });

  test('normalizes auth failures into the error state', async ({ page }) => {
    await page.route('https://test-app.fast.sparq.ai/v2', (route) =>
      route.fulfill({ status: 401, json: { status: 401, data: 'Invalid API key' } }),
    );
    await page.goto('/e2e/fixtures/api.html');
    await expect(page.locator('sparq-items')).toContainText('Invalid API key');
  });
});
