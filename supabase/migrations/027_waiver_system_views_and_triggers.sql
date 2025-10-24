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
-- PART 2: Helper Views for Reporting
-- ============================================================================
-- Note: Functions and triggers are defined in migration 035_fix_waiver_refresh_function_conflict.sql

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
-- PART 3: Initial Data Load
-- ============================================================================

-- Note: Initial refresh will be done by migration 035 after creating the refresh function
-- The materialized view is created empty and will be populated after migration 035 runs
