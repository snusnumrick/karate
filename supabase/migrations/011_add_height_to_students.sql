-- Add optional height field to students table

-- Add height column to students table (in centimeters as integer)
ALTER TABLE students 
ADD COLUMN height INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN students.height IS 'Student height in centimeters (optional field for gi size recommendations)';