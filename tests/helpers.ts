import { test, expect, type Page } from '@playwright/test';

/** Clear localStorage and reload so each test starts fresh with seed data */
export async function freshPage(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/** Locate a list card (role=button) by its exact name, excluding the delete button */
export function listCard(page: Page, name: string) {
  return page
    .getByRole('button')
    .filter({ has: page.getByText(name, { exact: true }) })
    .first();
}

/** Open a list by clicking its card */
export async function openList(page: Page, name: string): Promise<void> {
  await listCard(page, name).click();
}

/** Open the task creation bottom sheet via FAB */
export async function openCreateSheet(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add new task' }).click();
  await expect(
    page.getByRole('dialog').getByPlaceholder('What needs to be done?')
  ).toBeVisible();
}

/** Create a task with the given title in the TaskSheet */
export async function createTask(
  page: Page,
  title: string,
  listName = 'Personal'
): Promise<void> {
  await openCreateSheet(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('What needs to be done?').fill(title);
  await dialog.getByRole('button', { name: listName, exact: true }).click();
  await dialog.getByRole('button', { name: 'Create Task' }).click();
  await expect(dialog).toBeHidden();
}

/** Task card locator by exact title text */
export function taskCard(page: Page, title: string) {
  return page.locator('[role="button"]').filter({ has: page.getByText(title, { exact: true }) }).first();
}

/** Simulate a swipe on a task card: direction 'left' (delete) or 'right' (done) */
export async function swipeTask(
  page: Page,
  taskTitle: string,
  direction: 'left' | 'right'
): Promise<void> {
  const card = taskCard(page, taskTitle);
  const box = (await card.boundingBox())!;
  const startX = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const endX = direction === 'left' ? box.x - 100 : box.x + box.width + 100;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** Open the create-list modal — desktop uses "New List", mobile uses "Add list" */
export async function openCreateListModal(page: Page): Promise<void> {
  const mobileBtn = page.getByRole('button', { name: 'Add list' }).first();
  const isMobile = await mobileBtn.isVisible().catch(() => false);
  if (isMobile) {
    await mobileBtn.click();
  } else {
    await page.getByRole('button', { name: 'New List' }).first().click();
  }
  await expect(page.locator('#new-list-name')).toBeVisible();
}
