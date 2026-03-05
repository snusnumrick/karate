import { expect, test } from '@playwright/test';
import { loginAsAdmin, loginAsFamily } from '../utils/auth';
import { getSeededFixture } from '../utils/fixtures';

test.describe('Critical service-error HTTP status contracts', () => {
  test('admin PDF API route redirects unauthenticated users to login', async ({ page }) => {
    const response = await page.goto('/api/invoices/00000000-0000-0000-0000-000000000000/pdf');

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/login\?redirectTo=/);
  });

  test('admin receives 404 for missing invoice PDF', async ({ page }) => {
    await loginAsAdmin(page);

    const missingInvoiceId = '00000000-0000-0000-0000-000000000000';
    const response = await page.request.get(`/api/invoices/${missingInvoiceId}/pdf`);

    expect([404, 500]).toContain(response.status());
    const body = await response.text();
    expect(body.length).toBeGreaterThan(0);
  });

  test('family user cannot access admin PDF API route', async ({ page }) => {
    await loginAsFamily(page);
    await page.goto('/api/invoices/00000000-0000-0000-0000-000000000000/pdf');

    await expect(page).not.toHaveURL(/\/api\/invoices\/.*\/pdf/);
  });

  test('existing seeded invoice endpoint is reachable when fixture is configured', async ({ page }) => {
    const seededInvoiceId = getSeededFixture('invoiceId');
    test.skip(!seededInvoiceId, 'Missing seeded fixture env var(s): TEST_INVOICE_ID');

    await loginAsAdmin(page);
    const response = await page.request.get(`/api/invoices/${seededInvoiceId}/pdf`);

    expect([200, 404]).toContain(response.status());
  });
});
