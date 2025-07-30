-- Migration to add structured location fields to events table
-- This allows events to have detailed address information for better metadata and SEO

-- Add structured location fields to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS location_name text,
ADD COLUMN IF NOT EXISTS street_address text,
ADD COLUMN IF NOT EXISTS locality text,
ADD COLUMN IF NOT EXISTS region text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS country text DEFAULT 'CA';

-- Add comments for clarity
COMMENT ON COLUMN events.location IS 'Simple location name (e.g., "Community Center", "Downtown Dojo")';
COMMENT ON COLUMN events.address IS 'Full address as a single string (for backward compatibility)';
COMMENT ON COLUMN events.location_name IS 'Structured location name for metadata';
COMMENT ON COLUMN events.street_address IS 'Street address (e.g., "123 Main St")';
COMMENT ON COLUMN events.locality IS 'City/locality (e.g., "Victoria")';
COMMENT ON COLUMN events.region IS 'Province/state (e.g., "BC")';
COMMENT ON COLUMN events.postal_code IS 'Postal/zip code (e.g., "V8W 1A1")';
COMMENT ON COLUMN events.country IS 'Country code (e.g., "CA")';

-- Create index for location searches
CREATE INDEX IF NOT EXISTS idx_events_locality ON events(locality);
CREATE INDEX IF NOT EXISTS idx_events_region ON events(region);