import { expect, test } from '@playwright/test';

/**
 * Facet display modes + rating + toggle against the built bundle.
 * Fixture: 24 items — 6 colors × 4 sizes; rating cycles 1..5;
 * every 4th item "out of stock" (6 items), 18 "in stock".
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/fixtures/facet-modes.html');
  await expect(page.locator('sparq-stats')).toContainText('24 results');
});

test.describe('mode="single" (radio semantics)', () => {
  test('one value at a time; clicking the selected value clears it', async ({ page }) => {
    const gender = page.locator('#f-gender');
    await expect(gender.locator('input[type="radio"]')).toHaveCount(3);

    const row = (value: string) =>
      gender.locator('label').filter({ has: page.locator('.value', { hasText: new RegExp(`^${value}$`) }) });

    await row('Men').click();
    await expect(page).toHaveURL(/f\.gender=Men/);
    await expect(page.locator('sparq-stats')).toContainText('8 results'); // 24 / 3 genders

    // Picking another value REPLACES (radio), never ANDs/ORs into a broken pair
    await row('Women').click();
    await expect(page).toHaveURL(/f\.gender=Women/);
    await expect(page).not.toHaveURL(/=Men/);
    await expect(gender.locator('input:checked')).toHaveCount(1);

    // Clicking the selected value clears the filter entirely
    await row('Women').click();
    await expect(page).not.toHaveURL(/f\.gender/);
    await expect(page.locator('sparq-stats')).toContainText('24 results');
  });
});

test.describe('mode="pill"', () => {
  test('pills toggle multi-select with counts and aria-pressed', async ({ page }) => {
    const size = page.locator('#f-size');
    const smallPill = size.locator('button.pill', { hasText: 'S' }).first();
    await expect(smallPill).toHaveAttribute('aria-pressed', 'false');

    await smallPill.click();
    await expect(smallPill).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('sparq-stats')).toContainText('6 results');

    // multi-select: add M → OR within the attribute
    await size.locator('button.pill', { hasText: 'M' }).click();
    await expect(page.locator('sparq-stats')).toContainText('12 results');
    await expect(page).toHaveURL(/f\.size=(S(~|%7E)M|M(~|%7E)S)/);
  });
});

test.describe('mode="swatch" and mode="color-list"', () => {
  test('swatches render mapped colors, gradients, multi, clear, and unknown fallbacks', async ({ page }) => {
    const swatches = page.locator('#f-color-swatch button.swatch');
    await expect(swatches).toHaveCount(6);

    const styles = await page.evaluate(() => {
      const host = document.querySelector('#f-color-swatch')!;
      const buttons = [...host.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.swatch')];
      return buttons.map((b) => ({
        label: b.getAttribute('aria-label')!.split(',')[0],
        bg: b.style.background,
        classes: b.className,
      }));
    });
    const byLabel = Object.fromEntries(styles.map((s) => [s.label, s]));
    expect(byLabel['Red']!.bg).toBe('red'); // raw CSS color value
    expect(byLabel['Storm']!.bg).toContain('linear-gradient'); // two-tone from map
    expect(byLabel['Multi']!.bg).toContain('conic-gradient'); // * encoding
    expect(byLabel['Clear']!.classes).toContain('clear'); // # encoding
    expect(byLabel['Sparkle']!.classes).toContain('unknown'); // unresolvable

    // Selecting via swatch filters and shows the selection ring
    await page.locator('#f-color-swatch button.swatch[aria-label^="Blue"]').click();
    await expect(page.locator('sparq-stats')).toContainText('4 results');
    await expect(page.locator('#f-color-swatch button.swatch[aria-label^="Blue"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('color-list renders checkbox rows with color dots and stays in sync with the swatch widget', async ({ page }) => {
    const list = page.locator('#f-color-list');
    await expect(list.locator('.dot')).toHaveCount(6);
    await list.locator('label', { hasText: 'Red' }).click();
    await expect(page.locator('sparq-stats')).toContainText('4 results');
    // Same attribute, different widget: the swatch view reflects the selection
    await expect(page.locator('#f-color-swatch button.swatch[aria-label^="Red"]')).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('sparq-rating', () => {
  test('renders "N stars & up" rows and filters rating >= N', async ({ page }) => {
    const rows = page.locator('sparq-rating button.row');
    await expect(rows).toHaveCount(4); // 4..1 & up

    // "4 & up": ratings cycle 1..5 evenly except rounding — compute expectation
    await rows.first().click(); // top row = 4 stars & up
    await expect(page).toHaveURL(/r\.rating=4-/);
    const prices = await page.locator('[data-sparq-item] .r').allTextContents();
    for (const r of prices) expect(Number(r)).toBeGreaterThanOrEqual(4);
    await expect(rows.first()).toHaveAttribute('aria-checked', 'true');

    // Switching rows replaces the threshold
    await rows.nth(2).click(); // 2 stars & up
    await expect(page).toHaveURL(/r\.rating=2-/);
    // Clicking the selected row clears
    await rows.nth(2).click();
    await expect(page).not.toHaveURL(/r\.rating/);
    await expect(page.locator('sparq-stats')).toContainText('24 results');
  });

  test('rating filter appears as a refinement chip and clear-all resets it', async ({ page }) => {
    await page.locator('sparq-rating button.row').first().click();
    await expect(page.locator('sparq-refinements')).toContainText('rating');
    await page.locator('sparq-refinements button', { hasText: 'Clear all' }).click();
    await expect(page).not.toHaveURL(/r\.rating/);
    await expect(page.locator('sparq-rating button.row[aria-checked="true"]')).toHaveCount(0);
  });
});

test.describe('sparq-toggle', () => {
  test('switch applies the facet value, shows the count, and round-trips the URL', async ({ page }) => {
    const toggle = page.locator('sparq-toggle button');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(toggle).toContainText('18'); // in-stock count

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('sparq-stats')).toContainText('18 results');
    await expect(page).toHaveURL(/f\.availability=in(%20|\+| )stock/);

    await toggle.click();
    await expect(page.locator('sparq-stats')).toContainText('24 results');
  });

  test('URL-seeded availability checks the switch on load', async ({ page }) => {
    await page.goto('/e2e/fixtures/facet-modes.html?f.availability=in%20stock');
    await expect(page.locator('sparq-toggle button')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('sparq-stats')).toContainText('18 results');
  });
});
