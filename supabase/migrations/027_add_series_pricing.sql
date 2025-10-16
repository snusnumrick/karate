-- Migration 027: Add Series-Level Pricing
-- Allows seminar series to override the default seminar price
-- When null, the series uses the seminar's default price

-- ============================================================================
-- CLASSES TABLE EXTENSIONS (Series Pricing)
-- ============================================================================

-- Add pricing override for series
ALTER TABLE public.classes
    ADD COLUMN IF NOT EXISTS price_override_cents INT4 NULL CHECK (price_override_cents >= 0),
    ADD COLUMN IF NOT EXISTS registration_fee_override_cents INT4 NULL CHECK (registration_fee_override_cents >= 0);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.classes.price_override_cents IS 'Override price for this series in cents (null = use seminar default price)';
COMMENT ON COLUMN public.classes.registration_fee_override_cents IS 'Override registration fee for this series in cents (null = use seminar default)';
