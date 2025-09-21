-- Migration: Convert discount_codes.discount_value from dollars to cents
-- This migration adds discount_value_cents column and migrates data from discount_value

-- Add discount_value_cents column to discount_codes table
ALTER TABLE discount_codes
ADD COLUMN discount_value_cents INT4;

-- Migrate data: convert dollars to cents (multiply by 100)
UPDATE discount_codes
SET discount_value_cents = COALESCE(ROUND(discount_value * 100), 0);

-- Set NOT NULL constraint and default value
ALTER TABLE discount_codes
ALTER COLUMN discount_value_cents SET NOT NULL,
ALTER COLUMN discount_value_cents SET DEFAULT 0;

-- Add comment to document the column
COMMENT ON COLUMN discount_codes.discount_value_cents IS 'Discount value in cents (replaces discount_value DECIMAL)';

-- Note: The old discount_value column is kept for backward compatibility
-- It can be dropped in a future migration after all code is updated

-- Rollback instructions (commented out):
-- ALTER TABLE discount_codes DROP COLUMN IF EXISTS discount_value_cents;