-- Curriculum and adult self-registration: add missing columns/enums then indexes.

-- audience_scope enum
DO $$ BEGIN
  CREATE TYPE public.audience_scope AS ENUM ('youth', 'adults', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- engagement_type enum
DO $$ BEGIN
  CREATE TYPE public.engagement_type AS ENUM ('program', 'seminar');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- programs.audience_scope
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS audience_scope public.audience_scope NOT NULL DEFAULT 'youth';

-- programs.engagement_type
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS engagement_type public.engagement_type NOT NULL DEFAULT 'program';

-- events.allow_self_participants
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS allow_self_participants boolean NOT NULL DEFAULT false;

-- classes.allow_self_enrollment
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS allow_self_enrollment boolean NOT NULL DEFAULT false;

-- event_registrations.participant_profile_id
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS participant_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Efficient filtering of adult/mixed programs for public curriculum browsing.
CREATE INDEX IF NOT EXISTS idx_programs_audience_scope_active
  ON public.programs (audience_scope, is_active)
  WHERE is_active = true;

-- Efficient filtering of active self-enrollable classes for seminar/adult flows.
CREATE INDEX IF NOT EXISTS idx_classes_self_enrollment_active
  ON public.classes (program_id, allow_self_enrollment, is_active)
  WHERE allow_self_enrollment = true AND is_active = true;

-- Efficient lookup of self-participant event registrations by profile.
CREATE INDEX IF NOT EXISTS idx_event_registrations_participant_profile
  ON public.event_registrations (participant_profile_id)
  WHERE participant_profile_id IS NOT NULL;
