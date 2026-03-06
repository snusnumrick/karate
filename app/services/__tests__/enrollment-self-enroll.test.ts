import { beforeEach, describe, expect, it, vi } from 'vitest';
import { selfEnrollAdult } from '../enrollment.server';

function createMockSupabase({
  classRecord,
  profileRecord,
}: {
  classRecord: { data: unknown; error: unknown };
  profileRecord: { data: unknown; error: unknown };
}) {
  const classesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(classRecord),
  };

  const profilesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(profileRecord),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'classes') {
        return classesQuery;
      }
      if (table === 'profiles') {
        return profilesQuery;
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe('selfEnrollAdult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects enrollment when class is not self-enrollable', async () => {
    const supabase = createMockSupabase({
      classRecord: {
        data: { id: 'class-1', program_id: 'program-1', is_active: true, allow_self_enrollment: false },
        error: null,
      },
      profileRecord: {
        data: { id: 'profile-1', first_name: 'Pat', last_name: 'Lee', email: 'pat@example.com' },
        error: null,
      },
    });

    await expect(
      selfEnrollAdult('class-1', 'profile-1', {}, supabase as never, {
        getSelfRegistrantByProfileIdFn: vi.fn(),
        createSelfRegistrantFn: vi.fn(),
        enrollStudentFn: vi.fn(),
      })
    ).rejects.toThrow('does not allow self enrollment');
  });

  it('creates a self-registrant when missing and enrolls the adult student', async () => {
    const supabase = createMockSupabase({
      classRecord: {
        data: { id: 'class-1', program_id: 'program-1', is_active: true, allow_self_enrollment: true },
        error: null,
      },
      profileRecord: {
        data: { id: 'profile-1', first_name: null, last_name: null, email: 'adult@example.com' },
        error: null,
      },
    });

    const getSelfRegistrantByProfileIdFn = vi.fn().mockResolvedValue(null);
    const createSelfRegistrantFn = vi.fn().mockResolvedValue({
      family: { id: 'family-1' },
      student: { id: 'student-1' },
    });
    const enrollStudentFn = vi.fn().mockResolvedValue({ id: 'enrollment-1' });

    const result = await selfEnrollAdult(
      'class-1',
      'profile-1',
      { status: 'waitlist', notes: 'adult-self-flow' },
      supabase as never,
      { getSelfRegistrantByProfileIdFn, createSelfRegistrantFn, enrollStudentFn }
    );

    expect(createSelfRegistrantFn).toHaveBeenCalledWith(
      {
        profileId: 'profile-1',
        firstName: 'adult',
        lastName: 'Registrant',
        email: 'adult@example.com',
        phone: '',
      },
      supabase
    );
    expect(enrollStudentFn).toHaveBeenCalledWith(
      {
        class_id: 'class-1',
        student_id: 'student-1',
        program_id: 'program-1',
        status: 'waitlist',
        notes: 'adult-self-flow',
      },
      supabase
    );
    expect(result).toEqual({ id: 'enrollment-1' });
  });

  it('reuses an existing self-registrant and skips creation', async () => {
    const supabase = createMockSupabase({
      classRecord: {
        data: { id: 'class-1', program_id: 'program-1', is_active: true, allow_self_enrollment: true },
        error: null,
      },
      profileRecord: {
        data: { id: 'profile-1', first_name: 'Pat', last_name: 'Lee', email: 'pat@example.com' },
        error: null,
      },
    });

    const getSelfRegistrantByProfileIdFn = vi.fn().mockResolvedValue({
      family: { id: 'family-1' },
      student: { id: 'student-9' },
    });
    const createSelfRegistrantFn = vi.fn();
    const enrollStudentFn = vi.fn().mockResolvedValue({ id: 'enrollment-9' });

    await selfEnrollAdult(
      'class-1',
      'profile-1',
      {},
      supabase as never,
      { getSelfRegistrantByProfileIdFn, createSelfRegistrantFn, enrollStudentFn }
    );

    expect(createSelfRegistrantFn).not.toHaveBeenCalled();
    expect(enrollStudentFn).toHaveBeenCalledWith(
      {
        class_id: 'class-1',
        student_id: 'student-9',
        program_id: 'program-1',
        status: undefined,
        notes: undefined,
      },
      supabase
    );
  });
});

