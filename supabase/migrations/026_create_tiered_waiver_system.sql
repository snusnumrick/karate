-- Migration: Tiered Waiver System
-- Implements two-tier waiver requirements:
-- 1. General required waivers (required=true, family-level)
-- 2. Program-specific waivers (optional per program via required_waiver_id)

-- ============================================================================
-- PART 1: Programs table - Add required_waiver_id column
-- ============================================================================

-- Add foreign key to waivers table for program-specific waivers
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS required_waiver_id UUID REFERENCES waivers(id) ON DELETE SET NULL;

COMMENT ON COLUMN programs.required_waiver_id IS 'Optional program-specific waiver that must be signed for enrollment in this program';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_programs_required_waiver ON programs(required_waiver_id);

-- ============================================================================
-- PART 2: Enhance enrollments with waiver tracking (optional)
-- ============================================================================

-- Add timestamp for when waivers were completed
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS waivers_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN enrollments.waivers_completed_at IS 'Timestamp when all required waivers for this enrollment were signed';

-- ============================================================================
-- PART 3: Comments and Documentation
-- ============================================================================

COMMENT ON TABLE waivers IS 'Stores waiver templates. Use required=true for general registration waivers, or link via programs.required_waiver_id for program-specific waivers';
COMMENT ON TABLE waiver_signatures IS 'Tracks which users (guardians) have signed which waivers for their families';
