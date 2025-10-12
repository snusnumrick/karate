import { getSupabaseAdminClient } from '~/utils/supabase.server';
import { fromCents, type Money } from '~/utils/money';
import { getCurrentDateTimeInTimezone } from '~/utils/misc';
import * as Sentry from '@sentry/remix';

// Types for enrollment-based payment system
export interface EnrollmentPaymentOption {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  programId: string;
  programName: string;
  classId: string;
  className: string;
  supportedPaymentTypes: PaymentType[];
  currentStatus: 'trial' | 'active_monthly' | 'active_yearly' | 'expired';
  monthlyAmount?: Money;
  yearlyAmount?: Money;
  individualSessionAmount?: Money;
  hasActiveSubscription: boolean;
  paidUntil?: string;
}

export interface StudentPaymentOptions {
  studentId: string;
  studentName: string;
  enrollments: EnrollmentPaymentOption[];
  hasAnyActiveSubscription: boolean;
}

export type PaymentType = 'trial' | 'individual_session' | 'monthly_subscription' | 'yearly_subscription';

// Helper function to get supported payment types for a program
export function getSupportedPaymentTypes(program: {
  monthly_fee_cents?: number | null;
  yearly_fee_cents?: number | null;
  individual_session_fee_cents?: number | null;
}): PaymentType[] {
  const supportedTypes: PaymentType[] = [];
  
  // Individual sessions should always be available if fee is set
  if (program.individual_session_fee_cents && program.individual_session_fee_cents > 0) {
    supportedTypes.push('individual_session');
  }
  
  if (program.monthly_fee_cents && program.monthly_fee_cents > 0) {
    supportedTypes.push('monthly_subscription');
  }
  
  if (program.yearly_fee_cents && program.yearly_fee_cents > 0) {
    supportedTypes.push('yearly_subscription');
  }
  
  return supportedTypes;
}

// Calculate payment amount for a specific enrollment
export function calculatePaymentAmount(
  enrollmentId: string,
  paymentType: PaymentType,
  program: {
    monthly_fee?: number | null;
    yearly_fee?: number | null;
    individual_session_fee?: number | null;
  },
  quantity: number = 1
): Money {
  switch (paymentType) {
    case 'trial':
      return fromCents(0);
    case 'individual_session':
      return fromCents((program.individual_session_fee || 0) * quantity);
    case 'monthly_subscription':
      return fromCents(program.monthly_fee || 0);
    case 'yearly_subscription':
      return fromCents(program.yearly_fee || 0);
    default:
      throw new Error(`Unsupported payment type: ${paymentType}`);
  }
}

