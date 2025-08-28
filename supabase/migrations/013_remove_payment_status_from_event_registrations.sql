-- Remove redundant payment_status field from event_registrations table
-- Payment status should only be tracked in the payments table

ALTER TABLE event_registrations DROP COLUMN IF EXISTS payment_status;