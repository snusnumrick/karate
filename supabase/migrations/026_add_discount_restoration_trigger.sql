-- Migration 026: Add discount restoration trigger for failed payments
-- This trigger automatically restores discount codes when payments fail,
-- allowing users to retry with the same discount.
--
-- Related to: PENDING_PAYMENT_FIXES.md
-- Created: 2025-10-16

-- ========================================
-- DISCOUNT CODE RESTORATION ON PAYMENT FAILURE
-- ========================================
-- When a payment fails, we need to restore the discount code usage
-- so the user can try again with the same discount.

CREATE OR REPLACE FUNCTION public.restore_discount_on_payment_failure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only proceed if payment transitioned to 'failed' and had a discount applied
    IF NEW.status = 'failed' AND OLD.status = 'pending' AND NEW.discount_code_id IS NOT NULL THEN

        -- Log the restoration for debugging
        RAISE NOTICE 'Restoring discount code % for failed payment %', NEW.discount_code_id, NEW.id;

        -- Decrement the usage count on the discount code
        UPDATE public.discount_codes
        SET current_uses = GREATEST(0, current_uses - 1),  -- Prevent negative usage
            updated_at = now()
        WHERE id = NEW.discount_code_id;

        -- Delete the usage record (CASCADE will handle this automatically)
        -- This allows the family/student to use the discount again
        DELETE FROM public.discount_code_usage
        WHERE payment_id = NEW.id;

        RAISE NOTICE 'Successfully restored discount code % (deleted usage record for payment %)', NEW.discount_code_id, NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger on payments table
DROP TRIGGER IF EXISTS trigger_restore_discount_on_payment_failure ON public.payments;
CREATE TRIGGER trigger_restore_discount_on_payment_failure
    AFTER UPDATE ON public.payments
    FOR EACH ROW
    WHEN (NEW.status = 'failed' AND OLD.status = 'pending' AND NEW.discount_code_id IS NOT NULL)
    EXECUTE FUNCTION public.restore_discount_on_payment_failure();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.restore_discount_on_payment_failure() TO service_role;

-- Add comments for documentation
COMMENT ON FUNCTION public.restore_discount_on_payment_failure IS 'Automatically restores discount code usage when a payment transitions from pending to failed. Allows users to retry payment with the same discount.';
COMMENT ON TRIGGER trigger_restore_discount_on_payment_failure ON public.payments IS 'Fires after a payment status changes to failed, restoring the associated discount code for reuse.';

-- ========================================
-- VERIFICATION QUERIES (for testing)
-- ========================================
-- To verify the trigger is installed:
-- SELECT * FROM pg_trigger WHERE tgname = 'trigger_restore_discount_on_payment_failure';
--
-- To test the trigger:
-- 1. Create a payment with a discount (status = 'pending')
-- 2. Note the discount_code.current_uses value
-- 3. UPDATE payments SET status = 'failed' WHERE id = '<payment_id>';
-- 4. Verify discount_code.current_uses decreased by 1
-- 5. Verify discount_code_usage record for that payment was deleted
