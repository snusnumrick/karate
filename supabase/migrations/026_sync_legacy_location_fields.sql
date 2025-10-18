-- Migration to sync legacy location fields with structured location fields
-- This ensures backward compatibility while supporting the new structured location format

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to build a full address string from structured fields
CREATE OR REPLACE FUNCTION build_address_from_structured_fields(
    p_street_address text,
    p_locality text,
    p_region text,
    p_postal_code text,
    p_country text
) RETURNS text AS $$
DECLARE
    address_parts text[] := '{}';
    result text;
BEGIN
    -- Add non-null parts to array
    IF p_street_address IS NOT NULL AND p_street_address != '' THEN
        address_parts := array_append(address_parts, p_street_address);
    END IF;

    IF p_locality IS NOT NULL AND p_locality != '' THEN
        address_parts := array_append(address_parts, p_locality);
    END IF;

    -- Combine region and postal code on same line if both exist
    IF p_region IS NOT NULL AND p_region != '' AND p_postal_code IS NOT NULL AND p_postal_code != '' THEN
        address_parts := array_append(address_parts, p_region || ' ' || p_postal_code);
    ELSIF p_region IS NOT NULL AND p_region != '' THEN
        address_parts := array_append(address_parts, p_region);
    ELSIF p_postal_code IS NOT NULL AND p_postal_code != '' THEN
        address_parts := array_append(address_parts, p_postal_code);
    END IF;

    IF p_country IS NOT NULL AND p_country != '' THEN
        address_parts := array_append(address_parts, p_country);
    END IF;

    -- Join with comma and space
    result := array_to_string(address_parts, ', ');

    -- Return NULL if empty
    IF result = '' THEN
        RETURN NULL;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to parse address string into structured fields
-- Note: This is a best-effort parser for common Canadian address formats
CREATE OR REPLACE FUNCTION parse_address_to_structured_fields(
    p_address text,
    OUT street_address text,
    OUT locality text,
    OUT region text,
    OUT postal_code text,
    OUT country text
) AS $$
DECLARE
    address_clean text;
    parts text[];
    last_part text;
    second_last_part text;
