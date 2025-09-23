-- Migration: Add currency field to invoice_payments and update trigger for hybrid approach
-- This migration implements the hybrid approach for invoice payment system refactor

-- Step 1: Add currency field to invoice_payments table
ALTER TABLE invoice_payments 
ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'CAD';

-- Add comment to document the field
COMMENT ON COLUMN invoice_payments.currency IS 'Currency code (ISO 4217) for the payment amount';

-- Step 2: Update the trigger function (Safe Migration)
-- Update trigger to use amount_cents AND maintain decimal versions for safety
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
    invoice_subtotal_cents INTEGER;
    invoice_tax_amount_cents INTEGER;
    invoice_discount_amount_cents INTEGER;
    invoice_total_cents INTEGER;
    invoice_amount_paid_cents INTEGER;
BEGIN
    -- Calculate totals from line items (in cents)
    SELECT 
        COALESCE(SUM(line_total_cents), 0),
        COALESCE(SUM(tax_amount_cents), 0),
        COALESCE(SUM(discount_amount_cents), 0)
    INTO invoice_subtotal_cents, invoice_tax_amount_cents, invoice_discount_amount_cents
    FROM invoice_line_items 
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Calculate total amount in cents
    invoice_total_cents := invoice_subtotal_cents + invoice_tax_amount_cents - invoice_discount_amount_cents;
    
    -- Get amount paid in cents (using amount_cents field)
    SELECT COALESCE(SUM(amount_cents), 0)
    INTO invoice_amount_paid_cents
    FROM invoice_payments
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Update BOTH cents and decimal versions for safety during transition
    UPDATE invoices SET
        -- Primary cents fields (source of truth)
        subtotal_cents = invoice_subtotal_cents,
        tax_amount_cents = invoice_tax_amount_cents,
        discount_amount_cents = invoice_discount_amount_cents,
        total_amount_cents = invoice_total_cents,
        amount_paid_cents = invoice_amount_paid_cents,
        amount_due_cents = invoice_total_cents - invoice_amount_paid_cents,
        
        -- Decimal versions (for backward compatibility and safety)
        subtotal = invoice_subtotal_cents / 100.0,
        tax_amount = invoice_tax_amount_cents / 100.0,
        discount_amount = invoice_discount_amount_cents / 100.0,
        total_amount = invoice_total_cents / 100.0,
        amount_paid = invoice_amount_paid_cents / 100.0,
        amount_due = (invoice_total_cents - invoice_amount_paid_cents) / 100.0,
        
        updated_at = NOW()
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 3: Remove redundant amount field from invoice_payments
-- This field is redundant since we have amount_cents
ALTER TABLE invoice_payments DROP COLUMN IF EXISTS amount;

-- Add comment to document the migration
COMMENT ON TABLE invoice_payments IS 'Updated to use hybrid approach: currency field added, amount_cents is primary, redundant amount field removed';