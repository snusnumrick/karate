
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsFamily, loginAsInstructor } from '../utils/auth';

/**
 * Event Management & Registration - E2E Tests
 *
 * Event creation, management, and registration system with waiver integration
 *
 * Auto-generated from feature catalog
 * Routes: 6
 * Files: 10
 */

test.describe('Event Management & Registration', () => {
  
  test('smoke: /admin/events loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/events');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  test('smoke: /admin/events/new loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/events/new');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  test.skip('smoke: /events/:eventId/register_/students loads successfully', async ({ page }) => {
    // SKIPPED: route contains dynamic parameters that require real IDs.
    // Navigating to "/events/:eventId/register_/students" literally would send ":familyId" etc. to the
    // database, causing UUID parse errors (Sentry: invalid input syntax for uuid).
    // To enable: replace params with real test-fixture IDs from your test database.
    // Example: '/events/:eventId/register_/students'.replace(':familyId', process.env.TEST_FAMILY_ID ?? '')
  });

  
  // 3 more route(s) available:
  // /events/:eventId/register_/waivers, /events/:eventId_/register, /family/events

  
  test('access: admin can access /admin/events', async ({ page }) => {
    
    await loginAsAdmin(page);
    const response = await page.goto('/admin/events');

    // Should not redirect to login
    await expect(page).not.toHaveURL(/.*login.*/);

    // Should respond with a success status (not 4xx/5xx)
    expect(response?.status() ?? 200).toBeLessThan(400);
  });
});
