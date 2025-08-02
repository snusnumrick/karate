-- Improve eligibility checking with enums and comprehensive issue collection
-- Create enum for eligibility check reasons
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'eligibility_reason_enum') THEN
        CREATE TYPE eligibility_reason_enum AS ENUM (
            'eligible',
            'event_not_found',
            'student_not_found',
            'registration_not_open',
            'registration_deadline_passed',
            'already_registered',
            'event_full',
            'student_too_young',
            'student_too_old',
            'student_belt_rank_too_low',
            'student_belt_rank_too_high'
        );
    END IF;
END $$;

-- Function to check event registration eligibility
-- Returns all eligibility issues instead of stopping at the first one
CREATE OR REPLACE FUNCTION check_event_registration_eligibility(
    p_event_id uuid,
    p_student_id uuid
) RETURNS jsonb AS $$
DECLARE
    event_record events%ROWTYPE;
    student_record students%ROWTYPE;
    student_belt_rank belt_rank_enum;
    student_belt_order integer;
    min_belt_order integer;
    max_belt_order integer;
    student_age integer;
    current_registrations integer;
    issues eligibility_reason_enum[] := '{}';
    primary_reason eligibility_reason_enum;
    reason_priority integer;
    max_priority integer := 0;
    result jsonb;
BEGIN
    -- Get event details
    SELECT * INTO event_record FROM events WHERE id = p_event_id;
    IF NOT FOUND THEN
        issues := array_append(issues, 'event_not_found');
    END IF;
    
    -- Get student details
    SELECT * INTO student_record FROM students WHERE id = p_student_id;
    IF NOT FOUND THEN
        issues := array_append(issues, 'student_not_found');
    END IF;
    
    -- If event or student not found, return early as other checks are meaningless
    IF 'event_not_found' = ANY(issues) OR 'student_not_found' = ANY(issues) THEN
        primary_reason := CASE 
            WHEN 'event_not_found' = ANY(issues) THEN 'event_not_found'
            ELSE 'student_not_found'
        END;
        RETURN jsonb_build_object(
            'eligible', false, 
            'reason', primary_reason,
            'all_issues', issues
        );
    END IF;
    
    -- Check if already registered (highest priority issue)
    IF EXISTS (SELECT 1 FROM event_registrations WHERE event_id = p_event_id AND student_id = p_student_id) THEN
        issues := array_append(issues, 'already_registered');
    END IF;
    
    -- Check if event is accepting registrations
    IF event_record.status NOT IN ('published', 'registration_open') THEN
        issues := array_append(issues, 'registration_not_open');
    END IF;
    
    -- Check registration deadline
    IF event_record.registration_deadline IS NOT NULL AND event_record.registration_deadline < CURRENT_DATE THEN
        issues := array_append(issues, 'registration_deadline_passed');
    END IF;
    
    -- Check capacity
    IF event_record.max_participants IS NOT NULL THEN
        SELECT COUNT(*) INTO current_registrations 
        FROM event_registrations 
        WHERE event_id = p_event_id AND registration_status = 'confirmed';
        
        IF current_registrations >= event_record.max_participants THEN
            issues := array_append(issues, 'event_full');
        END IF;
    END IF;
    
    -- Check age requirements
    student_age := EXTRACT(YEAR FROM AGE(student_record.birth_date));
    IF event_record.min_age IS NOT NULL AND student_age < event_record.min_age THEN
        issues := array_append(issues, 'student_too_young');
    END IF;
    
    IF event_record.max_age IS NOT NULL AND student_age > event_record.max_age THEN
        issues := array_append(issues, 'student_too_old');
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
    
    -- Get belt rank orders for comparison
    student_belt_order := get_belt_rank_order(student_belt_rank);
    
    -- Check minimum belt rank requirement
    IF event_record.min_belt_rank IS NOT NULL THEN
        min_belt_order := get_belt_rank_order(event_record.min_belt_rank);
        IF student_belt_order < min_belt_order THEN
            issues := array_append(issues, 'student_belt_rank_too_low');
        END IF;
    END IF;
    
    -- Check maximum belt rank requirement
    IF event_record.max_belt_rank IS NOT NULL THEN
        max_belt_order := get_belt_rank_order(event_record.max_belt_rank);
        IF student_belt_order > max_belt_order THEN
            issues := array_append(issues, 'student_belt_rank_too_high');
        END IF;
    END IF;
    
    -- If no issues found, student is eligible
    IF array_length(issues, 1) IS NULL THEN
        RETURN jsonb_build_object(
            'eligible', true, 
            'reason', 'eligible',
            'all_issues', '{}'::eligibility_reason_enum[]
        );
    END IF;
    
    -- Determine primary reason based on priority
    -- Priority order: already_registered > registration issues > capacity > requirements
    FOREACH primary_reason IN ARRAY issues LOOP
        reason_priority := CASE primary_reason
            WHEN 'already_registered' THEN 10
            WHEN 'registration_not_open' THEN 9
            WHEN 'registration_deadline_passed' THEN 8
            WHEN 'event_full' THEN 7
            WHEN 'student_too_young' THEN 6
            WHEN 'student_too_old' THEN 5
            WHEN 'student_belt_rank_too_low' THEN 4
            WHEN 'student_belt_rank_too_high' THEN 3
            ELSE 1
        END;
        
        IF reason_priority > max_priority THEN
            max_priority := reason_priority;
        END IF;
    END LOOP;
    
    -- Find the primary reason with highest priority
    FOREACH primary_reason IN ARRAY issues LOOP
        reason_priority := CASE primary_reason
            WHEN 'already_registered' THEN 10
            WHEN 'registration_not_open' THEN 9
            WHEN 'registration_deadline_passed' THEN 8
            WHEN 'event_full' THEN 7
            WHEN 'student_too_young' THEN 6
            WHEN 'student_too_old' THEN 5
            WHEN 'student_belt_rank_too_low' THEN 4
            WHEN 'student_belt_rank_too_high' THEN 3
            ELSE 1
        END;
        
        IF reason_priority = max_priority THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'eligible', false, 
        'reason', primary_reason,
        'all_issues', issues
    );
END;
$$ LANGUAGE plpgsql;