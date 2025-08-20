-- Migration to add visibility field to events table
-- This allows events to have different visibility levels:
-- - public: everybody can register, displayed on main page
-- - limited: everybody can register, but not displayed, can be visible if you have a link
-- - internal: only visible on main page when logged in and only existing users can register

BEGIN;

-- Step 1: Create event_visibility_enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_visibility_enum') THEN
        CREATE TYPE event_visibility_enum AS ENUM (
            'public',
            'limited', 
            'internal'
        );
    END IF;
END
$$;

-- Step 2: Add visibility column to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS visibility event_visibility_enum NOT NULL DEFAULT 'public';

-- Step 3: Create index for performance on visibility queries
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility);

-- Step 4: Add comments for clarity
COMMENT ON COLUMN events.visibility IS 'Event visibility level: public (displayed on main page, everyone can register), limited (not displayed but accessible via link, everyone can register), internal (only visible when logged in, only existing users can register)';

-- Step 5: Update existing events to have public visibility by default
-- This ensures backward compatibility
UPDATE events 
SET visibility = 'public' 
WHERE visibility IS NULL;

COMMIT;

-- Verification queries (run these after migration to verify success):
-- SELECT DISTINCT visibility FROM events; -- Should show 'public' and any other values set
-- SELECT COUNT(*) FROM events WHERE visibility IS NULL; -- Should be 0
-- SELECT COUNT(*) FROM events WHERE visibility = 'public'; -- Should show count of existing events