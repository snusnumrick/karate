-- Migration: Update attendance table to work with class sessions
-- This migration modifies the attendance table to link to class_sessions instead of class_date

-- First, create a backup of existing attendance data
CREATE TABLE IF NOT EXISTS attendance_backup AS
SELECT * FROM attendance;

-- Drop the existing unique constraint
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_class_date_student_id_key;

-- Add new columns for session-based attendance
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS class_session_id uuid REFERENCES class_sessions(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'excused', 'late'));

-- Update existing records to use 'present' or 'absent' status based on the boolean 'present' column
UPDATE attendance 
SET status = CASE 
    WHEN present = true THEN 'present'
    WHEN present = false THEN 'absent'
    ELSE 'present'
END
WHERE status = 'present'; -- Only update records that haven't been updated yet

-- For existing data, we'll need to manually link attendance records to sessions
-- This is a complex migration that may require manual intervention
-- For now, we'll leave class_session_id as NULL for existing records

-- Create new unique constraint for session-based attendance
ALTER TABLE attendance 
ADD CONSTRAINT attendance_session_student_unique 
UNIQUE (class_session_id, student_id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_class_session_id ON attendance(class_session_id);

-- Update the existing index name for clarity
DROP INDEX IF EXISTS idx_attendance_student_id;
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);

-- Note: The old 'class_date' and 'present' columns are kept for backward compatibility
-- They can be removed in a future migration once all systems are updated

-- Add RLS policies for attendance table
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage all attendance records
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Allow admins to manage attendance' 
        AND tablename = 'attendance'
    ) THEN
        CREATE POLICY "Allow admins to manage attendance" ON attendance
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles p 
                WHERE p.id = auth.uid() AND p.role = 'admin'
            )
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM profiles p 
                WHERE p.id = auth.uid() AND p.role = 'admin'
            )
        );
    END IF;
END $$;

-- Allow family members to view attendance for their students
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Allow families to view student attendance' 
        AND tablename = 'attendance'
    ) THEN
        CREATE POLICY "Allow families to view student attendance" ON attendance
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM profiles p 
                JOIN students s ON s.family_id = p.family_id
                WHERE p.id = auth.uid() AND s.id = attendance.student_id
            )
        );
    END IF;
END $$;

-- Allow instructors to view attendance for their classes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Allow instructors to view class attendance' 
        AND tablename = 'attendance'
    ) THEN
        CREATE POLICY "Allow instructors to view class attendance" ON attendance
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM profiles p 
                JOIN class_sessions cs ON cs.instructor_id = p.id
                WHERE p.id = auth.uid() AND cs.id = attendance.class_session_id
            )
        );
    END IF;
END $$;