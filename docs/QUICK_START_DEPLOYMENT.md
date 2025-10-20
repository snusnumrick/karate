# Waiver System - Quick Start Deployment Guide

**For Hosted Supabase Projects**

## TL;DR - What You Need to Do

### 1. Run Database Migration (SQL Editor)

In Supabase SQL Editor, paste and run:

```sql
-- File: supabase/migrations/029_add_student_ids_and_pdf_to_waiver_signatures.sql
```

✅ Expected: Migration success message with summary

### 2. Create Storage Bucket (Dashboard)

**⚠️ Cannot use SQL - Must use dashboard**

1. **Supabase Dashboard** → **Storage** → **New bucket**
2. Settings:
   - Name: `waivers`
   - Public: **OFF**
   - File size limit: `5242880` (5MB)
   - Allowed MIME types: `application/pdf`
3. Click **Create**

### 3. Add RLS Policies (SQL Editor)

Copy all 5 policies from `supabase/migrations/030_create_waivers_storage_bucket.sql` (lines with `CREATE POLICY`) and run in SQL Editor.

Or use this condensed version:

```sql
-- 1. Upload policy
CREATE POLICY "Authenticated users can upload waivers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'waivers' AND auth.uid() IS NOT NULL);

-- 2. Read (families)
CREATE POLICY "Users can read family waivers"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'waivers' AND (
    auth.uid() IN (
      SELECT ws.user_id FROM waiver_signatures ws
      WHERE ws.pdf_storage_path = name
    )
    OR auth.uid() IN (
      SELECT p.id FROM profiles p
      INNER JOIN waiver_signatures ws ON ws.user_id IN (
        SELECT p2.id FROM profiles p2 WHERE p2.family_id = p.family_id
      )
      WHERE ws.pdf_storage_path = name
    )
  )
);

-- 3. Read (admins)
CREATE POLICY "Admins can read all waivers"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'waivers' AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. Delete (admins)
CREATE POLICY "Admins can delete waivers"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'waivers' AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 5. Update (families)
CREATE POLICY "Users can update family waivers"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'waivers' AND auth.uid() IN (
    SELECT ws.user_id FROM waiver_signatures ws WHERE ws.pdf_storage_path = name
  )
);
```

### 4. Regenerate TypeScript Types

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > app/types/database.types.ts
```

### 5. Verify

```bash
npm run typecheck
# Should show 0 errors ✅
```

### 6. Test

```bash
npm run dev
# Navigate to /family/waivers
# Sign a test waiver
# Verify PDF downloads
```

---

## Troubleshooting

**Q: Migration 030 gives "must be owner of table buckets" error**
- A: Normal! Use dashboard instead (Step 2 above)

**Q: TypeScript still shows errors after migration**
- A: Run step 4 (regenerate types)

**Q: Can't upload PDFs**
- A: Check RLS policies were created (Step 3)

**Q: Families can't download PDFs**
- A: Verify "Users can read family waivers" policy exists

---

For detailed information, see `WAIVER_DEPLOYMENT_CHECKLIST.md`
