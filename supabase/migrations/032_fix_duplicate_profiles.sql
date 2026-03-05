-- Migration: Fix duplicate profiles and add unique constraint
-- This prevents the "JSON object requested, multiple rows returned" error

-- 1. First, identify and log any duplicate profiles
DO $$
DECLARE
    duplicate_count integer;
BEGIN
    SELECT COUNT(*)
    INTO duplicate_count
    FROM (
        SELECT id, COUNT(*) as cnt
        FROM public.profiles
        GROUP BY id
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % users with duplicate profile entries', duplicate_count;
    ELSE
        RAISE NOTICE 'No duplicate profiles found';
    END IF;
END $$;

-- 2. Clean up duplicate profiles by keeping only the first inserted one
-- Uses ctid (physical row identifier) to determine which row to keep
WITH duplicates AS (
    SELECT id,
           ctid,
           ROW_NUMBER() OVER (PARTITION BY id ORDER BY ctid ASC) as rn
    FROM public.profiles
)
DELETE FROM public.profiles
WHERE ctid IN (
    SELECT ctid
    FROM duplicates
    WHERE rn > 1
);

-- 3. Add unique constraint to prevent future duplicates
-- Note: The 'id' column should already be the primary key, but we'll ensure it's unique
DO $$
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'profiles_pkey'
        AND conrelid = 'public.profiles'::regclass
    ) THEN
        -- Add primary key constraint if it doesn't exist
        ALTER TABLE public.profiles ADD PRIMARY KEY (id);
        RAISE NOTICE 'Added primary key constraint on profiles.id';
    ELSE
        RAISE NOTICE 'Primary key constraint already exists on profiles.id';
    END IF;
END $$;

-- 4. Ensure profiles table has a primary key (should already exist)
-- The primary key constraint on 'id' will prevent duplicates at the database level
-- No need for additional triggers since primary keys are automatically unique

-- 5. Add a comment explaining the fix
COMMENT ON TABLE public.profiles IS
'User profile data. The id column is the primary key matching auth.users.id, preventing duplicate entries. Migration 032.';
