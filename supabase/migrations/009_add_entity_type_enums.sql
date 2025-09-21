-- Migration to add entity type enums to replace hardcoded strings
-- This converts string fields to proper database enums for better type safety

-- Create attendance_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status_enum') THEN
        CREATE TYPE attendance_status_enum AS ENUM (
            'present',
            'absent',
            'excused',
            'late'
        );
    END IF;
END $$;

-- Create class_session_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_session_status_enum') THEN
        CREATE TYPE class_session_status_enum AS ENUM (
            'scheduled',
            'in_progress',
            'completed',
            'cancelled'
        );
    END IF;
END $$;

-- Create discount_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_type_enum') THEN
        CREATE TYPE discount_type_enum AS ENUM (
            'fixed_amount',
            'percentage'
        );
    END IF;
END $$;

-- Create discount_scope enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_scope_enum') THEN
        CREATE TYPE discount_scope_enum AS ENUM (
            'per_student',
            'per_family'
        );
    END IF;
END $$;

-- Create discount_usage_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_usage_type_enum') THEN
        CREATE TYPE discount_usage_type_enum AS ENUM (
            'one_time',
            'ongoing'
        );
    END IF;
END $$;

-- Update attendance table to use attendance_status_enum
ALTER TABLE attendance 
ALTER COLUMN status TYPE attendance_status_enum 
USING status::attendance_status_enum;

-- Update class_sessions table to use class_session_status_enum
ALTER TABLE class_sessions 
ALTER COLUMN status TYPE class_session_status_enum 
USING status::class_session_status_enum;

-- Update discount_codes table to use the new enums
ALTER TABLE discount_codes 
ALTER COLUMN discount_type TYPE discount_type_enum 
USING discount_type::discount_type_enum;

ALTER TABLE discount_codes 
ALTER COLUMN scope TYPE discount_scope_enum 
USING scope::discount_scope_enum;

ALTER TABLE discount_codes 
ALTER COLUMN usage_type TYPE discount_usage_type_enum 
USING usage_type::discount_usage_type_enum;

-- Update discount_templates table to use the new enums
ALTER TABLE discount_templates 
ALTER COLUMN discount_type TYPE discount_type_enum 
USING discount_type::discount_type_enum;

ALTER TABLE discount_templates 
ALTER COLUMN scope TYPE discount_scope_enum 
USING scope::discount_scope_enum;

ALTER TABLE discount_templates 
ALTER COLUMN usage_type TYPE discount_usage_type_enum 
USING usage_type::discount_usage_type_enum;