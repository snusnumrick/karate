// IMPORTANT: This needs to mirror the logic in app/utils/supabase.server.ts
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { differenceInDays } from 'https://esm.sh/date-fns@3.6.0'; // Use esm.sh and a specific recent version
import { Database } from './database.types.ts';

export type EligibilityStatus = {
  eligible: boolean;
  reason: 'Trial' | 'Paid' | 'Expired';
  lastPaymentDate?: string; // ISO date string
};

// Configuration (consider making these env vars if they change often)
const PAYMENT_VALIDITY_DAYS = 35; // How many days a payment keeps a student active

export async function checkStudentEligibility(
    studentId: string,
    supabaseClient: SupabaseClient<Database> // Use the passed client
): Promise<EligibilityStatus> {
    console.log(`Checking eligibility for student ID: ${studentId}`);

    // 1. Find the most recent *successful* payment for this student
    const { data: paymentData, error: paymentError } = await supabaseClient
        .from('payments')
        .select('payment_date, payment_students!inner(student_id)')
        .eq('payment_students.student_id', studentId)
        .eq('status', 'succeeded') // Only consider successful payments
        .order('payment_date', { ascending: false })
        .limit(1)
        .maybeSingle(); // Use maybeSingle to handle zero payments gracefully

    if (paymentError) {
        console.error(`Supabase error fetching payments for student ${studentId}:`, paymentError.message);
        // Decide how to handle DB errors - perhaps assume ineligible or throw?
        // For now, let's treat as 'Expired' but log the error.
        return { eligible: false, reason: 'Expired' };
    }

    // 2. Determine status based on payment data
    if (!paymentData || !paymentData.payment_date) {
        // No successful payment history found
        console.log(`No successful payment history for student ${studentId}. Status: Trial`);
        return { eligible: true, reason: 'Trial' }; // Eligible under trial period
    }

    // 3. Check if the last payment is within the validity period
    const lastPaymentDate = new Date(paymentData.payment_date);
    const today = new Date();
    const daysSinceLastPayment = differenceInDays(today, lastPaymentDate);

    console.log(`Student ${studentId}: Last payment date: ${paymentData.payment_date}, Days since: ${daysSinceLastPayment}`);

    if (daysSinceLastPayment <= PAYMENT_VALIDITY_DAYS) {
        // Payment is recent enough
        console.log(`Student ${studentId}: Status: Paid (Active)`);
        return { eligible: true, reason: 'Paid', lastPaymentDate: paymentData.payment_date };
    } else {
        // Payment has expired
        console.log(`Student ${studentId}: Status: Expired`);
        return { eligible: false, reason: 'Expired', lastPaymentDate: paymentData.payment_date };
    }
}