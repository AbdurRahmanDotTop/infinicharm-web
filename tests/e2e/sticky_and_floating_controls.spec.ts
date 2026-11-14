import { test, expect } from '@playwright/test';

const TARGET_VIEWPORTS = [
  { width: 320, height: 568, name: '320x568-Mobile-XS' },
  { width: 375, height: 667, name: '375x667-Mobile-SE' },
  { width: 768, height: 1024, name: '768x1024-Tablet' },
  { width: 1440, height: 900, name: '1440x900-Desktop' },
];

async function rectOf(locator: ReturnType<import('@playwright/test').Page['locator']>) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return {
    left: box!.x,
    top: box!.y,
    right: box!.x + box!.width,
    bottom: box!.y + box!.height,
    width: box!.width,
    height: box!.height,
  };
}

test.describe('Sticky Announcement Bar & Harmonious Floating Controls', () => {
  test('Only the top Announcement Bar remains sticky on scroll while Header & Category Nav scroll away', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    for (const vp of TARGET_VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/', { waitUntil: 'networkidle' });

      const announcement = page.getByTestId('announcement-bar');
      const mainHeader = page.getByTestId('main-header');

      await expect(announcement).toBeVisible();
      await expect(mainHeader).toBeVisible();

      const initialAnn = await rectOf(announcement);
      expect(Math.round(initialAnn.top), `${vp.name} initial announcement top`).toBe(0);

      // Scroll down 700px
      await page.evaluate(() => window.scrollTo(0, 700));
      await page.waitForTimeout(150);

      const scrolledAnn = await rectOf(announcement);
      const scrolledHeader = await rectOf(mainHeader);

      // Only the Announcement Bar stays stuck at top (y=0)
      expect(
        Math.abs(scrolledAnn.top),
        `${vp.name} announcement bar must remain pinned at y=0 after scroll`
      ).toBeLessThanOrEqual(1);

      // Main header & category nav must NOT be sticky — they must scroll off above viewport
      expect(
        scrolledHeader.bottom,
        `${vp.name} main header must scroll out of viewport instead of remaining sticky`
      ).toBeLessThanOrEqual(5);

      // Zero horizontal overflow while scrolled
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow, `${vp.name} overflow while scrolled`).toBe(false);
    }

    expect(errors).toEqual([]);
  });

  test('Back-to-Top & Live Chat sit cleanly above Sticky Cart Bar when cart has items and drop down cleanly when absent', async ({ page }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    // Step 1: Verify empty cart state (no Sticky Cart Bar -> buttons rest near bottom edge)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/shop', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('sticky-cart-bar')).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(250);

    const emptyBackRect = await rectOf(page.getByTestId('back-to-top-btn'));
    const emptyCareRect = await rectOf(page.getByTestId('live-care-btn'));
    expect(emptyBackRect.right + 8).toBeLessThanOrEqual(emptyCareRect.left);
    expect(667 - emptyCareRect.bottom).toBeLessThanOrEqual(36);
    expect(667 - emptyBackRect.bottom).toBeLessThanOrEqual(36);

    // Step 2: Add an authentic product to cart so Sticky Cart Bar activates
    await page.goto('/product/100-kashmiri-honey', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Add to Bag/i }).click();

    await page.goto('/shop', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(300);

    for (const vp of TARGET_VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(120);

      const cartBar = page.getByTestId('sticky-cart-bar');
      const backBtn = page.getByTestId('back-to-top-btn');
      const careBtn = page.getByTestId('live-care-btn');

      await expect(cartBar, `${vp.name} sticky cart visible`).toBeVisible();
      await expect(backBtn, `${vp.name} back-to-top visible`).toBeVisible();
      await expect(careBtn, `${vp.name} live care visible`).toBeVisible();

      const cartRect = await rectOf(cartBar);
      const backRect = await rectOf(backBtn);
      const careRect = await rectOf(careBtn);

      // Strictly inside viewport (no clipping on small screens)
      for (const [label, r] of [
        ['StickyCartBar', cartRect],
        ['BackToTop', backRect],
        ['LiveCare', careRect],
      ] as const) {
        expect(r.left, `${vp.name} ${label} left`).toBeGreaterThanOrEqual(0);
        expect(r.top, `${vp.name} ${label} top`).toBeGreaterThanOrEqual(0);
        expect(r.right, `${vp.name} ${label} right`).toBeLessThanOrEqual(vp.width + 1);
        expect(r.bottom, `${vp.name} ${label} bottom`).toBeLessThanOrEqual(vp.height + 1);
      }

      // Back to Top and Live Care must sit ABOVE Sticky Cart Bar with >= 6px vertical spacing
      expect(
        backRect.bottom,
        `${vp.name} BackToTop (${backRect.bottom}) must sit cleanly above StickyCartBar (${cartRect.top})`
      ).toBeLessThanOrEqual(cartRect.top - 6);
      expect(
        careRect.bottom,
        `${vp.name} LiveCare (${careRect.bottom}) must sit cleanly above StickyCartBar (${cartRect.top})`
      ).toBeLessThanOrEqual(cartRect.top - 6);

      // Back to Top (left) and Live Care (right) must never collide horizontally
      expect(
        backRect.right + 8,
        `${vp.name} horizontal gap between BackToTop and LiveCare`
      ).toBeLessThanOrEqual(careRect.left);
    }

    // Step 3: Interactive clickability check on Mobile (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(100);

    // Click View Bag inside Sticky Cart Bar -> opens Shopping Bag drawer cleanly
    await page.getByTestId('sticky-cart-bar').getByRole('button', { name: /View Bag/i }).click();
    const bagDialog = page.getByRole('dialog', { name: 'Shopping Bag' });
    await expect(bagDialog).toBeVisible();
    await bagDialog.getByRole('button', { name: 'Close Shopping Bag' }).click();
    await expect(bagDialog).toHaveCount(0);

    // Click Back to Top -> smoothly scrolls back to top (scrollY === 0)
    await page.getByTestId('back-to-top-btn').click();
    await page.waitForFunction(() => window.scrollY < 10, null, { timeout: 5000 });

    // Step 4: On /cart (excluded route), Sticky Cart Bar hides and Live Care drops smoothly down
    await page.goto('/cart', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('sticky-cart-bar')).toHaveCount(0);
    const cartRouteCareRect = await rectOf(page.getByTestId('live-care-btn'));
    expect(667 - cartRouteCareRect.bottom).toBeLessThanOrEqual(36);

    expect(errors).toEqual([]);
  });
});

