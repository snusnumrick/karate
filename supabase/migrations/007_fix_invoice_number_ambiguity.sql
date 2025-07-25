-- Fix ambiguous column reference in generate_invoice_number function
-- The issue is that the function has a local variable named 'invoice_number' 
-- and also references the 'invoice_number' column from the table

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
    current_year VARCHAR(4);
    next_number INTEGER;
    new_invoice_number VARCHAR;  -- Renamed to avoid ambiguity
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    
    -- Get the next sequential number for this year
    -- Explicitly qualify the column reference with table name
    SELECT COALESCE(MAX(
        CASE 
            WHEN invoices.invoice_number ~ ('^INV-' || current_year || '-[0-9]+$')
            THEN CAST(SUBSTRING(invoices.invoice_number FROM LENGTH('INV-' || current_year || '-') + 1) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO next_number
    FROM invoices;
    
    -- Format: INV-YYYY-NNNN (e.g., INV-2025-0001)
    new_invoice_number := 'INV-' || current_year || '-' || LPAD(next_number::VARCHAR, 4, '0');
    
    RETURN new_invoice_number;
END;
$$ LANGUAGE plpgsql;