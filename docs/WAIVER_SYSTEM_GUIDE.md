# Waiver System Implementation Guide

## Overview

The karate school management system now includes a tiered waiver system that supports both general registration waivers and program-specific waivers.

## Architecture

### Database Schema

#### Waivers Table
- `id`: UUID, primary key
- `title`: String, waiver title
- `content`: Text, full waiver content
- `required`: Boolean, indicates if this is a general registration waiver
- `description`: Text, brief description of the waiver
- `created_at`, `updated_at`: Timestamps

#### Waiver Signatures Table
- `id`: UUID, primary key
- `waiver_id`: Foreign key to waivers table
- `user_id`: Foreign key to profiles table (the guardian who signed)
- `signature_data`: Text, base64-encoded signature image
- `signed_at`: Timestamp
- `agreement_version`: String, tracks which version of the waiver was signed
- `student_ids`: UUID array, specific students covered by this signature
- `pdf_storage_path`: Text, path to signed PDF in Supabase Storage

#### Programs Table Enhancement
- `required_waiver_id`: Optional foreign key to waivers table
- When set, this waiver must be signed before a student can be enrolled in the program

### Database Views

#### `enrollment_waiver_status`
A materialized view that provides real-time status of waiver requirements for each enrollment:
- `enrollment_id`: The enrollment record
- `student_id`, `student_name`: Student information
- `program_id`, `program_name`: Program information
- `family_id`: Family the student belongs to
- `required_waiver_id`, `required_waiver_name`: The required waiver (if any)
- `waiver_signed`: Boolean indicating if the waiver has been signed
- `signed_by_user_id`, `signed_at`: Signature details

## User Flows

### 1. Setting Up Waivers

#### Creating a General Registration Waiver
1. Navigate to **Admin > Waivers**
2. Click **Add New Waiver**
3. Enter:
   - Title (e.g., "General Liability Waiver")
   - Description (brief summary)
   - Content (full waiver text)
   - Check "Required" to make it a registration waiver
4. Save

#### Creating a Program-Specific Waiver
1. Navigate to **Admin > Waivers**
2. Click **Add New Waiver**
3. Enter waiver details (DO NOT check "Required")
4. Save the waiver
5. Navigate to **Admin > Programs**
6. Edit the program that needs this waiver
7. Select the waiver from the "Required Waiver" dropdown
8. Save the program

### 2. Family Portal Experience

#### When Families Log In
1. The family dashboard displays a "Waivers" section
2. If waivers are pending:
   - An alert shows the number of pending waivers
   - Each pending waiver is listed with:
     - Waiver name
     - Which student it's for
     - Which program requires it
   - A "Sign Required Waivers" button is prominently displayed
3. If all waivers are signed:
   - A success message is displayed
   - A "View Waivers" button allows reviewing signed waivers

#### Signing a Waiver (Program Enrollment)
1. Click "Sign Required Waivers" or navigate to the waiver list
2. Click "Sign Now" on an unsigned waiver
3. Review the waiver content
4. Sign using mouse or touch input
5. Check the agreement checkbox
6. Submit the signature
7. Return to the dashboard

#### Event Registration with Waivers
For events that require waivers, families follow a three-step process:

**Step 1: Student Selection**
1. Navigate to the event details page
2. Click "Register for Event"
3. Select which students to register using checkboxes
4. Review the registration fee calculation
5. Click "Continue to Waiver" (or "Continue to Registration" if no waivers required)

**Step 2: Waiver Signing** (if event requires waivers)
1. Review all required waivers for the event
2. For each waiver:
   - See which students will be covered (only selected students)
   - Review the waiver content
   - Sign using mouse or touch input
   - Check the agreement checkbox
3. Submit all signatures
4. System validates all selected students are covered

**Step 3: Complete Registration**
1. Review registration summary
2. Complete payment (if applicable)
3. Receive confirmation

**Important Notes:**
- Students must be selected BEFORE signing waivers to ensure legal accuracy
- Waivers only cover the specific students selected for registration
- PDF copies include the names of covered students
- Families receive waiver PDFs via email after signing

### 3. Admin Experience

#### Enrolling a Student
1. When creating a new enrollment, the form checks:
   - If the program requires a waiver
   - If the family has signed that waiver
2. If the waiver is not signed:
   - A warning banner is displayed
   - The enrollment can still be created (trial/active status)
   - Admin is reminded to notify the family

#### Viewing Waiver Signatures
1. Navigate to **Admin > Waivers > View Signatures**
2. View a comprehensive report of:
   - All signed waivers with dates
   - Family and student information
   - Which students are covered by each waiver signature
   - PDF download links for each signed waiver
   - Filter by specific waiver type
3. Click on family name to view family details
4. Download PDF copies of signed waivers

#### Monitoring Enrollment Status
1. The enrollments list shows a badge for pending waivers
2. Click into an enrollment to see waiver status details

## Validation Rules

### Enrollment Creation
- Enrollments CAN be created even if waivers are not signed
- System shows warnings but does not block enrollment
- This allows for trial classes and flexible onboarding

### Program Waiver Requirements
- Only ONE waiver can be required per program
- Waivers are optional at the program level
- General registration waivers (required=true) apply to all families

### Signature Requirements
- Signatures must be drawn (not typed)
- Agreement checkbox must be checked
- One signature per waiver per user
- Guardians sign on behalf of their family

## Data Migration

### Backfilling Existing Data

