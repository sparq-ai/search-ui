import { expect, test, type Page } from '@playwright/test';

type TrackedEvent = {
  app?: string;
  collection?: string;
  eventName: string;
  eventData: Record<string, Record<string, unknown>>;
  timeStamp?: number;
};

/**
 * Insights e2e — the full attribution chain against the built CDN bundle:
 * search → search-query/search-session, click → product-clicked (queryId +
 * position), purchase → per-item queryId rejoin from the click map. The
 * tracking endpoint is intercepted; nothing leaves the browser.
 */
async function interceptEvents(page: Page): Promise<TrackedEvent[]> {
  const events: TrackedEvent[] = [];
  await page.route('https://events.sparq.ai/v2/events*', async (route) => {
    events.push(route.request().postDataJSON() as TrackedEvent);
    await route.fulfill({ status: 201, body: '' });
  });
  return events;
}

const byName = (events: TrackedEvent[], name: string) => events.filter((e) => e.eventName === name);

test.describe('insights', () => {
  test('reports the initial search with a queryId, and a session start', async ({ page }) => {
    const events = await interceptEvents(page);
    await page.goto('/e2e/fixtures/insights.html');
    await expect(page.locator('[data-sparq-item]')).toHaveCount(5);

    await expect.poll(() => byName(events, 'search-query').length).toBeGreaterThanOrEqual(1);
    const search = byName(events, 'search-query')[0]!;
    expect(search.app).toBe('test-app');
    expect(search.collection).toBe('products');
    expect(String(search.eventData.search!.queryId)).toMatch(/^mock-q-/);
    expect(search.eventData.search!.totalHits).toBe(48);
    expect(byName(events, 'search-session').length).toBeGreaterThanOrEqual(1);
  });

  test('drains pre-load queued commands in order (init, then purchase)', async ({ page }) => {
    const events = await interceptEvents(page);
    await page.goto('/e2e/fixtures/insights.html');

    await expect.poll(() => byName(events, 'purchase-complete').length).toBe(1);
    const order = byName(events, 'purchase-complete')[0]!.eventData.order!;
    expect(order.orderId).toBe('queued-1');
    expect(order.amount).toBe(5);
    const items = order.items as Record<string, unknown>[];
    expect(items[0]!.queryId).toBeUndefined(); // nothing was clicked before this purchase
  });

  test('a result click sends product-clicked and a later purchase rejoins its queryId', async ({ page }) => {
    const events = await interceptEvents(page);
    await page.goto('/e2e/fixtures/insights.html');
    await expect(page.locator('[data-sparq-item]')).toHaveCount(5);

    await page.locator('[data-sparq-item="2"]').click();
    await expect.poll(() => byName(events, 'product-clicked').length).toBe(1);
    const click = byName(events, 'product-clicked')[0]!.eventData.click!;
    expect(String(click.queryId)).toMatch(/^mock-q-/);
    expect(click.position).toBe(3); // 1-based
    const clickedId = String(click.itemId);

    await page.evaluate((id) => {
      window.sparq?.('purchase', {
        orderId: 'order-77',
        currency: 'USD',
        items: [
          { id, price: 100, quantity: 2 },
          { id: 'never-clicked', price: 10, quantity: 1 },
        ],
      });
    }, clickedId);

    // The fixture's queued purchase is the first; wait for THIS test's second one.
    await expect.poll(() => byName(events, 'purchase-complete').length).toBe(2);
    const purchases = byName(events, 'purchase-complete');
    const order = purchases[purchases.length - 1]!.eventData.order!;
    expect(order.amount).toBe(210);
    const items = order.items as Record<string, unknown>[];
    expect(items[0]).toMatchObject({ id: clickedId, queryId: click.queryId });
    expect(items[1]!.queryId).toBeUndefined();
  });

  test('typing settles into one more tracked search, not one per keystroke', async ({ page }) => {
    const events = await interceptEvents(page);
    await page.goto('/e2e/fixtures/insights.html');
    await expect(page.locator('[data-sparq-item]')).toHaveCount(5);
    await expect.poll(() => byName(events, 'search-query').length).toBe(1);

    await page.locator('sparq-searchbox input').pressSequentially('nike', { delay: 30 });
    await expect.poll(() => byName(events, 'search-query').length).toBeGreaterThanOrEqual(2);
    // Debounced: far fewer tracked searches than keystrokes.
    expect(byName(events, 'search-query').length).toBeLessThan(4);
  });

  test('a page without insights sends nothing', async ({ page }) => {
    const events = await interceptEvents(page);
    await page.goto('/e2e/fixtures/basic.html');
    await expect(page.locator('[data-sparq-item]')).toHaveCount(10);
    await page.locator('[data-sparq-item="0"]').click();
    await page.waitForTimeout(300);
    expect(events).toHaveLength(0);
  });

  test('a reloaded confirmation page does not re-send the same order (SDK 2.0.1 dedupe)', async ({ page }) => {
    const events = await interceptEvents(page);
    await page.goto('/e2e/fixtures/insights.html');
    await expect(page.locator('[data-sparq-item]')).toHaveCount(5);
    await page.evaluate(() => window.sparq?.('purchase', { orderId: 'reload-1', items: [{ id: 'r1', price: 9, quantity: 1 }] }));
    await expect.poll(() => byName(events, 'purchase-complete').filter((e) => (e.eventData.order as { orderId?: string }).orderId === 'reload-1').length).toBe(1);

    await page.reload();
    await expect(page.locator('[data-sparq-item]')).toHaveCount(5);
    await page.evaluate(() => window.sparq?.('purchase', { orderId: 'reload-1', items: [{ id: 'r1', price: 9, quantity: 1 }] }));
    await page.waitForTimeout(400);
    expect(byName(events, 'purchase-complete').filter((e) => (e.eventData.order as { orderId?: string }).orderId === 'reload-1')).toHaveLength(1);
  });
});
