// IMPORTANT: This needs to mirror the logic in app/utils/supabase.server.ts
import {SupabaseClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {Database} from './database.types.ts';

export type EligibilityStatus = {
  eligible: boolean;
  reason: 'Trial' | 'Paid - Monthly' | 'Paid - Yearly' | 'Expired'; // More specific reasons
  lastPaymentDate?: string; // Optional: ISO date string of the last successful payment
  paymentType?: Database['public']['Enums']['payment_type_enum']; // Added payment type
};

// Configuration (consider making these env vars if they change often)
const MONTHLY_PAYMENT_ELIGIBILITY_WINDOW_DAYS = 35; // ~1 month + buffer
const YEARLY_PAYMENT_ELIGIBILITY_WINDOW_DAYS = 370; // ~1 year + buffer

export async function checkStudentEligibility(
  studentId: string,
  supabaseClient: SupabaseClient<Database>, // Use the passed client
): Promise<EligibilityStatus> {
  console.log(`Checking eligibility for student ID: ${studentId}`);

  // 1. Fetch successful payments linked to this student, ordered by date descending.
  //    We will filter by type *after* fetching to simplify the initial query.
  const { data: paymentLinks, error: linkError } = await supabaseClient
    .from('payment_students')
    .select(
      `                                                                                                                                                                                                        
            payment_id,                                                                                                                                                                                                  
            payments!inner ( id, payment_date, status, type )                                                                                                                                                            
        `,
    ) // Use !inner join syntax to ensure payment exists, select type
    .eq('student_id', studentId)
    .eq('payments.status', 'succeeded') // Keep filter for successful payments
    .order('payment_date', { foreignTable: 'payments', ascending: false }); // Get most recent first

  if (linkError) {
    console.error(
      `Error fetching successful payment links for student ${studentId}:`,
      linkError.message,
    );
    // Default to not eligible if we can't verify payments
    return { eligible: false, reason: 'Expired' }; // Use 'Expired'
  }

  // Filter out null payments and filter for the correct *type* here in the code
  const successfulGroupPayments = paymentLinks
    ?.map((link) => link.payments)
    .filter((payment) =>
      payment !== null &&
      payment.payment_date !== null &&
      payment.type !== null &&
      ['monthly_group', 'yearly_group'].includes(payment.type) // Filter for group types now
    ) as Array<{
      id: string;
      payment_date: string;
      status: string;
      type: Database['public']['Enums']['payment_type_enum'];
    }> ?? [];

  // 2. Check for Free Trial (zero successful group payments)
  if (successfulGroupPayments.length === 0) {
    console.log(`No successful group payment history for student ${studentId}. Status: Trial`);
    return { eligible: true, reason: 'Trial' };
  }

  // 3. Check the most recent group payment date against the appropriate eligibility window
  const mostRecentGroupPayment = successfulGroupPayments[0];
  const lastPaymentDate = new Date(mostRecentGroupPayment.payment_date);
  const paymentType = mostRecentGroupPayment.type;

  const today = new Date();
  let eligibilityCutoffDate = new Date(today);

  let reason: EligibilityStatus['reason'] = 'Expired'; // Default if checks fail
  let eligibilityWindowDays: number;

  if (paymentType === 'yearly_group') {
    eligibilityWindowDays = YEARLY_PAYMENT_ELIGIBILITY_WINDOW_DAYS;
    reason = 'Paid - Yearly';
  } else { // Default to monthly for 'monthly_group' (or any unexpected type that slipped through)
    eligibilityWindowDays = MONTHLY_PAYMENT_ELIGIBILITY_WINDOW_DAYS;
    reason = 'Paid - Monthly';
  }

  eligibilityCutoffDate.setDate(today.getDate() - eligibilityWindowDays);

  console.log(
    `Student ${studentId}: Last ${paymentType} payment date: ${mostRecentGroupPayment.payment_date}, Checking against cutoff: ${eligibilityCutoffDate.toISOString()}`,
  );

  if (lastPaymentDate >= eligibilityCutoffDate) {
    // Payment is recent enough
    console.log(`Student ${studentId}: Status: ${reason} (Active)`);
    return {
      eligible: true,
      reason: reason, // Use the determined reason
      lastPaymentDate: mostRecentGroupPayment.payment_date,
      paymentType: paymentType,
    };
  }

  // 4. If not on trial and the most recent group payment is outside the window
  console.log(
    `Student ${studentId}: Status: Expired (Last payment ${mostRecentGroupPayment.payment_date} is before cutoff ${eligibilityCutoffDate.toISOString()})`,
  );
  return {
    eligible: false,
    reason: 'Expired',
    lastPaymentDate: mostRecentGroupPayment.payment_date, // Still pass the date for context
    paymentType: paymentType,
  };
}
