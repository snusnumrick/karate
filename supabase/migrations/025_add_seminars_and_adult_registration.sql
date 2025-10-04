-- Migration 025: Add Seminars and Adult Registration Support
-- Extends programs/events architecture to support multi-session seminars and adult self-registration
-- See docs/SEMINARS_ADULT_REGISTRATION_PLAN.md for full specification

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Engagement type for programs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engagement_type') THEN
        CREATE TYPE engagement_type AS ENUM ('program', 'seminar');
    END IF;
END $$;

-- Ability category for marketing/filtering
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ability_category') THEN
        CREATE TYPE ability_category AS ENUM ('able', 'adaptive');
    END IF;
END $$;

-- Delivery format for programs/seminars
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_format') THEN
        CREATE TYPE delivery_format AS ENUM ('group', 'private', 'competition_individual', 'competition_team', 'introductory');
    END IF;
END $$;

-- Audience scope for programs/seminars
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audience_scope') THEN
        CREATE TYPE audience_scope AS ENUM ('youth', 'adults', 'mixed');
    END IF;
END $$;

-- Family type to distinguish households from self-registrants
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'family_type') THEN
        CREATE TYPE family_type AS ENUM ('household', 'self', 'organization');
    END IF;
END $$;

-- Waiver status for self-registrants
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waiver_status') THEN
        CREATE TYPE waiver_status AS ENUM ('not_required', 'pending', 'signed', 'expired');
    END IF;
END $$;

-- ============================================================================
-- PROGRAMS TABLE EXTENSIONS
-- ============================================================================

-- Add engagement type and marketing fields to programs
ALTER TABLE public.programs
    ADD COLUMN IF NOT EXISTS engagement_type engagement_type NOT NULL DEFAULT 'program',
    ADD COLUMN IF NOT EXISTS ability_category ability_category NULL,
    ADD COLUMN IF NOT EXISTS delivery_format delivery_format NULL,
    ADD COLUMN IF NOT EXISTS audience_scope audience_scope NOT NULL DEFAULT 'youth',
    ADD COLUMN IF NOT EXISTS min_capacity integer NULL CHECK (min_capacity > 0);

-- Add additional pricing columns for single purchase and subscriptions
ALTER TABLE public.programs
    ADD COLUMN IF NOT EXISTS single_purchase_price_cents INT4 NULL CHECK (single_purchase_price_cents >= 0),
    ADD COLUMN IF NOT EXISTS subscription_monthly_price_cents INT4 NULL CHECK (subscription_monthly_price_cents >= 0),
    ADD COLUMN IF NOT EXISTS subscription_yearly_price_cents INT4 NULL CHECK (subscription_yearly_price_cents >= 0);

-- Add slug for SEO-friendly URLs
ALTER TABLE public.programs
    ADD COLUMN IF NOT EXISTS slug text NULL UNIQUE;

-- Create index on engagement_type for filtering
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_programs_engagement_type') THEN
        CREATE INDEX idx_programs_engagement_type ON public.programs (engagement_type);
    END IF;
END $$;

-- Create index on audience_scope for filtering
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_programs_audience_scope') THEN
        CREATE INDEX idx_programs_audience_scope ON public.programs (audience_scope);
    END IF;
END $$;

-- ============================================================================
-- CLASSES TABLE EXTENSIONS (Seminar Series)
-- ============================================================================

-- Add seminar-specific fields to classes
ALTER TABLE public.classes
    ADD COLUMN IF NOT EXISTS series_label text NULL,
    ADD COLUMN IF NOT EXISTS series_start_on date NULL,
    ADD COLUMN IF NOT EXISTS series_end_on date NULL,
    ADD COLUMN IF NOT EXISTS sessions_per_week_override integer NULL CHECK (sessions_per_week_override > 0),
    ADD COLUMN IF NOT EXISTS session_duration_minutes integer NULL CHECK (session_duration_minutes > 0),
    ADD COLUMN IF NOT EXISTS series_session_quota integer NULL CHECK (series_session_quota > 0),
    ADD COLUMN IF NOT EXISTS allow_self_enrollment boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS min_capacity integer NULL CHECK (min_capacity > 0),
    ADD COLUMN IF NOT EXISTS on_demand boolean NOT NULL DEFAULT false;

