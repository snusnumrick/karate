-- Multi-Class System Database Schema
-- This migration creates the core tables for the program and class management system

-- Programs table: Templates for classes
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  pricing_structure JSONB NOT NULL DEFAULT '{}',
  eligibility_rules JSONB NOT NULL DEFAULT '{}',
  duration_minutes INTEGER NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Classes table: Specific instances of programs
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  instructor_id UUID REFERENCES profiles(id),
  start_date DATE NOT NULL,
  end_date DATE,
  schedule JSONB NOT NULL DEFAULT '{}',
  current_enrollment INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Class enrollments table: Student enrollment in classes
CREATE TABLE class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'completed', 'waitlist')),
  payment_id UUID REFERENCES payments(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);

-- Class sessions table: Individual class sessions
CREATE TABLE class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  instructor_id UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add class-related columns to existing tables
ALTER TABLE attendance ADD COLUMN class_session_id UUID REFERENCES class_sessions(id);
ALTER TABLE attendance ADD COLUMN class_id UUID REFERENCES classes(id);

-- Update conversations table for class messaging
ALTER TABLE conversations ADD COLUMN class_id UUID REFERENCES classes(id);
ALTER TABLE conversations ADD COLUMN message_type VARCHAR(20) DEFAULT 'individual' 
  CHECK (message_type IN ('individual', 'class_announcement', 'general'));

-- Create indexes for performance
CREATE INDEX idx_programs_active ON programs(is_active);
CREATE INDEX idx_classes_program_id ON classes(program_id);
CREATE INDEX idx_classes_active ON classes(is_active);
CREATE INDEX idx_classes_instructor ON classes(instructor_id);
CREATE INDEX idx_class_enrollments_class_id ON class_enrollments(class_id);
CREATE INDEX idx_class_enrollments_student_id ON class_enrollments(student_id);
CREATE INDEX idx_class_enrollments_status ON class_enrollments(status);
CREATE INDEX idx_class_sessions_class_id ON class_sessions(class_id);
CREATE INDEX idx_class_sessions_date ON class_sessions(session_date);
CREATE INDEX idx_attendance_class_session ON attendance(class_session_id);
CREATE INDEX idx_attendance_class ON attendance(class_id);
CREATE INDEX idx_conversations_class ON conversations(class_id);

-- Create class message recipients table for bulk messaging
CREATE TABLE class_message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_class_message_recipients_conversation ON class_message_recipients(conversation_id);
CREATE INDEX idx_class_message_recipients_class ON class_message_recipients(class_id);

-- Function to update enrollment count when students are added/removed
CREATE OR REPLACE FUNCTION update_class_enrollment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE classes 
    SET current_enrollment = (
      SELECT COUNT(*) 
      FROM class_enrollments 
      WHERE class_id = NEW.class_id AND status = 'active'
    )
    WHERE id = NEW.class_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE classes 
    SET current_enrollment = (
      SELECT COUNT(*) 
      FROM class_enrollments 
      WHERE class_id = NEW.class_id AND status = 'active'
    )
    WHERE id = NEW.class_id;
    
    -- If class_id changed, update old class too
    IF OLD.class_id != NEW.class_id THEN
      UPDATE classes 
      SET current_enrollment = (
        SELECT COUNT(*) 
        FROM class_enrollments 
        WHERE class_id = OLD.class_id AND status = 'active'
      )
      WHERE id = OLD.class_id;
    END IF;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE classes 
    SET current_enrollment = (
      SELECT COUNT(*) 
      FROM class_enrollments 
      WHERE class_id = OLD.class_id AND status = 'active'
    )
    WHERE id = OLD.class_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update enrollment counts
CREATE TRIGGER trigger_update_class_enrollment_count
  AFTER INSERT OR UPDATE OR DELETE ON class_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_class_enrollment_count();

-- Function to generate class sessions based on schedule
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
  
  schedule_data := class_record.schedule;
  days_of_week := ARRAY(SELECT jsonb_array_elements_text(schedule_data->'days_of_week'));
  start_time := (schedule_data->>'start_time')::TIME;
  end_time := (schedule_data->>'end_time')::TIME;
  
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

-- Add RLS policies for security
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_message_recipients ENABLE ROW LEVEL SECURITY;

-- Admin can access all records
CREATE POLICY "Admin full access to programs" ON programs
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to classes" ON classes
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to class_enrollments" ON class_enrollments
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to class_sessions" ON class_sessions
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to class_message_recipients" ON class_message_recipients
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Families can view active programs and classes
CREATE POLICY "Families can view active programs" ON programs
  FOR SELECT USING (is_active = true);

CREATE POLICY "Families can view active classes" ON classes
  FOR SELECT USING (is_active = true);

-- Families can view their own enrollments
CREATE POLICY "Families can view own enrollments" ON class_enrollments
  FOR SELECT USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN families f ON s.family_id = f.id
      JOIN profiles p ON f.id = p.family_id
      WHERE p.id = auth.uid()
    )
  );

-- Families can view sessions for their enrolled classes
CREATE POLICY "Families can view enrolled class sessions" ON class_sessions
  FOR SELECT USING (
    class_id IN (
      SELECT ce.class_id FROM class_enrollments ce
      JOIN students s ON ce.student_id = s.id
      JOIN families f ON s.family_id = f.id
      JOIN profiles p ON f.id = p.family_id
      WHERE p.id = auth.uid() AND ce.status = 'active'
    )
  );

-- Insert sample data for testing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM programs LIMIT 1) THEN
        INSERT INTO programs (name, description, pricing_structure, eligibility_rules, duration_minutes, max_capacity) VALUES
        ('Little Dragons', 'Karate program for young children ages 4-6', 
         '{"monthly_fee": 120.00, "registration_fee": 50.00, "family_discount": 0.10, "payment_frequency": "monthly"}',
         '{"min_age": 4, "max_age": 6, "special_needs_support": true}',
         30, 12),

        ('Youth Karate', 'Traditional karate for children and teens ages 7-17',
         '{"monthly_fee": 140.00, "registration_fee": 50.00, "family_discount": 0.10, "payment_frequency": "monthly"}',
         '{"min_age": 7, "max_age": 17}',
         45, 20),

        ('Adult Karate', 'Karate training for adults 18 and older',
         '{"monthly_fee": 160.00, "registration_fee": 50.00, "family_discount": 0.05, "payment_frequency": "monthly"}',
         '{"min_age": 18}',
         60, 15),

        ('Competition Team', 'Advanced training for competitive karate',
         '{"monthly_fee": 200.00, "registration_fee": 75.00, "payment_frequency": "monthly"}',
         '{"min_age": 10, "belt_requirements": ["green", "brown", "black"]}',
         90, 10),

        ('Adaptive Karate', 'Modified karate program for students with special needs',
         '{"monthly_fee": 100.00, "registration_fee": 25.00, "family_discount": 0.15, "payment_frequency": "monthly"}',
         '{"special_needs_support": true, "min_age": 5}',
         45, 8);
    END IF;
END $$;

COMMIT;