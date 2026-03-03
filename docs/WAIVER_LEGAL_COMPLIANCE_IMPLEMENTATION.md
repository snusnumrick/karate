# Waiver System Legal Compliance Implementation

## Executive Summary

This document outlines the implementation plan to enhance the waiver system for legal compliance with British Columbia contract law. The primary issue is that current waiver signatures do not explicitly record which student(s) they apply to, creating legal ambiguity and potential unenforceability.

## Legal Background

### BC-Specific Requirements

1. **Minors (Under 19)**: Waivers signed by parents on behalf of minors are **unenforceable** in BC due to the Infants Act
   - Landmark case: *Wong v. Lok's Martial Arts Centre Inc.* (2009 BCSC 1385) - martial arts context
   - Parents cannot waive a minor's right to sue for negligence
   - **Alternative**: Use indemnity agreements where parents promise to reimburse if sued

2. **Contract Law Requirements**:
   - "If the exact name of the person or legal entity is not mentioned as a party, then they will not be able to rely on the liability waiver to protect them"
   - Waivers must specifically identify all parties
   - Generic references are insufficient

3. **Valid Waiver Requirements** (for adults 19+):
   - Clear purpose for hazardous activity
   - Short and easy to read
   - Common practice for the activity
   - Adequate time to read
   - **Specific identification of parties**

### Current System Gaps

**Database Schema:**
```sql
-- Current waiver_signatures table
CREATE TABLE waiver_signatures (
    id uuid,
    waiver_id uuid,
    user_id uuid,           -- Guardian who signed
    signature_data text,
    signed_at timestamptz,
    agreement_version text
    -- ❌ NO student_ids column
    -- ❌ NO pdf_storage_path column
);
```

**Problems:**
- No explicit record of which student(s) the signature covers
- Cannot prove which child was covered at time of signing
- Ambiguous if family has multiple children
- Only inferred through database joins (not legally binding)

## Solution: Hybrid Database + PDF Approach

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│              Waiver Signing Flow                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Determine which students need waiver           │
│     ├─> Query enrollments                          │
│     └─> Identify students by ID and name           │
│                                                     │
│  2. Present waiver with student context            │
│     ├─> Show waiver content                        │
│     ├─> Display: "For [Student Name(s)]"           │
│     └─> Capture guardian signature                 │
│                                                     │
│  3. Generate self-contained PDF                    │
│     ├─> Full waiver text                           │
│     ├─> Student name(s) explicitly listed          │
│     ├─> Guardian name and signature image          │
│     ├─> Date/time signed                           │
│     └─> Unique signature ID                        │
│                                                     │
│  4. Store in Supabase Storage                      │
│     ├─> Upload PDF to secure bucket                │
│     └─> Get storage path                           │
│                                                     │
│  5. Save database record                           │
│     ├─> waiver_id                                  │
│     ├─> user_id (guardian)                         │
│     ├─> student_ids[] (NEW - array of UUIDs)       │
│     ├─> signature_data (base64 for display)        │
│     ├─> pdf_storage_path (NEW - path to PDF)       │
│     └─> signed_at                                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Benefits

✅ **Legal Clarity**: Explicit student identification in both DB and PDF
✅ **Self-Contained Records**: PDF stands alone as legal document
✅ **Audit Trail**: Complete, immutable record of what was signed
✅ **Family Convenience**: Download and keep copies
✅ **Query Performance**: Database records for fast lookups
✅ **Insurance Compliance**: Professional documentation for claims

## Implementation Plan

### Phase 1: Database Schema Updates

**File**: `supabase/migrations/029_add_student_ids_and_pdf_to_waiver_signatures.sql`

