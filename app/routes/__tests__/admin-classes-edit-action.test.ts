import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ActionFunctionArgs } from '@remix-run/node';

const mockDeleteClass = vi.fn();
const mockValidateCsrf = vi.fn();

vi.mock('~/utils/auth.server', () => ({
  withAdminLoader: (handler: (args: ActionFunctionArgs) => unknown) => handler,
  withAdminAction: (handler: (args: ActionFunctionArgs) => unknown) => handler,
}));

vi.mock('~/utils/csrf.server', () => ({
  csrf: { validate: (...args: unknown[]) => mockValidateCsrf(...args) },
}));

vi.mock('~/services/class.server', () => ({
  getClassById: vi.fn(),
  updateClass: vi.fn(),
  deleteClass: (...args: unknown[]) => mockDeleteClass(...args),
  getInstructors: vi.fn(),
  getClassSchedules: vi.fn(),
  updateClassSchedules: vi.fn(),
}));

vi.mock('~/services/program.server', () => ({
  getPrograms: vi.fn(),
}));

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { action } from '../admin.classes.$id.edit';

function makeDeleteRequest(isSeminar: boolean) {
  const formData = new FormData();
  formData.set('intent', 'delete');
  formData.set('is_seminar_view', isSeminar ? 'true' : 'false');

  return new Request('http://localhost/admin/classes/class-1/edit', {
    method: 'POST',
    body: formData,
  });
}

describe('admin class edit action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCsrf.mockResolvedValue(undefined);
    mockDeleteClass.mockResolvedValue(undefined);
  });

  it('deletes a seminar run and redirects back to seminars', async () => {
    const response = await (action as Function)({
      request: makeDeleteRequest(true),
      params: { id: 'class-1' },
    } satisfies Partial<ActionFunctionArgs>);

    expect(mockValidateCsrf).toHaveBeenCalledTimes(1);
    expect(mockDeleteClass).toHaveBeenCalledWith('class-1');
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/admin/classes?engagement=seminar');
  });
});
