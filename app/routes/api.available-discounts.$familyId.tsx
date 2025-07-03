import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { DiscountService } from "~/services/discount.server";
import type { DiscountCode, PaymentTypeEnum } from "~/types/discount";
import type { ExtendedSupabaseClient } from "~/types/supabase-extensions";

export interface AvailableDiscountCode extends DiscountCode {
  formatted_display: string; // "name discount [%|$] (description)"
}

export interface AvailableDiscountsResponse {
  discounts: AvailableDiscountCode[];
  error?: string;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const familyId = params.familyId;

  if (!familyId) {
    return json({ discounts: [], error: "Family ID is required" }, { 
      status: 400, 
      headers: response.headers 
    });
  }

  try {
    // Get user to verify they have access to this family
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) {
      return json({ discounts: [], error: "Authentication required" }, { 
        status: 401, 
        headers: response.headers 
      });
    }

    // Verify user belongs to this family
    const { data: profileData, error: profileError } = await supabaseServer
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single();

    if (profileError || profileData?.family_id !== familyId) {
      return json({ discounts: [], error: "Access denied" }, { 
        status: 403, 
        headers: response.headers 
      });
    }

    // Get URL search params for filtering
    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId');
    const applicableTo = url.searchParams.get('applicableTo') as PaymentTypeEnum || 'monthly_group';

    // Get all active discount codes
    const allDiscountCodes = await DiscountService.getActiveDiscountCodes();

    // Filter discount codes applicable to this family/student
    const applicableDiscounts: AvailableDiscountCode[] = [];

    for (const discount of allDiscountCodes) {
      // Check if discount is applicable to the payment type
      if (!discount.applicable_to.includes(applicableTo)) {
        continue;
      }

      // Check scope restrictions
      if (discount.scope === 'per_student' && !studentId) {
        continue; // Student-specific discount but no student specified
      }

      if (discount.scope === 'per_family' && studentId) {
        // Family discount can be used even if student is specified
      }

      // Check if discount is restricted to specific family/student
      if (discount.family_id && discount.family_id !== familyId) {
        continue; // Discount is for a different family
      }

      if (discount.student_id && discount.student_id !== studentId) {
        continue; // Discount is for a different student
      }

      // Check usage limits
      if (discount.max_uses && discount.current_uses >= discount.max_uses) {
        continue; // Discount has reached usage limit
      }

      // Check if discount has already been used by this family/student for one-time discounts
      if (discount.usage_type === 'one_time') {
        let query = (supabaseServer as ExtendedSupabaseClient)
          .from('discount_code_usage')
          .select('id')
          .eq('discount_code_id', discount.id)
          .eq('family_id', familyId);
        
        if (studentId) {
          query = query.eq('student_id', studentId);
        } else {
          query = query.is('student_id', null);
        }
        
        const { data: usageData, error: usageError } = await query.limit(1);

        if (usageError) {
          console.error('Error checking discount usage:', usageError);
          continue;
        }

        if (usageData && usageData.length > 0) {
          continue; // Already used by this family/student
        }
      }

      // Format display string: "name discount [%|$] (description)"
      const discountSymbol = discount.discount_type === 'percentage' ? '%' : '$';
      const discountValueDisplay = discount.discount_type === 'percentage' 
        ? discount.discount_value.toString()
        : discount.discount_value.toFixed(2);
      
      const formatted_display = `${discount.name} ${discountValueDisplay}${discountSymbol}${discount.description ? ` (${discount.description})` : ''}`;

      applicableDiscounts.push({
        ...discount,
        formatted_display
      });
    }

    return json({ discounts: applicableDiscounts }, { headers: response.headers });

  } catch (error) {
    console.error('Error fetching available discounts:', error);
    return json({ 
      discounts: [], 
      error: error instanceof Error ? error.message : 'Failed to fetch available discounts' 
    }, { 
      status: 500, 
      headers: response.headers 
    });
  }
}