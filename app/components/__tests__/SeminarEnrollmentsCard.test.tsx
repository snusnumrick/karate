import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SeminarEnrollmentsCard } from '~/components/SeminarEnrollmentsCard';

vi.mock('@remix-run/react', () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode; [key: string]: unknown }) => (
    <a href={typeof to === 'string' ? to : String(to)} {...props}>
      {children}
    </a>
  ),
}));

describe('SeminarEnrollmentsCard', () => {
  it('renders seminar date-only ranges without shifting a day earlier', () => {
    const html = renderToStaticMarkup(
      <SeminarEnrollmentsCard
        enrollments={[
          {
            id: 'enrollment-1',
            status: 'active',
            class: {
              id: 'series-1',
              name: 'July 6',
              series_start_on: '2026-07-06',
              series_end_on: '2026-07-10',
              series_session_quota: 5,
              program: {
                name: 'Karate Camps',
                engagement_type: 'seminar',
              },
            },
            student: {
              id: 'student-1',
              first_name: 'Eva',
              last_name: 'Osipova',
              is_adult: false,
            },
          },
        ]}
      />
    );

    expect(html).toContain('Karate Camps');
    expect(html).toContain('July 6');
    expect(html).toContain('Participant: Eva Osipova');
    expect(html).toContain('7/6/2026 - 7/10/2026');
    expect(html).not.toContain('7/5/2026 - 7/9/2026');
  });

  it('renders midnight timestamp ranges as date-only seminar dates', () => {
    const html = renderToStaticMarkup(
      <SeminarEnrollmentsCard
        enrollments={[
          {
            id: 'enrollment-1',
            status: 'active',
            class: {
              id: 'series-1',
              name: 'July 6',
              series_start_on: '2026-07-06T00:00:00.000Z',
              series_end_on: '2026-07-10T00:00:00.000Z',
              program: {
                name: 'Karate Camps',
                engagement_type: 'seminar',
              },
            },
            student: {
              id: 'student-1',
              first_name: 'Eva',
              last_name: 'Osipova',
              is_adult: false,
            },
          },
        ]}
      />
    );

    expect(html).toContain('7/6/2026 - 7/10/2026');
    expect(html).not.toContain('7/5/2026 - 7/9/2026');
  });
});
