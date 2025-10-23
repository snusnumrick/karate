-- Migration: Add Student IDs and PDF Storage to Waiver Signatures
-- Purpose: Enable explicit student identification in waiver signatures for legal compliance
-- BC Law Requirement: Contracts must specifically identify all parties
-- Related: docs/WAIVER_LEGAL_COMPLIANCE_IMPLEMENTATION.md

-- ============================================================================
-- PART 0: Add pending_waivers to enrollment_status enum
-- ============================================================================

-- Add 'pending_waivers' to enrollment_status enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pending_waivers'
    AND enumtypid = 'enrollment_status'::regtype
  ) THEN
    ALTER TYPE enrollment_status ADD VALUE 'pending_waivers';
    RAISE NOTICE 'Added pending_waivers to enrollment_status enum';
  END IF;
END $$;

-- ============================================================================
-- PART 0b: Create program_waivers table (if not exists)
-- ============================================================================

-- Program waivers junction table (for program-specific waiver requirements)
CREATE TABLE IF NOT EXISTS program_waivers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id uuid REFERENCES programs(id) ON DELETE CASCADE NOT NULL,
    waiver_id uuid REFERENCES waivers(id) ON DELETE CASCADE NOT NULL,
    is_required boolean DEFAULT true,
    required_for_trial boolean DEFAULT false,
    required_for_full_enrollment boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(program_id, waiver_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_program_waivers_program_id ON program_waivers(program_id);
CREATE INDEX IF NOT EXISTS idx_program_waivers_waiver_id ON program_waivers(waiver_id);

COMMENT ON TABLE program_waivers IS 'Junction table linking programs to required waivers. Used alongside programs.required_waiver_id for flexible waiver requirements.';

-- Enable RLS
ALTER TABLE program_waivers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for program_waivers
DO $$
BEGIN
  -- Allow authenticated users to view program waivers
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'program_waivers'
    AND policyname = 'Program waivers are viewable by authenticated users'
  ) THEN
    CREATE POLICY "Program waivers are viewable by authenticated users"
      ON program_waivers
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  -- Allow admins to manage program waivers
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'program_waivers'
    AND policyname = 'Admin can manage program waivers'
  ) THEN
    CREATE POLICY "Admin can manage program waivers"
      ON program_waivers
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

-- ============================================================================
-- PART 1: Add student_ids column (array of UUIDs)
-- ============================================================================

-- Add student_ids array column to track which students are covered by each signature
ALTER TABLE waiver_signatures
  ADD COLUMN IF NOT EXISTS student_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN waiver_signatures.student_ids IS
  'Array of student IDs that this waiver signature covers. Required for legal clarity per BC contract law which requires specific identification of parties.';

-- Create GIN index for efficient querying by student ID
-- This allows fast lookups like "has this student signed this waiver?"
CREATE INDEX IF NOT EXISTS idx_waiver_signatures_student_ids
  ON waiver_signatures USING GIN (student_ids);

-- ============================================================================
-- PART 2: Add pdf_storage_path column
-- ============================================================================

-- Add PDF storage path column for self-contained legal documents
ALTER TABLE waiver_signatures
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;

COMMENT ON COLUMN waiver_signatures.pdf_storage_path IS
  'Path to the generated PDF in Supabase Storage (e.g., "waiver_john_doe_2025-01-19.pdf"). PDF contains full waiver text, student names, guardian signature, and timestamp as a self-contained legal document.';

-- Create index for PDF path lookups
CREATE INDEX IF NOT EXISTS idx_waiver_signatures_pdf_path
  ON waiver_signatures(pdf_storage_path) WHERE pdf_storage_path IS NOT NULL;

-- ============================================================================
-- PART 3: Update existing records
-- ============================================================================

-- Set empty array for legacy signatures that don't have student IDs yet
-- This ensures the column is never NULL for consistency
UPDATE waiver_signatures
SET student_ids = '{}'
WHERE student_ids IS NULL;

-- ============================================================================
-- PART 4: Add constraint to ensure data integrity
-- ============================================================================

-- Ensure student_ids is never NULL (always use empty array instead)
ALTER TABLE waiver_signatures
  ALTER COLUMN student_ids SET NOT NULL;

-- ============================================================================
-- PART 5: Create helper function to check if student has signed waiver
-- ============================================================================

