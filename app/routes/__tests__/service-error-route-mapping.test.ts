import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loader as familyLoader } from '../api/v1/families.$familyId';
import { loader as studentLoader } from '../api/v1/students.$studentId';
import {
  createAuthorizationError,
  createNotFoundError,
  createPersistenceError,
  createValidationError,
} from '~/utils/service-errors.server';

const mockRequireApiAuth = vi.fn();
const mockRequireApiRole = vi.fn();
const mockGetFamilyDetails = vi.fn();
const mockGetStudentDetails = vi.fn();

vi.mock('~/utils/api-auth.server', () => ({
  requireApiAuth: (...args: unknown[]) => mockRequireApiAuth(...args),
  requireApiRole: (...args: unknown[]) => mockRequireApiRole(...args),
}));

vi.mock('~/services/family.server', () => ({
  getFamilyDetails: (...args: unknown[]) => mockGetFamilyDetails(...args),
}));

vi.mock('~/services/student.server', () => ({
  getStudentDetails: (...args: unknown[]) => mockGetStudentDetails(...args),
}));

function buildRequest(path: string) {
  return new Request(`https://example.test${path}`, {
    headers: { Authorization: 'Bearer test-token' },
  });
}

describe('route/API ServiceError status mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireApiAuth.mockResolvedValue({ id: 'admin-user' });
    mockRequireApiRole.mockResolvedValue(undefined);
  });

  it('maps validation errors to 400 in family API loader', async () => {
    mockGetFamilyDetails.mockRejectedValue(createValidationError('Invalid filter'));

    const response = await familyLoader({
      request: buildRequest('/api/v1/families/fam-1'),
      params: { familyId: 'fam-1' },
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid filter' });
  });

  it('maps authorization errors to 403 in student API loader', async () => {
    mockGetStudentDetails.mockRejectedValue(createAuthorizationError('Forbidden student access'));

    const response = await studentLoader({
      request: buildRequest('/api/v1/students/student-1'),
      params: { studentId: 'student-1' },
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden student access' });
  });

  it('maps not-found errors to 404 in family API loader', async () => {
    mockGetFamilyDetails.mockRejectedValue(createNotFoundError('Family not found'));

    const response = await familyLoader({
      request: buildRequest('/api/v1/families/fam-missing'),
      params: { familyId: 'fam-missing' },
    } as never);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Family not found' });
  });

  it('maps persistence errors to 500 in student API loader', async () => {
    mockGetStudentDetails.mockRejectedValue(createPersistenceError('Database unavailable'));

    const response = await studentLoader({
      request: buildRequest('/api/v1/students/student-500'),
      params: { studentId: 'student-500' },
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Database unavailable' });
  });
});
