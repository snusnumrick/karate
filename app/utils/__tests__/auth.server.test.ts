import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  getOptionalSession,
  getOptionalUser,
  withAdminLoader,
  withFamilyLoader,
  withInstructorLoader,
  withUserLoader,
} from '../auth.server';

const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockGetUserRole = vi.fn();

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseServerClient: vi.fn(() => ({
    supabaseServer: {
      auth: {
        getUser: () => mockGetUser(),
        getSession: () => mockGetSession(),
      },
    },
    response: new Response(),
  })),
  getUserRole: (...args: unknown[]) => mockGetUserRole(...args),
}));

function buildRequest(path: string) {
  return new Request(`https://example.test${path}`);
}

function mockSignedInUser(userId = 'user-1') {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

describe('auth wrapper contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('getOptionalUser clears stale auth cookies when refresh token lookup fails', async () => {
    mockGetUser.mockRejectedValue({
      code: 'refresh_token_not_found',
      message: 'Invalid Refresh Token: Refresh Token Not Found',
    });

    const request = new Request('https://example.test/', {
      headers: {
        cookie: 'sb-example-auth-token=stale-token',
      },
    });

    const result = await getOptionalUser(request);

    expect(result.user).toBeNull();
    expect(result.clearedInvalidSession).toBe(true);
    expect(result.response.headers.get('Set-Cookie')).toContain('sb-example-auth-token=');
  });

  it('getOptionalSession clears stale auth cookies when refresh token lookup fails', async () => {
    mockGetSession.mockRejectedValue({
      code: 'refresh_token_not_found',
      message: 'Invalid Refresh Token: Refresh Token Not Found',
    });

    const request = new Request('https://example.test/', {
      headers: {
        cookie: 'sb-example-auth-token=stale-token',
      },
    });

    const result = await getOptionalSession(request);

    expect(result.session).toBeNull();
    expect(result.clearedInvalidSession).toBe(true);
    expect(result.response.headers.get('Set-Cookie')).toContain('sb-example-auth-token=');
  });

  it('withAdminLoader redirects unauthenticated users to login with redirectTo', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const loader = withAdminLoader(async () => ({ ok: true }));

    try {
      await loader({ request: buildRequest('/admin/classes?tab=active') });
      throw new Error('Expected redirect response to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      const response = error as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe(
        '/login?redirectTo=%2Fadmin%2Fclasses%3Ftab%3Dactive'
      );
    }
  });

  it('withFamilyLoader redirects authenticated users with wrong role to root', async () => {
    mockSignedInUser('admin-1');
    mockGetUserRole.mockResolvedValue('admin');

    const loader = withFamilyLoader(async () => ({ ok: true }));

    try {
      await loader({ request: buildRequest('/family/calendar') });
      throw new Error('Expected redirect response to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      const response = error as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/');
    }
  });

  it('withInstructorLoader allows admin role passthrough', async () => {
    mockSignedInUser('admin-1');
    mockGetUserRole.mockResolvedValue('admin');

    const loader = withInstructorLoader(async ({ auth }) => auth.role);
    const role = await loader({ request: buildRequest('/instructor') });

    expect(role).toBe('admin');
  });

  it('withUserLoader injects userId for authenticated user', async () => {
    mockSignedInUser('family-1');

    const loader = withUserLoader(async ({ userId }) => userId);
    const userId = await loader({ request: buildRequest('/api/push/test') });

    expect(userId).toBe('family-1');
  });

  it('withAdminLoader injects auth payload for allowed role', async () => {
    mockSignedInUser('admin-1');
    mockGetUserRole.mockResolvedValue('admin');

    const loader = withAdminLoader(async ({ auth }) => ({
      role: auth.role,
      userId: auth.user.id,
    }));

    await expect(loader({ request: buildRequest('/admin/invoices') })).resolves.toEqual({
      role: 'admin',
      userId: 'admin-1',
    });
  });
});
