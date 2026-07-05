import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * <sparq-range> dual-thumb slider. Fixture dataset: 48 items, prices 50–210,
 * step=5. Keyboard interaction runs on ALL engines (real native-range
 * behavior); pointer-drag has a chromium-only spec (coordinate maths on
 * native thumbs is engine-specific and would flake elsewhere).
 */

const rangeMin = (page: Page): Locator => page.locator('sparq-range input[type="range"]').first();
const rangeMax = (page: Page): Locator => page.locator('sparq-range input[type="range"]').nth(1);
const numberMin = (page: Page): Locator => page.locator('sparq-range input[aria-label="Minimum"]');
const numberMax = (page: Page): Locator => page.locator('sparq-range input[aria-label="Maximum"]');

async function fillPercents(page: Page): Promise<{ left: number; right: number }> {
  return page.evaluate(() => {
    const root = document.querySelector('sparq-range')!.shadowRoot!;
    const fill = root.querySelector('.fill') as HTMLElement;
    return { left: parseFloat(fill.style.left), right: parseFloat(fill.style.right) };
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/fixtures/range.html');
  await expect(page.locator('sparq-stats')).toContainText('48 results');
});

test.describe('bounds discovery', () => {
  test('thumbs adopt stats bounds and slider becomes active', async ({ page }) => {
    await expect(rangeMin(page)).toBeEnabled();
    await expect(rangeMin(page)).toHaveValue('50');
    await expect(rangeMax(page)).toHaveValue('210');
    await expect(rangeMin(page)).toHaveAttribute('min', '50');
    await expect(rangeMax(page)).toHaveAttribute('max', '210');
    // full span = no filter
    await expect(page).not.toHaveURL(/r\.price/);
    const fill = await fillPercents(page);
    expect(fill.left).toBe(0);
    expect(fill.right).toBe(0);
  });

  test('number inputs show bounds as placeholders, empty values', async ({ page }) => {
    await expect(numberMin(page)).toHaveAttribute('placeholder', '50');
    await expect(numberMax(page)).toHaveAttribute('placeholder', '210');
    await expect(numberMin(page)).toHaveValue('');
  });
});

test.describe('keyboard interaction (all engines)', () => {
  test('arrow keys on the min thumb filter results after the debounce', async ({ page }) => {
    await rangeMin(page).focus();
    // step=5: four presses → min 70 → excludes prices 50,55,60,65
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    await expect(page.locator('sparq-stats')).not.toContainText('48 results');
    await expect(page).toHaveURL(/r\.price=70-/);
    await expect(page.locator('sparq-refinements')).toContainText('price');
    // every rendered price respects the filter
    const prices = await page.locator('[data-sparq-item] .price').allTextContents();
    for (const p of prices) expect(Number(p)).toBeGreaterThanOrEqual(70);
  });

  test('max thumb narrows from the other side', async ({ page }) => {
    await rangeMax(page).focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
    await expect(page).toHaveURL(/r\.price=-190/);
    const prices = await page.locator('[data-sparq-item] .price').allTextContents();
    for (const p of prices) expect(Number(p)).toBeLessThanOrEqual(190);
  });

  test('returning thumbs to the bounds clears the filter entirely', async ({ page }) => {
    await rangeMin(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/r\.price=55-/);
    await page.keyboard.press('ArrowLeft');
    await expect(page).not.toHaveURL(/r\.price/);
    await expect(page.locator('sparq-stats')).toContainText('48 results');
    await expect(page.locator('sparq-refinements li')).toHaveCount(0);
  });

  test('a burst of keypresses produces one debounced application', async ({ page }) => {
    let searches = 0;
    await page.exposeFunction('countSearch', () => searches++);
    await page.evaluate(() => {
      document.addEventListener('sparq:refine', () => (window as unknown as { countSearch: () => void }).countSearch());
    });
    await rangeMin(page).focus();
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/r\.price=90-/);
    await page.waitForTimeout(500);
    expect(searches).toBe(1); // one refine for eight keypresses
  });
});

test.describe('thumb clamping', () => {
  test('min thumb cannot cross the max thumb', async ({ page }) => {
    // narrow max down to 60, then try to push min past it
    await rangeMax(page).focus();
    for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowLeft');
    await expect(rangeMax(page)).toHaveValue('60');
    await rangeMin(page).focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
    const minVal = Number(await rangeMin(page).inputValue());
    expect(minVal).toBeLessThanOrEqual(60);
    await expect(page).toHaveURL(/r\.price=/);
  });

  test('typed values beyond the bounds are clamped', async ({ page }) => {
    await numberMin(page).fill('9999');
    await numberMin(page).blur();
    // clamped to max bound → exact-value range at 210
    await expect(page).toHaveURL(/r\.price=210-/);
    await expect(page.locator('sparq-stats')).toContainText('1 result');
    await expect(rangeMin(page)).toHaveValue('210');
  });
});

