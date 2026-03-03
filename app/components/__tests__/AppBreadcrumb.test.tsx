import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

// Mock @remix-run/react so Link renders without requiring a Router context.
// The critical thing under test is DOM structure, not routing behaviour.
vi.mock('@remix-run/react', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href: to, ...props }, children),
}));

// Mock breadcrumb UI primitives with predictable semantic HTML so the test
// is fast, stable, and not coupled to Radix/Shadcn internals.
vi.mock('~/components/ui/breadcrumb', () => ({
  Breadcrumb: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement('nav', { 'aria-label': 'breadcrumb', className }, children),
  BreadcrumbList: ({ children }: { children: React.ReactNode }) =>
    React.createElement('ol', null, children),
  BreadcrumbItem: ({ children }: { children: React.ReactNode }) =>
    React.createElement('li', null, children),
  // asChild is handled by Radix Slot in production; here just render children directly.
  BreadcrumbLink: ({ children, asChild: _asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    React.createElement(React.Fragment, null, children),
  BreadcrumbPage: ({ children }: { children: React.ReactNode }) =>
    React.createElement('span', { 'aria-current': 'page' }, children),
  BreadcrumbSeparator: () =>
    React.createElement('li', { 'aria-hidden': 'true', role: 'presentation' }, '/'),
}));

import { AppBreadcrumb } from '~/components/AppBreadcrumb';

// ─── helpers ────────────────────────────────────────────────────────────────

function render(ui: React.ReactElement) {
  return renderToStaticMarkup(ui);
}

/** Extract the innerHTML of the <ol> element from the rendered HTML string. */
function olContent(html: string): string {
  const match = html.match(/<ol[^>]*>([\s\S]*?)<\/ol>/);
  if (!match) throw new Error('No <ol> found in rendered HTML');
  return match[1];
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('AppBreadcrumb', () => {
  describe('DOM structure — regression for hydration bug', () => {
    it('renders no <div> inside <ol> (was the root cause of SSR hydration mismatch)', () => {
      const html = render(
        <AppBreadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Events', href: '/events' },
            { label: 'My Event', current: true },
          ]}
        />
      );
      const ol = olContent(html);
      expect(ol).not.toContain('<div');
    });

    it('contains only <li> elements as direct children of <ol>', () => {
      const html = render(
        <AppBreadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Page', current: true },
          ]}
        />
      );
      const ol = olContent(html);
      // Strip <li>...</li> content and verify nothing remains that isn't whitespace
      const withoutLis = ol.replace(/<li[\s\S]*?<\/li>/g, '').trim();
      expect(withoutLis).toBe('');
    });

    it('wraps each item + its separator in a Fragment, not a <div>', () => {
      // With N items there should be N item <li>s + (N-1) separator <li>s = 2N-1 total
      const items = [
        { label: 'A', href: '/a' },
        { label: 'B', href: '/b' },
        { label: 'C', current: true },
      ];
      const html = render(<AppBreadcrumb items={items} />);
      const ol = olContent(html);
      const liCount = (ol.match(/<li/g) || []).length;
      expect(liCount).toBe(2 * items.length - 1); // 3 items + 2 separators = 5
    });
  });

  describe('item variants', () => {
    it('renders current item as non-interactive <span aria-current="page">', () => {
      const html = render(
        <AppBreadcrumb items={[{ label: 'Current Page', current: true }]} />
      );
      expect(html).toContain('aria-current="page"');
      expect(html).toContain('Current Page');
      expect(html).not.toContain('<a ');
    });

    it('renders href item as an anchor link', () => {
      const html = render(
        <AppBreadcrumb items={[{ label: 'Home', href: '/home' }]} />
      );
      expect(html).toContain('href="/home"');
      expect(html).toContain('Home');
    });

    it('renders onClick item as a <button>', () => {
      const html = render(
        <AppBreadcrumb items={[{ label: 'Back', onClick: () => {} }]} />
      );
      expect(html).toContain('<button');
      expect(html).toContain('Back');
    });

    it('renders item with no href/onClick/current as non-interactive text', () => {
      const html = render(
        <AppBreadcrumb items={[{ label: 'Plain' }]} />
      );
      expect(html).toContain('Plain');
      expect(html).not.toContain('<a ');
      expect(html).not.toContain('<button');
    });
  });

  describe('separators', () => {
    it('renders no separator for a single item', () => {
      const html = render(
        <AppBreadcrumb items={[{ label: 'Only', current: true }]} />
      );
      expect(html).not.toContain('role="presentation"');
    });

    it('renders one separator between two items', () => {
      const html = render(
        <AppBreadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Page', current: true },
          ]}
        />
      );
      const separatorCount = (html.match(/role="presentation"/g) || []).length;
      expect(separatorCount).toBe(1);
    });

    it('renders N-1 separators for N items', () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        label: `Step ${i + 1}`,
        href: i < 4 ? `/step/${i + 1}` : undefined,
        current: i === 4,
      }));
      const html = render(<AppBreadcrumb items={items} />);
      const separatorCount = (html.match(/role="presentation"/g) || []).length;
      expect(separatorCount).toBe(4);
    });
  });

  describe('breadcrumbPatterns helpers', () => {
    it('eventDetail pattern produces correct structure', async () => {
      const { breadcrumbPatterns } = await import('~/components/AppBreadcrumb');
      const items = breadcrumbPatterns.eventDetail('Summer Tournament');
      expect(items).toHaveLength(3);
      expect(items[0]).toMatchObject({ label: 'Home', href: '/' });
      expect(items[1]).toMatchObject({ label: 'Upcoming Events', href: '/events' });
      expect(items[2]).toMatchObject({ label: 'Summer Tournament', current: true });
    });

    it('familyMessages pattern produces correct structure', async () => {
      const { breadcrumbPatterns } = await import('~/components/AppBreadcrumb');
      const items = breadcrumbPatterns.familyMessages();
      expect(items).toHaveLength(2);
      expect(items[1]).toMatchObject({ label: 'Messages', current: true });
    });
  });
});
