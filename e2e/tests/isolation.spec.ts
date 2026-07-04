import { expect, test } from '@playwright/test';

test.describe('CSS isolation — both directions (ARCHITECTURE §12)', () => {
  test('outbound: the library never touches document.head or host-page styles', async ({ page }) => {
    await page.goto('/e2e/fixtures/basic.html');
    const before = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { fontFamily: s.fontFamily, color: s.color, headStyleCount: document.querySelectorAll('head style, head link[rel="stylesheet"]').length };
    });
    await expect(page.locator('[data-sparq-item]')).toHaveCount(10); // fully rendered

    const after = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { fontFamily: s.fontFamily, color: s.color, headStyleCount: document.querySelectorAll('head style, head link[rel="stylesheet"]').length };
    });
    expect(after).toEqual(before);
  });

  test('inbound: hostile page CSS cannot break component interiors', async ({ page }) => {
    await page.goto('/e2e/fixtures/isolation.html');
    await expect(page.locator('[data-sparq-item]')).toHaveCount(5);

    const interior = await page.evaluate(() => {
      const input = document.querySelector('sparq-searchbox')!.shadowRoot!.querySelector('.input')!;
      const label = document.querySelector('sparq-filters')!.shadowRoot!.querySelector('.header')!;
      const si = getComputedStyle(input);
      const sl = getComputedStyle(label);
      return {
        inputFont: si.fontFamily,
        inputTransform: si.textTransform,
        inputLetterSpacing: si.letterSpacing,
        headerTransform: sl.textTransform,
      };
    });

    // The hostile sheet demands cursive/uppercase/7px on * with !important —
    // the all:initial firewall + internal reset must win inside the shadow.
    expect(interior.inputFont.toLowerCase()).not.toContain('cursive');
    expect(interior.inputTransform).toBe('none');
    expect(interior.inputLetterSpacing).toBe('normal');
    expect(interior.headerTransform).toBe('none');
  });

  test('theming doors still work: tokens pierce inward deliberately', async ({ page }) => {
    await page.goto('/e2e/fixtures/basic.html');
    await page.evaluate(() => {
      document.body.style.setProperty('--sparq-color-primary', 'rgb(5, 150, 105)');
    });
    await page.locator('sparq-pagination button', { hasText: '2' }).click();
    const active = page.locator('sparq-pagination button.active');
    await expect(active).toHaveCSS('background-color', 'rgb(5, 150, 105)');
  });
});
