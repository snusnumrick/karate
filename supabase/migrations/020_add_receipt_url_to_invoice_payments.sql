-- Add receipt_url to invoice_payments to mirror payments table
-- Allows linking to hosted receipts for invoice payments

ALTER TABLE invoice_payments
ADD COLUMN IF NOT EXISTS receipt_url VARCHAR NULL;

COMMENT ON COLUMN invoice_payments.receipt_url IS 'URL to hosted receipt for this invoice payment';

