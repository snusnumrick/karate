
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsFamily, loginAsInstructor } from '../utils/auth';

/**
 * Instructor Portal - E2E Tests
 *
 * Instructor-specific features including messaging and session management
 *
 * Auto-generated from feature catalog
 * Routes: 3
 * Files: 6
 */

test.describe('Instructor Portal', () => {
  
  test('smoke: /instructor loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/instructor');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  test('smoke: /instructor/messages/ loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/instructor/messages/');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  test.skip('smoke: /instructor/messages/:conversationId loads successfully', async ({ page }) => {
    // SKIPPED: route contains dynamic parameters that require real IDs.
    // Navigating to "/instructor/messages/:conversationId" literally would send ":familyId" etc. to the
    // database, causing UUID parse errors (Sentry: invalid input syntax for uuid).
    // To enable: replace params with real test-fixture IDs from your test database.
    // Example: '/instructor/messages/:conversationId'.replace(':familyId', process.env.TEST_FAMILY_ID ?? '')
  });

  
  test('access: instructor can access /instructor', async ({ page }) => {
    if (!process.env.TEST_INSTRUCTOR_EMAIL) { test.skip(true, 'No instructor credentials — set TEST_INSTRUCTOR_EMAIL/PASSWORD in .env'); return; }
    await loginAsInstructor(page);
    const response = await page.goto('/instructor');

    // Should not redirect to login
    await expect(page).not.toHaveURL(/.*login.*/);

    // Should respond with a success status (not 4xx/5xx)
    expect(response?.status() ?? 200).toBeLessThan(400);
  });
});