// Get payment options for a specific student
export async function getStudentPaymentOptions(
  studentId: string,
  supabaseClient: ReturnType<typeof getSupabaseAdminClient>
): Promise<StudentPaymentOptions> {
  // Fetch student info
  const { data: student, error: studentError } = await supabaseClient
    .from('students')
    .select('id, first_name, last_name')
    .eq('id', studentId)
    .single();

  if (studentError || !student) {
    console.error(`[getStudentPaymentOptions] Failed to fetch student ${studentId}:`, studentError?.message);
    throw new Error(`Failed to fetch student: ${studentError?.message}`);
  }

  // Fetch active enrollments with program and class details
  const { data: enrollments_db, error: enrollmentsError } = await supabaseClient
    .from('enrollments')
    .select(`
      id,
      class_id,
      program_id,
      status,
      paid_until,
      class:classes(
        id,
        name,
        program:programs(
          id,
          name,
          monthly_fee_cents,
          yearly_fee_cents,
          individual_session_fee_cents
        )
      )
    `)
    .eq('student_id', studentId)
    .in('status', ['active', 'trial']);

  if (enrollmentsError) {
    console.error(`[getStudentPaymentOptions] Failed to fetch enrollments for student ${studentId}:`, enrollmentsError.message);
    throw new Error(`Failed to fetch enrollments: ${enrollmentsError.message}`);
  }

  // Validate enrollment data structure
  if (enrollments_db) {
    enrollments_db.forEach((enrollment) => {
      if (!enrollment.class) {
        console.warn(`[getStudentPaymentOptions] Enrollment ${enrollment.id} for student ${studentId} has no class reference`);
      } else if (!enrollment.class.program) {
        console.warn(`[getStudentPaymentOptions] Class ${enrollment.class_id} for enrollment ${enrollment.id} has no program reference`);
      }
    });
  }

  // Check for active subscriptions
  const thirtyTwoDaysAgo = getCurrentDateTimeInTimezone();
  thirtyTwoDaysAgo.setDate(thirtyTwoDaysAgo.getDate() - 32);

  const { data: activePayments, error: paymentsError } = await supabaseClient
    .from('payments')
    .select('id, type, status, payment_students!inner(student_id)')
    .eq('payment_students.student_id', studentId)
    .eq('status', 'succeeded')
    .in('type', ['monthly_group', 'yearly_group'])
    .gte('created_at', thirtyTwoDaysAgo.toISOString()); // Last 32 days

  if (paymentsError) {
    console.warn(`[getStudentPaymentOptions] Failed to fetch active payments for student ${studentId}:`, paymentsError.message);
  }

  const hasActiveMonthly = activePayments?.some(p => p.type === 'monthly_group') || false;
  const hasActiveYearly = activePayments?.some(p => p.type === 'yearly_group') || false;
  const hasAnyActiveSubscription = hasActiveMonthly || hasActiveYearly;

  // Process enrollments into payment options
  // Filter out enrollments with broken references first
  const validEnrollments = (enrollments_db || []).filter(enrollment_db => {
    if (!enrollment_db.class || !enrollment_db.class.program) {
      console.error(`[getStudentPaymentOptions] Skipping enrollment ${enrollment_db.id} due to broken class/program reference`);
      return false;
    }
    return true;
  });

  const enrollmentOptions: EnrollmentPaymentOption[] = validEnrollments.map(enrollment_db => {
    const program_db = enrollment_db.class.program;
    const supportedPaymentTypes = getSupportedPaymentTypes(program_db);

    // Determine current status
    let currentStatus: EnrollmentPaymentOption['currentStatus'];
    if (hasActiveYearly) {
      currentStatus = 'active_yearly';
    } else if (hasActiveMonthly) {
      currentStatus = 'active_monthly';
    } else if (enrollment_db.status === 'trial') {
      currentStatus = 'trial';
    } else {
      // Active enrollment without a recent payment is treated as expired for billing purposes
      currentStatus = 'expired';
    }

    return {
      enrollmentId: enrollment_db.id,
      studentId: studentId,
      studentName: `${student.first_name} ${student.last_name}`,
      programId: program_db.id,
      programName: program_db.name,
      classId: enrollment_db.class.id,
      className: enrollment_db.class.name,
      supportedPaymentTypes,
      currentStatus,
      monthlyAmount: program_db.monthly_fee_cents? fromCents(program_db.monthly_fee_cents) : undefined,
      yearlyAmount: program_db.yearly_fee_cents ? fromCents(program_db.yearly_fee_cents) : undefined,
      individualSessionAmount: program_db.individual_session_fee_cents ? fromCents(program_db.individual_session_fee_cents) : undefined,
      hasActiveSubscription: hasAnyActiveSubscription,
      paidUntil: (hasActiveYearly || hasActiveMonthly) ? (enrollment_db.paid_until || undefined) : undefined
    };
  });

  return {
    studentId,
    studentName: `${student.first_name} ${student.last_name}`,
    enrollments: enrollmentOptions,
    hasAnyActiveSubscription
  };
}

// Get payment options for all students in a family
export async function getFamilyPaymentOptions(
  familyId: string,
  supabaseClient: ReturnType<typeof getSupabaseAdminClient>
): Promise<StudentPaymentOptions[]> {
  console.log(`[getFamilyPaymentOptions] Fetching payment options for family ${familyId}`);

  // Fetch all students in the family
  const { data: students, error: studentsError } = await supabaseClient
    .from('students')
    .select('id')
    .eq('family_id', familyId);

  if (studentsError) {
    console.error(`[getFamilyPaymentOptions] Failed to fetch students for family ${familyId}:`, studentsError.message);
    throw new Error(`Failed to fetch family students: ${studentsError.message}`);
  }

  if (!students || students.length === 0) {
    console.warn(`[getFamilyPaymentOptions] No students found for family ${familyId}`);
    return [];
  }

  console.log(`[getFamilyPaymentOptions] Found ${students.length} students for family ${familyId}`);

  // Get payment options for each student, with resilient error handling
  const studentPaymentOptionsPromises = students.map(async (student) => {
    try {
      return await getStudentPaymentOptions(student.id, supabaseClient);
    } catch (error) {
      console.error(`[getFamilyPaymentOptions] Failed to get payment options for student ${student.id}:`, error instanceof Error ? error.message : String(error));

      // Capture in Sentry for tracking data issues
      Sentry.captureException(error, {
        tags: {
          familyId: familyId,
          studentId: student.id
        },
        level: 'warning', // Not critical - family page still loads with other students
        contexts: {
          studentLookup: {
            familyId: familyId,
            studentId: student.id,
            totalStudentsInFamily: students.length
          }
        }
      });

      // Return a minimal StudentPaymentOptions object instead of failing entirely
      return {
        studentId: student.id,
        studentName: 'Unknown Student',
        enrollments: [],
        hasAnyActiveSubscription: false,
      } as StudentPaymentOptions;
    }
  });

  const studentPaymentOptions = await Promise.all(studentPaymentOptionsPromises);

  // Filter out any failed student lookups (those with 'Unknown Student')
  const validOptions = studentPaymentOptions.filter(opt => opt.studentName !== 'Unknown Student');

  if (validOptions.length === 0 && studentPaymentOptions.length > 0) {
    console.error(`[getFamilyPaymentOptions] All student lookups failed for family ${familyId}`);
    // If all students failed, still return the partial data rather than throwing
  }

  return studentPaymentOptions;
}
