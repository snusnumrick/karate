-- Add entity_type enum and update invoice_entities table

-- Create entity_type enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entity_type_enum') THEN
        CREATE TYPE entity_type_enum AS ENUM ('family', 'school', 'government', 'corporate', 'other');
    END IF;
END $$;

-- Update invoice_entities table to use the new enum
ALTER TABLE invoice_entities 
DROP CONSTRAINT IF EXISTS invoice_entities_entity_type_check;

ALTER TABLE invoice_entities 
ALTER COLUMN entity_type TYPE entity_type_enum USING entity_type::entity_type_enum;

-- Add comment for documentation
COMMENT ON TYPE entity_type_enum IS 'Enum for invoice entity types: family, school, government, corporate, other';