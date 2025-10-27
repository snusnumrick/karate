-- Migration: Add performance indexes for enrollments table
-- The family dashboard loader queries enrollments frequently with these filters

-- Note: idx_enrollments_student already exists, no need to duplicate
-- Note: idx_enrollments_status already exists, no need to duplicate

-- Composite index for the exact query pattern used in batchCheckStudentEligibility
-- WHERE student_id IN (...) AND status IN ('active', 'trial') ORDER BY paid_until DESC
-- This single composite index will serve both filtered and sorted queries efficiently
CREATE INDEX IF NOT EXISTS idx_enrollments_student_status_paid
ON enrollments(student_id, status, paid_until DESC NULLS LAST);
