import { expect, test } from '@playwright/test';
import { loginAsAdmin, loginAsFamily } from '../utils/auth';

test.describe('Critical enrollment contracts', () => {
  test('admin enrollment route is protected for unauthenticated users', async ({ page }) => {
    await page.goto('/admin/enrollments/new');
    await expect(page).toHaveURL(/\/login\?redirectTo=/);
  });

  test('admin can access enrollment creation page', async ({ page }) => {
    await loginAsAdmin(page);
    const response = await page.goto('/admin/enrollments/new');

    await expect(page).not.toHaveURL(/\/login/);
    expect(response?.status() ?? 200).toBeLessThan(400);
  });

  test('family user cannot stay on admin enrollment page', async ({ page }) => {
    await loginAsFamily(page);
    await page.goto('/admin/enrollments/new');

    await expect(page).not.toHaveURL(/\/admin\/enrollments\/new/);
  });

  test('admin enrollment POST without csrf is rejected', async ({ page }) => {
    await loginAsAdmin(page);

    const response = await page.request.post('/admin/enrollments/new', {
      form: {
        class_id: '00000000-0000-0000-0000-000000000000',
        student_id: '00000000-0000-0000-0000-000000000000',
      },
    });

    expect([403, 500]).toContain(response.status());
  });
});
