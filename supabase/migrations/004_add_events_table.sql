-- Migration to add events table for one-off events like competitions
-- This extends the existing system to handle special events

-- Create event_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type_enum') THEN
        CREATE TYPE event_type_enum AS ENUM (
            'competition',
            'seminar',
            'testing',
            'tournament',
            'workshop',
            'social_event',
            'fundraiser',
            'other'
        );
    END IF;
END $$;

-- Create event_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status_enum') THEN
        CREATE TYPE event_status_enum AS ENUM (
            'draft',
            'published',
            'registration_open',
            'registration_closed',
            'in_progress',
            'completed',
            'cancelled'
        );
    END IF;
END $$;

-- Create events table
CREATE TABLE IF NOT EXISTS events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    event_type event_type_enum NOT NULL DEFAULT 'other',
    status event_status_enum NOT NULL DEFAULT 'draft',
    
    -- Date and time information
    start_date date NOT NULL,
    end_date date,
    start_time time,
    end_time time,
    timezone text DEFAULT 'America/Toronto',
    
    -- Location information
    location text,
    address text,
    
    -- Registration and capacity
    max_participants integer,
    registration_deadline date,
    min_age integer,
    max_age integer,
    min_belt_rank belt_rank_enum,
    max_belt_rank belt_rank_enum,
    
    -- Pricing
    registration_fee decimal(10,2) DEFAULT 0,
    late_registration_fee decimal(10,2),
    
    -- Requirements
    requires_waiver boolean DEFAULT false,
    required_waiver_ids uuid[] DEFAULT '{}',
    requires_equipment text[], -- Array of required equipment
    
    -- Administrative
    instructor_id uuid REFERENCES profiles(id),
    created_by uuid REFERENCES profiles(id) NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Additional metadata
    external_url text, -- For external registration or info
    notes text,
    is_public boolean DEFAULT true -- Whether to show on public calendar
);

-- Create event registrations table
CREATE TABLE IF NOT EXISTS event_registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    family_id uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
    
    -- Registration details
    registered_at timestamptz DEFAULT now(),
    registration_status text DEFAULT 'registered' CHECK (registration_status IN ('registered', 'waitlist', 'cancelled', 'attended', 'no_show')),
    
    -- Payment tracking
    payment_required boolean DEFAULT true,
    payment_amount decimal(10,2),
    payment_status payment_status DEFAULT 'pending',
    payment_id uuid REFERENCES payments(id),
    
    -- Additional info
    notes text,
    emergency_contact text,
    
    UNIQUE(event_id, student_id)
);

-- Create event waivers junction table (for events requiring specific waivers)
CREATE TABLE IF NOT EXISTS event_waivers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    waiver_id uuid REFERENCES waivers(id) ON DELETE CASCADE NOT NULL,
    is_required boolean DEFAULT true,
    
    UNIQUE(event_id, waiver_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_instructor ON events(instructor_id);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_student ON event_registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_family ON event_registrations(family_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_status ON event_registrations(registration_status);

CREATE INDEX IF NOT EXISTS idx_event_waivers_event ON event_waivers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_waivers_waiver ON event_waivers(waiver_id);

-- Add RLS policies
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_waivers ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Public events are viewable by everyone" ON events
    FOR SELECT USING (is_public = true);

CREATE POLICY "Admin can manage all events" ON events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Instructors can view and manage their events" ON events
    FOR ALL USING (
        instructor_id = auth.uid() OR
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'instructor')
        )
    );

