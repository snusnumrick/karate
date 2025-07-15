import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { getSupabaseServerClient } from '~/utils/supabase.server';
import { getStudentPaymentOptions, type StudentPaymentOptions } from '~/services/enrollment-payment.server';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { supabaseClient, response } = getSupabaseServerClient(request);
  const studentId = params.studentId;

  if (!studentId) {
    return json({ error: 'Student ID is required' }, { status: 400, headers: response.headers });
  }

  try {
    // Check if user has access to this student (same family)
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, { status: 401, headers: response.headers });
    }

    // Get user's family_id
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.family_id) {
      return json({ error: 'Failed to get user profile' }, { status: 500, headers: response.headers });
    }

    // Verify student belongs to the same family
    const { data: student, error: studentError } = await supabaseClient
      .from('students')
      .select('family_id')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return json({ error: 'Student not found' }, { status: 404, headers: response.headers });
    }

    if (student.family_id !== profile.family_id) {
      return json({ error: 'Access denied' }, { status: 403, headers: response.headers });
    }

    // Get payment options for the student
    const paymentOptions = await getStudentPaymentOptions(studentId, supabaseClient);

    return json(paymentOptions, { headers: response.headers });
  } catch (error) {
    console.error('Error fetching student payment options:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, { status: 500, headers: response.headers });
  }
}

export type StudentPaymentOptionsResponse = StudentPaymentOptions;