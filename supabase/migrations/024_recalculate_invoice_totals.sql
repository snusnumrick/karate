-- Migration: Recalculate all invoice totals to fix denormalized tax_amount and total_amount
-- This fixes invoices where the denormalized totals don't match the sum of line item taxes
-- Particularly important for invoices with multiple tax rates

-- Use the existing recalc_invoice_totals function to recalculate all invoices
DO $$
DECLARE
  invoice_rec RECORD;
  recalc_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting invoice totals recalculation...';

  FOR invoice_rec IN
    SELECT id, invoice_number
    FROM invoices
    WHERE status != 'cancelled'
    ORDER BY created_at
  LOOP
    PERFORM recalc_invoice_totals(invoice_rec.id);
    recalc_count := recalc_count + 1;

    -- Log progress every 100 invoices
    IF recalc_count % 100 = 0 THEN
      RAISE NOTICE 'Recalculated % invoices...', recalc_count;
    END IF;
  END LOOP;

  RAISE NOTICE 'Completed! Recalculated totals for % invoices.', recalc_count;
END $$;
