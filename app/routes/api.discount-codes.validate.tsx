import { json, type ActionFunctionArgs } from '@remix-run/node';
import { getSupabaseServerClient } from '~/utils/supabase.server';
import { DiscountService } from '~/services/discount.server';
import type { ApplyDiscountRequest } from '~/types/discount';

export async function action({ request }: ActionFunctionArgs) {
  const { supabaseServer, response } = getSupabaseServerClient(request);
  
  // Check authentication
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) {
    return json(
      { error: 'Authentication required' },
      { status: 401, headers: response.headers }
    );
  }
  
  if (request.method !== 'POST') {
    return json(
      { error: 'Method not allowed' },
      { status: 405, headers: response.headers }
    );
  }

  try {
    const body = await request.json();
    const { code, family_id, student_id, subtotal_amount, applicable_to }: ApplyDiscountRequest = body;

    // Verify user belongs to this family
    const { data: profileData, error: profileError } = await supabaseServer
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single();

    if (profileError || profileData?.family_id !== family_id) {
      return json(
        { error: 'Access denied' },
        { status: 403, headers: response.headers }
      );
    }

    // Validate required fields
    if (!code || !family_id || !subtotal_amount || !applicable_to) {
      return json(
        { error: 'Missing required fields: code, family_id, subtotal_amount, applicable_to' },
        { status: 400, headers: response.headers }
      );
    }

    // Validate subtotal_amount
    if (typeof subtotal_amount !== 'number' || subtotal_amount <= 0) {
      return json(
        { error: 'Invalid subtotal amount' },
        { status: 400, headers: response.headers }
      );
    }

    // Validate applicable_to
    const validPaymentTypes = ['monthly_group', 'yearly_group', 'individual_session', 'store_purchase', 'other'];
    if (!validPaymentTypes.includes(applicable_to)) {
      return json(
        { error: 'Invalid applicable_to value' },
        { status: 400, headers: response.headers }
      );
    }

    const validationResult = await DiscountService.validateDiscountCode({
      code,
      family_id,
      student_id,
      subtotal_amount,
      applicable_to
    });

    return json(validationResult, { headers: response.headers });
  } catch (error) {
    console.error('Error validating discount code:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Failed to validate discount code' },
      { status: 500, headers: response.headers }
    );
  }
}