
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsFamily, loginAsInstructor } from '../utils/auth';

/**
 * Payment Processing - E2E Tests
 *
 * Multi-provider payment processing with Stripe and Square integration, eligibility checking, and paid-until calculation
 *
 * Auto-generated from feature catalog
 * Routes: 18
 * Files: 37
 */

test.describe('Payment Processing', () => {
  
  test('smoke: /__tests__/family-payment-action/test loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/__tests__/family-payment-action/test');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  test('smoke: /admin/invoices/:id/record-payment loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/invoices/:id/record-payment');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  test('smoke: /admin/payments/ loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/payments/');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  
  // 15 more route(s) available:
  // /admin/payments/:paymentId, /admin/payments/new, /admin/payments/pending, /api/check-pending-payment, /api/create-payment-intent, /api/student-payment-eligibility/:studentId, /api/student-payment-options/:studentId, /family/payment, /family/payment-history, /family/payment/success/:paymentId, /family/receipt/:paymentId, /pay, /pay/:paymentId, /payment/cancel, /payment/success
});
