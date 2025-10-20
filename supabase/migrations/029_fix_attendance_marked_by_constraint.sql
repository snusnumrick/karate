-- Fix foreign key constraints referencing profiles to allow profile deletion
-- When a profile is deleted, we want to preserve the records but set the reference to NULL

-- 1. Fix attendance.marked_by
ALTER TABLE attendance
DROP CONSTRAINT IF EXISTS attendance_marked_by_fkey,
ADD CONSTRAINT attendance_marked_by_fkey
  FOREIGN KEY (marked_by)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- 2. Fix classes.instructor_id
ALTER TABLE classes
DROP CONSTRAINT IF EXISTS classes_instructor_id_fkey,
ADD CONSTRAINT classes_instructor_id_fkey
  FOREIGN KEY (instructor_id)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- 3. Fix class_sessions.instructor_id
ALTER TABLE class_sessions
DROP CONSTRAINT IF EXISTS class_sessions_instructor_id_fkey,
ADD CONSTRAINT class_sessions_instructor_id_fkey
  FOREIGN KEY (instructor_id)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- 4. Fix invoice_templates.created_by
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_templates') THEN
        ALTER TABLE invoice_templates
        DROP CONSTRAINT IF EXISTS invoice_templates_created_by_fkey,
        ADD CONSTRAINT invoice_templates_created_by_fkey
          FOREIGN KEY (created_by)
          REFERENCES profiles(id)
          ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Fix event_types.instructor_id and created_by (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'event_types' AND column_name = 'instructor_id'
    ) THEN
        ALTER TABLE event_types
        DROP CONSTRAINT IF EXISTS event_types_instructor_id_fkey,
        ADD CONSTRAINT event_types_instructor_id_fkey
          FOREIGN KEY (instructor_id)
          REFERENCES profiles(id)
          ON DELETE SET NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'event_types' AND column_name = 'created_by'
    ) THEN
        -- First, make created_by nullable
        ALTER TABLE event_types ALTER COLUMN created_by DROP NOT NULL;

        -- Then add the constraint
        ALTER TABLE event_types
        DROP CONSTRAINT IF EXISTS event_types_created_by_fkey,
        ADD CONSTRAINT event_types_created_by_fkey
          FOREIGN KEY (created_by)
          REFERENCES profiles(id)
          ON DELETE SET NULL;
    END IF;
END $$;

-- 6. Fix discount_codes.created_by (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'discount_codes' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE discount_codes
        DROP CONSTRAINT IF EXISTS discount_codes_created_by_fkey,
        ADD CONSTRAINT discount_codes_created_by_fkey
          FOREIGN KEY (created_by)
          REFERENCES profiles(id)
          ON DELETE SET NULL;
    END IF;
END $$;

COMMENT ON CONSTRAINT attendance_marked_by_fkey ON attendance IS 'Reference to profile who marked attendance. NULL if profile deleted.';
COMMENT ON CONSTRAINT classes_instructor_id_fkey ON classes IS 'Reference to instructor profile. NULL if profile deleted.';
COMMENT ON CONSTRAINT class_sessions_instructor_id_fkey ON class_sessions IS 'Reference to instructor profile. NULL if profile deleted.';
