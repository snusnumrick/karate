-- Migration: Complete transition from event_type enum to event_type_id foreign key system
-- This migration handles all schema changes including:
-- 1. Creating event_types table with proper seeding
-- 2. Adding event_type_id column to events table
-- 3. Migrating existing enum data to foreign key references
-- 4. Removing the old event_type enum column and type
-- 5. Adding proper constraints and indexes

BEGIN;

-- Step 1: Create event_types table if it doesn't exist
CREATE TABLE IF NOT EXISTS event_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    display_name text NOT NULL,
    description text,
    color_class text NOT NULL DEFAULT 'bg-gray-100 text-gray-800',
    border_class text,
    dark_mode_class text,
    icon text,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Step 2: Seed event_types table with all standard types
INSERT INTO event_types (name, display_name, description, color_class, border_class, dark_mode_class, sort_order)
VALUES 
    ('competition', 'Competition', 'Competitive karate events and matches', 'bg-red-100 text-red-800', 'border-red-200', 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', 1),
    ('tournament', 'Tournament', 'Large-scale competitive tournaments', 'bg-orange-100 text-orange-800', 'border-orange-200', 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', 2),
    ('testing', 'Testing', 'Belt testing and rank advancement', 'bg-yellow-100 text-yellow-800', 'border-yellow-200', 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', 3),
    ('seminar', 'Seminar', 'Educational seminars and workshops', 'bg-blue-100 text-blue-800', 'border-blue-200', 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', 4),
    ('workshop', 'Workshop', 'Skill-building workshops and training', 'bg-green-100 text-green-800', 'border-green-200', 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', 5),
    ('social_event', 'Social Event', 'Community gatherings and social activities', 'bg-pink-100 text-pink-800', 'border-pink-200', 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200', 6),
    ('fundraiser', 'Fundraiser', 'Fundraising events and activities', 'bg-purple-100 text-purple-800', 'border-purple-200', 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', 7),
    ('other', 'Other', 'Other types of events', 'bg-gray-100 text-gray-800', 'border-gray-200', 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200', 8)
ON CONFLICT (name) DO NOTHING;

-- Step 3: Add constraint to prevent deletion of the 'other' event type (required for default values)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'prevent_other_deletion' 
        AND table_name = 'event_types'
    ) THEN
        ALTER TABLE event_types 
        ADD CONSTRAINT prevent_other_deletion 
        CHECK (name != 'other' OR is_active = true);
    END IF;
END
$$;

-- Step 4: Add the new event_type_id column (nullable initially)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS event_type_id uuid;

-- Step 5: Create a mapping function to convert enum values to event_type IDs
-- This handles the data migration from old enum values to new foreign keys
CREATE OR REPLACE FUNCTION migrate_event_type_enum_to_id()
RETURNS void AS $$
DECLARE
    event_record RECORD;
    target_event_type_id uuid;
BEGIN
    -- Iterate through all events that have event_type but no event_type_id
    FOR event_record IN 
        SELECT id, event_type 
        FROM events 
        WHERE event_type IS NOT NULL 
        AND event_type_id IS NULL
    LOOP
        -- Find the corresponding event_type_id (cast enum to text for comparison)
        SELECT et.id INTO target_event_type_id
        FROM event_types et
        WHERE et.name = event_record.event_type::text;
        
        -- If no matching event type found, use 'other'
        IF target_event_type_id IS NULL THEN
            SELECT et.id INTO target_event_type_id
            FROM event_types et
            WHERE et.name = 'other';
        END IF;
        
        -- Update the event with the new event_type_id
        UPDATE events 
        SET event_type_id = target_event_type_id
        WHERE id = event_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Execute the migration function
SELECT migrate_event_type_enum_to_id();

-- Step 7: Set default value for event_type_id using a function
-- Create a function to get the 'other' event type ID
CREATE OR REPLACE FUNCTION get_other_event_type_id()
RETURNS uuid AS $$
BEGIN
    RETURN (SELECT id FROM event_types WHERE name = 'other' LIMIT 1);
END;
$$ LANGUAGE plpgsql STABLE;

-- Set the default value using the function
ALTER TABLE events 
ALTER COLUMN event_type_id 
SET DEFAULT get_other_event_type_id();

-- Step 8: Make event_type_id NOT NULL (all existing records should now have values)
UPDATE events 
SET event_type_id = get_other_event_type_id()
WHERE event_type_id IS NULL;

ALTER TABLE events 
ALTER COLUMN event_type_id SET NOT NULL;

-- Step 9: Add foreign key constraint
ALTER TABLE events 
ADD CONSTRAINT fk_events_event_type_id 
FOREIGN KEY (event_type_id) REFERENCES event_types(id) ON DELETE RESTRICT;

-- Step 10: Create index for performance
CREATE INDEX IF NOT EXISTS idx_events_event_type_id ON events(event_type_id);

-- Step 11: Drop the old event_type column
ALTER TABLE events DROP COLUMN IF EXISTS event_type;

-- Step 12: Drop the old event_type_enum type (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type_enum') THEN
        DROP TYPE event_type_enum;
    END IF;
END
$$;

-- Step 13: Clean up the migration function
DROP FUNCTION IF EXISTS migrate_event_type_enum_to_id();

COMMIT;

-- Verification queries (run these after migration to verify success):
-- SELECT COUNT(*) FROM events WHERE event_type_id IS NULL; -- Should be 0
-- SELECT COUNT(*) FROM events e JOIN event_types et ON e.event_type_id = et.id; -- Should equal total events
-- SELECT name FROM event_types WHERE name = 'other'; -- Should return 'other'