import { expect, test } from '@playwright/test';

test.describe('basic search flow (built CDN bundle)', () => {
  test('renders initial results, searches, paginates, shows empty state', async ({ page }) => {
    await page.goto('/e2e/fixtures/basic.html');

    // Initial load: 10 of 48 items, stats visible.
    await expect(page.locator('[data-sparq-item]')).toHaveCount(10);
    await expect(page.locator('sparq-stats')).toContainText('48 results');

    // Item template rendered with escaped bindings.
    const first = page.locator('[data-sparq-item]').first();
    await expect(first.locator('h3')).toContainText('Model');
    await expect(first.locator('a')).toHaveAttribute('href', /\/products\/\d+/);

    // Type a query — debounced single search.
    await page.locator('sparq-searchbox input').fill('Adidas');
    await expect(page.locator('sparq-stats')).toContainText('16 results');
    await expect(page.locator('[data-sparq-item] h3').first()).toContainText('Adidas');

    // Pagination.
    await page.locator('sparq-pagination button', { hasText: '2' }).click();
    await expect(page.locator('[data-sparq-item]')).toHaveCount(6); // 16 total, page 2 of 10/page

    // Empty state.
    await page.locator('sparq-searchbox input').fill('zzz-no-match');
    await expect(page.locator('sparq-items')).toContainText('Nothing found.');
    await expect(page.locator('[data-sparq-item]')).toHaveCount(0);
  });

  test('item clicks dispatch composed sparq:item-click events', async ({ page }) => {
    await page.goto('/e2e/fixtures/basic.html');
    const detail = page.evaluate(
      () =>
        new Promise<{ index: number; item: { name: string } }>((resolve) => {
          document.addEventListener('sparq:item-click', (e) => resolve((e as CustomEvent).detail), { once: true });
        }),
    );
    await page.locator('[data-sparq-item] h3').first().click();
    expect((await detail).item.name).toContain('Model');
  });
});
