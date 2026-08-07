import { test, expect } from '@playwright/test';
import { freshPage, createTask, taskCard, swipeTask, openList } from './helpers';

test.describe('Tasks', () => {
  test('6. Create a task via FAB bottom sheet', async ({ page }) => {
    await freshPage(page);
    await createTask(page, 'Test task from E2E', 'Personal');
    // Created in Personal — open the list to see it
    await openList(page, 'Personal');
    await expect(page.getByText('Test task from E2E', { exact: true })).toBeVisible();
  });

  test('7. Task sheet: add subtask with Enter', async ({ page }) => {
    await freshPage(page);
    await page.getByRole('button', { name: 'Add new task' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('What needs to be done?').fill('Task with subtasks');
    await dialog.getByPlaceholder('Add subtask...').fill('First subtask');
    await dialog.getByPlaceholder('Add subtask...').press('Enter');
    await expect(dialog.getByText('First subtask')).toBeVisible();
    await dialog.getByRole('button', { name: 'Create Task' }).click();
    // Wait for sheet to close
    await expect(dialog).toBeHidden();
    // The new task is created in the default list (Personal)
    await openList(page, 'Personal');
    await expect(page.getByText('Task with subtasks', { exact: true })).toBeVisible();
  });

  test('8. Swipe left deletes a task', async ({ page }) => {
    await freshPage(page);
    await openList(page, 'Personal');
    await expect(page.getByText('Call mom', { exact: true })).toBeVisible();
    await swipeTask(page, 'Call mom', 'left');
    await expect(page.getByText('Call mom', { exact: true })).toHaveCount(0);
  });

  test('9. Swipe right marks task done', async ({ page }) => {
    await freshPage(page);
    await openList(page, 'Personal');
    // "Call mom" is a non-recurring "later" task — safe for swipe-to-done
    await expect(page.getByText('Call mom', { exact: true })).toBeVisible();
    await swipeTask(page, 'Call mom', 'right');
    // Task moves to the Completed section
    const completedSection = page.getByText('Completed', { exact: true });
    await completedSection.scrollIntoViewIfNeeded();
    await expect(completedSection).toBeVisible();
  });

  test('10. Tap task card opens edit sheet', async ({ page }) => {
    await freshPage(page);
    await openList(page, 'Personal');
    await page.getByText('Call mom', { exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Edit Task' })).toBeVisible();
    await expect(dialog.getByPlaceholder('What needs to be done?')).toHaveValue('Call mom');
  });
});
