-- Migration 026: Refactor Seminar Hierarchy
-- Adds seminar-specific type field and series status/registration management
-- Changes seminars from using delivery_format to seminar_type
-- Adds Topic, Status, and Registration fields to series (classes)

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Seminar type for distinguishing skill levels
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seminar_type') THEN
        CREATE TYPE seminar_type AS ENUM ('introductory', 'intermediate', 'advanced');
    END IF;
END $$;

-- Series status for tracking seminar series lifecycle
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'series_status') THEN
        CREATE TYPE series_status AS ENUM ('tentative', 'confirmed', 'cancelled', 'in_progress', 'completed');
    END IF;
END $$;

-- Registration status for managing enrollment
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registration_status') THEN
        CREATE TYPE registration_status AS ENUM ('open', 'closed', 'waitlisted');
    END IF;
END $$;

-- ============================================================================
-- PROGRAMS TABLE EXTENSIONS (Seminars)
-- ============================================================================

-- Add seminar_type column for seminars (null for regular programs)
ALTER TABLE public.programs
    ADD COLUMN IF NOT EXISTS seminar_type seminar_type NULL;

-- Create index on seminar_type for filtering
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_programs_seminar_type') THEN
        CREATE INDEX idx_programs_seminar_type ON public.programs (seminar_type) WHERE seminar_type IS NOT NULL;
    END IF;
END $$;

-- ============================================================================
-- CLASSES TABLE EXTENSIONS (Series)
-- ============================================================================

-- Add series-specific fields for topic and status management
ALTER TABLE public.classes
    ADD COLUMN IF NOT EXISTS topic text NULL,
    ADD COLUMN IF NOT EXISTS series_status series_status NOT NULL DEFAULT 'tentative',
    ADD COLUMN IF NOT EXISTS registration_status registration_status NOT NULL DEFAULT 'closed';

-- Create index on series_status for filtering
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_classes_series_status') THEN
        CREATE INDEX idx_classes_series_status ON public.classes (series_status);
    END IF;
END $$;

-- Create index on registration_status for filtering
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_classes_registration_status') THEN
        CREATE INDEX idx_classes_registration_status ON public.classes (registration_status);
    END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TYPE seminar_type IS 'Skill level for seminars: introductory, intermediate, or advanced';
COMMENT ON TYPE series_status IS 'Lifecycle status of seminar series: tentative, confirmed, cancelled, in_progress, or completed';
COMMENT ON TYPE registration_status IS 'Registration availability: open, closed, or waitlisted';

COMMENT ON COLUMN public.programs.seminar_type IS 'Type of seminar by skill level (null for regular programs)';

COMMENT ON COLUMN public.classes.topic IS 'Topic or subject matter for the series (alternative/supplement to name)';
COMMENT ON COLUMN public.classes.series_status IS 'Current status of the series lifecycle';
COMMENT ON COLUMN public.classes.registration_status IS 'Current registration availability status';
