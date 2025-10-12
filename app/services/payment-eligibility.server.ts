import { getSupabaseAdminClient , checkStudentEligibility } from '~/utils/supabase.server';
import {EligibilityStatus, StudentPaymentDetail} from '~/types/payment';
import {ZERO_MONEY} from "~/utils/money";
import {getFamilyPaymentOptions, type EnrollmentPaymentOption} from "~/services/enrollment-payment.server";
import { getCurrentDateTimeInTimezone } from '~/utils/misc';

// Types for the reusable payment eligibility service
export interface IndividualSessionInfo {
  totalPurchased: number;
  totalRemaining: number;
  purchases: Array<{
    id: string;
    purchaseDate: string;
    quantityPurchased: number;
    quantityRemaining: number;
  }>;
}



export interface PaymentEligibilityData {
  familyId: string;
  familyName?: string;
  studentPaymentDetails: StudentPaymentDetail[];
  hasAvailableDiscounts: boolean;
  error?: string;
}

/**
 * Fetches individual session information for a family
 */
export async function getFamilyIndividualSessions(
  familyId: string,
  supabaseClient: ReturnType<typeof getSupabaseAdminClient>
): Promise<IndividualSessionInfo> {
  try {
    const { data: sessionsData, error: sessionsError } = await supabaseClient
      .from('one_on_one_sessions')
      .select('id, purchase_date, quantity_purchased, quantity_remaining')
      .eq('family_id', familyId)
      .order('purchase_date', { ascending: false });

    if (sessionsError) {
      console.error('Failed to load individual sessions:', sessionsError.message);
      return {
        totalPurchased: 0,
        totalRemaining: 0,
        purchases: []
      };
    }

    const purchases = (sessionsData || []).map(session => ({
      id: session.id,
      purchaseDate: session.purchase_date,
      quantityPurchased: session.quantity_purchased,
      quantityRemaining: session.quantity_remaining
    }));

    const totalPurchased = purchases.reduce((sum, p) => sum + p.quantityPurchased, 0);
    const totalRemaining = purchases.reduce((sum, p) => sum + p.quantityRemaining, 0);

    return {
      totalPurchased,
      totalRemaining,
      purchases
    };
  } catch (error) {
    console.error('Unexpected error fetching individual sessions:', error);
    return {
      totalPurchased: 0,
      totalRemaining: 0,
      purchases: []
    };
  }
}

/**
 * Fetches payment eligibility data for a family
 * This function extracts the core logic from the family payment page loader
 * and makes it reusable for both family and student-specific payment pages
 */
