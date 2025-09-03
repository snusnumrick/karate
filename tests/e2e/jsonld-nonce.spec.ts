import { test, expect, Page } from '@playwright/test';

const routes = ['/', '/about', '/classes', '/contact'];

async function expectLdJsonScriptsHaveNonceAttributeInDOM(page: Page) {
  const results = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]')) as HTMLScriptElement[];
    return scripts.map(s => ({ hasNonce: s.hasAttribute('nonce'), nonce: s.getAttribute('nonce') }));
  });
  expect(results.length).toBeGreaterThan(0);
  for (const r of results) {
    // React clears nonce values on the client to prevent leakage, so value may be an empty string.
    // We only assert that the nonce attribute exists in the hydrated DOM.
    expect(r.hasNonce, `Missing nonce attribute on ld+json script in DOM`).toBeTruthy();
  }
}

async function expectNonEmptyNonceInSSRAndCSP(page: Page, route: string) {
  const res = await page.request.get(route);
  expect(res.ok()).toBeTruthy();

  // Validate CSP header: in strict dev/prod we expect a nonce, in lenient dev we allow 'unsafe-inline'
  const csp = res.headers()['content-security-policy'] || '';
  expect(csp.length).toBeGreaterThan(0);
  const hasNonceDirective = /script-src[^;]*'nonce-[^']+'/.test(csp);
  const isLenientDev = /script-src[^;]*'unsafe-inline'/.test(csp);
  expect(hasNonceDirective || isLenientDev).toBeTruthy();

  // Validate server-rendered HTML includes non-empty nonce attributes on ld+json scripts
  const html = await res.text();
  const ldJsonScripts = Array.from(html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>/gi)).map(m => m[0]);
  expect(ldJsonScripts.length).toBeGreaterThan(0);
  for (const tag of ldJsonScripts) {
    // Ensure nonce attribute exists and is non-empty in the SSR HTML
    expect(/\bnonce="[^"]+"/.test(tag), `SSR ld+json tag missing non-empty nonce: ${tag.slice(0, 200)}`).toBeTruthy();
  }
}

for (const route of routes) {
  test(`ld+json scripts on ${route} have a nonce`, async ({ page }) => {
    // First, validate SSR HTML and CSP header
    await expectNonEmptyNonceInSSRAndCSP(page, route);

    // Then, navigate and validate presence of nonce attribute in the hydrated DOM
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expectLdJsonScriptsHaveNonceAttributeInDOM(page);
  });
}