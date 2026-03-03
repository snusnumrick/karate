import { test, expect } from '@playwright/test';

/**
 * Regression tests for the SSR hydration bug on public event pages.
 *
 * Root cause (fixed in cc25e18):
 *   AppBreadcrumb wrapped <BreadcrumbItem>/<BreadcrumbSeparator> in <div>,
 *   producing <div> inside <ol> — invalid HTML. Browsers auto-corrected the
 *   DOM during parsing, causing a mismatch with the SSR-rendered virtual DOM.
 *   React's hydration then failed, losing Router context, causing every
 *   useHref() / useLocation() call to throw an invariant error.
 *
 * These tests navigate directly (full SSR + hydration path) rather than via
 * client-side navigation, which is the only way to trigger the bug.
 */

const HYDRATION_ERROR_PATTERNS = [
  /hydration failed/i,
  /did not match/i,
  /server html was replaced/i,
  /usehref.*context/i,
  /uselocation.*context/i,
  /invariant/i,
  /useloaderdata must be used within a data router/i,
  /cannot read properties of null \(reading 'useref'\)/i,
];

function isHydrationError(msg: string): boolean {
  return HYDRATION_ERROR_PATTERNS.some((re) => re.test(msg));
}

test.describe('Public event pages — SSR hydration', () => {
  test('direct navigation to /events produces no hydration errors', async ({ page }) => {
    const hydrationErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' && isHydrationError(msg.text())) {
        hydrationErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      if (isHydrationError(err.message)) {
        hydrationErrors.push(err.message);
      }
    });

    await page.goto('/events', { waitUntil: 'networkidle' });

    expect(
      hydrationErrors,
      `Hydration errors on direct navigation to /events:\n${hydrationErrors.join('\n')}`
    ).toHaveLength(0);
  });

  test('/events page mounts AppBreadcrumb without router context errors', async ({ page }) => {
    const routerErrors: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (
        msg.type() === 'error' &&
        (text.includes('useHref') || text.includes('useLocation') || text.includes('Router'))
      ) {
        routerErrors.push(text);
      }
    });

    page.on('pageerror', (err) => {
      if (
        err.message.includes('useHref') ||
        err.message.includes('useLocation') ||
        err.message.includes('invariant')
      ) {
        routerErrors.push(err.message);
      }
    });

    await page.goto('/events', { waitUntil: 'networkidle' });

    expect(
      routerErrors,
      `Router context errors on /events:\n${routerErrors.join('\n')}`
    ).toHaveLength(0);
  });

  test('<ol> in breadcrumb contains only <li> children (no div wrappers)', async ({ page }) => {
    await page.goto('/events', { waitUntil: 'networkidle' });

    // Ensure there is at least one breadcrumb nav on the page
    const breadcrumbNav = page.locator('nav[aria-label="breadcrumb"]').first();
    const hasBreadcrumb = await breadcrumbNav.count() > 0;

    if (!hasBreadcrumb) {
      // Page may have no events yet — skip structural check
      test.skip();
      return;
    }

    // The <ol> inside the breadcrumb must not contain any <div> elements.
    // A <div> inside <ol> is invalid HTML and causes browser DOM correction
    // which breaks React SSR hydration.
    const divInsideOl = await page.evaluate(() => {
      const ols = Array.from(document.querySelectorAll('nav[aria-label="breadcrumb"] ol'));
      return ols.some((ol) => ol.querySelector('div') !== null);
    });

    expect(divInsideOl, 'Found <div> inside breadcrumb <ol> — this causes hydration failures').toBe(false);
  });

  test('event ErrorBoundary renders a plain <a> link (not broken when router context lost)', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Navigate to a non-existent event ID to trigger the ErrorBoundary
    await page.goto('/events/00000000-0000-0000-0000-000000000000', {
      waitUntil: 'networkidle',
    });

    // The page should not itself throw an uncaught error from the ErrorBoundary.
    // (A <Link> without Router context would throw; a plain <a> does not.)
    const invariantErrors = pageErrors.filter((e) => /invariant|usehref/i.test(e));
    expect(
      invariantErrors,
      `ErrorBoundary threw router invariant:\n${invariantErrors.join('\n')}`
    ).toHaveLength(0);

    // The ErrorBoundary should render an anchor that navigates back to /events
    const returnLink = page.locator('a[href="/events"]');
    const linkExists = await returnLink.count() > 0;
    // If the loader returned 404/error and the ErrorBoundary rendered, verify the link
    if (linkExists) {
      await expect(returnLink.first()).toBeVisible();
    }
  });
});
