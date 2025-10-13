-- Migration: Waiver System Data Backfill and Cleanup
-- Purpose: Ensure data consistency after implementing the tiered waiver system

-- Step 1: Report on programs without required waivers
-- This is informational only - admin should decide which programs need waivers
DO $$
DECLARE
    program_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO program_count
    FROM programs
    WHERE required_waiver_id IS NULL;

    IF program_count > 0 THEN
        RAISE NOTICE '% programs found without a required waiver. Admins should review and assign waivers as needed.', program_count;
    ELSE
        RAISE NOTICE 'All programs have required waivers assigned.';
    END IF;
END $$;

-- Step 2: Report on active enrollments with pending waivers
-- This helps identify families that need to sign waivers
DO $$
DECLARE
    pending_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT e.id) INTO pending_count
    FROM enrollments e
    INNER JOIN programs p ON e.program_id = p.id
    INNER JOIN students s ON e.student_id = s.id
    INNER JOIN families f ON s.family_id = f.id
    LEFT JOIN waiver_signatures ws ON ws.waiver_id = p.required_waiver_id
    WHERE e.status IN ('active', 'trial')
        AND p.required_waiver_id IS NOT NULL
        AND ws.id IS NULL;

    IF pending_count > 0 THEN
        RAISE NOTICE '% active enrollments found with pending waivers. Families will be prompted to sign.', pending_count;
    ELSE
        RAISE NOTICE 'No pending waivers for active enrollments.';
    END IF;
END $$;

-- Step 3: Clean up any orphaned waiver signatures (signatures for deleted waivers)
-- This is a safety measure to keep data clean
DELETE FROM waiver_signatures
WHERE waiver_id NOT IN (SELECT id FROM waivers);

-- Step 4: Report on required waivers that exist
DO $$
DECLARE
    required_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO required_count
    FROM waivers
    WHERE required = true;

    IF required_count > 0 THEN
        RAISE NOTICE '% required (registration) waivers found in the system.', required_count;
    ELSE
        RAISE NOTICE 'No required (registration) waivers found. Consider creating at least one general registration waiver.';
    END IF;
END $$;

-- Step 5: Verify RLS policies are enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'waiver_signatures'
    ) THEN
        RAISE WARNING 'No RLS policies found for waiver_signatures table. This may be a security concern.';
    ELSE
        RAISE NOTICE 'RLS policies verified for waiver_signatures table.';
    END IF;
END $$;

COMMENT ON TABLE waivers IS 'Stores waiver templates. Required=true for registration, or can be program-specific via programs.required_waiver_id';
COMMENT ON TABLE waiver_signatures IS 'Tracks which users have signed which waivers';
COMMENT ON COLUMN programs.required_waiver_id IS 'Optional program-specific waiver that must be signed for enrollment';
