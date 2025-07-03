import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { requireApiAuth, requireApiRole } from '~/utils/api-auth.server';
import { DiscountService } from '~/services/discount.server';
import type { CreateDiscountCodeData, UpdateDiscountCodeData, PaymentTypeEnum } from '~/types/discount';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireApiAuth(request);
    requireApiRole(user, 'admin');
  } catch (error) {
    if (error instanceof Response) throw error;
    throw error;
  }

  try {
    const discountCodes = await DiscountService.getAllDiscountCodes();
    return json({ discountCodes });
  } catch (error) {
    console.error('Error fetching discount codes:', error);
    return json(
      { error: 'Failed to fetch discount codes' },
      { status: 500 }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  let user;
  try {
    user = await requireApiAuth(request);
    requireApiRole(user, 'admin');
  } catch (error) {
    if (error instanceof Response) throw error;
    throw error;
  }
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  try {
    switch (intent) {
      case 'create': {
        const createData: CreateDiscountCodeData = {
          code: formData.get('code') as string,
          name: formData.get('name') as string,
          description: formData.get('description') as string || undefined,
          discount_type: formData.get('discount_type') as 'fixed_amount' | 'percentage',
          discount_value: parseFloat(formData.get('discount_value') as string),
          usage_type: formData.get('usage_type') as 'one_time' | 'ongoing',
          max_uses: formData.get('max_uses') ? parseInt(formData.get('max_uses') as string) : undefined,
          applicable_to: formData.getAll('applicable_to') as PaymentTypeEnum[],
          scope: formData.get('scope') as 'per_student' | 'per_family',
          valid_from: formData.get('valid_from') as string || undefined,
          valid_until: formData.get('valid_until') as string || undefined,
        };

        // Validate required fields
        if (!createData.code || !createData.name || !createData.discount_type || 
            !createData.discount_value || !createData.usage_type || 
            !createData.applicable_to || createData.applicable_to.length === 0 || !createData.scope) {
          return json(
            { error: 'Missing required fields' },
            { status: 400 }
          );
        }

        // Validate discount value
        if (createData.discount_value <= 0) {
          return json(
            { error: 'Discount value must be greater than 0' },
            { status: 400 }
          );
        }

        // Validate percentage discount
        if (createData.discount_type === 'percentage' && createData.discount_value > 100) {
          return json(
            { error: 'Percentage discount cannot exceed 100%' },
            { status: 400 }
          );
        }

        const discountCode = await DiscountService.createDiscountCode(createData, user.id);
        return json({ discountCode, success: true });
      }

      case 'update': {
        const id = formData.get('id') as string;
        if (!id) {
          return json(
            { error: 'Discount code ID is required' },
            { status: 400 }
          );
        }

        const updateData: UpdateDiscountCodeData = {};
        
        if (formData.get('name')) updateData.name = formData.get('name') as string;
        if (formData.get('description')) updateData.description = formData.get('description') as string;
        if (formData.get('discount_value')) updateData.discount_value = parseFloat(formData.get('discount_value') as string);
        if (formData.get('max_uses')) updateData.max_uses = parseInt(formData.get('max_uses') as string);
        if (formData.get('is_active') !== null) updateData.is_active = formData.get('is_active') === 'true';
        if (formData.get('valid_until')) updateData.valid_until = formData.get('valid_until') as string;

        const discountCode = await DiscountService.updateDiscountCode(id, updateData);
        return json({ discountCode, success: true });
      }

      case 'deactivate': {
        const id = formData.get('id') as string;
        if (!id) {
          return json(
            { error: 'Discount code ID is required' },
            { status: 400 }
          );
        }

        await DiscountService.deactivateDiscountCode(id);
        return json({ success: true });
      }

      case 'delete': {
        const id = formData.get('id') as string;
        if (!id) {
          return json(
            { error: 'Discount code ID is required' },
            { status: 400 }
          );
        }

        await DiscountService.deleteDiscountCode(id);
        return json({ success: true });
      }

      case 'generate-code': {
        const prefix = formData.get('prefix') as string || '';
        const length = parseInt(formData.get('length') as string) || 8;
        
        const code = await DiscountService.generateUniqueCode(prefix, length);
        return json({ code });
      }

      default:
        return json(
          { error: 'Invalid intent' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in discount codes action:', error);
    return json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}