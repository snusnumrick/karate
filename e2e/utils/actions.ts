
import { Page, expect } from '@playwright/test';

/**
 * Common Test Actions
 *
 * Reusable actions for E2E tests
 */

export async function waitForSuccess(page: Page) {
  // Wait for success toast/message
  await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 5000 });
}

export async function waitForError(page: Page) {
  // Wait for error message
  await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
}

export async function fillForm(page: Page, data: Record<string, string>) {
  for (const [name, value] of Object.entries(data)) {
    await page.fill(`[name="${name}"]`, value);
  }
}

export async function navigateToAdminSection(page: Page, section: string) {
  await page.goto(`/admin/${section}`);
  await page.waitForLoadState('networkidle');
}