```sql
-- Add student_ids array column
ALTER TABLE waiver_signatures
  ADD COLUMN IF NOT EXISTS student_ids UUID[] DEFAULT '{}';

-- Add PDF storage path column
ALTER TABLE waiver_signatures
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;

-- Add index for querying by student
CREATE INDEX IF NOT EXISTS idx_waiver_signatures_student_ids
  ON waiver_signatures USING GIN (student_ids);

-- Add comments
COMMENT ON COLUMN waiver_signatures.student_ids IS
  'Array of student IDs that this waiver signature covers';
COMMENT ON COLUMN waiver_signatures.pdf_storage_path IS
  'Path to the generated PDF in Supabase Storage (e.g., waivers/abc123.pdf)';

-- Update existing records (set empty array for legacy signatures)
UPDATE waiver_signatures
SET student_ids = '{}'
WHERE student_ids IS NULL;
```

**Migration Tasks:**
- Create migration file
- Test in development
- Document rollback procedure
- Plan production deployment

### Phase 2: PDF Generation Infrastructure

**File**: `app/components/pdf/WaiverPDFTemplate.tsx`

```tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import { siteConfig } from '~/config/site';

interface WaiverPDFTemplateProps {
  waiver: {
    id: string;
    title: string;
    content: string;
  };
  signature: {
    id: string;
    signedAt: string;
    signatureImage: string; // base64
  };
  guardian: {
    firstName: string;
    lastName: string;
  };
  students: {
    id: string;
    firstName: string;
    lastName: string;
  }[];
  program?: {
    name: string;
  };
}

export function WaiverPDFTemplate({
  waiver,
  signature,
  guardian,
  students,
  program
}: WaiverPDFTemplateProps) {
  // Styles following InvoiceTemplate.tsx patterns
  // Include: header, waiver content, student list, signature section
  // Return <Document><Page>...</Page></Document>
}
```

**File**: `app/utils/waiver-pdf-generator.server.ts`

```tsx
import { renderToBuffer } from '@react-pdf/renderer';
import { WaiverPDFTemplate } from '~/components/pdf/WaiverPDFTemplate';

export async function generateWaiverPDF(params: {
  waiver: WaiverData;
  signature: SignatureData;
  guardian: GuardianData;
  students: StudentData[];
  program?: ProgramData;
}): Promise<Buffer> {
  // Similar to generateInvoicePDF
  // Sanitize text data
  // Render PDF buffer
  // Return buffer
}

export function generateWaiverFilename(
  waiverId: string,
  studentNames: string[]
): string {
  const dateStr = new Date().toISOString().split('T')[0];
  const studentStr = studentNames.join('_').replace(/[^a-zA-Z0-9]/g, '_');
  return `waiver_${studentStr}_${dateStr}.pdf`;
}
```

### Phase 3: Supabase Storage Setup

**Storage Bucket Configuration:**

```sql
-- Create waivers bucket (run in Supabase SQL Editor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('waivers', 'waivers', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for waivers bucket
-- Policy 1: Authenticated users can upload
CREATE POLICY "Authenticated users can upload waivers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'waivers');

-- Policy 2: Users can read their own family's waivers
CREATE POLICY "Users can read family waivers"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'waivers'
  AND auth.uid() IN (
    SELECT p.id
    FROM profiles p
    INNER JOIN waiver_signatures ws ON ws.user_id = p.id
    WHERE ws.pdf_storage_path = name
  )
);

-- Policy 3: Admins can read all waivers
CREATE POLICY "Admins can read all waivers"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'waivers'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);
```

**Helper Functions** (`app/utils/waiver-storage.server.ts`):

```tsx
import { getSupabaseAdminClient } from '~/utils/supabase.server';

export async function uploadWaiverPDF(
  pdfBuffer: Buffer,
  filename: string
): Promise<string> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.storage
    .from('waivers')
    .upload(filename, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (error) throw new Error(`Failed to upload waiver PDF: ${error.message}`);

  return data.path; // Returns path like "abc123.pdf"
}

export async function downloadWaiverPDF(
  path: string
): Promise<Blob> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.storage
    .from('waivers')
    .download(path);

  if (error) throw new Error(`Failed to download waiver PDF: ${error.message}`);

  return data;
}

export function getWaiverPDFUrl(path: string): string {
  const supabase = getSupabaseAdminClient();

  const { data } = supabase.storage
    .from('waivers')
    .getPublicUrl(path);

  return data.publicUrl;
}
```

