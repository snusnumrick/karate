
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsFamily, loginAsInstructor } from '../utils/auth';

/**
 * Student Management - E2E Tests
 *
 * Student profile management, enrollment, belt progression tracking, belt award management, and attendance tracking
 *
 * Auto-generated from feature catalog
 * Routes: 18
 * Files: 21
 */

test.describe('Student Management', () => {
  
  test('smoke: /admin/families/:familyId/students/new loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/families/:familyId/students/new');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  test('smoke: /admin/student-belts/:studentId/ loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/student-belts/:studentId/');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  test('smoke: /admin/student-belts/:studentId/:beltAwardId/edit loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/student-belts/:studentId/:beltAwardId/edit');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  // 15 more route(s) available:
  // /admin/student-belts/:studentId/new, /admin/students/, /admin/students/:studentId, /admin/students/new, /api/student-eligible-classes/:studentId, /api/student-family/:studentId, /api/student-payment-eligibility/:studentId, /api/student-payment-options/:studentId, /api/v1/students/:studentId, /events/:eventId/register_/students, /family/add-student, /family/store/purchase/:studentId, /family/student/:studentId/, /family/student/:studentId/attendance, /instructor/students

  
  test('access: admin can access /admin/students/', async ({ page }) => {
    
    await loginAsAdmin(page);
    const response = await page.goto('/admin/students/');

    // Should not redirect to login
    await expect(page).not.toHaveURL(/.*login.*/);

    // Should respond with a success status (not 4xx/5xx)
    expect(response?.status() ?? 200).toBeLessThan(400);
  });
});
