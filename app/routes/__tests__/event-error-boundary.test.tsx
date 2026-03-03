import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

/**
 * Unit tests for the EventDetail ErrorBoundary.
 *
 * Critical regression (fixed in cc25e18 / related cleanup):
 *   The original ErrorBoundary used a Remix <Link> component for the "Return to
 *   Events" button. When the SSR hydration failed (due to <div>-inside-<ol> in
 *   AppBreadcrumb), React lost its Router context. Any subsequent render of
 *   <Link> then threw an invariant "useHref() may be used only in the context of
 *   a <Router>" error, crashing the ErrorBoundary itself and leaving users with
 *   a completely blank page instead of a helpful message.
 *
 *   The fix: replace <Link> with a plain <a href="/events"> in the ErrorBoundary.
 *
 * These tests verify:
 *   1. The component renders without throwing when there is no Router context.
 *   2. The "Return to Events" navigation is a plain <a>, not a <Link>.
 *   3. Correct error content for RouteErrorResponse (404) and plain Error objects.
 */

// ─── control what useRouteError() returns in each test ──────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseRouteError = vi.fn<() => unknown>();

// ─── mock @remix-run/react ───────────────────────────────────────────────────
// Provide all hooks the route file imports so we can import it in a node env.
vi.mock('@remix-run/react', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href: to, ...props }, children),
  useLoaderData: vi.fn(),
  useLocation: vi.fn(() => ({ pathname: '/events/test-id' })),
  Outlet: () => null,
  useRouteError: () => mockUseRouteError(),
  isRouteErrorResponse: (err: unknown): boolean =>
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    'statusText' in err,
  useRouteLoaderData: vi.fn(() => undefined),
}));

// ─── mock server-side / framework imports ───────────────────────────────────
vi.mock('@remix-run/node', () => ({
  json: vi.fn((data: unknown) => data),
}));

vi.mock('~/services/event.server', () => ({
  EventService: { getEventById: vi.fn() },
}));

vi.mock('~/utils/auth.server', () => ({
  isLoggedIn: vi.fn(() => Promise.resolve(false)),
}));

// ─── mock UI components that may use browser APIs ───────────────────────────
vi.mock('~/components/AppBreadcrumb', () => ({
  AppBreadcrumb: () => React.createElement('nav', { 'aria-label': 'breadcrumb' }),
  breadcrumbPatterns: { eventDetail: vi.fn(() => []) },
}));

vi.mock('~/components/JsonLd', () => ({
  JsonLd: () => null,
}));

vi.mock('~/components/ui/button', () => ({
  Button: ({ children, asChild: _asChild, ...props }: { children: React.ReactNode; asChild?: boolean; [k: string]: unknown }) =>
    React.createElement('button', props, children),
}));

vi.mock('~/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { className: 'card' }, children),
  CardContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { className: 'card-content' }, children),
}));

vi.mock('~/config/site', () => ({
  siteConfig: {
    name: 'Test Dojo',
    url: 'https://test.example.com',
    location: {
      address: '1 Main St',
      locality: 'Testville',
      region: 'ON',
      postalCode: 'A1B 2C3',
      country: 'CA',
    },
    localization: { currency: 'CAD' },
  },
}));

vi.mock('~/utils/misc', () => ({
  formatDate: vi.fn((d: string) => d),
  getCurrentDateTimeInTimezone: vi.fn(() => new Date('2099-01-01')),
}));

vi.mock('~/utils/money', () => ({
  formatMoney: vi.fn(() => '$0.00'),
  isPositive: vi.fn(() => false),
  toDollars: vi.fn(() => 0),
  serializeMoney: vi.fn((m: unknown) => m),
  deserializeMoney: vi.fn((m: unknown) => m),
}));

// ─── import the component under test (after all mocks are set up) ────────────
// eslint-disable-next-line import/first
import { ErrorBoundary } from '~/routes/_layout.events.$eventId';

// ─── helpers ─────────────────────────────────────────────────────────────────

function renderErrorBoundary(): string {
  return renderToStaticMarkup(React.createElement(ErrorBoundary));
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('EventDetail ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── critical regression: must not use <Link> ────────────────────────────

  describe('router-safe anchor — critical regression for broken-Router crash', () => {
    it('renders without throwing even when there is no Router context', () => {
      // If the ErrorBoundary used a Remix <Link> it would throw:
      //   "useHref() may be used only in the context of a <Router>"
      // A plain <a> never throws in this situation.
      mockUseRouteError.mockReturnValue({ status: 404, statusText: 'Not Found', data: null });

      expect(() => renderErrorBoundary()).not.toThrow();
    });

    it('contains a plain <a href="/events"> — not a Router-dependent <Link>', () => {
      mockUseRouteError.mockReturnValue({ status: 404, statusText: 'Not Found', data: null });

      const html = renderErrorBoundary();

      // Must have a plain anchor pointing back to events list
      expect(html).toContain('href="/events"');
    });

    it('does not throw for a generic JavaScript Error', () => {
      mockUseRouteError.mockReturnValue(new Error('Unexpected crash'));

      expect(() => renderErrorBoundary()).not.toThrow();
    });

    it('does not throw for an unknown error type (string)', () => {
      mockUseRouteError.mockReturnValue('something went wrong');

      expect(() => renderErrorBoundary()).not.toThrow();
    });
  });

  // ── 404 route error response ─────────────────────────────────────────────

  describe('RouteErrorResponse — 404', () => {
    it('renders a "Return to Events" link', () => {
      mockUseRouteError.mockReturnValue({
        status: 404,
        statusText: 'Not Found',
        data: 'Event not found',
      });

      const html = renderErrorBoundary();

      expect(html).toContain('href="/events"');
      expect(html).toContain('Return to Events');
    });

    it('includes the status code in the heading', () => {
      mockUseRouteError.mockReturnValue({
        status: 404,
        statusText: 'Not Found',
        data: null,
      });

      const html = renderErrorBoundary();

      expect(html).toContain('404');
    });
  });

  // ── 500 route error response ─────────────────────────────────────────────

  describe('RouteErrorResponse — 500', () => {
    it('renders a "Return to Events" link for server errors too', () => {
      mockUseRouteError.mockReturnValue({
        status: 500,
        statusText: 'Internal Server Error',
        data: { message: 'Something broke on the server' },
      });

      const html = renderErrorBoundary();

      expect(html).toContain('href="/events"');
      expect(html).toContain('500');
    });
  });

  // ── generic Error ─────────────────────────────────────────────────────────

  describe('generic JavaScript Error', () => {
    it('renders "An Unexpected Error" heading', () => {
      mockUseRouteError.mockReturnValue(new Error('Segfault in the matrix'));

      const html = renderErrorBoundary();

      expect(html).toContain('Unexpected Error');
    });

    it('renders the "Return to Events" link', () => {
      mockUseRouteError.mockReturnValue(new Error('Segfault in the matrix'));

      const html = renderErrorBoundary();

      expect(html).toContain('href="/events"');
      expect(html).toContain('Return to Events');
    });
  });
});
