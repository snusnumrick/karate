import { test, expect, type Page } from '@playwright/test';

const SELF_EMAIL = process.env.TEST_SELF_EMAIL;
const SELF_PASSWORD = process.env.TEST_SELF_PASSWORD;
const HOUSEHOLD_EMAIL = process.env.TEST_HOUSEHOLD_EMAIL;
const HOUSEHOLD_PASSWORD = process.env.TEST_HOUSEHOLD_PASSWORD;
const SEMINAR_SLUG = process.env.TEST_SEMINAR_SLUG;
const SEMINAR_SERIES_ID = process.env.TEST_SEMINAR_SERIES_ID;
const SELF_EVENT_ID = process.env.TEST_SELF_EVENT_ID;
const HOUSEHOLD_EVENT_ID = process.env.TEST_HOUSEHOLD_EVENT_ID;

async function login(page: Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'networkidle' });

  const emailInput = page.locator('input[name="email"], input[type="email"]').first();
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();

  if ((await emailInput.count()) === 0 || (await passwordInput.count()) === 0) {
    test.skip();
    return;
  }

  await emailInput.fill(email);
  await passwordInput.fill(password);

  const submitButton = page
    .getByRole('button', { name: /log in|login|sign in/i })
    .first();

  if ((await submitButton.count()) === 0) {
    test.skip();
    return;
  }

  await submitButton.click();
  await page.waitForLoadState('networkidle');
}

test.describe('Curriculum adult registration', () => {
  test('anonymous users can browse curriculum and are redirected to login for event registration', async ({ page }) => {
    await page.goto('/curriculum', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /pathways/i })).toBeVisible();

    await page.goto('/events/00000000-0000-0000-0000-000000000000/register', {
      waitUntil: 'networkidle',
    });
    await expect(page).toHaveURL(/\/login\?redirectTo=/);
  });

  test('self-family seminar registration route is reachable for authenticated self users', async ({ page }) => {
    if (!SELF_EMAIL || !SELF_PASSWORD || !SEMINAR_SLUG || !SEMINAR_SERIES_ID) {
      test.skip();
    }

    await login(page, SELF_EMAIL as string, SELF_PASSWORD as string);
    await page.goto(`/curriculum/seminars/${SEMINAR_SLUG}/register?seriesId=${SEMINAR_SERIES_ID}`, {
      waitUntil: 'networkidle',
    });

    await expect(page.getByText(/registration information/i).first()).toBeVisible();
    await expect(page.getByText(/seminar summary/i).first()).toBeVisible();
  });

  test('self participant event registration route supports authenticated adult flow', async ({ page }) => {
    if (!SELF_EMAIL || !SELF_PASSWORD || !SELF_EVENT_ID) {
      test.skip();
    }

    await login(page, SELF_EMAIL as string, SELF_PASSWORD as string);
    await page.goto(`/events/${SELF_EVENT_ID}/register`, { waitUntil: 'networkidle' });

    await expect(page.getByText(/event registration/i).first()).toBeVisible();
    await expect(page.getByText(/register yourself/i).first()).toBeVisible();
  });

  test('household event registration route remains available for existing student selection', async ({ page }) => {
    if (!HOUSEHOLD_EMAIL || !HOUSEHOLD_PASSWORD || !HOUSEHOLD_EVENT_ID) {
      test.skip();
    }

    await login(page, HOUSEHOLD_EMAIL as string, HOUSEHOLD_PASSWORD as string);
    await page.goto(`/events/${HOUSEHOLD_EVENT_ID}/register`, { waitUntil: 'networkidle' });

    await expect(page.getByText(/event registration/i).first()).toBeVisible();
    await expect(page.getByText(/select existing students/i).first()).toBeVisible();
  });
});

