import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { getSupabaseServerClient } from '~/utils/supabase.server';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { supabaseClient, response } = getSupabaseServerClient(request);
  const studentId = params.studentId;

  if (!studentId) {
    return json({ error: 'Student ID is required' }, { status: 400, headers: response.headers });
  }

  try {
    // Check if user has access to this student (same family)
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return json({ error: 'Authentication required' }, { status: 401, headers: response.headers });
    }

    // Get user's family ID
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData?.family_id) {
      return json({ error: 'User family not found' }, { status: 404, headers: response.headers });
    }

    // Get student's family ID and verify access
    const { data: studentData, error: studentError } = await supabaseClient
      .from('students')
      .select('family_id')
      .eq('id', studentId)
      .single();

    if (studentError || !studentData) {
      return json({ error: 'Student not found' }, { status: 404, headers: response.headers });
    }

    // Verify user has access to this student
    if (studentData.family_id !== profileData.family_id) {
      return json({ error: 'Access denied' }, { status: 403, headers: response.headers });
    }

    return json({ familyId: studentData.family_id }, { headers: response.headers });
  } catch (error) {
    console.error('Error fetching student family:', error);
    return json(
      { error: 'Failed to fetch student family information' },
      { status: 500, headers: response.headers }
    );
  }
}