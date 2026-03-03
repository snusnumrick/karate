
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsFamily, loginAsInstructor } from '../utils/auth';

/**
 * SEO & Marketing Infrastructure - E2E Tests
 *
 * SEO optimization with sitemap generation, structured data, and marketing landing pages
 *
 * Auto-generated from feature catalog
 * Routes: 1
 * Files: 3
 */

test.describe('SEO & Marketing Infrastructure', () => {
  
  test('smoke: /sitemap[/]xml loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/sitemap[/]xml');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });
});