### Phase 4: Update Signing Flow

**File**: `app/routes/_layout.family.waivers.$id.sign.tsx`

**Loader Changes:**

```tsx
export async function loader({request, params}: LoaderFunctionArgs) {
  const waiverId = params.id!;
  const {supabaseServer} = getSupabaseServerClient(request);

  const {data: {user}} = await supabaseServer.auth.getUser();
  if (!user) return redirect('/login?redirectTo=/family/waivers');

  // Get profile and family
  const {data: profile} = await supabaseServer
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (!profile?.family_id) {
    throw new Response("Family not found", {status: 404});
  }

  // Get guardian info
  const {data: guardian} = await supabaseServer
    .from('guardians')
    .select('first_name, last_name')
    .eq('family_id', profile.family_id)
    .limit(1)
    .single();

  // Get waiver
  const {data: waiver} = await supabaseServer
    .from('waivers')
    .select('*')
    .eq('id', waiverId)
    .single();

  if (!waiver) return redirect('/family/waivers');

  // Check if already signed
  const {data: existingSignature} = await supabaseServer
    .from('waiver_signatures')
    .select('*')
    .eq('waiver_id', waiverId)
    .eq('user_id', user.id)
    .single();

  if (existingSignature) return redirect('/family/waivers');

  // ✨ NEW: Determine which students need this waiver
  const studentsNeedingWaiver = await determineStudentsForWaiver(
    profile.family_id,
    waiverId,
    supabaseServer
  );

  // Get redirectTo parameter
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirectTo');

  return json({
    waiver,
    userId: user.id,
    firstName: guardian.first_name,
    lastName: guardian.last_name,
    studentsNeedingWaiver, // ✨ NEW
    redirectTo
  });
}

// ✨ NEW: Helper function
async function determineStudentsForWaiver(
  familyId: string,
  waiverId: string,
  supabase: SupabaseClient
) {
  // Check if it's a registration waiver
  const {data: waiver} = await supabase
    .from('waivers')
    .select('required_for_registration')
    .eq('id', waiverId)
    .single();

  if (waiver?.required_for_registration) {
    // Registration waiver applies to all students
    const {data: students} = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('family_id', familyId);
    return students || [];
  }

  // Program-specific waiver: find students enrolled in programs requiring it
  const {data: enrollments} = await supabase
    .from('enrollments')
    .select(`
      student:students!inner(
        id,
        first_name,
        last_name
      ),
      program:programs!inner(
        program_waivers!inner(
          waiver_id
        )
      )
    `)
    .eq('program.program_waivers.waiver_id', waiverId)
    .in('status', ['active', 'trial', 'pending_waivers']);

  const uniqueStudents = new Map();
  enrollments?.forEach(e => {
    const student = e.student;
    if (student && !uniqueStudents.has(student.id)) {
      uniqueStudents.set(student.id, student);
    }
  });

  return Array.from(uniqueStudents.values());
}
```

**UI Changes:**

