-- Migration to update class schedule structure
-- Remove timezone dependency and change to day/time pairs with duration from program

-- Remove old schedule columns
ALTER TABLE classes DROP COLUMN IF EXISTS days_of_week;
ALTER TABLE classes DROP COLUMN IF EXISTS start_time;
ALTER TABLE classes DROP COLUMN IF EXISTS end_time;
ALTER TABLE classes DROP COLUMN IF EXISTS timezone;

-- Add new schedule_pairs column
ALTER TABLE classes ADD COLUMN schedule_pairs JSONB DEFAULT '[]';

-- Make program_id NOT NULL (it should already be, but ensuring it)
ALTER TABLE classes ALTER COLUMN program_id SET NOT NULL;

-- Create index for the new schedule_pairs column
CREate INDEX idx_classes_schedule_pairs ON classes USING GIN(schedule_pairs);

-- Update the generate_class_sessions function to use new structure
CREATE OR REPLACE FUNCTION generate_class_sessions(
  p_class_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS INTEGER AS $$
DECLARE
  class_record RECORD;
  program_record RECORD;
  session_date DATE;
  sessions_created INTEGER := 0;
  schedule_pair JSONB;
  day_name TEXT;
  start_time TIME;
  end_time TIME;
  current_date DATE;
  duration_minutes INTEGER;
BEGIN
  -- Get class and program details
  SELECT c.*, p.duration_minutes INTO class_record, duration_minutes
  FROM classes c
  JOIN programs p ON c.program_id = p.id
  WHERE c.id = p_class_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;
  
  -- Generate sessions for each day in the date range
  current_date := p_start_date;
  
  WHILE current_date <= p_end_date LOOP
    day_name := LOWER(TO_CHAR(current_date, 'Day'));
    day_name := TRIM(day_name);
    
    -- Check each schedule pair for this day
    FOR schedule_pair IN SELECT jsonb_array_elements(class_record.schedule_pairs)
    LOOP
      IF (schedule_pair->>0) = day_name THEN
        start_time := (schedule_pair->>1)::TIME;
        end_time := start_time + (duration_minutes || ' minutes')::INTERVAL;
        
        -- Insert session if it doesn't already exist
        INSERT INTO class_sessions (
          class_id,
          session_date,
          start_time,
          end_time,
          instructor_id
        )
        SELECT 
          p_class_id,
          current_date,
          start_time,
          end_time,
          class_record.instructor_id
        WHERE NOT EXISTS (
          SELECT 1 FROM class_sessions 
          WHERE class_id = p_class_id AND session_date = current_date
        );
        
        IF FOUND THEN
          sessions_created := sessions_created + 1;
        END IF;
      END IF;
    END LOOP;
    
    current_date := current_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN sessions_created;
END;
$$ LANGUAGE plpgsql;

-- Add comments to document the new structure
COMMENT ON COLUMN classes.schedule_pairs IS 'Array of [day, start_time] pairs, e.g., [["monday", "16:00"], ["wednesday", "18:00"]]';
COMMENT ON COLUMN classes.schedule IS 'JSONB field for additional schedule details not covered by schedule_pairs';