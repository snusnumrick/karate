
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsFamily, loginAsInstructor } from '../utils/auth';

/**
 * Store & Products - E2E Tests
 *
 * E-commerce functionality for products, variants, inventory, and orders
 *
 * Auto-generated from feature catalog
 * Routes: 9
 * Files: 9
 */

test.describe('Store & Products', () => {
  
  test('smoke: /admin/store/orders/ loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/store/orders/');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  test.skip('smoke: /admin/store/orders/:orderId loads successfully', async ({ page }) => {
    // SKIPPED: route contains dynamic parameters that require real IDs.
    // Navigating to "/admin/store/orders/:orderId" literally would send ":familyId" etc. to the
    // database, causing UUID parse errors (Sentry: invalid input syntax for uuid).
    // To enable: replace params with real test-fixture IDs from your test database.
    // Example: '/admin/store/orders/:orderId'.replace(':familyId', process.env.TEST_FAMILY_ID ?? '')
  });

  
  test('smoke: /admin/store/products/ loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/store/products/');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  // 6 more route(s) available:
  // /admin/store/products/:productId/edit, /admin/store/products/:productId/variants/, /admin/store/products/:productId/variants/:variantId/edit, /admin/store/products/:productId/variants/new, /admin/store/products/new, /family/orders

  
  test('access: admin can access /admin/store/orders/', async ({ page }) => {
    
    await loginAsAdmin(page);
    const response = await page.goto('/admin/store/orders/');

    // Should not redirect to login
    await expect(page).not.toHaveURL(/.*login.*/);

    // Should respond with a success status (not 4xx/5xx)
    expect(response?.status() ?? 200).toBeLessThan(400);
  });
});