```tsx
export default function SignWaiver() {
  const {
    waiver,
    firstName,
    lastName,
    studentsNeedingWaiver, // ✨ NEW
    redirectTo
  } = useLoaderData<typeof loader>();

  // ... existing state ...

  return (
    <div className="min-h-screen page-background-styles py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Existing breadcrumb and header */}

        {/* ✨ NEW: Show which students this applies to */}
        {studentsNeedingWaiver && studentsNeedingWaiver.length > 0 && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Students Covered by This Waiver</AlertTitle>
            <AlertDescription>
              This waiver will be signed on behalf of:
              <ul className="mt-2 list-disc list-inside">
                {studentsNeedingWaiver.map(student => (
                  <li key={student.id}>
                    {student.first_name} {student.last_name}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="form-container-styles p-8">
          {/* Waiver content */}
          <div className="mb-8 p-6 border rounded">
            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
              {waiver.content}
            </div>
          </div>

          <Form method="post" onSubmit={handleSubmit}>
            <AuthenticityTokenInput />

            {/* Signature canvas (existing) */}
            {/* ... */}

            <input type="hidden" name="signature" value={signatureData}/>
            {/* ✨ NEW: Pass student IDs */}
            <input
              type="hidden"
              name="studentIds"
              value={JSON.stringify(studentsNeedingWaiver.map(s => s.id))}
            />
            {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo}/>}

            {/* Agreement checkbox */}
            <div className="mb-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="agreement"
                  name="agreement"
                  checked={isAgreed}
                  onCheckedChange={(checked) => setIsAgreed(Boolean(checked))}
                />
                <Label htmlFor="agreement">
                  {/* ✨ UPDATED: Include student names */}
                  <span className="dark:text-gray-300">
                    I, {firstName} {lastName}, on behalf of{' '}
                    {studentsNeedingWaiver.length === 1
                      ? `${studentsNeedingWaiver[0].first_name} ${studentsNeedingWaiver[0].last_name}`
                      : studentsNeedingWaiver.map((s, i) =>
                          `${s.first_name} ${s.last_name}${i < studentsNeedingWaiver.length - 1 ? ', ' : ''}`
                        ).join('')
                    }, have read and agree to the terms outlined in this document.
                  </span>
                </Label>
              </div>
            </div>

            {/* Submit button (existing) */}
          </Form>
        </div>
      </div>
    </div>
  );
}
```

**Action Changes:**

```tsx
import { generateWaiverPDF, generateWaiverFilename } from '~/utils/waiver-pdf-generator.server';
import { uploadWaiverPDF } from '~/utils/waiver-storage.server';

export async function action({request, params}: ActionFunctionArgs) {
  const waiverId = params.id!;
  const {supabaseServer} = getSupabaseServerClient(request);

  const {data: {user}} = await supabaseServer.auth.getUser();
  if (!user) {
    return json({success: false, error: 'User not authenticated'});
  }

  await csrf.validate(request);
  const formData = await request.formData();
  const signature = formData.get('signature') as string;
  const agreement = formData.get('agreement') === 'on';
  const studentIdsJson = formData.get('studentIds') as string; // ✨ NEW
  const redirectTo = formData.get('redirectTo') as string;

  if (!signature || !agreement) {
    return json({
      success: false,
      error: !signature ? 'Signature is required' : 'You must agree to the terms'
    });
  }

  // ✨ NEW: Parse student IDs
  let studentIds: string[] = [];
  try {
    studentIds = JSON.parse(studentIdsJson);
  } catch (e) {
    return json({success: false, error: 'Invalid student data'});
  }

  // Fetch data needed for PDF generation
  const supabaseAdmin = getSupabaseAdminClient();

  const {data: waiver} = await supabaseAdmin
    .from('waivers')
    .select('id, title, content')
    .eq('id', waiverId)
    .single();

  const {data: profile} = await supabaseAdmin
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  const {data: guardian} = await supabaseAdmin
    .from('guardians')
    .select('first_name, last_name')
    .eq('family_id', profile.family_id)
    .limit(1)
    .single();

  const {data: students} = await supabaseAdmin
    .from('students')
    .select('id, first_name, last_name')
    .in('id', studentIds);

  // ✨ NEW: Generate PDF
  const signatureId = crypto.randomUUID();
  const pdfBuffer = await generateWaiverPDF({
    waiver: {
      id: waiver.id,
      title: waiver.title,
      content: waiver.content,
    },
    signature: {
      id: signatureId,
      signedAt: new Date().toISOString(),
      signatureImage: signature,
    },
    guardian: {
      firstName: guardian.first_name,
      lastName: guardian.last_name,
    },
    students: students.map(s => ({
      id: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
    })),
  });

  // ✨ NEW: Upload PDF to storage
  const filename = generateWaiverFilename(
    waiverId,
    students.map(s => `${s.first_name}_${s.last_name}`)
  );
  const pdfPath = await uploadWaiverPDF(pdfBuffer, filename);

  // ✨ UPDATED: Save signature with student IDs and PDF path
  const {error} = await supabaseAdmin
    .from('waiver_signatures')
    .insert({
      id: signatureId,
      waiver_id: waiverId,
      user_id: user.id,
      student_ids: studentIds, // ✨ NEW
      signature_data: signature,
      signed_at: new Date().toISOString(),
      agreement_version: waiverId,
      pdf_storage_path: pdfPath, // ✨ NEW
    });

  if (error) {
    console.error('Error saving signature:', error);
    return json({success: false, error: 'Failed to save signature'});
  }

  if (redirectTo) {
    return redirect(redirectTo);
  }

  return redirect('/family/waivers');
}
```