-- Event registrations policies
CREATE POLICY "Users can view their family's registrations" ON event_registrations
    FOR SELECT USING (
        family_id IN (
            SELECT family_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can register their family members" ON event_registrations
    FOR INSERT WITH CHECK (
        family_id IN (
            SELECT family_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admin can manage all registrations" ON event_registrations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Event waivers policies
CREATE POLICY "Event waivers are viewable by all authenticated users" ON event_waivers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage event waivers" ON event_waivers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for events table
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to check event registration eligibility
CREATE OR REPLACE FUNCTION check_event_registration_eligibility(
    p_event_id uuid,
    p_student_id uuid
) RETURNS jsonb AS $$
DECLARE
    event_record events%ROWTYPE;
    student_record students%ROWTYPE;
    student_belt_rank belt_rank_enum;
    student_age integer;
    current_registrations integer;
    result jsonb;
BEGIN
    -- Get event details
    SELECT * INTO event_record FROM events WHERE id = p_event_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('eligible', false, 'reason', 'Event not found');
    END IF;
    
    -- Get student details
    SELECT * INTO student_record FROM students WHERE id = p_student_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('eligible', false, 'reason', 'Student not found');
    END IF;
    
    -- Check if event is accepting registrations
    IF event_record.status NOT IN ('published', 'registration_open') THEN
        RETURN jsonb_build_object('eligible', false, 'reason', 'Registration not open');
    END IF;
    
    -- Check registration deadline
    IF event_record.registration_deadline IS NOT NULL AND event_record.registration_deadline < CURRENT_DATE THEN
        RETURN jsonb_build_object('eligible', false, 'reason', 'Registration deadline passed');
    END IF;
    
    -- Check if already registered
    IF EXISTS (SELECT 1 FROM event_registrations WHERE event_id = p_event_id AND student_id = p_student_id) THEN
        RETURN jsonb_build_object('eligible', false, 'reason', 'Already registered');
    END IF;
    
    -- Check capacity
    IF event_record.max_participants IS NOT NULL THEN
        SELECT COUNT(*) INTO current_registrations 
        FROM event_registrations 
        WHERE event_id = p_event_id AND registration_status = 'registered';
        
        IF current_registrations >= event_record.max_participants THEN
            RETURN jsonb_build_object('eligible', false, 'reason', 'Event is full');
        END IF;
    END IF;
    
    -- Check age requirements
    student_age := EXTRACT(YEAR FROM AGE(student_record.birth_date));
    IF event_record.min_age IS NOT NULL AND student_age < event_record.min_age THEN
        RETURN jsonb_build_object('eligible', false, 'reason', 'Student too young');
    END IF;
    
    IF event_record.max_age IS NOT NULL AND student_age > event_record.max_age THEN
        RETURN jsonb_build_object('eligible', false, 'reason', 'Student too old');
    END IF;
    
    -- Check belt rank requirements
    SELECT type INTO student_belt_rank 
    FROM belt_awards 
    WHERE student_id = p_student_id 
    ORDER BY awarded_date DESC 
    LIMIT 1;
    
    -- If no belt rank found, assume white belt
    IF student_belt_rank IS NULL THEN
        student_belt_rank := 'white';
    END IF;
    
    -- Note: This is a simplified belt rank comparison
    -- You may need to implement a proper belt rank ordering function
    
    RETURN jsonb_build_object('eligible', true, 'reason', 'Eligible for registration');
END;
$$ LANGUAGE plpgsql;

-- Add some sample data (optional)
INSERT INTO events (title, description, event_type_id, start_date, start_time, end_time, max_participants, registration_fee, status, visibility)
VALUES 
('Spring Tournament', 'Annual spring karate tournament for all belt levels', (SELECT id FROM event_types WHERE name = 'tournament' LIMIT 1), '2024-04-15', '09:00', '17:00', 100, 25.00, 'published', 'public'),
('Self-Defense Workshop', 'Basic self-defense techniques workshop', (SELECT id FROM event_types WHERE name = 'workshop' LIMIT 1), '2024-03-20', '18:00', '20:00', 20, 15.00, 'published', 'public');

-- Update dates to be in the future for testing
UPDATE events SET start_date = CURRENT_DATE + INTERVAL '30 days' WHERE title = 'Spring Tournament';
UPDATE events SET start_date = CURRENT_DATE + INTERVAL '15 days' WHERE title = 'Self-Defense Workshop';}]}}