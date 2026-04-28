import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoaderFunctionArgs } from '@remix-run/node';

const mockGetProgramBySlug = vi.fn();
const mockGetSeminarWithSeries = vi.fn();

vi.mock('~/utils/auth.server', () => ({
  getOptionalUser: vi.fn().mockResolvedValue({
    supabaseServer: {},
    user: null,
    response: { headers: new Headers() },
  }),
  withAdminLoader: (h: unknown) => h,
  withAdminAction: (h: unknown) => h,
}));

vi.mock('~/services/program.server', () => ({
  getProgramBySlug: (...args: unknown[]) => mockGetProgramBySlug(...args),
  getSeminarWithSeries: (...args: unknown[]) => mockGetSeminarWithSeries(...args),
}));

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  }),
}));

import { loader } from '../_layout.curriculum.seminars.$slug._index';

const baseSeminar = {
  id: 'sem-1',
  name: 'Summer Camp',
  engagement_type: 'seminar' as const,
  audience_scope: 'youth' as const,
  description: 'Fun summer camp for kids',
  slug: 'summer-camp',
  is_active: true,
  classes: [],
  duration_minutes: 60,
  monthly_fee: null,
  registration_fee: null,
  yearly_fee: null,
  individual_session_fee: null,
  single_purchase_price: null,
  subscription_monthly_price: null,
  subscription_yearly_price: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

function makeLoaderArgs(slug: string) {
  return {
    request: new Request(`http://localhost/curriculum/seminars/${slug}`),
    params: { slug },
  } as unknown as LoaderFunctionArgs;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProgramBySlug.mockResolvedValue(null);
});

describe('seminar detail loader audience filtering', () => {
  it('returns youth seminar data without 404', async () => {
    mockGetSeminarWithSeries.mockResolvedValue({ ...baseSeminar, audience_scope: 'youth' });

    const response = await (loader as Function)(makeLoaderArgs('summer-camp'));

    expect(response.status).not.toBe(404);
    const payload = await response.json();
    expect(payload.seminar).not.toBeNull();
    expect(payload.seminar.name).toBe('Summer Camp');
  });

  it('returns adults seminar data without 404', async () => {
    mockGetSeminarWithSeries.mockResolvedValue({ ...baseSeminar, audience_scope: 'adults', slug: 'adult-seminar' });

    const response = await (loader as Function)(makeLoaderArgs('adult-seminar'));

    expect(response.status).not.toBe(404);
    const payload = await response.json();
    expect(payload.seminar).not.toBeNull();
  });

  it('returns mixed audience seminar data without 404', async () => {
    mockGetSeminarWithSeries.mockResolvedValue({ ...baseSeminar, audience_scope: 'mixed', slug: 'mixed-seminar' });

    const response = await (loader as Function)(makeLoaderArgs('mixed-seminar'));

    expect(response.status).not.toBe(404);
  });

  it('excludes inactive seminar series from the public detail payload', async () => {
    mockGetSeminarWithSeries.mockResolvedValue({
      ...baseSeminar,
      classes: [
        {
          id: 'inactive-series',
          name: 'August 3',
          is_active: false,
          allow_self_enrollment: true,
          registration_status: 'open',
        },
        {
          id: 'active-series',
          name: 'August 3',
          is_active: true,
          allow_self_enrollment: true,
          registration_status: 'open',
        },
      ],
    });

    const response = await (loader as Function)(makeLoaderArgs('summer-camp'));

    const payload = await response.json();
    expect(payload.seminar.classes.map((series: { id: string }) => series.id)).toEqual(['active-series']);
  });

  it('throws 404 when seminar not found', async () => {
    mockGetSeminarWithSeries.mockResolvedValue(null);

    await expect(
      (loader as Function)(makeLoaderArgs('does-not-exist'))
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws 404 for non-seminar engagement type', async () => {
    mockGetSeminarWithSeries.mockResolvedValue({ ...baseSeminar, engagement_type: 'program' });

    await expect(
      (loader as Function)(makeLoaderArgs('some-program'))
    ).rejects.toMatchObject({ status: 404 });
  });
});
