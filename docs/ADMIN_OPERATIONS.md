# Admin Operations Guide

This guide covers common administrative operations in the karate school management system.

## Family Management

### Creating a New Family

When an administrator creates a new family through the admin panel (`/admin/families/new`), the system automatically handles portal access setup:

#### Process Flow

1. **Admin enters family information:**
   - Family name, address, contact details
   - Primary guardian information (name, phone, email)
   - Optional: Additional guardians
   - Optional: Student information

2. **System creates records:**
   - Family record in the database
   - Guardian record(s) with contact information
   - Student record(s) if provided

3. **Automatic portal access setup:**
   - Supabase authentication user is created for the primary guardian
   - Profile record is created linking the auth user to the family
   - Password setup email is automatically sent to the guardian's email

4. **Guardian receives email:**
   - Professional password setup email from the system
   - Link to set their own secure password
   - Valid for 24 hours (Supabase default)

5. **Guardian sets password:**
   - Guardian clicks the link in the email
   - Sets their own password on the password reset page
   - Can immediately log in to the family portal

#### Security Benefits

- **Admin never knows the guardian's password** - The system generates a random temporary password that is never communicated
- **Guardian controls credentials** - Guardian sets their own password from the start
- **Secure delivery** - Uses the existing, tested password reset infrastructure
- **Professional communication** - Automated email from the system, not manual communication

#### Email Failure Handling

If the password setup email fails to send:
- The family, guardian, and auth user are still created successfully
- The system logs a warning with details
- Admin can manually trigger a password reset from the admin panel
- Guardian can also use the "Forgot Password" link on the login page

#### Troubleshooting

**Guardian didn't receive the email:**
1. Check spam/junk folder
2. Verify the email address was entered correctly
3. Use the "Forgot Password" link on the login page with the guardian's email
4. Admin can verify the email in the guardian record and resend if needed

**Email address doesn't match:**
- The system validates that the guardian email and confirmation email match
- If they don't match, the form will show an error before submission

**Guardian already has an account:**
- If the email is already in use, the auth user creation will fail
- The system will show an error message
- Verify the email address is correct or use a different email

## Self-Registration vs Admin-Created Families

### Self-Registration
- Family registers through the public registration page
- Sets password during registration
- Can log in immediately after email confirmation (if required)
- Complete control over their own account from the start

### Admin-Created Families
- Admin creates the family through the admin panel
- Guardian receives password setup email automatically
- Guardian sets their own password via email link
- Same portal access and features as self-registered families

Both methods result in the same family portal access and features. The main difference is who initiates the registration and how the password is set.

## Email Templates

The password setup email uses the Supabase password reset template. To customize this template:

1. Navigate to your Supabase project dashboard
2. Go to Authentication → Email Templates
3. Edit the "Reset Password" template
4. Template location in this repo: `supabase/email_templates/supabase-resetpassword-email-template.html`

The email includes:
- Professional branding
- Clear instructions for setting password
- Secure link with token
- Support contact information

## Best Practices

### When Creating Families

1. **Double-check email addresses** - Ensure the guardian's email is correct before submitting
2. **Confirm with guardian** - Let them know to expect a password setup email
3. **Check spam filters** - Remind guardians to check spam/junk folders
4. **Use consistent naming** - Follow a consistent format for family names (e.g., "Smith Family")

### Email Communication

1. **Inform guardians in advance** - Let them know they'll receive an automated email
2. **Provide context** - Explain what the email is for (setting up portal access)
3. **Share support contact** - Provide a contact method if they have issues
4. **Set expectations** - Email should arrive within minutes, check spam if not

### Security Considerations

1. **Never share passwords** - The system is designed so admins never know guardian passwords
2. **Use secure emails** - Ensure guardians provide secure, accessible email addresses
3. **Verify identity** - Confirm you're creating the family for the right person
4. **Document consent** - Ensure guardians consent to account creation

## Related Documentation

- [Architecture Overview](ARCHITECTURE.md) - Technical details on user onboarding flows
- [API Documentation](API.md) - API endpoints for family and guardian management
- [Development Guide](DEVELOPMENT.md) - Development environment setup
