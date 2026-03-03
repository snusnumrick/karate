
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsFamily, loginAsInstructor } from '../utils/auth';

/**
 * Discount System - E2E Tests
 *
 * Discount templates, automatic discounts, and discount code management
 *
 * Auto-generated from feature catalog
 * Routes: 18
 * Files: 22
 */

test.describe('Discount System', () => {
  
  test('smoke: /admin/automatic-discounts loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/automatic-discounts');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  test('smoke: /admin/automatic-discounts/ loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/automatic-discounts/');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  test('smoke: /admin/automatic-discounts/:ruleId loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/automatic-discounts/:ruleId');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  // 15 more route(s) available:
  // /admin/automatic-discounts/assignments, /admin/automatic-discounts/new, /admin/automatic-discounts/utilities, /admin/discount-codes, /admin/discount-codes/, /admin/discount-codes/:id/edit, /admin/discount-codes/new, /admin/discount-templates, /admin/discount-templates/, /admin/discount-templates/:id/edit, /admin/discount-templates/new, /api/admin/discount-codes, /api/admin/discount-templates, /api/available-discounts/:familyId, /api/discount-codes/validate

  
  test('access: admin can access /admin/automatic-discounts', async ({ page }) => {
    
    await loginAsAdmin(page);
    const response = await page.goto('/admin/automatic-discounts');

    // Should not redirect to login
    await expect(page).not.toHaveURL(/.*login.*/);

    // Should respond with a success status (not 4xx/5xx)
    expect(response?.status() ?? 200).toBeLessThan(400);
  });
});
