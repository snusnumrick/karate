import { describe, expect, it, vi } from 'vitest';
import { EnrollmentValidationError, validateAndPrepareEnrollment } from '../enrollment.server';

function buildSupabaseMock(familyId = 'fam_1', profileId = 'profile_1') {
  const studentsSingle = vi.fn().mockResolvedValue({ data: { family_id: familyId }, error: null });
  const profilesSingle = vi.fn().mockResolvedValue({ data: { id: profileId }, error: null });

  const studentsEq = vi.fn(() => ({ single: studentsSingle }));
  const studentsSelect = vi.fn(() => ({ eq: studentsEq }));

  const profilesLimit = vi.fn(() => ({ single: profilesSingle }));
  const profilesEq = vi.fn(() => ({ limit: profilesLimit }));
  const profilesSelect = vi.fn(() => ({ eq: profilesEq }));

  const from = vi.fn((table: string) => {
    if (table === 'students') {
      return { select: studentsSelect };
    }
    if (table === 'profiles') {
      return { select: profilesSelect };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { from };
}

describe('validateAndPrepareEnrollment', () => {
  it('returns pending_waivers when active enrollment is missing program waivers', async () => {
    const supabase = buildSupabaseMock();

    const result = await validateAndPrepareEnrollment(
      {
        class_id: 'class_1',
        student_id: 'student_1',
        program_id: 'program_1',
        status: 'active',
      },
      'enrollment',
      supabase as never,
      {
        validateEnrollmentFn: vi.fn().mockResolvedValue({
          is_valid: true,
          errors: [],
          warnings: [],
          capacity_available: true,
          meets_eligibility: true,
          age_appropriate: true,
          belt_requirements_met: true,
        }),
        checkScheduleConflictsFn: vi.fn().mockResolvedValue({
          hasConflicts: false,
          conflicts: [],
        }),
        getFamilyRegistrationWaiverStatusFn: vi.fn().mockResolvedValue({
          is_complete: true,
          missing_waivers: [],
        }),
        getProgramWaiverStatusFn: vi.fn().mockResolvedValue({
          is_complete: false,
          missing_waivers: [{ title: 'Program Waiver' }],
        }),
      }
    );

    expect(result.enrollmentStatus).toBe('pending_waivers');
  });

  it('uses re-enrollment specific registration-waiver message', async () => {
    const supabase = buildSupabaseMock();

    await expect(
      validateAndPrepareEnrollment(
        {
          class_id: 'class_1',
          student_id: 'student_1',
          program_id: 'program_1',
          status: 'active',
        },
        're-enrollment',
        supabase as never,
        {
          validateEnrollmentFn: vi.fn().mockResolvedValue({
            is_valid: true,
            errors: [],
            warnings: [],
            capacity_available: true,
            meets_eligibility: true,
            age_appropriate: true,
            belt_requirements_met: true,
          }),
          checkScheduleConflictsFn: vi.fn().mockResolvedValue({
            hasConflicts: false,
            conflicts: [],
          }),
          getFamilyRegistrationWaiverStatusFn: vi.fn().mockResolvedValue({
            is_complete: false,
            missing_waivers: [{ title: 'Family Waiver' }],
          }),
          getProgramWaiverStatusFn: vi.fn().mockResolvedValue({
            is_complete: true,
            missing_waivers: [],
          }),
        }
      )
    ).rejects.toThrow('Registration waivers must be signed before re-enrollment. Missing: Family Waiver');
  });

  it('throws EnrollmentValidationError with original validation payload', async () => {
    const supabase = buildSupabaseMock();
    const validationPayload = {
      is_valid: false,
      errors: ['Student is not eligible', 'Class is full'],
      warnings: ['Schedule overlap warning'],
      capacity_available: false,
      meets_eligibility: false,
      age_appropriate: true,
      belt_requirements_met: true,
    } as const;

    try {
      await validateAndPrepareEnrollment(
        {
          class_id: 'class_1',
          student_id: 'student_1',
          program_id: 'program_1',
          status: 'active',
        },
        'enrollment',
        supabase as never,
        {
          validateEnrollmentFn: vi.fn().mockResolvedValue(validationPayload),
          checkScheduleConflictsFn: vi.fn().mockResolvedValue({
            hasConflicts: false,
            conflicts: [],
          }),
          getFamilyRegistrationWaiverStatusFn: vi.fn(),
          getProgramWaiverStatusFn: vi.fn(),
        }
      );
      throw new Error('Expected EnrollmentValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(EnrollmentValidationError);
      const validationError = error as EnrollmentValidationError;
      expect(validationError.validation).toEqual(validationPayload);
      expect(validationError.message).toContain('Student is not eligible');
      expect(validationError.message).toContain('Class is full');
    }
  });

  it('moves enrollment to waitlist when capacity is unavailable', async () => {
    const supabase = buildSupabaseMock();

    const result = await validateAndPrepareEnrollment(
      {
        class_id: 'class_1',
        student_id: 'student_1',
        program_id: 'program_1',
        status: 'active',
      },
      'enrollment',
      supabase as never,
      {
        validateEnrollmentFn: vi.fn().mockResolvedValue({
          is_valid: true,
          errors: [],
          warnings: [],
          capacity_available: false,
          meets_eligibility: true,
          age_appropriate: true,
          belt_requirements_met: true,
        }),
        checkScheduleConflictsFn: vi.fn().mockResolvedValue({
          hasConflicts: false,
          conflicts: [],
        }),
        getFamilyRegistrationWaiverStatusFn: vi.fn().mockResolvedValue({
          is_complete: true,
          missing_waivers: [],
        }),
        getProgramWaiverStatusFn: vi.fn().mockResolvedValue({
          is_complete: true,
          missing_waivers: [],
        }),
      }
    );

    expect(result.enrollmentStatus).toBe('waitlist');
  });
});