### Phase 5: Family Portal Updates

**File**: `app/routes/_layout.family.waivers._index.tsx`

Add PDF download functionality:

```tsx
import { Download } from 'lucide-react';

// In loader, fetch signed waivers with PDF paths
const {data: signedWaivers} = await supabaseServer
  .from('waiver_signatures')
  .select(`
    id,
    signed_at,
    student_ids,
    pdf_storage_path,
    waiver:waivers(
      id,
      title,
      description
    )
  `)
  .eq('user_id', user.id);

// In component, add download button
{signedWaivers.map(sig => (
  <div key={sig.id} className="border rounded p-4">
    <h3 className="font-semibold">{sig.waiver.title}</h3>
    <p className="text-sm text-gray-600">
      Signed on {formatDate(sig.signed_at)}
    </p>

    {/* ✨ NEW: Show students covered */}
    {sig.student_ids && sig.student_ids.length > 0 && (
      <p className="text-sm text-gray-600 mt-2">
        Students: {/* fetch and display student names */}
      </p>
    )}

    {/* ✨ NEW: Download button */}
    {sig.pdf_storage_path && (
      <form method="post" action={`/family/waivers/${sig.id}/download`}>
        <Button type="submit" variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </form>
    )}
  </div>
))}
```

**New Route**: `app/routes/_layout.family.waivers.$id.download.tsx`

```tsx
import { downloadWaiverPDF } from '~/utils/waiver-storage.server';

export async function action({request, params}: ActionFunctionArgs) {
  const signatureId = params.id!;
  const {supabaseServer} = getSupabaseServerClient(request);

  const {data: {user}} = await supabaseServer.auth.getUser();
  if (!user) return redirect('/login');

  // Verify user owns this signature
  const {data: signature} = await supabaseServer
    .from('waiver_signatures')
    .select('pdf_storage_path, waiver:waivers(title)')
    .eq('id', signatureId)
    .eq('user_id', user.id)
    .single();

  if (!signature?.pdf_storage_path) {
    throw new Response('PDF not found', {status: 404});
  }

  const pdfBlob = await downloadWaiverPDF(signature.pdf_storage_path);
  const buffer = await pdfBlob.arrayBuffer();

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${signature.waiver.title.replace(/[^a-z0-9]/gi, '_')}.pdf"`,
    },
  });
}
```

### Phase 6: Admin Features

**File**: `app/routes/admin.waivers._index.tsx`

Update to show student coverage:

```tsx
// In loader, join with students
const {data: signatures} = await supabaseAdmin
  .from('waiver_signatures')
  .select(`
    id,
    signed_at,
    student_ids,
    pdf_storage_path,
    user:profiles(
      id,
      family:families(
        name
      )
    ),
    waiver:waivers(
      id,
      title
    )
  `);

// Fetch student names for display
const studentIds = signatures.flatMap(s => s.student_ids || []);
const {data: students} = await supabaseAdmin
  .from('students')
  .select('id, first_name, last_name')
  .in('id', studentIds);

const studentMap = new Map(
  students.map(s => [s.id, `${s.first_name} ${s.last_name}`])
);

// In component, display student names and download link
```

**File**: `app/routes/admin.waivers.missing.tsx`

Update to be more specific about which students need waivers:

```tsx
// Already has student context from enrollment_waiver_status view
// Just add PDF download capability for signed waivers
```

### Phase 7: Service Function Updates

**File**: `app/services/waiver.server.ts`

Add new helper functions:

```tsx
/**
 * Get students covered by a waiver signature
 */
