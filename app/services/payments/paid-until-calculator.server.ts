import { siteConfig } from '~/config/site';
import { getSupabaseAdminClient } from '~/utils/supabase.server';

type EnrollmentRecord = {
  id: string;
  student_id: string;
  paid_until: string | null;
  status: string;
};

type CalculationResult = {
  newPaidUntil: Date;
  reason: string;
  ruleApplied: 'grace_period' | 'attendance_credit' | 'default';
};

/**
 * Calculate the new paid_until date for an enrollment based on payment date and business rules.
 *
 * Business Rules (in order of precedence):
 * 1. Grace Period: If payment is within 7 days after expiration, extend from expiration date
 * 2. Attendance Credit: If student attended after expiration, extend from expiration date
 * 3. Default: Otherwise, extend from payment date
 *
 * @param enrollment - The enrollment record
 * @param paymentDate - The date payment was received
 * @param paymentType - Type of payment (monthly or yearly)
 * @returns Calculation result with new date, reason, and rule applied
 */
export async function calculatePaidUntil(
  enrollment: EnrollmentRecord,
  paymentDate: Date,
  paymentType: 'monthly_group' | 'yearly_group'
): Promise<CalculationResult> {
  const { gracePeriodDays, attendanceLookbackDays } = siteConfig.payment;

  // Work in UTC to avoid timezone issues
  const nowUTC = paymentDate;
  const currentPaidUntil = enrollment.paid_until ? new Date(enrollment.paid_until) : null;

  // If enrollment has no expiration or is not expired, use the future date
  if (currentPaidUntil && currentPaidUntil > nowUTC) {
    // Extend from the future date
    return extendPaidUntil(currentPaidUntil, paymentType,
      'default',
      'Extending from future paid_until date (not expired)');
  }

  // Calculate days since expiration (only if expired)
  const daysOverdue = currentPaidUntil
    ? Math.floor((nowUTC.getTime() - currentPaidUntil.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Rule 1: Grace Period - payment within grace period after expiration
  if (currentPaidUntil && daysOverdue >= 0 && daysOverdue <= gracePeriodDays) {
    return extendPaidUntil(currentPaidUntil, paymentType,
      'grace_period',
      `Within ${gracePeriodDays}-day grace period (${daysOverdue} days after expiration)`);
  }

  // Rule 2: Attendance Credit - student attended after expiration
  if (currentPaidUntil && daysOverdue > gracePeriodDays) {
    const attendanceDate = await checkAttendanceAfterExpiration(
      enrollment.student_id,
      currentPaidUntil,
      attendanceLookbackDays
    );

    if (attendanceDate) {
      return extendPaidUntil(currentPaidUntil, paymentType,
        'attendance_credit',
        `Student attended on ${attendanceDate.toISOString().split('T')[0]} after expiration on ${currentPaidUntil.toISOString().split('T')[0]}`);
    }
  }

  // Rule 3: Default - no grace period, no attendance credit
  // Extend from payment date (or now if no prior paid_until)
  const startDate = currentPaidUntil && daysOverdue > gracePeriodDays
    ? nowUTC
    : (currentPaidUntil || nowUTC);

  const reasonMessage = currentPaidUntil && daysOverdue > gracePeriodDays
    ? `Payment ${daysOverdue} days after expiration, outside grace period, no attendance recorded`
    : 'New enrollment or extending from current date';

  return extendPaidUntil(startDate, paymentType, 'default', reasonMessage);
}

/**
 * Check if a student attended any classes after their enrollment expired.
 * This is used to give attendance credit - if they showed up despite expired payment,
 * we extend from expiration date rather than penalizing them.
 *
 * @param studentId - The student's ID
 * @param expirationDate - The date enrollment expired
 * @param lookbackDays - How many days after expiration to check
 * @returns The earliest attendance date after expiration, or null if none found
 */
async function checkAttendanceAfterExpiration(
  studentId: string,
  expirationDate: Date,
  lookbackDays: number
): Promise<Date | null> {
  const supabaseAdmin = getSupabaseAdminClient();

  // Calculate the end of lookback window
  const lookbackUntil = new Date(expirationDate);
  lookbackUntil.setDate(lookbackUntil.getDate() + lookbackDays);

  // Query attendance records in the window after expiration
  const { data: attendance, error } = await supabaseAdmin
    .from('attendance')
    .select('class_sessions!inner(session_date)')
    .eq('student_id', studentId)
    .eq('status', 'present')
    .gte('class_sessions.session_date', expirationDate.toISOString().split('T')[0])
    .lte('class_sessions.session_date', lookbackUntil.toISOString().split('T')[0])
    .order('class_sessions(session_date)', { ascending: true })
    .limit(1);

  if (error) {
    console.error('[calculatePaidUntil] Error checking attendance:', error);
    return null;
  }

  if (attendance && attendance.length > 0) {
    // Type assertion since we know the join structure
    const sessionDate = (attendance[0].class_sessions as unknown as { session_date: string }).session_date;
    return new Date(sessionDate);
  }

  return null;
}

/**
 * Extend paid_until date by the appropriate duration based on payment type.
 * Uses UTC methods to avoid timezone conversion issues.
 *
 * @param startDate - The date to extend from
 * @param paymentType - Type of payment (monthly or yearly)
 * @param rule - Which business rule was applied
 * @param reason - Human-readable explanation
 * @returns Calculation result with new date and metadata
 */
function extendPaidUntil(
  startDate: Date,
  paymentType: 'monthly_group' | 'yearly_group',
  rule: CalculationResult['ruleApplied'],
  reason: string
): CalculationResult {
  const newPaidUntil = new Date(startDate);

  if (paymentType === 'monthly_group') {
    // Add 1 month using UTC to avoid timezone issues
    newPaidUntil.setUTCMonth(newPaidUntil.getUTCMonth() + 1);
  } else if (paymentType === 'yearly_group') {
    // Add 1 year using UTC
    newPaidUntil.setUTCFullYear(newPaidUntil.getUTCFullYear() + 1);
  } else {
    // For any other payment type, default to 1 month
    console.warn(`[calculatePaidUntil] Unknown payment type: ${paymentType}, defaulting to monthly`);
    newPaidUntil.setUTCMonth(newPaidUntil.getUTCMonth() + 1);
  }

  return {
    newPaidUntil,
    reason,
    ruleApplied: rule
  };
}
