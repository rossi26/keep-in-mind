import { test, expect } from '@playwright/test';
import { freshPage, openList, listCard, openCreateListModal } from './helpers';

test.describe('Lists (View 1)', () => {
  test('1. Seed data: shows 3 default lists with counts', async ({ page }) => {
    await freshPage(page);
    await expect(page.getByRole('heading', { name: 'Lists' })).toBeVisible();

    for (const name of ['Personal', 'Work', 'Shopping']) {
      await expect(listCard(page, name)).toBeVisible();
    }
    await expect(page.getByText('2 open', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('1 open', { exact: true })).toBeVisible();
  });

  test('2. Tap a list card opens filtered task view', async ({ page }) => {
    await freshPage(page);
    await openList(page, 'Shopping');
    await expect(page.getByRole('heading', { name: 'Shopping' })).toBeVisible();
    await expect(page.getByText('Buy groceries for the week')).toBeVisible();
  });

  test('3. Back button returns to Lists grid', async ({ page }) => {
    await freshPage(page);
    await openList(page, 'Work');
    await expect(page.getByRole('heading', { name: 'Work' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to lists' }).click();
    await expect(page.getByRole('heading', { name: 'Lists' })).toBeVisible();
  });

  test('4. Create a custom list with color+icon', async ({ page }) => {
    await freshPage(page);
    await openCreateListModal(page);
    await page.locator('#new-list-name').fill('Fitness');
    await page.getByRole('button', { name: 'Color #16a34a' }).click();
    await page.getByRole('button', { name: 'Icon dumbbell' }).click();
    await page.getByRole('button', { name: 'Create List' }).click();
    await expect(listCard(page, 'Fitness')).toBeVisible();
  });

  test('5. Delete a custom list', async ({ page }) => {
    await freshPage(page);
    // Create a list first
    await openCreateListModal(page);
    await page.locator('#new-list-name').fill('Temp');
    await page.getByRole('button', { name: 'Create List' }).click();
    await expect(listCard(page, 'Temp')).toBeVisible();

    // Delete button is opacity-0 until hover — force click since it exists in DOM
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete Temp', exact: true }).click({ force: true });
    await expect(listCard(page, 'Temp')).toHaveCount(0);
  });
});
