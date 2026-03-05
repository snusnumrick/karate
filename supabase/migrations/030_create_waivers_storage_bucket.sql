-- Migration: Create Waivers Storage Bucket
-- Purpose: Set up Supabase Storage for waiver PDFs with RLS policies
-- Related: docs/WAIVER_LEGAL_COMPLIANCE_IMPLEMENTATION.md

-- ============================================================================
-- PART 1: Create the waivers storage bucket
-- ============================================================================

-- Insert bucket if it doesn't exist
-- public=false ensures files are not publicly accessible without authentication
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'waivers',
  'waivers',
  false, -- Not public - requires authentication
  5242880, -- 5MB limit per file (waivers should be small)
  ARRAY['application/pdf']::text[] -- Only allow PDF files
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE storage.buckets IS 'Storage buckets for various file types';

-- ============================================================================
-- PART 2: RLS Policies for waivers bucket
-- ============================================================================

-- Policy 1: Authenticated users can upload waivers
-- This allows the signing flow to upload PDFs when guardians sign
CREATE POLICY "Authenticated users can upload waivers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'waivers'
  AND auth.uid() IS NOT NULL
);

-- Policy 2: Users can read their own family's waivers
-- This allows families to download their own signed waivers
CREATE POLICY "Users can read family waivers"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'waivers'
  AND (
    -- User can read if they signed the waiver
    auth.uid() IN (
      SELECT ws.user_id
      FROM waiver_signatures ws
      WHERE ws.pdf_storage_path = name
    )
    OR
    -- User can read if waiver is for their family
    auth.uid() IN (
      SELECT p.id
      FROM profiles p
      INNER JOIN waiver_signatures ws ON ws.user_id IN (
        SELECT p2.id
        FROM profiles p2
        WHERE p2.family_id = p.family_id
      )
      WHERE ws.pdf_storage_path = name
    )
  )
);

-- Policy 3: Admins can read all waivers
-- This allows admin panel to access any waiver PDF
CREATE POLICY "Admins can read all waivers"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'waivers'
  AND EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

-- Policy 4: Admins can delete waivers (for cleanup/corrections)
CREATE POLICY "Admins can delete waivers"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'waivers'
  AND EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

-- Policy 5: Users can update/replace their own family's waivers (if needed for corrections)
CREATE POLICY "Users can update family waivers"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'waivers'
  AND auth.uid() IN (
    SELECT ws.user_id
    FROM waiver_signatures ws
    WHERE ws.pdf_storage_path = name
  )
);

-- ============================================================================
-- PART 3: Grant permissions
-- ============================================================================

-- Ensure authenticated users can access storage functions
GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO authenticated;

-- ============================================================================
-- PART 4: Migration summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 030 completed successfully';
  RAISE NOTICE '   - Created waivers storage bucket';
  RAISE NOTICE '   - Bucket settings:';
  RAISE NOTICE '     • Public: false (authentication required)';
  RAISE NOTICE '     • File size limit: 5MB';
  RAISE NOTICE '     • Allowed types: application/pdf only';
  RAISE NOTICE '   - Created RLS policies:';
  RAISE NOTICE '     • Authenticated users can upload';
  RAISE NOTICE '     • Users can read their family waivers';
  RAISE NOTICE '     • Admins can read all waivers';
  RAISE NOTICE '     • Admins can delete waivers';
  RAISE NOTICE '     • Users can update their family waivers';
  RAISE NOTICE '';
  RAISE NOTICE '📁 Storage bucket ready for waiver PDFs';
END $$;
