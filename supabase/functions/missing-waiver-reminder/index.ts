import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getSupabaseAdminClient, SupabaseClient } from '../_shared/supabase.ts';
import { Database } from '../_shared/database.types.ts';
import { sendEmail } from '../_shared/email.ts';
import { createWaiverReminderEmail } from '../_shared/email-templates.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { RateLimiter } from '../_shared/rate-limiter.ts';

console.log('Missing Waiver Reminder Function Initializing');

type ProfileWithFamily =
  & Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'family_id'>
  & {
    families: Pick<Database['public']['Tables']['families']['Row'], 'name' | 'email'> | null;
  };
type WaiverInfo = Pick<Database['public']['Tables']['waivers']['Row'], 'id' | 'title'>;

serve(async (req: Request) => {
  // 1. Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. Check Authorization (as in payment-reminder)
  console.log('Received request for missing waiver reminders.');

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

    // 4. Fetch all *required* waivers
    const { data: requiredWaivers, error: waiversError } = await supabaseAdmin
      .from('waivers')
      .select('id, title')
      .eq('required', true);

    if (waiversError) throw waiversError;
    if (!requiredWaivers || requiredWaivers.length === 0) {
      console.log('No required waivers found. No reminders needed.');
      return new Response(JSON.stringify({ message: 'No required waivers found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    const requiredWaiverMap = new Map<string, string>(requiredWaivers.map((w) => [w.id, w.title]));
    console.log(`Found ${requiredWaiverMap.size} required waivers.`);

    // 5. Fetch all active users (profiles) linked to a family with an email
    // We only need users who *could* sign waivers
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select(
        `                                                                                                                                                                                                          
        id,                                                                                                                                                                                                              
        family_id,                                                                                                                                                                                                       
        families ( name, email )                                                                                                                                                                                         
      `,
      )
      .not('family_id', 'is', null) // Must be linked to a family
      .not('families', 'is', null) // Family must exist
      .not('families.email', 'is', null); // Family must have an email

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) {
      console.log('No active users with linked families and emails found.');
      return new Response(JSON.stringify({ message: 'No relevant users found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    console.log(`Fetched ${profiles.length} profiles to check for missing waivers.`);

    // 6. Fetch all existing signatures
    const { data: allSignatures, error: signaturesError } = await supabaseAdmin
      .from('waiver_signatures')
      .select('user_id, waiver_id');

    if (signaturesError) throw signaturesError;

    // Create a map for quick lookup: Map<user_id, Set<waiver_id>>
    const userSignaturesMap = new Map<string, Set<string>>();
    if (allSignatures) {
      for (const sig of allSignatures) {
        if (!userSignaturesMap.has(sig.user_id)) {
          userSignaturesMap.set(sig.user_id, new Set<string>());
        }
        userSignaturesMap.get(sig.user_id)!.add(sig.waiver_id);
      }
    }
    console.log(`Processed ${allSignatures?.length ?? 0} signatures into lookup map.`);

    // 7. Iterate through users, find missing waivers, send emails
    let emailsSent = 0;
    let errorsEncountered = 0;

    // Initialize rate limiter (500ms between emails = max 2 req/sec)
    const rateLimiter = new RateLimiter(500);

    for (const profile of profiles as ProfileWithFamily[]) {
      // This check should be redundant due to the query, but good practice
      if (!profile.families || !profile.families.email) continue;

      const signedWaiverIds = userSignaturesMap.get(profile.id) ?? new Set<string>();
      const missingWaivers: WaiverInfo[] = [];

      for (const [waiverId, waiverTitle] of requiredWaiverMap.entries()) {
        if (!signedWaiverIds.has(waiverId)) {
          missingWaivers.push({ id: waiverId, title: waiverTitle });
        }
      }

      // If the user is missing any required waivers, send ONE email
      if (missingWaivers.length > 0) {
        console.log(
          `User ${profile.id} (Family: ${profile.families.name}) is missing ${missingWaivers.length} waivers.`,
        );
        try {
          const emailTemplate = createWaiverReminderEmail({
            familyName: profile.families.name,
            missingWaivers,
            siteUrl,
          });

          // Use rate limiter to prevent hitting API limits
          const emailSent = await rateLimiter.execute(async () => {
            return await sendEmail({
              to: profile.families.email,
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
            `Error sending missing waiver reminder email to family ${profile.family_id} (${profile.families.email}):`,
            emailError instanceof Error ? emailError.message : 'Unknown error occurred',
          );
          errorsEncountered++;
        }
      } // End if missingWaivers
    } // End profile loop

    console.log(
      `Missing waiver check complete. Emails Sent: ${emailsSent}, Errors: ${errorsEncountered}`,
    );
    return new Response(JSON.stringify({ success: true, emailsSent, errors: errorsEncountered }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error(
      'Error in Missing Waiver Reminder function:',
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

/*
Shared file stubs needed:

// supabase/functions/_shared/database.types.ts
// (Same as in payment-reminder)

// supabase/functions/_shared/email.ts
// (Same as in payment-reminder)

// supabase/functions/_shared/cors.ts
// (Same as in payment-reminder)

*/
