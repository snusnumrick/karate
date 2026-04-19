import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoaderFunctionArgs } from '@remix-run/node';

const mockGetPrograms = vi.fn();
const mockGetInstructors = vi.fn();

vi.mock('~/utils/auth.server', () => ({
  withAdminLoader: (handler: (args: LoaderFunctionArgs) => unknown) => handler,
  withAdminAction: (handler: (args: LoaderFunctionArgs) => unknown) => handler,
}));

vi.mock('~/utils/csrf.server', () => ({
  csrf: { validate: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('~/services/program.server', () => ({
  getPrograms: (...args: unknown[]) => mockGetPrograms(...args),
}));

vi.mock('~/services/class.server', () => ({
  getInstructors: (...args: unknown[]) => mockGetInstructors(...args),
  createClass: vi.fn(),
  createClassSchedule: vi.fn(),
  getClassById: vi.fn(),
}));

vi.mock('~/utils/class-validation', () => ({
  validateClassConstraints: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
  getDefaultMaxCapacity: vi.fn().mockReturnValue(null),
  getSessionFrequencyDescription: vi.fn().mockReturnValue(''),
}));

import { loader } from '../admin.classes.new';

const seminarProgram = {
  id: 'prog-seminar-1',
  name: 'Summer Camp Seminar',
  description: 'Summer camp for all ages',
  engagement_type: 'seminar' as const,
  audience_scope: 'youth' as const,
  is_active: true,
  duration_minutes: 60,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

const regularProgram = {
  id: 'prog-1',
  name: 'Adults Karate',
  description: 'Regular program',
  engagement_type: 'program' as const,
  audience_scope: 'adults' as const,
  is_active: true,
  duration_minutes: 60,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetInstructors.mockResolvedValue([]);
});

describe('admin.classes.new loader engagement filtering', () => {
  it('filters programs to seminar type when engagement=seminar', async () => {
    mockGetPrograms.mockResolvedValue([seminarProgram]);

    const args = { request: new Request('http://localhost/admin/classes/new?engagement=seminar') } as unknown as LoaderFunctionArgs;
    const response = await (loader as Function)(args);
    const payload = await response.json();

    expect(mockGetPrograms).toHaveBeenCalledWith({ is_active: true, engagement_type: 'seminar' });
    expect(payload.engagement).toBe('seminar');
    expect(payload.programs).toHaveLength(1);
    expect(payload.programs[0].name).toBe('Summer Camp Seminar');
  });

  it('filters programs to program type by default', async () => {
    mockGetPrograms.mockResolvedValue([regularProgram]);

    const args = { request: new Request('http://localhost/admin/classes/new') } as unknown as LoaderFunctionArgs;
    const response = await (loader as Function)(args);
    const payload = await response.json();

    expect(mockGetPrograms).toHaveBeenCalledWith({ is_active: true, engagement_type: 'program' });
    expect(payload.engagement).toBe('program');
  });

  it('treats unknown engagement values as program', async () => {
    mockGetPrograms.mockResolvedValue([regularProgram]);

    const args = { request: new Request('http://localhost/admin/classes/new?engagement=unknown') } as unknown as LoaderFunctionArgs;
    const response = await (loader as Function)(args);
    const payload = await response.json();

    expect(mockGetPrograms).toHaveBeenCalledWith({ is_active: true, engagement_type: 'program' });
    expect(payload.engagement).toBe('program');
  });
});
