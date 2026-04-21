-- Add pending_payment to enrollment_status enum
-- Used for seminar enrollments where payment is required before activation.
-- Replaces the misuse of 'waitlist' for this state.
ALTER TYPE enrollment_status ADD VALUE IF NOT EXISTS 'pending_payment';
