// IMPORTANT: This needs to mirror the logic in app/utils/supabase.server.ts
import {SupabaseClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {Database} from './database.types.ts';

export type EligibilityStatus = {
  eligible: boolean;
  reason: 'Trial' | 'Paid - Monthly' | 'Paid - Yearly' | 'Expired' | 'Not Enrolled'; // More specific reasons
  lastPaymentDate?: string; // Optional: ISO date string of the last successful payment
  paymentType?: Database['public']['Enums']['payment_type_enum']; // Added payment type
  paidUntil?: string;
};

// Configuration (consider making these env vars if they change often)
const MONTHLY_PAYMENT_ELIGIBILITY_WINDOW_DAYS = 35; // ~1 month + buffer
const YEARLY_PAYMENT_ELIGIBILITY_WINDOW_DAYS = 370; // ~1 year + buffer

export async function checkStudentEligibility(
  studentId: string,
  supabaseClient: SupabaseClient<Database>,
): Promise<EligibilityStatus> {
  console.log(`Checking eligibility for student ID: ${studentId}`);

  // 1. Fetch the student's active enrollments with their paid_until dates.
  const { data: enrollments, error } = await supabaseClient
    .from('enrollments')
    .select('paid_until, status')
    .eq('student_id', studentId)
    .in('status', ['active', 'trial']); // Check for active or trial enrollments

  if (error) {
    console.error(`Error fetching enrollments for student ${studentId}:`, error.message);
    return { eligible: false, reason: 'Expired' };
  }

  if (!enrollments || enrollments.length === 0) {
    console.log(`No active enrollments found for student ${studentId}.`);
    return { eligible: false, reason: 'Not Enrolled' };
  }

  // For simplicity, we'll check if *any* enrollment makes the student eligible.
  // A more complex system might need to check a specific enrollment (e.g., for a specific class).
  const today = new Date();
  let isEligible = false;
  let eligibilityReason: EligibilityStatus['reason'] = 'Expired';
  let paidUntil: string | undefined = undefined;

  for (const enrollment of enrollments) {
    if (enrollment.status === 'trial') {
        return { eligible: true, reason: 'Trial' };
    }

    if (enrollment.paid_until) {
      const paidUntilDate = new Date(enrollment.paid_until);
      if (paidUntilDate >= today) {
        isEligible = true;
        // This is a simplification. We don't know if the last payment was monthly or yearly.
        // We'll just say 'Paid'. A more complex system could store the last payment type on the enrollment.
        eligibilityReason = 'Paid - Monthly'; // Or 'Paid - Yearly' if you can determine it.
        paidUntil = enrollment.paid_until;
        break; // Found an eligible enrollment, no need to check others.
      }
    }
  }

  if (isEligible) {
    console.log(`Student ${studentId} is eligible. Reason: ${eligibilityReason}`);
    return { eligible: true, reason: eligibilityReason, paidUntil };
  } else {
    console.log(`Student ${studentId} is not eligible. No active enrollments are paid up.`);
    return { eligible: false, reason: 'Expired' };
  }
}
