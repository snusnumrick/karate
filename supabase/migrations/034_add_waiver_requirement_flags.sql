-- Migration: Add Waiver Requirement Flags
-- Purpose: Add required_for_registration and required_for_trial columns to waivers table
-- This migration resolves schema drift between database and migration history

-- ============================================================================
-- Add requirement flag columns to waivers table
-- ============================================================================

-- Add required_for_registration column
ALTER TABLE waivers
  ADD COLUMN IF NOT EXISTS required_for_registration boolean DEFAULT false;

COMMENT ON COLUMN waivers.required_for_registration IS
  'Indicates if this waiver must be signed before completing event/program registration';

-- Add required_for_trial column
ALTER TABLE waivers
  ADD COLUMN IF NOT EXISTS required_for_trial boolean DEFAULT false;

COMMENT ON COLUMN waivers.required_for_trial IS
  'Indicates if this waiver must be signed before starting a trial enrollment';

-- Create index for queries filtering by requirement type
CREATE INDEX IF NOT EXISTS idx_waivers_required_for_registration
  ON waivers(required_for_registration) WHERE required_for_registration = true;

CREATE INDEX IF NOT EXISTS idx_waivers_required_for_trial
  ON waivers(required_for_trial) WHERE required_for_trial = true;

-- ============================================================================
-- Migration summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 034 completed successfully';
  RAISE NOTICE '   - Added required_for_registration column to waivers table';
  RAISE NOTICE '   - Added required_for_trial column to waivers table';
  RAISE NOTICE '   - Created indexes for efficient filtering';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Total waivers: %', (SELECT COUNT(*) FROM waivers);
  RAISE NOTICE '📊 Required for registration: %', (SELECT COUNT(*) FROM waivers WHERE required_for_registration = true);
  RAISE NOTICE '📊 Required for trial: %', (SELECT COUNT(*) FROM waivers WHERE required_for_trial = true);
END $$;
