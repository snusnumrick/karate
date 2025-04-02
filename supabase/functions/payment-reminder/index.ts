/* eslint-disable-next-line import/no-unresolved */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Database } from '../_shared/database.types.ts'; // Assuming you generate types for functions
import { sendEmail } from '../_shared/email.ts'; // Shared email utility for functions
import { checkStudentEligibility, EligibilityStatus } from '../_shared/eligibility.ts'; // Shared eligibility logic for functions
import { corsHeaders } from '../_shared/cors.ts';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables.');
    }
    const supabaseAdmin: SupabaseClient<Database> = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Supabase client created.');

    // Check for SITE_URL needed for email links
    const siteUrl = Deno.env.get('SITE_URL');
    if (!siteUrl) {
      throw new Error('Missing SITE_URL environment variable.');
    }
    console.log('SITE_URL verified.');

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
          
          // Calculate expiration timeframe
          const now = new Date();
          const expirationThresholdDays = 5; // Warn when expiration is within 5 days
          
          if (eligibility.reason === 'Expired') {
            console.log(
              `Student ${student.first_name} ${student.last_name} (ID: ${student.id}) in family ${family.name} has expired eligibility.`,
            );
            studentsToExpire.push({ name: `${student.first_name} ${student.last_name}` });
          } else if (
            eligibility.reason === 'Paid' && 
            eligibility.lastPaymentDate
          ) {
            const lastPaymentDate = new Date(eligibility.lastPaymentDate);
            const expirationDate = new Date(lastPaymentDate);
            expirationDate.setDate(expirationDate.getDate() + 30); // Payments cover 30 days
            
            const daysUntilExpiration = Math.ceil(
              (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (daysUntilExpiration <= expirationThresholdDays) {
              console.log(
                `Student ${student.first_name} ${student.last_name} (ID: ${student.id}) in family ${family.name} expires in ${daysUntilExpiration} days.`
              );
              studentsToExpire.push({ 
                name: `${student.first_name} ${student.last_name}`,
                daysUntilExpiration 
              });
            }
          }
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
          const expiredStudents = studentsToExpire.filter(s => !('daysUntilExpiration' in s));
          const expiringSoonStudents = studentsToExpire.filter(s => 'daysUntilExpiration' in s);
          
          const subject = `Action Required: Karate Payment Due for ${family.name}`;
          const htmlBody = `
            <p>Hello ${family.name},</p>
            ${expiredStudents.length > 0 ? `
              <p>This is a reminder that the karate class payment is <strong>overdue</strong> for:</p>
              <ul>
                ${expiredStudents.map(s => `<li><strong>${s.name}</strong></li>`).join('')}
              </ul>
            ` : ''}
            ${expiringSoonStudents.length > 0 ? `
              <p>The following students have payments expiring soon:</p>
              <ul>
                ${expiringSoonStudents.map(s => 
                  `<li><strong>${s.name}</strong> - Expires in ${s.daysUntilExpiration} days</li>`
                ).join('')}
              </ul>
            ` : ''}
            ${expiredStudents.length > 0 ? `
              <p>Their current status is <strong>Expired</strong>. Please visit the family portal immediately to make a payment.</p>
            ` : ''}
            ${expiringSoonStudents.length > 0 ? `
              <p>Payments will expire soon. Please renew before the due date to ensure continued participation.</p>
            ` : ''}
            <p><a href="${siteUrl}/family/payment">Make Payment Now</a></p> {/* Use verified siteUrl variable */}
            <p>Thank you,<br/>Sensei Negin's Karate Class</p>
          `;

          const emailSent = await sendEmail({
            to: family.email,
            subject: subject,
            html: htmlBody,
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