-- Add constraint to ensure series dates are valid
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_series_dates') THEN
        ALTER TABLE public.classes
            ADD CONSTRAINT chk_series_dates CHECK (
                series_start_on IS NULL OR series_end_on IS NULL OR series_end_on >= series_start_on
            );
    END IF;
END $$;

-- ============================================================================
-- CLASS_SESSIONS TABLE EXTENSIONS
-- ============================================================================

-- Add sequence number for ordered timelines to existing class_sessions table
ALTER TABLE public.class_sessions
    ADD COLUMN IF NOT EXISTS sequence_number integer NULL;

-- Add index on class_id and sequence_number
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_class_sessions_class_sequence') THEN
        CREATE INDEX idx_class_sessions_class_sequence ON public.class_sessions (class_id, sequence_number);
    END IF;
END $$;

-- Add index on session_date for date-based queries (session_date already exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_class_sessions_session_date_time') THEN
        CREATE INDEX idx_class_sessions_session_date_time ON public.class_sessions (session_date, start_time);
    END IF;
END $$;

-- ============================================================================
-- FAMILIES TABLE EXTENSIONS
-- ============================================================================

-- Add family_type to distinguish household vs self-registrants
ALTER TABLE public.families
    ADD COLUMN IF NOT EXISTS family_type family_type NOT NULL DEFAULT 'household';

-- Make certain fields nullable for self-registrants (they may not have all family info)
DO $$
BEGIN
    -- Check if columns need to be made nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'families'
        AND column_name = 'address'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.families ALTER COLUMN address DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'families'
        AND column_name = 'city'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.families ALTER COLUMN city DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'families'
        AND column_name = 'province'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.families ALTER COLUMN province DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'families'
        AND column_name = 'postal_code'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.families ALTER COLUMN postal_code DROP NOT NULL;
    END IF;
END $$;

-- Create index on family_type for filtering
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_families_family_type') THEN
        CREATE INDEX idx_families_family_type ON public.families (family_type);
    END IF;
END $$;

-- ============================================================================
-- STUDENTS TABLE EXTENSIONS
-- ============================================================================

-- Add is_adult flag and profile_id for self-registrants
ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS is_adult boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Make youth-only fields nullable for adult registrants
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'students'
        AND column_name = 'school'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.students ALTER COLUMN school DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'students'
        AND column_name = 'birth_date'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.students ALTER COLUMN birth_date DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'students'
        AND column_name = 't_shirt_size'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.students ALTER COLUMN t_shirt_size DROP NOT NULL;
    END IF;
END $$;

-- Create index on is_adult for filtering
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_students_is_adult') THEN
        CREATE INDEX idx_students_is_adult ON public.students (is_adult);
    END IF;
END $$;

-- Create index on profile_id for lookups
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_students_profile_id') THEN
        CREATE INDEX idx_students_profile_id ON public.students (profile_id);
    END IF;
END $$;

-- ============================================================================
-- EVENTS TABLE EXTENSIONS
-- ============================================================================

-- Add min_capacity and multi-slot scheduling
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS min_capacity integer NULL CHECK (min_capacity > 0),
    ADD COLUMN IF NOT EXISTS slot_one_start timestamptz NULL,
    ADD COLUMN IF NOT EXISTS slot_one_end timestamptz NULL,
    ADD COLUMN IF NOT EXISTS slot_two_start timestamptz NULL,
    ADD COLUMN IF NOT EXISTS slot_two_end timestamptz NULL,
    ADD COLUMN IF NOT EXISTS allow_self_participants boolean NOT NULL DEFAULT false;

-- Add constraint to ensure slot times are valid
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_slot_one_times') THEN
        ALTER TABLE public.events
            ADD CONSTRAINT chk_slot_one_times CHECK (
                slot_one_start IS NULL OR slot_one_end IS NULL OR slot_one_end > slot_one_start
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_slot_two_times') THEN
        ALTER TABLE public.events
            ADD CONSTRAINT chk_slot_two_times CHECK (
                slot_two_start IS NULL OR slot_two_end IS NULL OR slot_two_end > slot_two_start
            );
    END IF;
END $$;

-- ============================================================================
-- EVENT_REGISTRATIONS TABLE EXTENSIONS
-- ============================================================================

-- Add participant_profile_id and waiver_status for adult registrants
ALTER TABLE public.event_registrations
    ADD COLUMN IF NOT EXISTS participant_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS waiver_status waiver_status NOT NULL DEFAULT 'not_required';

-- Add constraint to ensure either student_id or participant_profile_id is set
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_event_registration_participant') THEN
        ALTER TABLE public.event_registrations
            ADD CONSTRAINT chk_event_registration_participant CHECK (
                student_id IS NOT NULL OR participant_profile_id IS NOT NULL
            );
    END IF;
END $$;

-- Create index on participant_profile_id for lookups
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_event_registrations_participant_profile') THEN
        CREATE INDEX idx_event_registrations_participant_profile ON public.event_registrations (participant_profile_id);
    END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TYPE engagement_type IS 'Distinguishes ongoing programs from fixed-duration seminars';
COMMENT ON TYPE ability_category IS 'Marketing category: able-bodied or adaptive programs';
COMMENT ON TYPE delivery_format IS 'Delivery mode: group, private, competition, or introductory';
COMMENT ON TYPE audience_scope IS 'Target audience: youth, adults, or mixed';
COMMENT ON TYPE family_type IS 'Type of family record: traditional household, self-registrant, or organization';
COMMENT ON TYPE waiver_status IS 'Status of waiver signature for participants';

COMMENT ON COLUMN public.programs.engagement_type IS 'Type of engagement: program (ongoing) or seminar (fixed series)';
COMMENT ON COLUMN public.programs.ability_category IS 'Ability category for marketing and filtering';
COMMENT ON COLUMN public.programs.delivery_format IS 'Delivery format for marketing and filtering';
COMMENT ON COLUMN public.programs.audience_scope IS 'Target audience: youth, adults, or mixed';
COMMENT ON COLUMN public.programs.min_capacity IS 'Minimum enrollment needed to run the program';
COMMENT ON COLUMN public.programs.single_purchase_price_cents IS 'One-time purchase price in cents';
COMMENT ON COLUMN public.programs.subscription_monthly_price_cents IS 'Monthly subscription price in cents';
COMMENT ON COLUMN public.programs.subscription_yearly_price_cents IS 'Yearly subscription price in cents';
COMMENT ON COLUMN public.programs.slug IS 'SEO-friendly URL slug';

COMMENT ON COLUMN public.classes.series_label IS 'Label for seminar series (e.g., "Fall 2025")';
COMMENT ON COLUMN public.classes.series_start_on IS 'Start date of seminar series';
COMMENT ON COLUMN public.classes.series_end_on IS 'End date of seminar series';
COMMENT ON COLUMN public.classes.sessions_per_week_override IS 'Override for sessions per week (seminar-specific)';
COMMENT ON COLUMN public.classes.session_duration_minutes IS 'Duration of each session in minutes';
COMMENT ON COLUMN public.classes.series_session_quota IS 'Total number of sessions in the series';
COMMENT ON COLUMN public.classes.allow_self_enrollment IS 'Whether adults can self-enroll without a family';
COMMENT ON COLUMN public.classes.min_capacity IS 'Minimum enrollment needed to run this class/series';
COMMENT ON COLUMN public.classes.on_demand IS 'Whether sessions are on-demand (no fixed schedule)';

COMMENT ON COLUMN public.class_sessions.sequence_number IS 'Ordered sequence number for seminar sessions';

COMMENT ON COLUMN public.families.family_type IS 'Type: household (traditional family), self (adult registrant), or organization';

COMMENT ON COLUMN public.students.is_adult IS 'Whether this student record represents an adult self-registrant';
COMMENT ON COLUMN public.students.profile_id IS 'Profile ID for adult self-registrants (links to auth user)';

COMMENT ON COLUMN public.events.min_capacity IS 'Minimum participants needed to run the event';
COMMENT ON COLUMN public.events.slot_one_start IS 'Start time for first event slot (multi-slot events)';
COMMENT ON COLUMN public.events.slot_one_end IS 'End time for first event slot (multi-slot events)';
COMMENT ON COLUMN public.events.slot_two_start IS 'Start time for second event slot (multi-slot events)';
COMMENT ON COLUMN public.events.slot_two_end IS 'End time for second event slot (multi-slot events)';
COMMENT ON COLUMN public.events.allow_self_participants IS 'Whether adults can register without belonging to a family';

COMMENT ON COLUMN public.event_registrations.participant_profile_id IS 'Profile ID for adult self-registrants (alternative to student_id)';
COMMENT ON COLUMN public.event_registrations.waiver_status IS 'Status of required waiver signature';
