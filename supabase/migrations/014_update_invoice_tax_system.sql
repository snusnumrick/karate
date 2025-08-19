-- Migration: Update invoice tax system to use checkbox-based tax rates
-- This migration changes from percentage-based tax to multiple tax rate selection

-- Create junction table for invoice line item taxes
CREATE TABLE invoice_line_item_taxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_line_item_id UUID NOT NULL REFERENCES invoice_line_items(id) ON DELETE CASCADE,
    tax_rate_id UUID NOT NULL REFERENCES tax_rates(id) ON DELETE RESTRICT,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    -- Store snapshot of tax rate info for historical accuracy
    tax_name_snapshot TEXT NOT NULL,
    tax_rate_snapshot DECIMAL(5,4) NOT NULL,
    tax_description_snapshot TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(invoice_line_item_id, tax_rate_id)
);

-- Create indexes for performance
CREATE INDEX idx_invoice_line_item_taxes_line_item_id ON invoice_line_item_taxes(invoice_line_item_id);
CREATE INDEX idx_invoice_line_item_taxes_tax_rate_id ON invoice_line_item_taxes(tax_rate_id);

-- Migrate existing tax data from invoice_line_items to the new junction table
-- This will create entries in the junction table for line items that have tax_rate > 0
INSERT INTO invoice_line_item_taxes (
    invoice_line_item_id,
    tax_rate_id,
    tax_amount,
    tax_name_snapshot,
    tax_rate_snapshot,
    tax_description_snapshot
)
SELECT 
    ili.id,
    tr.id,
    ili.tax_amount,
    tr.name,
    ili.tax_rate,
    tr.description
FROM invoice_line_items ili
CROSS JOIN tax_rates tr
WHERE ili.tax_rate > 0 
  AND tr.is_active = true
  AND ABS(ili.tax_rate - tr.rate) < 0.0001; -- Match existing tax rates with small tolerance

-- Remove tax_rate and tax_amount columns from invoice_line_items
-- Note: We'll keep these for now and mark them as deprecated in comments
-- They can be removed in a future migration after ensuring all code is updated
COMMENT ON COLUMN invoice_line_items.tax_rate IS 'DEPRECATED: Use invoice_line_item_taxes table instead';
COMMENT ON COLUMN invoice_line_items.tax_amount IS 'DEPRECATED: Use invoice_line_item_taxes table instead';

-- Add RLS policies for the new table
ALTER TABLE invoice_line_item_taxes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view tax details for invoices they have access to
CREATE POLICY "Users can view invoice line item taxes for accessible invoices" 
ON invoice_line_item_taxes FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM invoice_line_items ili
        JOIN invoices i ON ili.invoice_id = i.id
        WHERE ili.id = invoice_line_item_taxes.invoice_line_item_id
        AND (
            -- Admin access
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
            OR
            -- Family access to their own invoices
            i.family_id = (
                SELECT family_id FROM profiles WHERE id = auth.uid()
            )
        )
    )
);

-- Policy: Admins can manage all invoice line item taxes
CREATE POLICY "Admins can manage invoice line item taxes" 
ON invoice_line_item_taxes FOR ALL 
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_invoice_line_item_taxes_updated_at
    BEFORE UPDATE ON invoice_line_item_taxes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a view to easily get tax breakdown for invoice line items
CREATE OR REPLACE VIEW invoice_line_item_tax_breakdown AS
SELECT 
    ili.id as line_item_id,
    ili.invoice_id,
    ili.description as line_item_description,
    ili.quantity,
    ili.unit_price,
    ili.line_total,
    COALESCE(tax_summary.total_tax_amount, 0) as total_tax_amount,
    COALESCE(tax_summary.tax_details, '[]'::json) as tax_details
FROM invoice_line_items ili
LEFT JOIN (
    SELECT 
        ilt.invoice_line_item_id,
        SUM(ilt.tax_amount) as total_tax_amount,
        json_agg(
            json_build_object(
                'tax_rate_id', ilt.tax_rate_id,
                'tax_name', ilt.tax_name_snapshot,
                'tax_rate', ilt.tax_rate_snapshot,
                'tax_amount', ilt.tax_amount,
                'tax_description', ilt.tax_description_snapshot
            )
        ) as tax_details
    FROM invoice_line_item_taxes ilt
    GROUP BY ilt.invoice_line_item_id
) tax_summary ON ili.id = tax_summary.invoice_line_item_id;

-- Grant appropriate permissions
GRANT SELECT ON invoice_line_item_tax_breakdown TO authenticated;
GRANT ALL ON invoice_line_item_taxes TO authenticated;