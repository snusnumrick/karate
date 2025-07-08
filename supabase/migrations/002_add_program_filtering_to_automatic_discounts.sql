-- Add program filtering to automatic discount system
-- This migration adds the ability to restrict automatic discount rules to specific programs

-- Add applicable_programs column to discount_automation_rules table
ALTER TABLE public.discount_automation_rules 
ADD COLUMN IF NOT EXISTS applicable_programs uuid[] NULL;

-- Add index for program filtering
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_automation_rules_programs') THEN
            CREATE INDEX idx_automation_rules_programs ON public.discount_automation_rules USING GIN (applicable_programs);
        END IF;
    END
$$;

-- Add foreign key constraint to ensure program IDs are valid
-- Note: We can't add a direct foreign key constraint on an array column,
-- so we'll add a trigger to validate the program IDs

-- Function to validate program IDs in applicable_programs array
CREATE OR REPLACE FUNCTION validate_applicable_programs()
RETURNS TRIGGER AS $$
BEGIN
    -- If applicable_programs is not null and not empty, validate all program IDs
    IF NEW.applicable_programs IS NOT NULL AND array_length(NEW.applicable_programs, 1) > 0 THEN
        -- Check if all program IDs exist and are active
        IF EXISTS (
            SELECT 1 
            FROM unnest(NEW.applicable_programs) AS program_id
            WHERE NOT EXISTS (
                SELECT 1 
                FROM public.programs p 
                WHERE p.id = program_id AND p.is_active = true
            )
        ) THEN
            RAISE EXCEPTION 'One or more program IDs in applicable_programs are invalid or inactive';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate program IDs
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1
                       FROM information_schema.triggers
                       WHERE trigger_name = 'validate_applicable_programs_trigger') THEN
            CREATE TRIGGER validate_applicable_programs_trigger
                BEFORE INSERT OR UPDATE
                ON public.discount_automation_rules
                FOR EACH ROW
            EXECUTE FUNCTION validate_applicable_programs();
        END IF;
    END
$$;

-- Add comment to document the new column
COMMENT ON COLUMN public.discount_automation_rules.applicable_programs IS 'Array of program IDs that this discount rule applies to. If NULL or empty, the rule applies to all programs.';

-- Update the existing automation rules to have NULL applicable_programs (applies to all programs)
-- This ensures backward compatibility
UPDATE public.discount_automation_rules 
SET applicable_programs = NULL 
WHERE applicable_programs IS NULL;