-- Migration: Convert all DECIMAL monetary fields to INT4 cents storage
-- This migration standardizes all monetary values to be stored as integers in cents
-- to ensure precision and consistency across the application

-- Start transaction
BEGIN;

-- Temporarily disable triggers that might interfere with the migration
SET session_replication_role = replica;

-- 1. Programs table - convert fees from dollars to cents
ALTER TABLE programs 
  ADD COLUMN monthly_fee_cents INT4,
  ADD COLUMN registration_fee_cents INT4,
  ADD COLUMN individual_session_fee_cents INT4,
  ADD COLUMN yearly_fee_cents INT4;

-- Migrate existing data (multiply by 100 to convert dollars to cents)
UPDATE programs SET 
  monthly_fee_cents = COALESCE(ROUND(monthly_fee * 100), 0),
  registration_fee_cents = COALESCE(ROUND(registration_fee * 100), 0),
  individual_session_fee_cents = COALESCE(ROUND(individual_session_fee * 100), 0),
  yearly_fee_cents = COALESCE(ROUND(yearly_fee * 100), 0);

-- Set NOT NULL constraints and defaults
ALTER TABLE programs 
  ALTER COLUMN monthly_fee_cents SET NOT NULL,
  ALTER COLUMN monthly_fee_cents SET DEFAULT 0,
  ALTER COLUMN registration_fee_cents SET NOT NULL,
  ALTER COLUMN registration_fee_cents SET DEFAULT 0,
  ALTER COLUMN individual_session_fee_cents SET NOT NULL,
  ALTER COLUMN individual_session_fee_cents SET DEFAULT 0,
  ALTER COLUMN yearly_fee_cents SET NOT NULL,
  ALTER COLUMN yearly_fee_cents SET DEFAULT 0;

-- 2. Events table - convert fees from dollars to cents
ALTER TABLE events 
  ADD COLUMN registration_fee_cents INT4,
  ADD COLUMN late_registration_fee_cents INT4;

-- Migrate existing data
UPDATE events SET 
  registration_fee_cents = COALESCE(ROUND(registration_fee * 100), 0),
  late_registration_fee_cents = COALESCE(ROUND(late_registration_fee * 100), 0);

-- Set NOT NULL constraints and defaults
ALTER TABLE events 
  ALTER COLUMN registration_fee_cents SET NOT NULL,
  ALTER COLUMN registration_fee_cents SET DEFAULT 0,
  ALTER COLUMN late_registration_fee_cents SET DEFAULT 0;

-- 3. Event registrations table - convert payment amount
ALTER TABLE event_registrations 
  ADD COLUMN payment_amount_cents INT4;

-- Migrate existing data
UPDATE event_registrations SET 
  payment_amount_cents = COALESCE(ROUND(payment_amount * 100), 0);

-- Set default
ALTER TABLE event_registrations 
  ALTER COLUMN payment_amount_cents SET DEFAULT 0;

-- 4. Invoice entities table - convert credit limit
ALTER TABLE invoice_entities 
  ADD COLUMN credit_limit_cents INT4;

-- Migrate existing data
UPDATE invoice_entities SET 
  credit_limit_cents = COALESCE(ROUND(credit_limit * 100), 0);

-- Set default
ALTER TABLE invoice_entities 
  ALTER COLUMN credit_limit_cents SET DEFAULT 0;

-- 5. Invoices table - convert all monetary fields
ALTER TABLE invoices 
  ADD COLUMN subtotal_cents INT4,
  ADD COLUMN tax_amount_cents INT4,
  ADD COLUMN discount_amount_cents INT4,
  ADD COLUMN total_amount_cents INT4,
  ADD COLUMN amount_paid_cents INT4,
  ADD COLUMN amount_due_cents INT4;

-- Migrate existing data
UPDATE invoices SET 
  subtotal_cents = COALESCE(ROUND(subtotal * 100), 0),
  tax_amount_cents = COALESCE(ROUND(tax_amount * 100), 0),
  discount_amount_cents = COALESCE(ROUND(discount_amount * 100), 0),
  total_amount_cents = COALESCE(ROUND(total_amount * 100), 0),
  amount_paid_cents = COALESCE(ROUND(amount_paid * 100), 0),
  amount_due_cents = COALESCE(ROUND(amount_due * 100), 0);

