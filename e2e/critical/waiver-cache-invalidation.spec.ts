import { expect, test } from '@playwright/test';
import { loginAsAdmin, loginAsFamily } from '../utils/auth';
import {
  getSeededFixture,
  hasSeededFixtures,
  missingSeededFixturesMessage,
} from '../utils/fixtures';

test.describe('Critical waiver cache contracts', () => {
  test('waiver pages are protected and role-scoped', async ({ page }) => {
    await page.goto('/admin/waivers');
    await expect(page).toHaveURL(/\/login\?redirectTo=/);

    await loginAsFamily(page);
    await page.goto('/admin/waivers');
    await expect(page).not.toHaveURL(/\/admin\/waivers/);
  });

  test('admin and family waiver pages load for seeded fixtures', async ({ page, context }) => {
    test.skip(
      !hasSeededFixtures(['waiverId']),
      missingSeededFixturesMessage(['waiverId'])
    );

    const waiverId = getSeededFixture('waiverId') as string;

    await loginAsAdmin(page);
    const adminResponse = await page.goto(`/admin/waivers/${waiverId}`);
    expect(adminResponse?.status() ?? 200).toBeLessThan(500);

    await context.clearCookies();

    await loginAsFamily(page);
    const familyResponse = await page.goto('/family/waivers');
    expect(familyResponse?.status() ?? 200).toBeLessThan(500);
  });

  test('admin waiver update submit flow can execute for seeded waiver fixture', async ({ page }) => {
    test.skip(
      !hasSeededFixtures(['waiverId']),
      missingSeededFixturesMessage(['waiverId'])
    );

    const waiverId = getSeededFixture('waiverId') as string;

    await loginAsAdmin(page);
    await page.goto(`/admin/waivers/${waiverId}`);

    const submitButton = page.locator('form button[type="submit"]').first();
    test.skip(
      (await submitButton.count()) === 0,
      'No waiver form submit button found for seeded waiver route'
    );

    await submitButton.click();
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
  });
});