BEGIN
    -- Return NULL values if input is empty
    IF p_address IS NULL OR trim(p_address) = '' THEN
        RETURN;
    END IF;

    -- Clean and split by comma
    address_clean := trim(p_address);
    parts := string_to_array(address_clean, ',');

    -- Trim all parts
    FOR i IN 1..array_length(parts, 1) LOOP
        parts[i] := trim(parts[i]);
    END LOOP;

    -- Extract country (usually last part if it's a country name)
    IF array_length(parts, 1) >= 1 THEN
        last_part := parts[array_length(parts, 1)];
        IF last_part ~* '^(Canada|United States|USA|US|CA)$' THEN
            country := last_part;
            parts := parts[1:array_length(parts, 1) - 1];
        END IF;
    END IF;

    -- Extract region and postal code (second to last part, format: "ON M5V 3A8" or "BC V8W 1A1")
    IF array_length(parts, 1) >= 1 THEN
        second_last_part := parts[array_length(parts, 1)];

        -- Check if it contains a Canadian postal code pattern (A1A 1A1 or A1A1A1)
        IF second_last_part ~* '[A-Z]\d[A-Z]\s?\d[A-Z]\d' THEN
            -- Extract postal code
            postal_code := (regexp_matches(second_last_part, '([A-Z]\d[A-Z]\s?\d[A-Z]\d)', 'i'))[1];

            -- Extract region (province code before postal code)
            region := trim(regexp_replace(second_last_part, '[A-Z]\d[A-Z]\s?\d[A-Z]\d', '', 'i'));

            -- Remove this part from array
            parts := parts[1:array_length(parts, 1) - 1];
        ELSIF second_last_part ~* '^(ON|BC|AB|SK|MB|QC|NB|NS|PE|NL|YT|NT|NU)$' THEN
            -- Just a province code
            region := second_last_part;
            parts := parts[1:array_length(parts, 1) - 1];
        END IF;
    END IF;

    -- Extract locality (city - now should be last remaining part)
    IF array_length(parts, 1) >= 1 THEN
        locality := parts[array_length(parts, 1)];
        parts := parts[1:array_length(parts, 1) - 1];
    END IF;

    -- Everything else is street address
    IF array_length(parts, 1) >= 1 THEN
        street_address := array_to_string(parts, ', ');
    END IF;

    RETURN;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger function to sync address from structured fields
CREATE OR REPLACE FUNCTION sync_address_from_structured_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update address if any structured field has a value
    IF NEW.street_address IS NOT NULL OR
       NEW.locality IS NOT NULL OR
       NEW.region IS NOT NULL OR
       NEW.postal_code IS NOT NULL OR
       NEW.country IS NOT NULL THEN

        NEW.address := build_address_from_structured_fields(
            NEW.street_address,
            NEW.locality,
            NEW.region,
            NEW.postal_code,
            NEW.country
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to parse address into structured fields
CREATE OR REPLACE FUNCTION parse_address_to_structured()
RETURNS TRIGGER AS $$
DECLARE
    parsed record;
BEGIN
    -- Only parse if address exists and ALL structured fields are empty
    IF NEW.address IS NOT NULL AND
       NEW.address != '' AND
       NEW.street_address IS NULL AND
       NEW.locality IS NULL AND
       NEW.region IS NULL AND
       NEW.postal_code IS NULL THEN

        -- Parse the address
        SELECT * INTO parsed FROM parse_address_to_structured_fields(NEW.address);

        -- Update structured fields
        NEW.street_address := parsed.street_address;
        NEW.locality := parsed.locality;
        NEW.region := parsed.region;
        NEW.postal_code := parsed.postal_code;
        NEW.country := COALESCE(parsed.country, NEW.country); -- Preserve existing country if not in address
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_sync_address_from_structured ON events;
DROP TRIGGER IF EXISTS trigger_parse_address_to_structured ON events;

-- Create trigger to sync address from structured fields (runs first)
CREATE TRIGGER trigger_sync_address_from_structured
    BEFORE INSERT OR UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION sync_address_from_structured_fields();

-- Create trigger to parse address into structured fields (runs second, only if structured fields are empty)
CREATE TRIGGER trigger_parse_address_to_structured
    BEFORE INSERT OR UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION parse_address_to_structured();

-- ============================================================================
-- ONE-TIME DATA SYNC FOR EXISTING EVENTS
-- ============================================================================

-- Step 1: Build address from structured fields where we have structured data but no address
DO $$
DECLARE
    updated_count integer;
BEGIN
    UPDATE events
    SET address = build_address_from_structured_fields(
        street_address,
        locality,
        region,
        postal_code,
        country
    )
    WHERE (street_address IS NOT NULL OR
           locality IS NOT NULL OR
           region IS NOT NULL OR
           postal_code IS NOT NULL OR
           country IS NOT NULL)
      AND (address IS NULL OR address = '');

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Synced address field for % events with structured location data', updated_count;
END $$;

-- Step 2: Parse address into structured fields where we have address but no structured data
DO $$
DECLARE
    updated_count integer;
    event_record record;
    parsed record;
BEGIN
    updated_count := 0;

    FOR event_record IN
        SELECT id, address
        FROM events
        WHERE address IS NOT NULL
          AND address != ''
          AND street_address IS NULL
          AND locality IS NULL
          AND region IS NULL
          AND postal_code IS NULL
    LOOP
        -- Parse the address
        SELECT * INTO parsed FROM parse_address_to_structured_fields(event_record.address);

        -- Update the event with parsed data
        UPDATE events
        SET street_address = parsed.street_address,
            locality = parsed.locality,
            region = parsed.region,
            postal_code = parsed.postal_code,
            country = COALESCE(parsed.country, country)
        WHERE id = event_record.id;

        updated_count := updated_count + 1;
    END LOOP;

    RAISE NOTICE 'Parsed and populated structured fields for % events with legacy address data', updated_count;
END $$;

-- Step 3: Report on final sync status
DO $$
DECLARE
    total_events integer;
    events_with_structured integer;
    events_with_address integer;
    events_with_both integer;
BEGIN
    SELECT COUNT(*) INTO total_events FROM events;

    SELECT COUNT(*) INTO events_with_structured
    FROM events
    WHERE street_address IS NOT NULL OR locality IS NOT NULL OR region IS NOT NULL;

    SELECT COUNT(*) INTO events_with_address
    FROM events
    WHERE address IS NOT NULL AND address != '';

    SELECT COUNT(*) INTO events_with_both
    FROM events
    WHERE (street_address IS NOT NULL OR locality IS NOT NULL OR region IS NOT NULL)
      AND address IS NOT NULL AND address != '';

    RAISE NOTICE '=== Location Field Sync Summary ===';
    RAISE NOTICE 'Total events: %', total_events;
    RAISE NOTICE 'Events with structured location data: %', events_with_structured;
    RAISE NOTICE 'Events with address field: %', events_with_address;
    RAISE NOTICE 'Events with both formats: %', events_with_both;
    RAISE NOTICE '===================================';
END $$;

-- Add helpful comments to the columns
COMMENT ON COLUMN events.location IS 'Legacy: Simple location/venue name. Use this for display. Triggers keep this separate from structured fields.';
COMMENT ON COLUMN events.address IS 'Legacy: Full address string (auto-generated from structured fields via trigger for backward compatibility)';
COMMENT ON COLUMN events.location_name IS 'Structured: Detailed venue name for metadata and SEO (optional, more specific than location)';
COMMENT ON COLUMN events.street_address IS 'Structured: Street address (e.g., "123 Main St")';
COMMENT ON COLUMN events.locality IS 'Structured: City/locality (e.g., "Toronto")';
COMMENT ON COLUMN events.region IS 'Structured: Province/state (e.g., "ON")';
COMMENT ON COLUMN events.postal_code IS 'Structured: Postal/zip code (e.g., "M5V 3A8")';
COMMENT ON COLUMN events.country IS 'Structured: Country (e.g., "Canada")';
