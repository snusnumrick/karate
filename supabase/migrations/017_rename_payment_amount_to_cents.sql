-- Migration to rename payment_amount to payment_amount_cents in event_registrations table
-- The current payment_amount column already stores values in cents, so no conversion is needed

-- Rename the column from payment_amount to payment_amount_cents
ALTER TABLE event_registrations 
  RENAME COLUMN payment_amount TO payment_amount_cents;

-- Update the column to be INT4 type and set default
ALTER TABLE event_registrations 
  ALTER COLUMN payment_amount_cents TYPE INT4,
  ALTER COLUMN payment_amount_cents SET DEFAULT 0;

-- Add comment to clarify the column stores values in cents
COMMENT ON COLUMN event_registrations.payment_amount_cents IS 'Payment amount stored in cents (e.g., 2599 for $25.99)';