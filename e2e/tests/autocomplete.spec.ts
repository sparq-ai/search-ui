import { expect, test, type Page } from '@playwright/test';

/**
 * <sparq-autocomplete> federated panel against the built CDN bundle.
 * Mock datasets: PRODUCTS (18, 6 per brand), CATEGORIES (2), POPULAR (4).
 */

const input = (page: Page) => page.locator('#Search-In-Header');
const panel = (page: Page) => page.locator('#ac-main .panel');
const wrappers = (page: Page) => page.locator('#ac-main > [data-sparq-ac-wrapper]');

async function requests(page: Page, suffix: string): Promise<number> {
  return page.evaluate(
    (s) => (window as unknown as { __SPARQ_REQUESTS__: string[] }).__SPARQ_REQUESTS__.filter((r) => r.endsWith(s)).length,
    suffix,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/fixtures/autocomplete.html');
  await page.waitForFunction(() => 'SparqSearchUI' in window);
});

test.describe('federated sections', () => {
  test('empty focus shows ONLY the show-on="empty" section (popular searches)', async ({ page }) => {
    await input(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(page.locator('#ac-main .ac-popular')).toHaveCount(4);
    await expect(page.locator('#ac-main .ac-product')).toHaveCount(0);
    // section headings: only Popular visible
    const visibleTitles = page.locator('#ac-main .panel section:not([hidden]) .section-title');
    await expect(visibleTitles).toHaveText(['Popular']);
  });

  test('typing swaps to query sections, each with its OWN template', async ({ page }) => {
    await input(page).fill('nike');
    await expect(page.locator('#ac-main .ac-product')).toHaveCount(4); // limit=4
    await expect(page.locator('#ac-main .ac-cat')).toHaveCount(1); // only "Nike Running" matches
    await expect(page.locator('#ac-main .ac-popular')).toHaveCount(0);
    // product template: title + price; category template: bare link
    await expect(page.locator('#ac-main .ac-product .price').first()).toContainText('$');
    await expect(page.locator('#ac-main .ac-cat').first()).toHaveAttribute('href', '/c/nike-running');
  });

  test('sections with zero results hide; nothing anywhere closes the panel', async ({ page }) => {
    await input(page).fill('adidas');
    await expect(page.locator('#ac-main .ac-product')).toHaveCount(4);
    await expect(page.locator('#ac-main .panel section:not([hidden]) .section-title')).toHaveText(['Products']);

    await input(page).fill('zzz-nothing');
    await expect(panel(page)).toBeHidden();
  });

  test('a keystroke burst settles into one request per active source', async ({ page }) => {
    await input(page).pressSequentially('nike', { delay: 30 });
    await expect(page.locator('#ac-main .ac-product')).toHaveCount(4);
    await page.waitForTimeout(300);
    expect(await requests(page, ':nike')).toBe(2); // PRODUCTS + CATEGORIES exactly once
  });
});

test.describe('keyboard + ARIA on the external input', () => {
  test('arrows traverse sections linearly; aria-activedescendant tracks light-DOM ids', async ({ page }) => {
    await input(page).fill('nike');
    await expect(wrappers(page)).toHaveCount(5); // 4 products + 1 category

    await input(page).press('ArrowDown');
    await expect(input(page)).toHaveAttribute('aria-activedescendant', 'ac-main-opt-0');
    await expect(wrappers(page).first()).toHaveAttribute('data-active', '');

    for (let i = 0; i < 4; i++) await input(page).press('ArrowDown');
    await expect(input(page)).toHaveAttribute('aria-activedescendant', 'ac-main-opt-4'); // into Categories

    await input(page).press('ArrowDown'); // wraps
    await expect(input(page)).toHaveAttribute('aria-activedescendant', 'ac-main-opt-0');

    await input(page).press('ArrowUp'); // wraps back
    await expect(input(page)).toHaveAttribute('aria-activedescendant', 'ac-main-opt-4');
  });

  test('combobox attributes applied on focus and expanded state tracks the panel', async ({ page }) => {
    await input(page).click();
    await expect(input(page)).toHaveAttribute('role', 'combobox');
    await expect(input(page)).toHaveAttribute('aria-controls', 'ac-main');
    await expect(input(page)).toHaveAttribute('aria-expanded', 'true');
    await input(page).press('Escape');
    await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(panel(page)).toBeHidden();
  });

  test('Enter on an active item follows its link', async ({ page }) => {
    await input(page).fill('nike');
    await expect(wrappers(page)).toHaveCount(5);
    await input(page).press('ArrowDown');
    await input(page).press('Enter');
    await page.waitForURL('**/products/nike-0');
  });

  test('activating an item fires sparq:ac-select with source metadata', async ({ page }) => {
    // popular items are <button>s — activation stays on the page, so the
    // recorded event survives for assertion
    await input(page).click();
    await expect(page.locator('#ac-main .ac-popular')).toHaveCount(4);
    await input(page).press('ArrowDown');
    await input(page).press('ArrowDown');
    await input(page).press('Enter');
    await expect(panel(page)).toBeHidden();
    const events = await page.evaluate(
      () => (window as unknown as { __AC_EVENTS__: { name: string; detail: Record<string, unknown> }[] }).__AC_EVENTS__,
    );
    const select = events.find((e) => e.name === 'sparq:ac-select');
    expect(select?.detail).toMatchObject({
      source: { collection: 'POPULAR', title: 'Popular' },
      index: 1,
      item: { query: 'trail shoes' },
      query: '',
    });
  });

  test('Enter with no active item goes to the search page', async ({ page }) => {
    await input(page).fill('nike');
    await expect(panel(page)).toBeVisible();
    await input(page).press('Enter');
    await page.waitForURL('**/search-landing.html?q=nike');
    await expect(page.locator('#q')).toHaveText('nike');
  });
});

test.describe('view-all footer', () => {
  test('shows the summed count and navigates to the search page', async ({ page }) => {
    await input(page).fill('nike');
    const viewAll = page.locator('#ac-main .view-all');
    await expect(viewAll).toBeVisible();
    await expect(viewAll).toHaveText('View all 7 results'); // 6 nike products + 1 category
    await viewAll.click();
    await page.waitForURL('**/search-landing.html?q=nike');
  });

  test('is hidden in empty mode', async ({ page }) => {
    await input(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(page.locator('#ac-main .view-all')).toBeHidden();
  });
});

test.describe('open/close behaviors', () => {
  test('outside click closes; refocus reopens from cache without new requests', async ({ page }) => {
    await input(page).click();
    await expect(panel(page)).toBeVisible();
    const before = await requests(page, ':');
    await page.locator('main').click();
    await expect(panel(page)).toBeHidden();
    await input(page).click();
    await expect(panel(page)).toBeVisible();
    expect(await requests(page, ':')).toBe(before); // POPULAR served from cache
  });

  test('clicking a result inside the panel does not trigger outside-close', async ({ page }) => {
    await input(page).fill('nike');
    await expect(page.locator('#ac-main .ac-cat')).toHaveCount(1);
    await page.locator('#ac-main .ac-cat').click();
    await page.waitForURL('**/c/nike-running');
  });
});

test.describe('resilience', () => {
  test('ARIA attributes are restored exactly when the component is removed', async ({ page }) => {
    await input(page).click();
    await expect(input(page)).toHaveAttribute('role', 'combobox');
    await page.evaluate(() => document.getElementById('ac-main')!.remove());
    await expect(input(page)).not.toHaveAttribute('role', 'combobox');
    await expect(input(page)).not.toHaveAttribute('aria-controls', /.+/);
    await expect(input(page)).not.toHaveAttribute('aria-expanded', /.+/);
  });

  test('survives the theme replacing the input node (delegated listeners)', async ({ page }) => {
    await input(page).fill('nike');
    await expect(panel(page)).toBeVisible();
    await input(page).press('Escape');
    await page.evaluate(() => {
      const old = document.getElementById('Search-In-Header')!;
      const clone = old.cloneNode(true) as HTMLElement;
      old.replaceWith(clone);
    });
    await input(page).fill('adidas');
    await expect(page.locator('#ac-main .ac-product')).toHaveCount(4);
    await expect(input(page)).toHaveAttribute('aria-expanded', 'true'); // re-wired on the new node
  });
});

test.describe('own-input mode + flip-above', () => {
  test('renders its own field, opens upward near the viewport bottom, submits on Enter', async ({ page }) => {
    const ownInput = page.locator('#own-instance input[data-sparq-ac-input]');
    await expect(ownInput).toBeVisible();
    await ownInput.fill('asics');
    const ownPanel = page.locator('#own-instance .panel');
    await expect(ownPanel).toBeVisible();
    await expect(page.locator('#own-instance > [data-sparq-ac-wrapper]')).toHaveCount(3);

    // pinned to the viewport bottom → panel must open ABOVE the input
    const inputBox = (await ownInput.boundingBox())!;
    const panelBox = (await ownPanel.boundingBox())!;
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(inputBox.y + 1);

    await ownInput.press('Enter');
    await page.waitForURL('**/search-landing.html?q=asics');
  });
});

test.describe('panel overlay CLS (chromium only)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'layout-shift API is Chromium-only');

  test('opening and closing the panel shifts nothing', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          const e = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        });
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/e2e/fixtures/autocomplete.html');
    await input(page).fill('nike');
    await expect(panel(page)).toBeVisible();
    await input(page).press('Escape');
    await input(page).click();
    await expect(panel(page)).toBeVisible();
    await page.waitForTimeout(300);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls).toBeLessThan(0.05);
  });
});
