import { test, expect } from '@playwright/test';
import { freshPage, openList } from './helpers';

test.describe('Features & PWA', () => {
  test('11. Dark mode toggle from settings', async ({ page }) => {
    await freshPage(page);
    // Settings modal has role="dialog" but NOT aria-label="Settings"
    // Use the unique "Settings" heading inside the dialog instead
    // Desktop: sidebar text "Settings"; Mobile: button aria-label "Open settings"
    const settingsBtn = page.getByRole('button', { name: /Open settings/ });
    const isMobile = await settingsBtn.isVisible().catch(() => false);
    if (isMobile) {
      await settingsBtn.click();
    } else {
      await page.getByText('Settings', { exact: true }).first().click();
    }
    const settings = page.getByRole('dialog');
    await expect(settings.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await settings.getByRole('button', { name: /Dark Mode/ }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await settings.getByRole('button', { name: 'Close settings' }).click();
    // Persisted after reload
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('12. Boomerang icon shown on task card', async ({ page }) => {
    await freshPage(page);
    await openList(page, 'Shopping');
    await expect(page.getByText(/🪃/)).toBeVisible();
  });

  test('13. Recurring badge shown on task card', async ({ page }) => {
    await freshPage(page);
    await openList(page, 'Shopping');
    await expect(page.getByText(/weekly/)).toBeVisible();
  });

  test('14. Subtask progress bar shown (1/3)', async ({ page }) => {
    await freshPage(page);
    await openList(page, 'Shopping');
    await expect(page.getByText('1/3 subtasks')).toBeVisible();
  });

  test('15. PWA manifest is valid', async ({ page }) => {
    await freshPage(page);
    const manifest = await page.evaluate(async () => {
      const res = await fetch('/manifest.json');
      return res.ok ? (await res.json()) : null;
    });
    expect(manifest).not.toBeNull();
    expect(manifest.name).toBe('Keep in Mind');
    expect(manifest.theme_color).toBe('#01696f');
  });
});
