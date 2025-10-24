-- Migration: Fix waiver refresh function conflict
-- Resolves the issue where two 027 migrations created conflicting function definitions
-- This ensures the SECURITY DEFINER version is used for proper permissions

-- Drop existing triggers
DROP TRIGGER IF EXISTS trigger_enrollments_refresh_waiver_status ON enrollments;
DROP TRIGGER IF EXISTS trigger_waiver_signatures_refresh_status ON waiver_signatures;
DROP TRIGGER IF EXISTS trigger_programs_refresh_waiver_status ON programs;
DROP TRIGGER IF EXISTS refresh_enrollment_waiver_status_on_signature ON waiver_signatures;

-- Drop existing functions (CASCADE will drop dependent objects)
DROP FUNCTION IF EXISTS refresh_enrollment_waiver_status() CASCADE;
DROP FUNCTION IF EXISTS trigger_refresh_enrollment_waiver_status() CASCADE;

-- Create the SECURITY DEFINER procedure to refresh the materialized view
-- This ensures the refresh has the necessary permissions
CREATE OR REPLACE FUNCTION refresh_enrollment_waiver_status_proc()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Refresh the materialized view with owner/superuser privileges
    -- Use CONCURRENTLY if the unique index exists
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY enrollment_waiver_status;
    EXCEPTION
        WHEN OTHERS THEN
            -- If concurrent refresh fails (e.g., no unique index), try regular refresh
            REFRESH MATERIALIZED VIEW enrollment_waiver_status;
    END;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the transaction
        -- This prevents cascade delete failures when the view doesn't exist
        RAISE WARNING 'Failed to refresh enrollment_waiver_status: %', SQLERRM;
END;
$$;

-- Create the trigger function that calls the SECURITY DEFINER procedure
CREATE OR REPLACE FUNCTION trigger_refresh_enrollment_waiver_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- Call the security definer procedure with explicit schema qualification
    -- This ensures the function is found even when called from auth.users cascade deletes
    PERFORM public.refresh_enrollment_waiver_status_proc();

    -- Return appropriate value for trigger
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Recreate all triggers using the corrected functions

-- Trigger on enrollments table
CREATE TRIGGER trigger_enrollments_refresh_waiver_status
    AFTER INSERT OR UPDATE OR DELETE ON enrollments
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_enrollment_waiver_status();

-- Trigger on waiver_signatures table
CREATE TRIGGER trigger_waiver_signatures_refresh_status
    AFTER INSERT OR UPDATE OR DELETE ON waiver_signatures
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_enrollment_waiver_status();

-- Trigger on programs table (when required_waiver_id changes)
CREATE TRIGGER trigger_programs_refresh_waiver_status
    AFTER UPDATE OF required_waiver_id ON programs
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_enrollment_waiver_status();

-- Add comments explaining the functions
COMMENT ON FUNCTION refresh_enrollment_waiver_status_proc() IS
    'SECURITY DEFINER procedure to refresh enrollment_waiver_status materialized view with elevated privileges. Used by triggers to ensure proper permissions when refreshing the view.';

COMMENT ON FUNCTION trigger_refresh_enrollment_waiver_status() IS
    'Trigger function that calls the SECURITY DEFINER refresh procedure when enrollment, waiver_signatures, or program data changes.';

-- Perform initial refresh of the materialized view
-- This populates the view created in migration 027
SELECT refresh_enrollment_waiver_status_proc();
