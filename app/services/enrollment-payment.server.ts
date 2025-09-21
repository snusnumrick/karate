import { getSupabaseAdminClient } from '~/utils/supabase.server';
import { fromCents, type Money } from '~/utils/money';

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
  monthly_fee?: number | null;
  yearly_fee?: number | null;
  individual_session_fee?: number | null;
}): PaymentType[] {
  const supportedTypes: PaymentType[] = [];
  
  // Individual sessions should always be available if fee is set
  if (program.individual_session_fee && program.individual_session_fee > 0) {
    supportedTypes.push('individual_session');
  }
  
  if (program.monthly_fee && program.monthly_fee > 0) {
    supportedTypes.push('monthly_subscription');
  }
  
  if (program.yearly_fee && program.yearly_fee > 0) {
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
          monthly_fee,
          yearly_fee,
          individual_session_fee
        )
      )
    `)
    .eq('student_id', studentId)
    .eq('status', 'active');

  if (enrollmentsError) {
    throw new Error(`Failed to fetch enrollments: ${enrollmentsError.message}`);
  }

  // Check for active subscriptions
  const { data: activePayments, error: paymentsError } = await supabaseClient
    .from('payments')
    .select('id, type, status, payment_students!inner(student_id)')
    .eq('payment_students.student_id', studentId)
    .eq('status', 'succeeded')
    .in('type', ['monthly_group', 'yearly_group'])
    .gte('created_at', new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString()); // Last 32 days

  if (paymentsError) {
    console.warn('Failed to fetch active payments:', paymentsError.message);
  }

  const hasActiveMonthly = activePayments?.some(p => p.type === 'monthly_group') || false;
  const hasActiveYearly = activePayments?.some(p => p.type === 'yearly_group') || false;
  const hasAnyActiveSubscription = hasActiveMonthly || hasActiveYearly;

  // Process enrollments into payment options
  const enrollmentOptions: EnrollmentPaymentOption[] = (enrollments_db || []).map(enrollment_db => {
    const program_db = enrollment_db.class.program;
    const supportedPaymentTypes = getSupportedPaymentTypes(program_db);

    // Determine current status
    let currentStatus: EnrollmentPaymentOption['currentStatus'] = 'trial';
    if (hasActiveYearly) {
      currentStatus = 'active_yearly';
    } else if (hasActiveMonthly) {
      currentStatus = 'active_monthly';
    } else {
      // Check if subscription expired (simplified logic)
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
      monthlyAmount: program_db.monthly_fee? fromCents(program_db.monthly_fee) : undefined,
      yearlyAmount: program_db.yearly_fee ? fromCents(program_db.yearly_fee) : undefined,
      individualSessionAmount: program_db.individual_session_fee ? fromCents(program_db.individual_session_fee) : undefined,
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
  // Fetch all students in the family
  const { data: students, error: studentsError } = await supabaseClient
    .from('students')
    .select('id')
    .eq('family_id', familyId);

  if (studentsError) {
    throw new Error(`Failed to fetch family students: ${studentsError.message}`);
  }

  // Get payment options for each student
  const studentPaymentOptions = await Promise.all(
    (students || []).map(student => getStudentPaymentOptions(student.id, supabaseClient))
  );

  return studentPaymentOptions;
}