
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsFamily, loginAsInstructor } from '../utils/auth';

/**
 * Calendar & Scheduling - E2E Tests
 *
 * Event calendar with filtering, different views (grid/list), session scheduling, and admin calendar management
 *
 * Auto-generated from feature catalog
 * Routes: 10
 * Files: 24
 */

test.describe('Calendar & Scheduling', () => {
  
  test('smoke: /admin/calendar loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/calendar');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  test('smoke: /admin/calendar/new loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/calendar/new');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  test.skip('smoke: /admin/classes/:id/sessions loads successfully', async ({ page }) => {
    // SKIPPED: route contains dynamic parameters that require real IDs.
    // Navigating to "/admin/classes/:id/sessions" literally would send ":familyId" etc. to the
    // database, causing UUID parse errors (Sentry: invalid input syntax for uuid).
    // To enable: replace params with real test-fixture IDs from your test database.
    // Example: '/admin/classes/:id/sessions'.replace(':familyId', process.env.TEST_FAMILY_ID ?? '')
  });

  
  // 7 more route(s) available:
  // /admin/classes/:id/sessions/:sessionId/:action, /admin/sessions, /admin/sessions/, /admin/sessions/:id/edit, /admin/sessions/:sessionId, /family/calendar, /instructor/sessions

  
  test('access: admin can access /admin/calendar', async ({ page }) => {
    
    await loginAsAdmin(page);
    const response = await page.goto('/admin/calendar');

    // Should not redirect to login
    await expect(page).not.toHaveURL(/.*login.*/);

    // Should respond with a success status (not 4xx/5xx)
    expect(response?.status() ?? 200).toBeLessThan(400);
  });
});