Run the migration script `028_waiver_data_backfill.sql` to:
1. Report on programs without required waivers
2. Identify active enrollments with pending waivers
3. Clean up orphaned waiver signatures
4. Verify required waivers exist
5. Check RLS policies are in place

### Setting Up Initial Waivers

1. **Create a General Liability Waiver** (required=true)
   - This applies to all families when they register
   - Should cover general participation risks

2. **Create Program-Specific Waivers** as needed:
   - Sparring waiver for competition programs
   - Equipment waiver for programs using weapons
   - Special needs waiver for adaptive programs

3. **Assign Waivers to Programs**
   - Review each program
   - Determine if a specific waiver is needed
   - Update the program's required_waiver_id

## Technical Implementation

### Backend Services

#### `checkEnrollmentWaiverStatus()`
Located in `app/services/waivers.server.ts`, this function:
- Checks if a program requires a waiver
- Validates if the family has signed the waiver
- Returns status and warning messages

#### Database Triggers
- `refresh_enrollment_waiver_status()`: Automatically updates the materialized view when:
  - Enrollments are created/updated
  - Waiver signatures are added
  - Programs are modified

### Frontend Components

#### Family Portal
- `app/routes/_layout.family._index.tsx`: Dashboard with waiver status
- `app/routes/_layout.family.waivers._index.tsx`: Waiver list
- `app/routes/_layout.family.waivers.$id.sign.tsx`: Waiver signing page with student coverage
- `app/routes/_layout.events.$eventId.register_.students.tsx`: Student selection for event registration
- `app/routes/_layout.events.$eventId.register_.waivers.tsx`: Event waiver signing flow
- `app/routes/_layout.events.$eventId_.register.tsx`: Final registration step with validation

#### Admin Interface
- `app/routes/admin.programs.new.tsx`: Program creation with waiver selection
- `app/routes/admin.programs.$id.edit.tsx`: Program editing with waiver management
- `app/routes/admin.enrollments.new.tsx`: Enrollment with waiver validation
- `app/routes/admin.waivers._index.tsx`: Waiver management and navigation
- `app/routes/admin.waivers.signatures.tsx`: View all signatures with student coverage details

## Best Practices

### For Administrators

1. **Keep Waivers Current**
   - Review and update waiver content annually
   - Track which version was signed using agreement_version

2. **Communicate Clearly**
   - Notify families when new waivers are required
   - Explain what each waiver covers
   - Provide support for families who have questions

3. **Monitor Compliance**
   - Regularly check the "Missing Signatures" report
   - Follow up with families who have pending waivers
   - Consider grace periods for trial enrollments

4. **Legal Review**
   - Have waivers reviewed by legal counsel
   - Ensure waivers are enforceable in your jurisdiction
   - Include all necessary legal language

### For Families

1. **Read Carefully**
   - Review all waiver content before signing
   - Ask questions if anything is unclear
   - Keep copies of signed waivers

2. **Sign Promptly**
   - Complete pending waivers as soon as possible
   - Don't delay enrollment by waiting to sign
   - Check the dashboard regularly for new requirements

## Troubleshooting

### "Waiver not found" Error
- Verify the waiver exists in the waivers table
- Check that the program's required_waiver_id is valid
- Refresh the enrollment_waiver_status materialized view

### Signature Not Saving
- Check browser console for errors
- Verify CSRF token is being sent
- Ensure user is authenticated and has a family_id

### Waiver Status Not Updating
- The materialized view refreshes automatically
- If needed, manually refresh: `REFRESH MATERIALIZED VIEW CONCURRENTLY enrollment_waiver_status;`

### Family Can't See Waiver
- Verify the waiver is published (not draft)
- Check RLS policies allow families to read waivers
- Ensure the family has students enrolled in programs requiring the waiver

## Implemented Features

### PDF Generation and Storage ✅
- **Automatic PDF Creation**: PDFs are automatically generated when waivers are signed
- **Student Coverage**: PDFs explicitly list all students covered by the signature
- **Supabase Storage**: PDFs securely stored in private Supabase Storage bucket
- **Access Control**: Row Level Security policies ensure only family members and admins can access PDFs
- **Email Delivery**: Families automatically receive PDF copies via email after signing

### Student Coverage Tracking ✅
- **student_ids Array**: Database tracks exactly which students each signature covers
- **Legal Accuracy**: Ensures contract law compliance by explicitly naming covered parties
- **Admin Visibility**: Admin interface shows student coverage for all signatures
- **Validation**: System validates all students are covered before completing event registration

## Future Enhancements

### Possible Improvements

1. **Email Notifications** ✅ PARTIALLY IMPLEMENTED
   - ✅ PDF copies sent automatically after signing
   - ⏳ Automatic reminders for unsigned waivers
   - ⏳ Notify families when new waivers are added

2. **Waiver Versioning**
   - Track changes to waiver content
   - Re-prompt families when waivers are updated significantly
   - Show version history in admin interface

3. **Multi-Guardian Signatures**
   - Require signatures from both guardians
   - Track which guardian signed which waiver
   - Joint signature support

4. **Waiver Templates**
   - Pre-built waiver templates for common scenarios
   - Industry-standard waiver language
   - Customizable template library

## Support

For questions or issues with the waiver system:
1. Check this documentation first
2. Review the code in `app/services/waivers.server.ts`
3. Check database schema in migrations 026 and 027
4. Contact the development team for technical support
