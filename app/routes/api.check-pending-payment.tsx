import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { getSupabaseAdminClient, getSupabaseServerClient } from '~/utils/supabase.server';

/**
 * API endpoint to check for existing pending payments
 * Used to proactively detect duplicates before user clicks "Proceed to Pay"
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer, response } = getSupabaseServerClient(request);

  // Check authentication
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) {
    return json(
      { error: 'Authentication required' },
      { status: 401, headers: response.headers }
    );
  }

  // Get query parameters
  const url = new URL(request.url);
  const familyId = url.searchParams.get('familyId');
  const typeParam = url.searchParams.get('type'); // monthly_group, yearly_group, or individual_session
  const studentIdsParam = url.searchParams.get('studentIds'); // comma-separated

  if (!familyId || !typeParam) {
    return json(
      { error: 'Missing required parameters: familyId, type' },
      { status: 400, headers: response.headers }
    );
  }

  // Validate type parameter
  const validTypes = ['monthly_group', 'yearly_group', 'individual_session', 'store_purchase', 'event_registration', 'other'];
  if (!validTypes.includes(typeParam)) {
    return json(
      { error: 'Invalid type parameter' },
      { status: 400, headers: response.headers }
    );
  }

  const type = typeParam as 'monthly_group' | 'yearly_group' | 'individual_session' | 'store_purchase' | 'event_registration' | 'other';

  // Verify user belongs to this family
  const { data: profileData, error: profileError } = await supabaseServer
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (profileError || profileData?.family_id !== familyId) {
    return json(
      { error: 'Access denied' },
      { status: 403, headers: response.headers }
    );
  }

  const studentIds = studentIdsParam ? studentIdsParam.split(',').filter(id => id) : [];

  // Check for duplicate pending payments (same logic as createInitialPaymentRecord)
  const oneHourAgo = new Date();
  oneHourAgo.setMinutes(oneHourAgo.getMinutes() - 60);

  const supabaseAdmin = getSupabaseAdminClient();

  const duplicatePaymentQuery = supabaseAdmin
    .from('payments')
    .select('id, created_at, total_amount, discount_code_id, discount_amount, type')
    .eq('family_id', familyId)
    .eq('type', type)
    .eq('status', 'pending')
    .gte('created_at', oneHourAgo.toISOString());

  // For group payments, check if students match
  if ((type === 'monthly_group' || type === 'yearly_group') && studentIds.length > 0) {
    const { data: recentPendingPayments } = await duplicatePaymentQuery;

    if (recentPendingPayments && recentPendingPayments.length > 0) {
      for (const pendingPayment of recentPendingPayments) {
        const { data: pendingStudents } = await supabaseAdmin
          .from('payment_students')
          .select('student_id')
          .eq('payment_id', pendingPayment.id);

        if (pendingStudents) {
          const pendingStudentIds = pendingStudents.map(ps => ps.student_id).sort();
          const currentStudentIds = [...studentIds].sort();

          if (pendingStudentIds.length === currentStudentIds.length &&
              pendingStudentIds.every((id, index) => id === currentStudentIds[index])) {
            // Found duplicate pending payment - fetch student names
            const { data: students } = await supabaseAdmin
              .from('students')
              .select('id, first_name, last_name')
              .in('id', pendingStudentIds);

            const studentNames = students?.map(s => `${s.first_name} ${s.last_name}`).join(', ') || '';

            return json({
              hasPendingPayment: true,
              paymentId: pendingPayment.id,
              createdAt: pendingPayment.created_at,
              totalAmount: pendingPayment.total_amount,
              discountAmount: pendingPayment.discount_amount,
              type: pendingPayment.type,
              studentNames
            }, { headers: response.headers });
          }
        }
      }
    }
  } else {
    // For non-group payments, just check family and type
    const { data: duplicatePayments } = await duplicatePaymentQuery.limit(1);

    if (duplicatePayments && duplicatePayments.length > 0) {
      const duplicate = duplicatePayments[0];
      return json({
        hasPendingPayment: true,
        paymentId: duplicate.id,
        createdAt: duplicate.created_at,
        totalAmount: duplicate.total_amount,
        discountAmount: duplicate.discount_amount,
        type: duplicate.type,
        studentNames: '' // Individual sessions don't have specific student names in this context
      }, { headers: response.headers });
    }
  }

  // No pending payment found
  return json({
    hasPendingPayment: false
  }, { headers: response.headers });
}