export async function getSignatureStudents(
  signatureId: string,
  supabase = getSupabaseAdminClient()
) {
  const {data: signature} = await supabase
    .from('waiver_signatures')
    .select('student_ids')
    .eq('id', signatureId)
    .single();

  if (!signature?.student_ids || signature.student_ids.length === 0) {
    return [];
  }

  const {data: students} = await supabase
    .from('students')
    .select('id, first_name, last_name')
    .in('id', signature.student_ids);

  return students || [];
}

/**
 * Check if a specific student has signed a specific waiver
 */
export async function hasStudentSignedWaiver(
  studentId: string,
  waiverId: string,
  supabase = getSupabaseAdminClient()
): Promise<boolean> {
  const {data: signatures} = await supabase
    .from('waiver_signatures')
    .select('student_ids')
    .eq('waiver_id', waiverId)
    .contains('student_ids', [studentId]);

  return (signatures?.length || 0) > 0;
}
```

## Testing Plan

### Unit Tests
- [ ] PDF generation with various student counts (1, 2, 5+)
- [ ] PDF generation with special characters in names
- [ ] Storage upload/download
- [ ] Student ID array queries

### Integration Tests
- [ ] Complete signing flow for registration waiver (all students)
- [ ] Complete signing flow for program waiver (specific students)
- [ ] PDF download from family portal
- [ ] PDF download from admin panel
- [ ] Multiple students in one family signing different waivers

### Manual Testing Checklist
- [ ] Sign waiver for single student
- [ ] Sign waiver for multiple students
- [ ] Download PDF and verify content
- [ ] Verify signature appears in admin views
- [ ] Test with existing legacy signatures (no student IDs)
- [ ] Test offline/slow network scenarios
- [ ] Test on mobile devices

## Deployment Plan

### Pre-Deployment
1. Review all code changes
2. Test in development environment
3. Backup production database
4. Create rollback plan

### Deployment Steps
1. Run database migration (add columns)
2. Deploy application code
3. Create Supabase Storage bucket
4. Apply RLS policies
5. Verify PDF generation works
6. Monitor error logs

### Post-Deployment
1. Monitor first few waiver signatures
2. Verify PDFs are being generated
3. Check storage usage
4. Gather user feedback

### Rollback Procedure
If issues arise:
1. Revert application code
2. Database columns can remain (they're nullable)
3. System will work without PDFs temporarily
4. Fix issues and redeploy

## Future Enhancements

### Immediate Next Steps
- [ ] Email PDF copies to families after signing
- [ ] Batch PDF generation for existing signatures
- [ ] Admin bulk download of all waivers

### Long-Term Improvements
- [ ] Waiver versioning (track content changes)
- [ ] Re-signing prompts when waiver content updates
- [ ] Electronic signature validation
- [ ] Integration with DocuSign or similar services
- [ ] Separate indemnity agreements for BC minors

## Legal Disclaimer

**Important**: This implementation provides better documentation and record-keeping, but does not guarantee legal enforceability. Key points:

- **Waivers for minors (under 19) are unenforceable in BC** per *Wong v. Lok's Martial Arts Centre Inc.*
- Consider adding separate **indemnity agreements** for parents
- This system provides **evidence of informed consent** even if not fully protective
- Consult with a lawyer to review final waiver text and implementation
- Consider liability insurance as primary protection

## Support and Maintenance

### Documentation
- This file: Implementation plan
- `WAIVER_SYSTEM_GUIDE.md`: User-facing guide (update with new features)
- Code comments: Technical details in each file

### Key Files Reference
- Schema: `supabase/migrations/029_*.sql`
- PDF Template: `app/components/pdf/WaiverPDFTemplate.tsx`
- PDF Generator: `app/utils/waiver-pdf-generator.server.ts`
- Storage Utils: `app/utils/waiver-storage.server.ts`
- Signing Route: `app/routes/_layout.family.waivers.$id.sign.tsx`
- Service Layer: `app/services/waiver.server.ts`

---

**Document Version**: 1.0
**Created**: 2025-01-19
**Author**: System Implementation Plan
**Status**: Ready for Implementation
