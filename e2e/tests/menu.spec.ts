import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * <sparq-menu> hierarchical drill-down against the built bundle.
 * Fixture: 10 items; Men(7) [Shoes(5) [Trail(3), Road(2)], Jackets(2)],
 * Women(3) [Dresses(2), Shoes(1)]. Items carry full ancestor chains.
 */

const nodes = (page: Page): Locator => page.locator('sparq-menu button.node');
const nodeByLabel = (page: Page, label: string): Locator =>
  nodes(page).filter({ has: page.locator('.label', { hasText: new RegExp(`^${label}$`) }) });

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/fixtures/menu.html');
  await expect(page.locator('sparq-stats')).toContainText('10 results');
});

test.describe('tree rendering', () => {
  test('shows only root categories initially, sorted by count, with counts', async ({ page }) => {
    await expect(nodes(page)).toHaveCount(2);
    const labels = await nodes(page).locator('.label').allTextContents();
    expect(labels).toEqual(['Men', 'Women']); // 7 > 3
    await expect(nodeByLabel(page, 'Men').locator('.count')).toHaveText('7');
    await expect(nodeByLabel(page, 'Women').locator('.count')).toHaveText('3');
    // branch nodes announce collapsed state
    await expect(nodeByLabel(page, 'Men')).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('drill-down selection', () => {
  test('selecting a root reveals its children and filters results', async ({ page }) => {
    await nodeByLabel(page, 'Men').click();
    await expect(page.locator('sparq-stats')).toContainText('7 results');
    await expect(page).toHaveURL(/f\.categories=Men(&|$)/);

    // children visible: Shoes(5), Jackets(2); Women's children stay hidden
    await expect(nodes(page)).toHaveCount(4);
    const labels = await nodes(page).locator('.label').allTextContents();
    expect(labels).toEqual(['Men', 'Shoes', 'Jackets', 'Women']);
    await expect(nodeByLabel(page, 'Men')).toHaveAttribute('aria-selected', 'true');
    await expect(nodeByLabel(page, 'Men')).toHaveAttribute('aria-expanded', 'true');
  });

  test('drilling to level 3 keeps the lineage expanded and filters deepest', async ({ page }) => {
    await nodeByLabel(page, 'Men').click();
    await nodeByLabel(page, 'Shoes').click();
    await expect(page.locator('sparq-stats')).toContainText('5 results');
    await nodeByLabel(page, 'Trail').click();
    await expect(page.locator('sparq-stats')).toContainText('3 results');

    const cards = await page.locator('[data-sparq-item] .result-card').allTextContents();
    expect(cards.sort()).toEqual(['Peak Trail', 'Ridge Trail', 'Rock Trail']);

    // full lineage rendered: Men > Shoes > [Road, Trail] + Jackets + Women
    const labels = await nodes(page).locator('.label').allTextContents();
    expect(labels).toEqual(['Men', 'Shoes', 'Trail', 'Road', 'Jackets', 'Women']);
    await expect(nodeByLabel(page, 'Trail')).toHaveAttribute('aria-selected', 'true');
  });

  test('counts stay disjunctive while drilled in: sibling categories remain visible', async ({ page }) => {
    await nodeByLabel(page, 'Men').click();
    await expect(page.locator('sparq-stats')).toContainText('7 results');
    // Women still listed with its full count (own-filter excluded server-side)
    await expect(nodeByLabel(page, 'Women').locator('.count')).toHaveText('3');
  });

  test('clicking the selected node steps back to its parent; root click clears', async ({ page }) => {
    await nodeByLabel(page, 'Men').click();
    await nodeByLabel(page, 'Shoes').click();
    await expect(page.locator('sparq-stats')).toContainText('5 results');

    await nodeByLabel(page, 'Shoes').click(); // selected → back to Men
    await expect(page.locator('sparq-stats')).toContainText('7 results');
    await expect(page).toHaveURL(/f\.categories=Men(&|$)/);
    await expect(nodeByLabel(page, 'Men')).toHaveAttribute('aria-selected', 'true');

    await nodeByLabel(page, 'Men').click(); // selected root → clear
    await expect(page.locator('sparq-stats')).toContainText('10 results');
    await expect(page).not.toHaveURL(/f\.categories/);
    await expect(nodes(page)).toHaveCount(2); // collapsed back to roots
  });

  test('switching branches replaces the selection (menu semantics, never OR)', async ({ page }) => {
    await nodeByLabel(page, 'Men').click();
    await nodeByLabel(page, 'Women').click();
    await expect(page.locator('sparq-stats')).toContainText('3 results');
    await expect(page).toHaveURL(/f\.categories=Women/);
    await expect(page).not.toHaveURL(/Men/);
    // Men's children collapsed, Women's expanded
    const labels = await nodes(page).locator('.label').allTextContents();
    expect(labels).toEqual(['Men', 'Women', 'Dresses', 'Shoes']);
  });
});

test.describe('routing + integration', () => {
  test('a deep path survives URL round-trip (reload restores selection + expansion)', async ({ page }) => {
    await nodeByLabel(page, 'Men').click();
    await nodeByLabel(page, 'Shoes').click();
    await nodeByLabel(page, 'Trail').click();
    await expect(page.locator('sparq-stats')).toContainText('3 results');

    await page.reload();
    await expect(page.locator('sparq-stats')).toContainText('3 results');
    await expect(nodeByLabel(page, 'Trail')).toHaveAttribute('aria-selected', 'true');
    const labels = await nodes(page).locator('.label').allTextContents();
    expect(labels).toEqual(['Men', 'Shoes', 'Trail', 'Road', 'Jackets', 'Women']);
  });

  test('back button steps through the drill-down', async ({ page }) => {
    await nodeByLabel(page, 'Men').click();
    await nodeByLabel(page, 'Shoes').click();
    await expect(page.locator('sparq-stats')).toContainText('5 results');
    await page.goBack();
    await expect(page.locator('sparq-stats')).toContainText('7 results');
    await expect(nodeByLabel(page, 'Men')).toHaveAttribute('aria-selected', 'true');
  });

  test('selection appears as a refinement chip; clear-all collapses the tree', async ({ page }) => {
    await nodeByLabel(page, 'Men').click();
    await nodeByLabel(page, 'Shoes').click();
    await expect(page.locator('sparq-refinements')).toContainText('Men >>> Shoes');

    await page.locator('sparq-refinements button', { hasText: 'Clear all' }).click();
    await expect(page.locator('sparq-stats')).toContainText('10 results');
    await expect(nodes(page)).toHaveCount(2);
  });

  test('menu composes with the search box (query + hierarchy filter AND together)', async ({ page }) => {
    await nodeByLabel(page, 'Men').click();
    await nodeByLabel(page, 'Shoes').click();
    await page.locator('sparq-searchbox input').fill('Trail');
    await expect(page.locator('sparq-stats')).toContainText('3 results');
    // menu tree reflects the query: counts recompute within "Trail" matches
    await expect(nodeByLabel(page, 'Shoes').locator('.count')).toHaveText('3');
  });
});
