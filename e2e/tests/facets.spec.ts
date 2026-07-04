import { expect, test } from '@playwright/test';

test.describe('facets, sort, refinements, routing', () => {
  test('facet counts stay visible after selection; chips and URL reflect state', async ({ page }) => {
    await page.goto('/e2e/fixtures/facets.html');
    const brandFilters = page.locator('sparq-filters[attribute="brand"]');
    await expect(brandFilters.locator('li')).toHaveCount(3);

    // Refine on Nike.
    await brandFilters.locator('label', { hasText: 'Nike' }).locator('input').check();
    await expect(page.locator('sparq-stats')).toContainText('16 results');

    // Disjunctive counts: other brands remain listed with counts.
    await expect(brandFilters.locator('li')).toHaveCount(3);
    await expect(brandFilters.locator('label', { hasText: 'Adidas' })).toContainText('16');

    // Category counts DO reflect the Nike filter (8 road + 8 trail).
    const categoryFilters = page.locator('sparq-filters[attribute="category"]');
    await expect(categoryFilters.locator('label', { hasText: 'Road' })).toContainText('8');

    // Refinement chip + URL.
    await expect(page.locator('sparq-refinements')).toContainText('brand: Nike');
    await expect(page).toHaveURL(/f\.brand=Nike/);

    // Back button steps the refinement away.
    await page.goBack();
    await expect(page).not.toHaveURL(/f\.brand/);
    await expect(page.locator('sparq-stats')).toContainText('48 results');
  });

  test('sort and numeric range refine results', async ({ page }) => {
    await page.goto('/e2e/fixtures/facets.html');
    await expect(page.locator('[data-sparq-item]')).toHaveCount(10);

    await page.locator('sparq-sort select').selectOption('price:desc');
    await expect(page.locator('[data-sparq-item] .price').first()).toHaveText('210');

    // prices ≥ 200 in the fixture dataset: 200, 200, 205, 210
    await page.locator('sparq-range input[aria-label="Minimum"]').fill('200');
    await page.locator('sparq-range input[aria-label="Minimum"]').blur();
    await expect(page.locator('sparq-stats')).toContainText('4 results');
    await expect(page).toHaveURL(/r\.price=200-/);

    // Clear all restores everything.
    await page.locator('sparq-refinements button', { hasText: 'Clear all' }).click();
    await expect(page.locator('sparq-stats')).toContainText('48 results');
  });

  test('reload restores full state from the URL', async ({ page }) => {
    await page.goto('/e2e/fixtures/facets.html?q=Model&f.brand=Asics&page=2');
    await expect(page.locator('sparq-searchbox input')).toHaveValue('Model');
    await expect(page.locator('sparq-stats')).toContainText('16 results');
    // page=2 (1-based URL) → second page of 10/page → 6 items.
    await expect(page.locator('[data-sparq-item]')).toHaveCount(6);
    const checked = page.locator('sparq-filters[attribute="brand"] input:checked');
    await expect(checked).toHaveCount(1);
  });
});
