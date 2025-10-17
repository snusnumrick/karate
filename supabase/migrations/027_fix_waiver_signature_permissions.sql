-- Migration: Fix waiver signature permissions issue
-- This addresses the "must be owner of materialized view enrollment_waiver_status" error
-- The issue occurs because a trigger tries to refresh a materialized view with user permissions

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS refresh_enrollment_waiver_status_on_signature ON waiver_signatures;

-- Drop the existing function (it may have the wrong signature)
DROP FUNCTION IF EXISTS refresh_enrollment_waiver_status() CASCADE;

-- Create a simple procedure (not a trigger function) to refresh with elevated privileges
CREATE OR REPLACE FUNCTION refresh_enrollment_waiver_status_proc()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Refresh the materialized view with owner/superuser privileges
    REFRESH MATERIALIZED VIEW enrollment_waiver_status;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail
        RAISE WARNING 'Failed to refresh enrollment_waiver_status: %', SQLERRM;
END;
$$;

-- Create a trigger function that calls the procedure
CREATE OR REPLACE FUNCTION trigger_refresh_enrollment_waiver_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Call the security definer procedure
    PERFORM refresh_enrollment_waiver_status_proc();

    -- Return appropriate value for trigger
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Create the trigger using FOR EACH STATEMENT (more efficient)
CREATE TRIGGER refresh_enrollment_waiver_status_on_signature
    AFTER INSERT OR UPDATE OR DELETE ON waiver_signatures
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_enrollment_waiver_status();

-- Add comments explaining the functions
COMMENT ON FUNCTION refresh_enrollment_waiver_status_proc() IS 'Security definer procedure to refresh enrollment_waiver_status materialized view with elevated privileges.';
COMMENT ON FUNCTION trigger_refresh_enrollment_waiver_status() IS 'Trigger function that calls the security definer refresh procedure.';
