
import { Page } from '@playwright/test';

/**
 * Authentication Helpers for E2E Tests
 *
 * Uses the login form directly (CSRF token is injected automatically by the
 * AuthenticityTokenInput component, so form submission works end-to-end).
 *
 * Test credentials are loaded from environment variables:
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
 *   TEST_FAMILY_EMAIL / TEST_FAMILY_PASSWORD
 *   TEST_INSTRUCTOR_EMAIL / TEST_INSTRUCTOR_PASSWORD  (optional)
 */

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-submit-button"]');

  // Successful login should move away from /login; role landing page can vary.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}

export async function loginAsAdmin(page: Page) {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in your .env file'
    );
  }

  await loginAs(page, email, password);
}

export async function loginAsFamily(page: Page) {
  const email = process.env.TEST_FAMILY_EMAIL;
  const password = process.env.TEST_FAMILY_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'TEST_FAMILY_EMAIL and TEST_FAMILY_PASSWORD must be set in your .env file'
    );
  }

  await loginAs(page, email, password);
}

export async function loginAsInstructor(page: Page) {
  const email = process.env.TEST_INSTRUCTOR_EMAIL;
  const password = process.env.TEST_INSTRUCTOR_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'TEST_INSTRUCTOR_EMAIL and TEST_INSTRUCTOR_PASSWORD must be set in your .env file.\n' +
      'If no instructor test account exists, create one in the Supabase dashboard.'
    );
  }

  await loginAs(page, email, password);
}

export async function logout(page: Page) {
  await page.goto('/logout');
  await page.waitForURL(/\/login/, { timeout: 10_000 });
}
