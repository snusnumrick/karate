-- Curriculum and adult self-registration query performance indexes.
-- This migration intentionally adds indexes only; schema columns/enums already exist.

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
