import { expect, test } from '@playwright/test';

test.describe('Core Web Vitals (ARCHITECTURE §17)', () => {
  test('skeletons + height retention keep CLS under 0.05', async ({ page }) => {
    await page.goto('/e2e/fixtures/cls.html');

    // Skeletons appear first (mock has 400ms latency) with real template dimensions.
    await expect(page.locator('[data-sparq-skeleton]').first()).toBeVisible();
    // Then results replace them.
    await expect(page.locator('[data-sparq-item]')).toHaveCount(8);

    // Interact: refine to another page (loading keeps height pinned).
    await page.locator('sparq-searchbox input').fill('Nike');
    await expect(page.locator('[data-sparq-item] h3').first()).toContainText('Nike');
    await page.waitForTimeout(300); // let any late shifts register

    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls).toBeLessThan(0.05);
  });
});
