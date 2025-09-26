-- Migration to clean up payment_amount column in event_registrations table
-- Note: payment_amount_cents already exists from migration 015_convert_decimal_to_int4_cents.sql
-- This migration removes the old payment_amount column since it's been replaced by payment_amount_cents

-- Check if payment_amount column still exists and drop it if it does
-- The payment_amount_cents column already exists and contains the migrated data
DO $$
BEGIN
    -- Check if payment_amount column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'event_registrations' 
        AND column_name = 'payment_amount'
        AND table_schema = 'public'
    ) THEN
        -- Drop the old payment_amount column since payment_amount_cents already exists
        ALTER TABLE event_registrations DROP COLUMN payment_amount;
        RAISE NOTICE 'Dropped payment_amount column from event_registrations table';
    ELSE
        RAISE NOTICE 'payment_amount column does not exist in event_registrations table - already cleaned up';
    END IF;
END $$;

-- Ensure payment_amount_cents has the correct type and default (should already be set from migration 015)
-- This is idempotent and safe to run even if already correct
ALTER TABLE event_registrations 
  ALTER COLUMN payment_amount_cents TYPE INT4,
  ALTER COLUMN payment_amount_cents SET DEFAULT 0;

-- Update comment to clarify the column stores values in cents
COMMENT ON COLUMN event_registrations.payment_amount_cents IS 'Payment amount stored in cents (e.g., 2599 for $25.99)';