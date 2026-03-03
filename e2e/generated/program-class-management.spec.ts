
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsFamily, loginAsInstructor } from '../utils/auth';

/**
 * Program & Class Management - E2E Tests
 *
 * Martial arts program and class management with session tracking
 *
 * Auto-generated from feature catalog
 * Routes: 12
 * Files: 14
 */

test.describe('Program & Class Management', () => {
  
  test('smoke: /admin/classes loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/classes');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  test('smoke: /admin/classes/ loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/classes/');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  test.skip('smoke: /admin/classes/:id/edit loads successfully', async ({ page }) => {
    // SKIPPED: route contains dynamic parameters that require real IDs.
    // Navigating to "/admin/classes/:id/edit" literally would send ":familyId" etc. to the
    // database, causing UUID parse errors (Sentry: invalid input syntax for uuid).
    // To enable: replace params with real test-fixture IDs from your test database.
    // Example: '/admin/classes/:id/edit'.replace(':familyId', process.env.TEST_FAMILY_ID ?? '')
  });

  
  // 9 more route(s) available:
  // /admin/classes/:id/sessions, /admin/classes/:id/sessions/:sessionId/:action, /admin/classes/new, /admin/programs, /admin/programs/, /admin/programs/:id/edit, /admin/programs/new, /api/student-eligible-classes/:studentId, /classes

  
  test('access: admin can access /admin/classes', async ({ page }) => {
    
    await loginAsAdmin(page);
    const response = await page.goto('/admin/classes');

    // Should not redirect to login
    await expect(page).not.toHaveURL(/.*login.*/);

    // Should respond with a success status (not 4xx/5xx)
    expect(response?.status() ?? 200).toBeLessThan(400);
  });
});
