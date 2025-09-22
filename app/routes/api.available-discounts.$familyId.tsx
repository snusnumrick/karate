import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { DiscountService } from "~/services/discount.server";
import type { DiscountCode, PaymentTypeEnum } from "~/types/discount";
import type { ExtendedSupabaseClient } from "~/types/supabase-extensions";
import {calculatePercentage, type Money, formatMoney, compareMoney, toMoney} from "~/utils/money";

export interface AvailableDiscountCode extends DiscountCode {
  formatted_display: string; // "name discount [%|$] (description)"
}

export interface AvailableDiscountsResponse {
  discounts: AvailableDiscountCode[];
  error?: string;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { supabaseClient, supabaseServer, response } = getSupabaseServerClient(request);
  const familyId = params.familyId;

  if (!familyId) {
    return json({ discounts: [], error: "Family ID is required" }, { 
      status: 400, 
      headers: response.headers 
    });
  }

  try {
    // Get user to verify they have access to this family - use supabaseClient for auth
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return json({ discounts: [], error: "Authentication required" }, { 
        status: 401, 
        headers: response.headers 
      });
    }

    // Verify user belongs to this family or is an admin - use supabaseServer for data queries
    const { data: profileData, error: profileError } = await supabaseServer
      .from('profiles')
      .select('family_id, role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return json({ discounts: [], error: "Access denied" }, { 
        status: 403, 
        headers: response.headers 
      });
    }

    // Allow access if user is admin or belongs to the family
    const isAdmin = profileData?.role === 'admin';
    const belongsToFamily = profileData?.family_id === familyId;
    
    if (!isAdmin && !belongsToFamily) {
      return json({ discounts: [], error: "Access denied" }, { 
        status: 403, 
        headers: response.headers 
      });
    }

    // Get URL search params for filtering
    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId');
    const applicableTo = url.searchParams.get('applicableTo') as PaymentTypeEnum || 'monthly_group';
    const subtotalParam = url.searchParams.get('subtotalAmount');
    
    // toMoney handles all parsing including JSON strings
    const subtotalMoney = toMoney(subtotalParam);

    // Get all active discount codes
    const allDiscountCodes = await DiscountService.getActiveDiscountCodes();
    console.log(`Found ${allDiscountCodes.length} active discount codes.`);

    // Filter discount codes applicable to this family/student
    const applicableDiscounts: AvailableDiscountCode[] = [];

    for (const discount of allDiscountCodes) {
      console.log(`Checking discount code ${discount.code} (${discount.id})...`);

      // Check if discount is applicable to the payment type
      if (!discount.applicable_to.includes(applicableTo)) {
        // console.log(`  Discount is not applicable to ${applicableTo}.`);
        continue;
      }

      // Check scope restrictions
      if (discount.scope === 'per_student' && !studentId) {
        console.log(`  Discount is per-student but no student specified.`);
        continue; // Student-specific discount but no student specified
      }

      if (discount.scope === 'per_family' && studentId) {
        // Family discount can be used even if student is specified
      }

      // Check if discount is restricted to specific family/student
      if (discount.family_id && discount.family_id !== familyId) {
        console.log(`  Discount is restricted to family ${discount.family_id}.`);
        continue; // Discount is for a different family
      }

      if (discount.student_id && discount.student_id !== studentId) {
        console.log(`  Discount is restricted to student ${discount.student_id}.`);
        continue; // Discount is for a different student
      }

      // Check usage limits
      if (discount.max_uses && discount.current_uses >= discount.max_uses) {
        console.log(`  Discount has reached usage limit.`);
        continue; // Discount has reached usage limit
      }

      // Check if discount has already been used by this family/student for one-time discounts
      if (discount.usage_type === 'one_time') {
        console.log(`  Checking if discount has already been used...`);
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
          console.log(`  Discount has already been used.`);
          continue; // Already used by this family/student
        }
      }

      // Format display string: "name discount [%|$] (description)"
      const discountSymbol = discount.discount_type === 'percentage' ? '%' : '$';
      const discountValueDisplay = discount.discount_type === 'percentage' 
        ? (discount.discount_value as number).toString()
        : (formatMoney(discount.discount_value as Money));
      
      const formatted_display = `${discount.name} ${discountValueDisplay}${discountSymbol}${discount.description ? ` (${discount.description})` : ''}`;
      console.log(`  Discount is valid. Display: ${formatted_display}`);

      applicableDiscounts.push({
        ...discount,
        formatted_display
      });
    }

    // Sort by decreasing actual discount amount (most rewarding at top)
    const sortedDiscounts = applicableDiscounts.sort((a, b) => {

      const aDiscountAmount = a.discount_type === 'percentage' 
        ? calculatePercentage(subtotalMoney, a.discount_value as number)
        : a.discount_value as Money;
      
      const bDiscountAmount = b.discount_type === 'percentage'
        ? calculatePercentage(subtotalMoney, b.discount_value as number)
        : b.discount_value as Money;
      
      return compareMoney(bDiscountAmount, aDiscountAmount);
    });

    console.log(`Found ${sortedDiscounts.length} applicable discounts.`);

    return json({ discounts: sortedDiscounts }, { headers: response.headers });

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