export async function getFamilyPaymentEligibilityData(
  familyId: string,
  supabaseClient: ReturnType<typeof getSupabaseAdminClient>
): Promise<PaymentEligibilityData> {
  try {
    // 1. Fetch Family Name
    const { data: familyData, error: familyError } = await supabaseClient
      .from('families')
      .select('name')
      .eq('id', familyId)
      .single() as { data: { name: string | null } | null, error: Error };

    if (familyError || !familyData) {
      console.error('Payment Eligibility Error: Failed to load family name', familyError?.message);
      return {
        familyId,
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'Could not load family details.'
      };
    }
    const familyName: string = familyData.name!;

    // 2. Fetch Students for the Family
    const { data: studentsData, error: studentsError } = await supabaseClient
      .from('students')
      .select('id::text, first_name::text, last_name::text')
      .eq('family_id', familyId);

    if (studentsError) {
      console.error('Payment Eligibility Error: Failed to load students', studentsError.message);
      return {
        familyId,
        familyName,
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'Could not load student information.'
      };
    }
    
    if (!studentsData || studentsData.length === 0) {
      return {
        familyId,
        familyName,
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'No students found in this family.'
      };
    }
    const students = studentsData;

    // 3b. Load current program pricing for each student (monthly/yearly/individual)
    let studentPricingMap = new Map<string, EnrollmentPaymentOption[]>();
    try {
      const studentPaymentOptions = await getFamilyPaymentOptions(familyId, supabaseClient);
      studentPricingMap = new Map(
        studentPaymentOptions.map(option => [option.studentId, option.enrollments])
      );
    } catch (pricingError) {
      console.error('Payment Eligibility Error: Failed to load program pricing', pricingError);
    }

    // 3. Fetch Successful Payments for the Family
    const { data: paymentsData, error: paymentsError } = await supabaseClient
      .from('payments')
      .select('id, status')
      .eq('family_id', familyId)
      .eq('status', 'succeeded');

    if (paymentsError) {
      console.error('Payment Eligibility Error: Failed to load payments', paymentsError.message);
      return {
        familyId,
        familyName,
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'Could not load payment history.'
      };
    }
    const successfulPaymentIds = paymentsData?.map(p => p.id) || [];

    // 4. Fetch Payment-Student Links for Successful Payments
    let paymentStudentLinks: Array<{ student_id: string, payment_id: string }> = [];
    if (successfulPaymentIds.length > 0) {
      const { data: linksData, error: linksError } = await supabaseClient
        .from('payment_students')
        .select('student_id, payment_id')
        .in('payment_id', successfulPaymentIds) as {
        data: Array<{ student_id: string, payment_id: string }> | null,
        error: Error
      };

      if (linksError) {
        console.error('Payment Eligibility Error: Failed to load payment links', linksError.message);
        return {
          familyId,
          familyName,
          studentPaymentDetails: [],
          hasAvailableDiscounts: false,
          error: 'Could not load payment link history.'
        };
      }
      paymentStudentLinks = linksData || [];
    }

    // 5. Get individual sessions for the family
    const individualSessions = await getFamilyIndividualSessions(familyId, supabaseClient);

    // 6. Calculate Eligibility and Next Payment Details Per Student
    const studentPaymentDetails: StudentPaymentDetail[] = [];

    for (const student of students) {
      // Check current eligibility
      const eligibility : EligibilityStatus = await checkStudentEligibility(student.id, supabaseClient);

      // Determine next payment amount - using flat monthly rate
      const pastPaymentCount = paymentStudentLinks.filter(link => link.student_id === student.id).length;
      const enrollmentOptions = studentPricingMap.get(student.id) ?? [];
      const monthlyOption = enrollmentOptions.find(option => option.monthlyAmount);
      const yearlyOption = enrollmentOptions.find(option => option.yearlyAmount);
      const individualOption = enrollmentOptions.find(option => option.individualSessionAmount);

      const monthlyAmount = monthlyOption?.monthlyAmount ?? null;
      const yearlyAmount = yearlyOption?.yearlyAmount ?? null;
      const individualSessionAmount = individualOption?.individualSessionAmount ?? null;

      let nextPaymentAmount = monthlyAmount ?? yearlyAmount ?? individualSessionAmount ?? ZERO_MONEY;
      let nextPaymentTierLabel: string;
      if (monthlyAmount) {
        nextPaymentTierLabel = 'Monthly';
      } else if (yearlyAmount) {
        nextPaymentTierLabel = 'Yearly';
      } else if (individualSessionAmount) {
        nextPaymentTierLabel = 'Individual Session';
      } else {
        nextPaymentTierLabel = 'Monthly';
        nextPaymentAmount = ZERO_MONEY;
      }

      // Determine if group class payment is needed now
      // Trial students can make payment to upgrade, expired students need payment
      const needsPayment = eligibility.reason === 'Trial' || eligibility.reason === 'Expired';

      studentPaymentDetails.push({
        studentId: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        eligibility: eligibility,
        needsPayment: needsPayment,
        nextPaymentAmount,
        nextPaymentTierLabel,
        // nextPaymentPriceId: nextPaymentPriceId,
        pastPaymentCount: pastPaymentCount,
        individualSessions: individualSessions,
        monthlyAmount: monthlyAmount ?? undefined,
        yearlyAmount: yearlyAmount ?? undefined,
        individualSessionAmount: individualSessionAmount ?? undefined,
      });
    }

    // 7. Check for Available Discounts
    const { data: availableDiscountsData, error: discountsError } = await supabaseClient
      .from('discount_codes')
      .select('id')
      .eq('is_active', true)
      .or(`family_id.eq.${familyId},family_id.is.null`)
      .or('valid_until.is.null,valid_until.gte.' + getCurrentDateTimeInTimezone().toISOString())
      .limit(1);

    const hasAvailableDiscounts = !discountsError && availableDiscountsData && availableDiscountsData.length > 0;

    return {
      familyId,
      familyName,
      studentPaymentDetails,
      hasAvailableDiscounts
    };
  } catch (error) {
    console.error('Payment Eligibility Error: Unexpected error', error);
    return {
      familyId,
      studentPaymentDetails: [],
      hasAvailableDiscounts: false,
      error: 'An unexpected error occurred while loading payment information.'
    };
  }
}

/**
 * Fetches payment eligibility data for a specific student
 * This is useful for student-specific payment pages
 */
export async function getStudentPaymentEligibilityData(
  studentId: string,
  supabaseClient: ReturnType<typeof getSupabaseAdminClient>
): Promise<PaymentEligibilityData> {
  try {
    // 1. Fetch student and family information
    const { data: studentData, error: studentError } = await supabaseClient
      .from('students')
      .select('id, first_name, last_name, family_id')
      .eq('id', studentId)
      .single();

    if (studentError || !studentData) {
      console.error('Student Payment Eligibility Error: Failed to load student', studentError?.message);
      return {
        familyId: '',
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'Could not load student information.'
      };
    }

    const familyId = studentData.family_id;
    if (!familyId) {
      return {
        familyId: '',
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'Student is not associated with a family.'
      };
    }

    // 2. Get family payment eligibility data and filter for this student
    const familyData = await getFamilyPaymentEligibilityData(familyId, supabaseClient);
    
    if (familyData.error) {
      return familyData;
    }

    // 3. Filter student payment details for the specific student
    const studentPaymentDetails = familyData.studentPaymentDetails.filter(
      detail => detail.studentId === studentId
    );

    return {
      ...familyData,
      studentPaymentDetails
    };
  } catch (error) {
    console.error('Student Payment Eligibility Error: Unexpected error', error);
    return {
      familyId: '',
      studentPaymentDetails: [],
      hasAvailableDiscounts: false,
      error: 'An unexpected error occurred while loading student payment information.'
    };
  }
}

/**
 * Helper function to get family ID from user profile
 * This is commonly needed in loaders that use the payment eligibility service
 */
export async function getFamilyIdFromUser(
  userId: string,
  supabaseClient: ReturnType<typeof getSupabaseAdminClient>
): Promise<{ familyId: string | null; error?: string }> {
  try {
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('family_id')
      .eq('id', userId)
      .single() as { data: { family_id: string | null } | null, error: Error };

    if (profileError || !profileData?.family_id) {
      console.error('Failed to load profile or family_id', profileError?.message);
      return {
        familyId: null,
        error: 'Could not load your family information. Please try again.'
      };
    }

    return { familyId: profileData.family_id };
  } catch (error) {
    console.error('Unexpected error getting family ID from user', error);
    return {
      familyId: null,
      error: 'An unexpected error occurred while loading your family information.'
    };
  }
}
