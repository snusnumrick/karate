import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { getSupabaseServerClient } from '~/utils/supabase.server';
import { getStudentPaymentEligibilityData, type PaymentEligibilityData } from '~/services/payment-eligibility.server';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { supabaseClient, response } = getSupabaseServerClient(request);
  const studentId = params.studentId;

  if (!studentId) {
    return json({ 
      familyId: '',
      studentPaymentDetails: [],
      hasAvailableDiscounts: false,
      error: 'Student ID is required' 
    } as PaymentEligibilityData, { 
      status: 400, 
      headers: response.headers 
    });
  }

  try {
    // Check if user has access to this student (same family)
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return json({ 
        familyId: '',
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'Unauthorized' 
      } as PaymentEligibilityData, { 
        status: 401, 
        headers: response.headers 
      });
    }

    // Get user's family ID to verify access
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData?.family_id) {
      return json({ 
        familyId: '',
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'Could not verify user access' 
      } as PaymentEligibilityData, { 
        status: 403, 
        headers: response.headers 
      });
    }

    // Verify student belongs to user's family
    const { data: studentData, error: studentError } = await supabaseClient
      .from('students')
      .select('family_id')
      .eq('id', studentId)
      .single();

    if (studentError || !studentData) {
      return json({ 
        familyId: '',
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'Student not found' 
      } as PaymentEligibilityData, { 
        status: 404, 
        headers: response.headers 
      });
    }

    if (studentData.family_id !== profileData.family_id) {
      return json({ 
        familyId: '',
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'Access denied: Student does not belong to your family' 
      } as PaymentEligibilityData, { 
        status: 403, 
        headers: response.headers 
      });
    }

    // Get payment eligibility data for the student
    const paymentData = await getStudentPaymentEligibilityData(studentId, supabaseClient);
    
    return json(paymentData, { headers: response.headers });
  } catch (error) {
    console.error('Error in student payment eligibility API:', error);
    return json({ 
      familyId: '',
      studentPaymentDetails: [],
      hasAvailableDiscounts: false,
      error: 'Internal server error' 
    } as PaymentEligibilityData, { 
      status: 500, 
      headers: response.headers 
    });
  }
}