-- Migration to add explicit columns for commonly used fields
-- This improves performance, indexing, and type safety while keeping JSONB for additional data

-- Add explicit pricing columns to programs table
ALTER TABLE programs ADD COLUMN monthly_fee DECIMAL(10,2);
ALTER TABLE programs ADD COLUMN registration_fee DECIMAL(10,2);
ALTER TABLE programs ADD COLUMN payment_frequency VARCHAR(20) CHECK (payment_frequency IN ('monthly', 'weekly', 'quarterly', 'annually', 'one-time'));
ALTER TABLE programs ADD COLUMN family_discount DECIMAL(5,2); -- percentage

-- Add explicit eligibility columns to programs table
ALTER TABLE programs ADD COLUMN min_age INTEGER;
ALTER TABLE programs ADD COLUMN max_age INTEGER;
ALTER TABLE programs ADD COLUMN gender_restriction VARCHAR(10) CHECK (gender_restriction IN ('male', 'female', 'any'));
ALTER TABLE programs ADD COLUMN special_needs_support BOOLEAN DEFAULT false;

-- Add explicit schedule columns to classes table
ALTER TABLE classes ADD COLUMN days_of_week TEXT[]; -- array of day names
ALTER TABLE classes ADD COLUMN start_time TIME;
ALTER TABLE classes ADD COLUMN end_time TIME;
ALTER TABLE classes ADD COLUMN timezone VARCHAR(50) DEFAULT 'America/New_York';

-- Create indexes for the new columns to improve query performance
CREATE INDEX idx_programs_monthly_fee ON programs(monthly_fee);
CREATE INDEX idx_programs_age_range ON programs(min_age, max_age);
CREATE INDEX idx_programs_gender_restriction ON programs(gender_restriction);
CREATE INDEX idx_programs_special_needs ON programs(special_needs_support);
CREATE INDEX idx_classes_days_of_week ON classes USING GIN(days_of_week);
CREATE INDEX idx_classes_start_time ON classes(start_time);
CREATE INDEX idx_classes_end_time ON classes(end_time);

-- Update the generate_class_sessions function to use explicit columns when available
CREATE OR REPLACE FUNCTION generate_class_sessions(
  p_class_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS INTEGER AS $$
DECLARE
  class_record RECORD;
  session_date DATE;
  sessions_created INTEGER := 0;
  schedule_data JSONB;
  days_of_week TEXT[];
  start_time TIME;
  end_time TIME;
  day_name TEXT;
  current_date DATE;
BEGIN
  -- Get class details
  SELECT * INTO class_record FROM classes WHERE id = p_class_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;
  
  -- Use explicit columns if available, otherwise fall back to JSONB
  IF class_record.days_of_week IS NOT NULL AND array_length(class_record.days_of_week, 1) > 0 THEN
    days_of_week := class_record.days_of_week;
    start_time := class_record.start_time;
    end_time := class_record.end_time;
  ELSE
    -- Fall back to JSONB schedule
    schedule_data := class_record.schedule;
    days_of_week := ARRAY(SELECT jsonb_array_elements_text(schedule_data->'days_of_week'));
    start_time := (schedule_data->>'start_time')::TIME;
    end_time := (schedule_data->>'end_time')::TIME;
  END IF;
  
  -- Generate sessions for each day in the date range
  current_date := p_start_date;
  
  WHILE current_date <= p_end_date LOOP
    day_name := LOWER(TO_CHAR(current_date, 'Day'));
    day_name := TRIM(day_name);
    
    -- Check if this day is in the schedule
    IF day_name = ANY(days_of_week) THEN
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
    
    current_date := current_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN sessions_created;
END;
$$ LANGUAGE plpgsql;

-- Add comments to document the hybrid approach
COMMENT ON COLUMN programs.pricing_structure IS 'JSONB field for additional pricing details not covered by explicit columns';
COMMENT ON COLUMN programs.eligibility_rules IS 'JSONB field for additional eligibility rules not covered by explicit columns';
COMMENT ON COLUMN classes.schedule IS 'JSONB field for additional schedule details not covered by explicit columns';

COMMENT ON COLUMN programs.monthly_fee IS 'Monthly fee in dollars';
COMMENT ON COLUMN programs.registration_fee IS 'One-time registration fee in dollars';
COMMENT ON COLUMN programs.payment_frequency IS 'How often payments are due';
COMMENT ON COLUMN programs.family_discount IS 'Family discount percentage (0-100)';
COMMENT ON COLUMN programs.min_age IS 'Minimum age requirement in years';
COMMENT ON COLUMN programs.max_age IS 'Maximum age requirement in years';
COMMENT ON COLUMN programs.gender_restriction IS 'Gender restriction for the program';
COMMENT ON COLUMN programs.special_needs_support IS 'Whether the program supports special needs students';

COMMENT ON COLUMN classes.days_of_week IS 'Array of day names when class occurs (e.g., {monday, wednesday, friday})';
COMMENT ON COLUMN classes.start_time IS 'Class start time';
COMMENT ON COLUMN classes.end_time IS 'Class end time';
COMMENT ON COLUMN classes.timezone IS 'Timezone for the class schedule';