import { expect, test } from '@playwright/test';

test.describe('SSR takeover (ARCHITECTURE §8)', () => {
  test('fallback is the no-JS experience', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4517/e2e/fixtures/ssr.html');
    await expect(page.locator('#fallback .server-item').first()).toBeVisible();
    await context.close();
  });

  test('JS render takes over on first successful search; sparq:takeover fires', async ({ page }) => {
    await page.goto('/e2e/fixtures/ssr.html');
    // Mock has 250ms latency — the fallback must be visible before results land.
    await expect(page.locator('#fallback')).toBeVisible();

    // After the first search: fallback hidden, JS items visible.
    await expect(page.locator('[data-sparq-item]')).toHaveCount(10);
    await expect(page.locator('#fallback')).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { __takeover: boolean }).__takeover)).toBe(true);
  });

  test('fallback STAYS visible when the first search fails', async ({ page }) => {
    await page.route('**/v2', (route) => route.abort('connectionrefused'));
    await page.goto('/e2e/fixtures/ssr-fail.html');
    // Give the failed search time to settle, then assert the fallback survived.
    await page.waitForTimeout(600);
    await expect(page.locator('#fallback .server-item')).toBeVisible();
    await expect(page.locator('[data-sparq-item]')).toHaveCount(0);
  });
});
