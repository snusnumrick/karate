-- Add family_id column to invoice_entities table
-- This allows family-type invoice entities to maintain a reference to the original family

ALTER TABLE invoice_entities 
ADD COLUMN family_id UUID REFERENCES families(id);

-- Add index for better query performance
CREATE INDEX idx_invoice_entities_family_id ON invoice_entities(family_id);

-- Add comment for documentation
COMMENT ON COLUMN invoice_entities.family_id IS 'Reference to the original family when entity_type is family';