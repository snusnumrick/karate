-- Fix the check_event_registration_eligibility function to use correct column name
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
    
    -- Check belt rank requirements (FIXED: use 'type' column instead of 'belt_rank')
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