-- Set NOT NULL constraints and defaults
ALTER TABLE invoices 
  ALTER COLUMN subtotal_cents SET NOT NULL,
  ALTER COLUMN subtotal_cents SET DEFAULT 0,
  ALTER COLUMN tax_amount_cents SET NOT NULL,
  ALTER COLUMN tax_amount_cents SET DEFAULT 0,
  ALTER COLUMN discount_amount_cents SET NOT NULL,
  ALTER COLUMN discount_amount_cents SET DEFAULT 0,
  ALTER COLUMN total_amount_cents SET NOT NULL,
  ALTER COLUMN total_amount_cents SET DEFAULT 0,
  ALTER COLUMN amount_paid_cents SET NOT NULL,
  ALTER COLUMN amount_paid_cents SET DEFAULT 0,
  ALTER COLUMN amount_due_cents SET NOT NULL,
  ALTER COLUMN amount_due_cents SET DEFAULT 0;

-- 6. Invoice line items table - convert monetary fields
ALTER TABLE invoice_line_items 
  ADD COLUMN unit_price_cents INT4,
  ADD COLUMN line_total_cents INT4,
  ADD COLUMN tax_amount_cents INT4,
  ADD COLUMN discount_amount_cents INT4;

-- Migrate existing data
UPDATE invoice_line_items SET 
  unit_price_cents = COALESCE(ROUND(unit_price * 100), 0),
  line_total_cents = COALESCE(ROUND(line_total * 100), 0),
  tax_amount_cents = COALESCE(ROUND(tax_amount * 100), 0),
  discount_amount_cents = COALESCE(ROUND(discount_amount * 100), 0);

-- Set NOT NULL constraints and defaults
ALTER TABLE invoice_line_items 
  ALTER COLUMN unit_price_cents SET NOT NULL,
  ALTER COLUMN line_total_cents SET NOT NULL,
  ALTER COLUMN tax_amount_cents SET DEFAULT 0,
  ALTER COLUMN discount_amount_cents SET DEFAULT 0;

-- 7. Invoice payments table - convert amount
ALTER TABLE invoice_payments 
  ADD COLUMN amount_cents INT4;

-- Migrate existing data
UPDATE invoice_payments SET 
  amount_cents = COALESCE(ROUND(amount * 100), 0);

-- Set NOT NULL constraint
ALTER TABLE invoice_payments 
  ALTER COLUMN amount_cents SET NOT NULL;

-- 8. Invoice template line items table - convert monetary fields
ALTER TABLE invoice_template_line_items 
  ADD COLUMN unit_price_cents INT4;

-- Migrate existing data
UPDATE invoice_template_line_items SET 
  unit_price_cents = COALESCE(ROUND(unit_price * 100), 0);

-- Set default
ALTER TABLE invoice_template_line_items 
  ALTER COLUMN unit_price_cents SET DEFAULT 0;

-- 9. Invoice line item taxes table - convert tax amount
ALTER TABLE invoice_line_item_taxes 
  ADD COLUMN tax_amount_cents INT4;

-- Migrate existing data
UPDATE invoice_line_item_taxes SET 
  tax_amount_cents = COALESCE(ROUND(tax_amount * 100), 0);

-- Set NOT NULL constraint and default
ALTER TABLE invoice_line_item_taxes 
  ALTER COLUMN tax_amount_cents SET NOT NULL,
  ALTER COLUMN tax_amount_cents SET DEFAULT 0;

-- 10. Add indexes for performance on new cents columns
CREATE INDEX IF NOT EXISTS idx_invoices_total_amount_cents ON invoices(total_amount_cents);
CREATE INDEX IF NOT EXISTS idx_invoices_amount_due_cents ON invoices(amount_due_cents);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_amount_cents ON invoice_payments(amount_cents);
CREATE INDEX IF NOT EXISTS idx_programs_monthly_fee_cents ON programs(monthly_fee_cents);

