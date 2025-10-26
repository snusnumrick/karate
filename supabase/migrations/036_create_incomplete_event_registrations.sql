-- Migration: Create incomplete_event_registrations table for tracking registration flow state
-- This table tracks incomplete event registrations so users can resume their registration process

-- Create enum for registration steps
CREATE TYPE registration_step AS ENUM ('student_selection', 'waiver_signing', 'payment');

-- Create the incomplete_event_registrations table
CREATE TABLE incomplete_event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    current_step registration_step NOT NULL DEFAULT 'student_selection',
    selected_student_ids UUID[] DEFAULT ARRAY[]::UUID[],
    metadata JSONB DEFAULT '{}'::jsonb, -- For storing additional state like form data
    dismissed_at TIMESTAMP WITH TIME ZONE, -- When user dismissed this incomplete registration
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'), -- Auto-cleanup after 7 days

    -- Unique constraint: One incomplete registration per family per event
    CONSTRAINT unique_family_event UNIQUE (family_id, event_id)
);

-- Create index for faster lookups
CREATE INDEX idx_incomplete_registrations_family ON incomplete_event_registrations(family_id) WHERE dismissed_at IS NULL;
CREATE INDEX idx_incomplete_registrations_expires ON incomplete_event_registrations(expires_at) WHERE dismissed_at IS NULL;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_incomplete_registration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_incomplete_registration_timestamp
    BEFORE UPDATE ON incomplete_event_registrations
    FOR EACH ROW
    EXECUTE FUNCTION update_incomplete_registration_timestamp();

-- RLS policies
ALTER TABLE incomplete_event_registrations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own family's incomplete registrations
CREATE POLICY "Users can view own family incomplete registrations"
    ON incomplete_event_registrations
    FOR SELECT
    USING (
        family_id IN (
            SELECT family_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Policy: Users can insert their own family's incomplete registrations
CREATE POLICY "Users can insert own family incomplete registrations"
    ON incomplete_event_registrations
    FOR INSERT
    WITH CHECK (
        family_id IN (
            SELECT family_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Policy: Users can update their own family's incomplete registrations
CREATE POLICY "Users can update own family incomplete registrations"
    ON incomplete_event_registrations
    FOR UPDATE
    USING (
        family_id IN (
            SELECT family_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Policy: Users can delete their own family's incomplete registrations
CREATE POLICY "Users can delete own family incomplete registrations"
    ON incomplete_event_registrations
    FOR DELETE
    USING (
        family_id IN (
            SELECT family_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Admin policy: Admins can manage all incomplete registrations
CREATE POLICY "Admins can manage all incomplete registrations"
    ON incomplete_event_registrations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Function to automatically clean up expired incomplete registrations
CREATE OR REPLACE FUNCTION cleanup_expired_incomplete_registrations()
RETURNS void AS $$
BEGIN
    DELETE FROM incomplete_event_registrations
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on table
COMMENT ON TABLE incomplete_event_registrations IS 'Tracks incomplete event registrations to allow users to resume their registration process';
COMMENT ON COLUMN incomplete_event_registrations.current_step IS 'The current step in the registration flow where the user left off';
COMMENT ON COLUMN incomplete_event_registrations.selected_student_ids IS 'Array of student IDs selected for registration';
COMMENT ON COLUMN incomplete_event_registrations.metadata IS 'Additional state data for the registration (e.g., form values, emergency contacts)';
COMMENT ON COLUMN incomplete_event_registrations.dismissed_at IS 'Timestamp when user dismissed this incomplete registration banner';
COMMENT ON COLUMN incomplete_event_registrations.expires_at IS 'Timestamp when this incomplete registration will be automatically deleted';