test.describe('slider ↔ number inputs stay in sync', () => {
  test('typing updates thumbs and the visual fill', async ({ page }) => {
    await numberMin(page).fill('90');
    await numberMin(page).blur();
    await numberMax(page).fill('130');
    await numberMax(page).blur();
    await expect(page).toHaveURL(/r\.price=90-130/);
    await expect(rangeMin(page)).toHaveValue('90');
    await expect(rangeMax(page)).toHaveValue('130');
    const fill = await fillPercents(page);
    expect(fill.left).toBeCloseTo(25, 0); // (90-50)/160
    expect(fill.right).toBeCloseTo(50, 0); // 1-(130-50)/160
  });

  test('sliding updates the number inputs', async ({ page }) => {
    await rangeMin(page).focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    await expect(numberMin(page)).toHaveValue('70');
  });
});

test.describe('external state changes', () => {
  test('URL-seeded range positions thumbs on load', async ({ page }) => {
    await page.goto('/e2e/fixtures/range.html?r.price=100-150');
    await expect(rangeMin(page)).toHaveValue('100');
    await expect(rangeMax(page)).toHaveValue('150');
    await expect(numberMin(page)).toHaveValue('100');
    await expect(numberMax(page)).toHaveValue('150');
    const fill = await fillPercents(page);
    expect(fill.left).toBeGreaterThan(20);
    expect(fill.right).toBeGreaterThan(30);
  });

  test('clear-all chip resets thumbs to the bounds', async ({ page }) => {
    await numberMin(page).fill('100');
    await numberMin(page).blur();
    await expect(page).toHaveURL(/r\.price=100-/);
    await page.locator('sparq-refinements button', { hasText: 'Clear all' }).click();
    await expect(page).not.toHaveURL(/r\.price/);
    await expect(rangeMin(page)).toHaveValue('50');
    await expect(rangeMax(page)).toHaveValue('210');
    await expect(numberMin(page)).toHaveValue('');
  });

  test('bounds FREEZE while own filter is active (no feedback collapse)', async ({ page }) => {
    await numberMin(page).fill('150');
    await numberMin(page).blur();
    await expect(page).toHaveURL(/r\.price=150-/);
    // stats of the filtered set start at 150 — the slider min bound must not follow
    await expect(rangeMin(page)).toHaveAttribute('min', '50');
    await expect(rangeMax(page)).toHaveAttribute('max', '210');
  });

  test('bounds adapt to a narrower result set once the filter is released', async ({ page }) => {
    await page.locator('sparq-searchbox input').fill('Asics');
    await expect(page.locator('sparq-stats')).toContainText('16 results');
    // Asics prices: 60..210 → min bound moves up
    await expect(rangeMin(page)).toHaveAttribute('min', '60');
  });
});

test.describe('pointer interaction on the track (all engines)', () => {
  const sliderBox = async (page: Page) => (await page.locator('sparq-range .slider').boundingBox())!;

  test('dragging from the min side applies a min filter', async ({ page }) => {
    const box = await sliderBox(page);
    const y = box.y + box.height / 2;
    // press near the min thumb (left edge), drag to mid-track
    await page.mouse.move(box.x + box.width * 0.05, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, y, { steps: 12 });
    await page.mouse.up();
    await expect(page).toHaveURL(/r\.price=\d+-/);
    const minVal = Number(await rangeMin(page).inputValue());
    expect(minVal).toBeGreaterThan(100);
    expect(minVal).toBeLessThan(170);
    const prices = await page.locator('[data-sparq-item] .price').allTextContents();
    for (const p of prices) expect(Number(p)).toBeGreaterThanOrEqual(minVal);
  });

  test('pressing the track jumps the NEAREST thumb (max side)', async ({ page }) => {
    const box = await sliderBox(page);
    const y = box.y + box.height / 2;
    await page.mouse.click(box.x + box.width * 0.75, y);
    // max thumb (nearest to 75%) jumps there; min stays put
    await expect(page).toHaveURL(/r\.price=-\d+/);
    await expect(rangeMin(page)).toHaveValue('50');
    const maxVal = Number(await rangeMax(page).inputValue());
    expect(maxVal).toBeGreaterThan(150);
    expect(maxVal).toBeLessThan(195);
  });

  test('a stacked pair at the max end is recoverable by dragging left', async ({ page }) => {
    await numberMin(page).fill('210');
    await numberMin(page).blur();
    await expect(rangeMin(page)).toHaveValue('210');
    const box = await sliderBox(page);
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.95, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.3, y, { steps: 10 });
    await page.mouse.up();
    const minVal = Number(await rangeMin(page).inputValue());
    expect(minVal).toBeLessThan(210);
    await expect(rangeMax(page)).toHaveValue('210');
  });

  test('drag is applied once on release, not per pixel', async ({ page }) => {
    let refines = 0;
    await page.exposeFunction('countRefine', () => refines++);
    await page.evaluate(() => {
      document.addEventListener('sparq:refine', () => (window as unknown as { countRefine: () => void }).countRefine());
    });
    const box = await sliderBox(page);
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.05, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, y, { steps: 25 });
    await page.mouse.up();
    await expect(page).toHaveURL(/r\.price=\d+-/);
    await page.waitForTimeout(450);
    expect(refines).toBe(1);
  });
});
