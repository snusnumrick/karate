-- Migration: Add performance indexes for payment_students join table
-- Used heavily in eligibility checks on the family dashboard

-- Index for filtering by student_id
CREATE INDEX IF NOT EXISTS idx_payment_students_student_id
ON payment_students(student_id);

-- Composite index for common join pattern (student + payment)
CREATE INDEX IF NOT EXISTS idx_payment_students_student_payment
ON payment_students(student_id, payment_id);
