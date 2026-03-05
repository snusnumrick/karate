import { expect, test } from '@playwright/test';
import { loginAsAdmin, loginAsFamily, loginAsInstructor } from '../utils/auth';

test.describe('Critical auth guard contracts', () => {
  test('unauthenticated user is redirected to login for admin route', async ({ page }) => {
    await page.goto('/admin/classes');
    await expect(page).toHaveURL(/\/login\?redirectTo=/);
  });

  test('family user cannot remain on admin route after navigation', async ({ page }) => {
    await loginAsFamily(page);
    await page.goto('/admin/classes');

    await expect(page).not.toHaveURL(/\/admin\/classes/);
  });

  test('admin user can access admin routes', async ({ page }) => {
    await loginAsAdmin(page);
    const response = await page.goto('/admin/classes');

    await expect(page).not.toHaveURL(/\/login/);
    expect(response?.status() ?? 200).toBeLessThan(400);
  });

  test('instructor user can access instructor routes', async ({ page }) => {
    test.skip(
      !process.env.TEST_INSTRUCTOR_EMAIL || !process.env.TEST_INSTRUCTOR_PASSWORD,
      'Instructor credentials are not configured in environment'
    );

    await loginAsInstructor(page);
    const response = await page.goto('/instructor');

    await expect(page).not.toHaveURL(/\/login/);
    expect(response?.status() ?? 200).toBeLessThan(400);
  });
});
