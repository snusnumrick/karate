import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';

const mockGetSupabaseServerClient = vi.fn();
const mockGetSupabaseAdminClient = vi.fn();
const mockCsrfValidate = vi.fn();
const mockGenerateWaiverPDF = vi.fn();
const mockGenerateWaiverFilename = vi.fn();
const mockUploadWaiverPDF = vi.fn();
const mockSendEmail = vi.fn();

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseServerClient: (...args: unknown[]) => mockGetSupabaseServerClient(...args),
  getSupabaseAdminClient: () => mockGetSupabaseAdminClient(),
}));

vi.mock('~/utils/csrf.server', () => ({
  csrf: {
    validate: (...args: unknown[]) => mockCsrfValidate(...args),
  },
}));

vi.mock('~/utils/waiver-pdf-generator.server', () => ({
  generateWaiverPDF: (...args: unknown[]) => mockGenerateWaiverPDF(...args),
  generateWaiverFilename: (...args: unknown[]) => mockGenerateWaiverFilename(...args),
}));

vi.mock('~/utils/waiver-storage.server', () => ({
  uploadWaiverPDF: (...args: unknown[]) => mockUploadWaiverPDF(...args),
}));

vi.mock('~/utils/email.server', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

import { action, loader } from '../_layout.family.waivers.$id.sign';

function createQuery(methods: Record<string, unknown>) {
  return methods;
}

describe('family waiver signer fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCsrfValidate.mockResolvedValue(undefined);
    mockGenerateWaiverPDF.mockResolvedValue(Buffer.from('pdf-data'));
    mockGenerateWaiverFilename.mockReturnValue('waiver.pdf');
    mockUploadWaiverPDF.mockResolvedValue('waivers/waiver.pdf');
    mockSendEmail.mockResolvedValue(undefined);
  });

  it('loader falls back to email prefix when no guardian row exists', async () => {
    const user = {
      id: 'user-1',
      email: 'fallback@example.com',
      user_metadata: {},
    };

    const tableQueries: Record<string, Array<Record<string, unknown>>> = {
      profiles: [
        createQuery({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { family_id: 'family-1', first_name: null, last_name: null, email: 'fallback@example.com' },
            error: null,
          }),
        }),
      ],
      guardians: [
        createQuery({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          }),
        }),
      ],
      waivers: [
        createQuery({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'waiver-1', title: 'General Waiver', content: 'terms' },
            error: null,
          }),
        }),
        createQuery({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { required_for_registration: true, required_for_trial: false },
            error: null,
          }),
        }),
      ],
      waiver_signatures: [
        createQuery({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          }),
        }),
      ],
      students: [
        createQuery({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: 'student-1', first_name: 'Ari', last_name: 'Kim' }],
            error: null,
          }),
        }),
      ],
    };

    const supabaseServer = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user } }),
      },
      from: vi.fn((table: string) => {
        const queue = tableQueries[table];
        if (!queue || queue.length === 0) {
          throw new Error(`No mock query configured for table ${table}`);
        }
        return queue.shift();
      }),
    };

    mockGetSupabaseServerClient.mockReturnValue({
      supabaseServer,
      response: new Response(),
    });

    const response = await loader({
      request: new Request('http://localhost/family/waivers/waiver-1/sign'),
      params: { id: 'waiver-1' },
    } as unknown as LoaderFunctionArgs);

    const payload = await response.json();
    expect(payload.firstName).toBe('fallback');
    expect(payload.lastName).toBe('');
    expect(payload.studentsNeedingWaiver).toHaveLength(1);
  });

  it('action uses fallback signer when guardian row is missing', async () => {
    const user = {
      id: 'user-1',
      email: 'fallback@example.com',
      user_metadata: {},
    };

    const supabaseServer = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user } }),
      },
    };

    const tableQueries: Record<string, Array<Record<string, unknown>>> = {
      waivers: [
        createQuery({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'waiver-1', title: 'General Waiver', content: 'terms' },
            error: null,
          }),
        }),
      ],
      profiles: [
        createQuery({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { family_id: 'family-1', first_name: null, last_name: null, email: 'fallback@example.com' },
            error: null,
          }),
        }),
      ],
      guardians: [
        createQuery({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          }),
        }),
      ],
      students: [
        createQuery({
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'student-1', first_name: 'Ari', last_name: 'Kim' }],
            error: null,
          }),
        }),
      ],
      waiver_signatures: [
        createQuery({
          insert: vi.fn().mockResolvedValue({ error: null }),
        }),
      ],
      families: [
        createQuery({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { email: null, name: 'Fallback Family' },
            error: null,
          }),
        }),
      ],
    };

    const supabaseAdmin = {
      from: vi.fn((table: string) => {
        const queue = tableQueries[table];
        if (!queue || queue.length === 0) {
          throw new Error(`No mock admin query configured for table ${table}`);
        }
        return queue.shift();
      }),
    };

    mockGetSupabaseServerClient.mockReturnValue({
      supabaseServer,
      response: new Response(),
    });
    mockGetSupabaseAdminClient.mockReturnValue(supabaseAdmin);

    const formData = new FormData();
    formData.set('signature', 'data:image/png;base64,abc');
    formData.set('agreement', 'on');
    formData.set('studentIds', JSON.stringify(['student-1']));

    const response = await action({
      request: new Request('http://localhost/family/waivers/waiver-1/sign', {
        method: 'POST',
        body: formData,
      }),
      params: { id: 'waiver-1' },
    } as unknown as ActionFunctionArgs);

    expect(mockGenerateWaiverPDF).toHaveBeenCalled();
    const pdfInput = mockGenerateWaiverPDF.mock.calls[0][0];
    expect(pdfInput.guardian).toMatchObject({
      firstName: 'fallback',
      lastName: '',
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/family/waivers');
  });
});
