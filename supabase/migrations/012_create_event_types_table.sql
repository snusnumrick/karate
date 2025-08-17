-- Migration to create event_types table and migrate from enum to table-based configuration
-- This allows for dynamic management of event types with rich metadata

-- Create event_types table
CREATE TABLE IF NOT EXISTS event_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(50) UNIQUE NOT NULL,
    display_name varchar(100) NOT NULL,
    description text,
    color_class varchar(100) NOT NULL,
    border_class varchar(100),
    dark_mode_class varchar(100),
    icon varchar(50),
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_event_types_updated_at
    BEFORE UPDATE ON event_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert existing enum values with their configurations
INSERT INTO event_types (name, display_name, description, color_class, border_class, dark_mode_class, sort_order) VALUES
    ('competition', 'Competition', 'Competitive events and contests', 'bg-red-100 text-red-800', 'border-red-200', 'bg-red-900 text-red-200', 1),
    ('tournament', 'Tournament', 'Tournament-style competitions', 'bg-red-100 text-red-800', 'border-red-200', 'bg-red-900 text-red-200', 2),
    ('testing', 'Testing', 'Belt testing and examinations', 'bg-yellow-100 text-yellow-800', 'border-yellow-200', 'bg-yellow-900 text-yellow-200', 3),
    ('seminar', 'Seminar', 'Educational seminars and workshops', 'bg-blue-100 text-blue-800', 'border-blue-200', 'bg-blue-900 text-blue-200', 4),
    ('workshop', 'Workshop', 'Hands-on training workshops', 'bg-blue-100 text-blue-800', 'border-blue-200', 'bg-blue-900 text-blue-200', 5),
    ('social_event', 'Social Event', 'Community and social gatherings', 'bg-green-100 text-green-800', 'border-green-200', 'bg-green-900 text-green-200', 6),
    ('fundraiser', 'Fundraiser', 'Fundraising events and activities', 'bg-purple-100 text-purple-800', 'border-purple-200', 'bg-purple-900 text-purple-200', 7),
    ('other', 'Other', 'Other types of events', 'bg-gray-100 text-gray-800', 'border-gray-200', 'bg-gray-900 text-gray-200', 8)
ON CONFLICT (name) DO NOTHING;

-- Enable RLS (Row Level Security)
ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;

-- Create policies for event_types
-- Allow all users to read event types
CREATE POLICY "Allow read access to event_types" ON event_types
    FOR SELECT USING (true);

-- Allow authenticated users to manage event types (admin functionality)
CREATE POLICY "Allow authenticated users to manage event_types" ON event_types
    FOR ALL USING (auth.role() = 'authenticated');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_types_name ON event_types(name);
CREATE INDEX IF NOT EXISTS idx_event_types_active ON event_types(is_active);
CREATE INDEX IF NOT EXISTS idx_event_types_sort_order ON event_types(sort_order);

-- Add comment to table
COMMENT ON TABLE event_types IS 'Dynamic event type configuration with rich metadata';
COMMENT ON COLUMN event_types.name IS 'Unique identifier for the event type (used in code)';
COMMENT ON COLUMN event_types.display_name IS 'Human-readable name for the event type';
COMMENT ON COLUMN event_types.color_class IS 'CSS classes for styling the event type badge';
COMMENT ON COLUMN event_types.border_class IS 'CSS classes for border styling';
COMMENT ON COLUMN event_types.dark_mode_class IS 'CSS classes for dark mode styling';
COMMENT ON COLUMN event_types.sort_order IS 'Order for displaying event types in lists';