/* eslint-disable-next-line import/no-unresolved */
import {serve} from 'https://deno.land/std@0.177.0/http/server.ts';
import {getSupabaseAdminClient, SupabaseClient} from '../_shared/supabase.ts';
import {Database} from '../_shared/database.types.ts'; // Assuming you generate types for functions
import {sendEmail} from '../_shared/email.ts'; // Shared email utility for functions
import {createPaymentReminderEmail} from '../_shared/email-templates.ts'; // Email template system
import {checkStudentEligibility, EligibilityStatus} from '../_shared/eligibility.ts'; // Shared eligibility logic for functions
import {corsHeaders} from '../_shared/cors.ts';
import {RateLimiter} from '../_shared/rate-limiter.ts';

console.log('Payment Reminder Function Initializing');

// Define types for cleaner code
type FamilyWithStudents = Database['public']['Tables']['families']['Row'] & {
  students: Database['public']['Tables']['students']['Row'][];
};

serve(async (req: Request) => {
  // 1. Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. Check Authorization (e.g., using a Supabase function secret)
  // Recommended: Check for 'Authorization': 'Bearer SUPABASE_FUNCTION_SECRET'
  // Or verify the request came from pg_cron if possible/needed.
  // For simplicity here, we'll proceed, but add auth in production.
  console.log('Received request for payment reminders.');

  try {
    // 3. Create Supabase Admin Client
    const supabaseAdmin: SupabaseClient<Database> = getSupabaseAdminClient();
    console.log('Supabase client created.');

    // Check for VITE_SITE_URL needed for email links
    const siteUrl = Deno.env.get('VITE_SITE_URL'); // Use VITE_ prefix
    if (!siteUrl) {
      throw new Error('Missing VITE_SITE_URL environment variable.'); // Update error message
    }
    console.log('VITE_SITE_URL verified.'); // Update log message

    // 4. Fetch all families with their students
    const { data: families, error: familiesError } = await supabaseAdmin
      .from('families')
      .select(
        `                                                                                                                                                                                                          
        id,                                                                                                                                                                                                              
        name,                                                                                                                                                                                                            
        email,                                                                                                                                                                                                           
        students ( id, first_name, last_name )                                                                                                                                                                           
      `,
      )
      .not('students', 'is', null); // Only families with students

    if (familiesError) throw familiesError;
    if (!families || families.length === 0) {
      console.log('No families with students found.');
      return new Response(JSON.stringify({ message: 'No families with students found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    console.log(`Fetched ${families.length} families.`);

    // 5. Iterate through families and students, check eligibility, send emails
    let emailsSent = 0;
    let errorsEncountered = 0;

    // Initialize rate limiter (500ms between emails = max 2 req/sec)
    const rateLimiter = new RateLimiter(500);

    for (const family of families as FamilyWithStudents[]) {
      if (!family.email) {
        console.warn(`Family ${family.name} (ID: ${family.id}) has no email address. Skipping.`);
        continue;
      }

      const studentsToExpire: Array<{ name: string; daysUntilExpiration?: number }> = [];

      for (const student of family.students) {
        try {
          const eligibility: EligibilityStatus = await checkStudentEligibility(
            student.id,
            supabaseAdmin,
          );

          const now = new Date();
          const expirationThresholdDays = 7; // Warn when expiration is within 7 days

          if (eligibility.reason === 'Expired') {
            console.log(
              `Student ${student.first_name} ${student.last_name} (ID: ${student.id}) in family ${family.name} has expired eligibility. Last payment: ${
                eligibility.lastPaymentDate || 'N/A'
              } (${
                eligibility.paymentType ||
                'N/A'
              })`,
            );
            studentsToExpire.push({ name: `${student.first_name} ${student.last_name}` });
          } else if (eligibility.reason === 'Not Enrolled') {
            console.log(
              `Student ${student.first_name} ${student.last_name} (ID: ${student.id}) in family ${family.name} has no active enrollments. Skipping reminder.`,
            );
          } else if (
            (eligibility.reason === 'Paid - Monthly' || eligibility.reason === 'Paid - Yearly') &&
            eligibility.lastPaymentDate &&
            eligibility.paymentType
          ) {
            const lastPaymentDate = new Date(eligibility.lastPaymentDate);
            const expirationDate = new Date(lastPaymentDate);

            // Calculate expiration based on payment type
            const paymentDurationDays = eligibility.paymentType === 'yearly_group' ? 365 : 30;
            expirationDate.setDate(expirationDate.getDate() + paymentDurationDays);

            const daysUntilExpiration = Math.ceil(
              (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            );

            // Only add to reminder list if within threshold AND not already expired (days > 0)
            if (daysUntilExpiration > 0 && daysUntilExpiration <= expirationThresholdDays) {
              console.log(
                `Student ${student.first_name} ${student.last_name} (ID: ${student.id}) in family ${family.name} (${eligibility.paymentType}) expires in ${daysUntilExpiration} days.`,
              );
              studentsToExpire.push({
                name: `${student.first_name} ${student.last_name}`,
                daysUntilExpiration,
              });
            } else if (daysUntilExpiration <= 0) {
              // This case should ideally be caught by eligibility.reason === 'Expired', but added as safety
              console.log(
                `Student ${student.first_name} ${student.last_name} (ID: ${student.id}) in family ${family.name} (${eligibility.paymentType}) is already expired (calculated ${daysUntilExpiration} days). Adding to 
expired list.`,
              );
              // Avoid duplicates if already added via 'Expired' reason check
              if (
                !studentsToExpire.some((s) =>
                  s.name === `${student.first_name} ${student.last_name}` && !s.daysUntilExpiration
                )
              ) {
                studentsToExpire.push({ name: `${student.first_name} ${student.last_name}` });
              }
            }
          }
          // Note: 'Trial' and 'Not Enrolled' students are ignored by this reminder logic.
        } catch (eligibilityError) {
          console.error(
            `Error checking eligibility for student ${student.id} in family ${family.id}:`,
            eligibilityError instanceof Error ? eligibilityError.message : 'Unknown error occurred',
          );
          errorsEncountered++;
        }
      } // End student loop

      // If any students in the family have expired eligibility, send ONE email to the family
      if (studentsToExpire.length > 0) {
        try {
          const expiredStudents = studentsToExpire.filter((s) => !('daysUntilExpiration' in s));
          const expiringSoonStudents = studentsToExpire.filter((s) => 'daysUntilExpiration' in s);

          const emailTemplate = createPaymentReminderEmail({
            familyName: family.name,
            expiredStudents,
            expiringSoonStudents,
            siteUrl,
          });

          // Use rate limiter to prevent hitting API limits
          const emailSent = await rateLimiter.execute(async () => {
            return await sendEmail({
              to: family.email,
              subject: emailTemplate.subject,
              html: emailTemplate.html,
            });
          });

          if (emailSent) {
            emailsSent++;
          } else {
            errorsEncountered++;
          }
        } catch (emailError) {
          console.error(
            `Error sending payment reminder email to family ${family.id} (${family.email}):`,
            emailError instanceof Error ? emailError.message : 'Unknown error occurred',
          );
          errorsEncountered++;
        }
      } // End if studentsToExpire
    } // End family loop

    console.log(
      `Payment reminder check complete. Emails Sent: ${emailsSent}, Errors: ${errorsEncountered}`,
    );
    return new Response(JSON.stringify({ success: true, emailsSent, errors: errorsEncountered }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error(
      'Error in Payment Reminder function:',
      error instanceof Error ? error.message : String(error),
    );
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
