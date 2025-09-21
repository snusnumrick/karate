-- Migration: Rename stripe_payment_intent_id to generic payment_intent_id
-- Date: 2025-01-19
-- Description: 
--   - Renames stripe_payment_intent_id to payment_intent_id for provider neutrality
--   - Supports both Stripe and Square payment providers
--   - Preserves existing data during migration

-- Add the new generic payment_intent_id column
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS payment_intent_id text NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_payment_intent_id 
ON payments(payment_intent_id);

-- Copy existing data from stripe_payment_intent_id to payment_intent_id
UPDATE payments 
SET payment_intent_id = stripe_payment_intent_id 
WHERE stripe_payment_intent_id IS NOT NULL 
  AND payment_intent_id IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN payments.payment_intent_id IS 'Generic payment intent ID for all payment providers (Stripe, Square, etc.)';

-- Remove the old Stripe-specific column (only if all data has been migrated)
-- Note: We'll keep this commented for safety - uncomment after verifying migration
-- ALTER TABLE payments DROP COLUMN IF EXISTS stripe_payment_intent_id;

-- Verify migration success
DO $$
DECLARE
    unmigrated_count INTEGER;
BEGIN
    -- Check for records that have stripe_payment_intent_id but no payment_intent_id
    SELECT COUNT(*) INTO unmigrated_count
    FROM payments 
    WHERE stripe_payment_intent_id IS NOT NULL 
      AND payment_intent_id IS NULL;
    
    IF unmigrated_count > 0 THEN
        RAISE WARNING 'Migration incomplete: % records have stripe_payment_intent_id but no payment_intent_id', unmigrated_count;
    ELSE
        RAISE NOTICE 'Migration successful: All stripe_payment_intent_id values copied to payment_intent_id';
    END IF;
END $$;