-- 11. Add comments to document the new columns
COMMENT ON COLUMN programs.monthly_fee_cents IS 'Monthly fee in cents (replaces monthly_fee DECIMAL)';
COMMENT ON COLUMN programs.registration_fee_cents IS 'Registration fee in cents (replaces registration_fee DECIMAL)';
COMMENT ON COLUMN programs.individual_session_fee_cents IS 'Individual session fee in cents (replaces individual_session_fee DECIMAL)';
COMMENT ON COLUMN programs.yearly_fee_cents IS 'Yearly fee in cents (replaces yearly_fee DECIMAL)';
COMMENT ON COLUMN events.registration_fee_cents IS 'Registration fee in cents (replaces registration_fee DECIMAL)';
COMMENT ON COLUMN events.late_registration_fee_cents IS 'Late registration fee in cents (replaces late_registration_fee DECIMAL)';
COMMENT ON COLUMN event_registrations.payment_amount_cents IS 'Payment amount in cents (replaces payment_amount DECIMAL)';
COMMENT ON COLUMN invoice_entities.credit_limit_cents IS 'Credit limit in cents (replaces credit_limit DECIMAL)';
COMMENT ON COLUMN invoices.subtotal_cents IS 'Subtotal in cents (replaces subtotal DECIMAL)';
COMMENT ON COLUMN invoices.tax_amount_cents IS 'Tax amount in cents (replaces tax_amount DECIMAL)';
COMMENT ON COLUMN invoices.discount_amount_cents IS 'Discount amount in cents (replaces discount_amount DECIMAL)';
COMMENT ON COLUMN invoices.total_amount_cents IS 'Total amount in cents (replaces total_amount DECIMAL)';
COMMENT ON COLUMN invoices.amount_paid_cents IS 'Amount paid in cents (replaces amount_paid DECIMAL)';
COMMENT ON COLUMN invoices.amount_due_cents IS 'Amount due in cents (replaces amount_due DECIMAL)';
COMMENT ON COLUMN invoice_line_items.unit_price_cents IS 'Unit price in cents (replaces unit_price DECIMAL)';
COMMENT ON COLUMN invoice_line_items.line_total_cents IS 'Line total in cents (replaces line_total DECIMAL)';
COMMENT ON COLUMN invoice_line_items.tax_amount_cents IS 'Tax amount in cents (replaces tax_amount DECIMAL)';
COMMENT ON COLUMN invoice_line_items.discount_amount_cents IS 'Discount amount in cents (replaces discount_amount DECIMAL)';
COMMENT ON COLUMN invoice_payments.amount_cents IS 'Payment amount in cents (replaces amount DECIMAL)';
COMMENT ON COLUMN invoice_template_line_items.unit_price_cents IS 'Unit price in cents (replaces unit_price DECIMAL)';
COMMENT ON COLUMN invoice_line_item_taxes.tax_amount_cents IS 'Tax amount in cents (replaces tax_amount DECIMAL)';

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Commit transaction
COMMIT;

-- Note: The old DECIMAL columns are kept for now to allow for rollback if needed
-- They can be dropped in a future migration after confirming the application works correctly
-- with the new INT4 cents columns.

-- To rollback this migration, run:
-- DROP INDEX IF EXISTS idx_invoices_total_amount_cents;
-- DROP INDEX IF EXISTS idx_invoices_amount_due_cents;
-- DROP INDEX IF EXISTS idx_invoice_payments_amount_cents;
-- DROP INDEX IF EXISTS idx_programs_monthly_fee_cents;
-- ALTER TABLE programs DROP COLUMN IF EXISTS monthly_fee_cents, DROP COLUMN IF EXISTS registration_fee_cents, DROP COLUMN IF EXISTS individual_session_fee_cents, DROP COLUMN IF EXISTS yearly_fee_cents;
-- ALTER TABLE events DROP COLUMN IF EXISTS registration_fee_cents, DROP COLUMN IF EXISTS late_registration_fee_cents;
-- ALTER TABLE event_registrations DROP COLUMN IF EXISTS payment_amount_cents;
-- ALTER TABLE invoice_entities DROP COLUMN IF EXISTS credit_limit_cents;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS subtotal_cents, DROP COLUMN IF EXISTS tax_amount_cents, DROP COLUMN IF EXISTS discount_amount_cents, DROP COLUMN IF EXISTS total_amount_cents, DROP COLUMN IF EXISTS amount_paid_cents, DROP COLUMN IF EXISTS amount_due_cents;
-- ALTER TABLE invoice_line_items DROP COLUMN IF EXISTS unit_price_cents, DROP COLUMN IF EXISTS line_total_cents, DROP COLUMN IF EXISTS tax_amount_cents, DROP COLUMN IF EXISTS discount_amount_cents;
-- ALTER TABLE invoice_payments DROP COLUMN IF EXISTS amount_cents;
-- ALTER TABLE invoice_template_line_items DROP COLUMN IF EXISTS unit_price_cents;
-- ALTER TABLE invoice_line_item_taxes DROP COLUMN IF EXISTS tax_amount_cents;