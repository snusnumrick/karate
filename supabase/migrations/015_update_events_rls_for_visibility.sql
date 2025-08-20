-- Migration to update RLS policies for events table to use visibility field instead of is_public
-- This updates the existing policy to work with the new visibility enum

BEGIN;

-- Drop the old policy that uses is_public
DROP POLICY IF EXISTS "Public events are viewable by everyone" ON events;

-- Create new policies for the visibility field
-- Policy for non-authenticated users: can only see public and limited events
CREATE POLICY "Public and limited events are viewable by everyone" ON events
    FOR SELECT USING (
        visibility IN ('public', 'limited')
    );

-- Policy for authenticated users: can see public, limited, and internal events
CREATE POLICY "Authenticated users can view all visible events" ON events
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND visibility IN ('public', 'limited', 'internal')
    );

-- Add comment for clarity
COMMENT ON POLICY "Public and limited events are viewable by everyone" ON events IS 'Allows non-authenticated users to view public and limited visibility events';
COMMENT ON POLICY "Authenticated users can view all visible events" ON events IS 'Allows authenticated users to view events with public, limited, and internal visibility';

COMMIT;