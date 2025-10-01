-- Add marked_by column to attendance records for auditing
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS marked_by UUID REFERENCES profiles(id);

COMMENT ON COLUMN attendance.marked_by IS 'User (instructor/admin) who recorded the attendance entry';
