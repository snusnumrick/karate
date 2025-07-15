-- Add paid_until column to class_enrollments table
ALTER TABLE public.enrollments
ADD COLUMN paid_until DATE;

COMMENT ON COLUMN public.enrollments.paid_until IS 'The date until which the student''s enrollment is paid for.';