-- Function to check if a specific student has signed a specific waiver
CREATE OR REPLACE FUNCTION has_student_signed_waiver(
  p_student_id UUID,
  p_waiver_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM waiver_signatures
    WHERE waiver_id = p_waiver_id
      AND p_student_id = ANY(student_ids)
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION has_student_signed_waiver IS
  'Check if a specific student has signed a specific waiver. Returns true if student_id is in any waiver_signature.student_ids array for the given waiver.';

-- ============================================================================
-- PART 6: Update enrollment_waiver_status view to use student_ids
-- ============================================================================

-- Drop and recreate the materialized view to include student-specific checks
DROP MATERIALIZED VIEW IF EXISTS enrollment_waiver_status CASCADE;

CREATE MATERIALIZED VIEW enrollment_waiver_status AS
SELECT
  e.id AS enrollment_id,
  e.student_id,
  s.first_name || ' ' || s.last_name AS student_name,
  e.program_id,
  p.name AS program_name,
  s.family_id,

  -- Check both program_waivers (new system) and programs.required_waiver_id (legacy)
  COALESCE(pw.waiver_id, p.required_waiver_id) AS required_waiver_id,
  COALESCE(w_pw.title, w_legacy.title) AS required_waiver_name,

  -- Student has signed if their ID is in the student_ids array of any signature
  CASE
    WHEN COALESCE(pw.waiver_id, p.required_waiver_id) IS NULL THEN true
    WHEN EXISTS (
      SELECT 1
      FROM waiver_signatures ws
      WHERE ws.waiver_id = COALESCE(pw.waiver_id, p.required_waiver_id)
        AND e.student_id = ANY(ws.student_ids)
        AND ws.user_id IN (
          SELECT id FROM profiles WHERE family_id = s.family_id
        )
    ) THEN true
    ELSE false
  END AS waiver_signed,

  ws_latest.user_id AS signed_by_user_id,
  ws_latest.signed_at
FROM enrollments e
INNER JOIN students s ON e.student_id = s.id
INNER JOIN programs p ON e.program_id = p.id
LEFT JOIN program_waivers pw ON pw.program_id = p.id AND pw.is_required = true
LEFT JOIN waivers w_pw ON pw.waiver_id = w_pw.id
LEFT JOIN waivers w_legacy ON p.required_waiver_id = w_legacy.id
LEFT JOIN LATERAL (
  SELECT ws.user_id, ws.signed_at
  FROM waiver_signatures ws
  WHERE ws.waiver_id = COALESCE(pw.waiver_id, p.required_waiver_id)
    AND e.student_id = ANY(ws.student_ids)
    AND ws.user_id IN (
      SELECT id FROM profiles WHERE family_id = s.family_id
    )
  ORDER BY ws.signed_at DESC
  LIMIT 1
) ws_latest ON true
WHERE e.status IN ('active', 'trial', 'pending_waivers');

-- Create indexes on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_waiver_status_enrollment
  ON enrollment_waiver_status(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_waiver_status_student
  ON enrollment_waiver_status(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_waiver_status_family
  ON enrollment_waiver_status(family_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_waiver_status_unsigned
  ON enrollment_waiver_status(waiver_signed) WHERE waiver_signed = false;

COMMENT ON MATERIALIZED VIEW enrollment_waiver_status IS
  'Tracks waiver signature status for each active enrollment, using student_ids array for accurate per-student tracking';

-- Refresh the materialized view with new data
REFRESH MATERIALIZED VIEW CONCURRENTLY enrollment_waiver_status;

-- ============================================================================
-- PART 7: Grant permissions
-- ============================================================================

-- Grant SELECT on the new function to authenticated users
GRANT EXECUTE ON FUNCTION has_student_signed_waiver(UUID, UUID) TO authenticated;

-- Ensure authenticated users can read the materialized view
GRANT SELECT ON enrollment_waiver_status TO authenticated;

-- ============================================================================
-- PART 8: Migration summary and validation
-- ============================================================================

-- Output migration summary
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 029 completed successfully';
  RAISE NOTICE '   - Added pending_waivers to enrollment_status enum';
  RAISE NOTICE '   - Created program_waivers junction table with RLS policies';
  RAISE NOTICE '   - Added student_ids column to waiver_signatures';
  RAISE NOTICE '   - Added pdf_storage_path column to waiver_signatures';
  RAISE NOTICE '   - Created GIN index on student_ids for fast queries';
  RAISE NOTICE '   - Created has_student_signed_waiver() function';
  RAISE NOTICE '   - Updated enrollment_waiver_status materialized view';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Current waiver signature count: %', (SELECT COUNT(*) FROM waiver_signatures);
  RAISE NOTICE '📊 Signatures with student IDs: %', (SELECT COUNT(*) FROM waiver_signatures WHERE array_length(student_ids, 1) > 0);
  RAISE NOTICE '📊 Legacy signatures (no student IDs): %', (SELECT COUNT(*) FROM waiver_signatures WHERE array_length(student_ids, 1) IS NULL OR array_length(student_ids, 1) = 0);
END $$;
