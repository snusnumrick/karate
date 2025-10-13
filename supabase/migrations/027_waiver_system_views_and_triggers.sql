-- Migration: Waiver System Views and Triggers
-- Creates materialized view and triggers for waiver status tracking

-- ============================================================================
-- PART 1: Materialized View for Enrollment Waiver Status
-- ============================================================================

-- Drop existing materialized view if it exists (to handle schema changes)
DROP MATERIALIZED VIEW IF EXISTS enrollment_waiver_status CASCADE;

-- Create materialized view to track waiver status for each enrollment
CREATE MATERIALIZED VIEW enrollment_waiver_status AS
SELECT
  e.id AS enrollment_id,
  e.student_id,
  s.first_name || ' ' || s.last_name AS student_name,
  e.program_id,
  p.name AS program_name,
  s.family_id,
  p.required_waiver_id,
  w.title AS required_waiver_name,
  CASE
    WHEN p.required_waiver_id IS NULL THEN true
    WHEN ws.id IS NOT NULL THEN true
    ELSE false
  END AS waiver_signed,
  ws.user_id AS signed_by_user_id,
  ws.signed_at
FROM enrollments e
INNER JOIN students s ON e.student_id = s.id
INNER JOIN programs p ON e.program_id = p.id
LEFT JOIN waivers w ON p.required_waiver_id = w.id
LEFT JOIN waiver_signatures ws ON ws.waiver_id = p.required_waiver_id
  AND ws.user_id IN (
    SELECT id FROM profiles WHERE family_id = s.family_id
  )
WHERE e.status IN ('active', 'trial');

-- Create indexes on the materialized view for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_waiver_status_enrollment
  ON enrollment_waiver_status(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_waiver_status_student
  ON enrollment_waiver_status(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_waiver_status_family
  ON enrollment_waiver_status(family_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_waiver_status_unsigned
  ON enrollment_waiver_status(waiver_signed) WHERE waiver_signed = false;

COMMENT ON MATERIALIZED VIEW enrollment_waiver_status IS 'Tracks waiver signature status for each active enrollment';

-- ============================================================================
-- PART 2: Function to refresh the materialized view
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_enrollment_waiver_status()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY enrollment_waiver_status;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_enrollment_waiver_status IS 'Refreshes the enrollment waiver status materialized view';

-- ============================================================================
-- PART 3: Triggers to auto-refresh the materialized view
-- ============================================================================

-- Trigger function to refresh view when enrollments change
CREATE OR REPLACE FUNCTION trigger_refresh_enrollment_waiver_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh the materialized view concurrently to avoid locks
  PERFORM refresh_enrollment_waiver_status();
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on enrollments table
DROP TRIGGER IF EXISTS trigger_enrollments_refresh_waiver_status ON enrollments;
CREATE TRIGGER trigger_enrollments_refresh_waiver_status
  AFTER INSERT OR UPDATE OR DELETE ON enrollments
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_enrollment_waiver_status();

-- Trigger on waiver_signatures table
DROP TRIGGER IF EXISTS trigger_waiver_signatures_refresh_status ON waiver_signatures;
CREATE TRIGGER trigger_waiver_signatures_refresh_status
  AFTER INSERT OR UPDATE OR DELETE ON waiver_signatures
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_enrollment_waiver_status();

-- Trigger on programs table (when required_waiver_id changes)
DROP TRIGGER IF EXISTS trigger_programs_refresh_waiver_status ON programs;
CREATE TRIGGER trigger_programs_refresh_waiver_status
  AFTER UPDATE OF required_waiver_id ON programs
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_enrollment_waiver_status();

COMMENT ON FUNCTION trigger_refresh_enrollment_waiver_status IS 'Trigger function to refresh enrollment waiver status view when related data changes';

-- ============================================================================
-- PART 4: Helper Views for Reporting
-- ============================================================================

-- Drop existing view if it exists (to handle schema changes)
DROP VIEW IF EXISTS pending_waiver_enrollments CASCADE;

-- View to quickly find enrollments with pending waivers
CREATE VIEW pending_waiver_enrollments AS
SELECT
  ews.enrollment_id,
  ews.student_id,
  ews.student_name,
  ews.program_id,
  ews.program_name,
  ews.family_id,
  ews.required_waiver_id,
  ews.required_waiver_name,
  f.name AS family_name,
  f.email AS family_email
FROM enrollment_waiver_status ews
INNER JOIN families f ON ews.family_id = f.id
WHERE ews.waiver_signed = false
  AND ews.required_waiver_id IS NOT NULL
ORDER BY ews.program_name, ews.student_name;

COMMENT ON VIEW pending_waiver_enrollments IS 'Shows all active enrollments that are missing required waiver signatures';

-- Grant appropriate access
GRANT SELECT ON enrollment_waiver_status TO authenticated;
GRANT SELECT ON pending_waiver_enrollments TO authenticated;

-- ============================================================================
-- PART 5: Initial Data Load
-- ============================================================================

-- Perform initial refresh of the materialized view
SELECT refresh_enrollment_waiver_status();
