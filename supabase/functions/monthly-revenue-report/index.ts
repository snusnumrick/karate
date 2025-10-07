/* eslint-disable-next-line import/no-unresolved */
import {serve} from 'https://deno.land/std@0.177.0/http/server.ts';
import {getSupabaseAdminClient, SupabaseClient} from '../_shared/supabase.ts';
import {Database} from '../_shared/database.types.ts';
import {sendEmail} from '../_shared/email.ts';
import {createMonthlyRevenueReportEmail} from '../_shared/email-templates.ts';
import {corsHeaders} from '../_shared/cors.ts';

console.log('Monthly Revenue Report Function Initializing');

// Type for payment breakdown
type PaymentBreakdown = {
  type: string;
  count: number;
  amount: number;
};

serve(async (req: Request) => {
  // 1. Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('Received request for monthly revenue report.');

  try {
    // 2. Create Supabase Admin Client
    const supabaseAdmin: SupabaseClient<Database> = getSupabaseAdminClient();
    console.log('Supabase client created.');

    // 3. Check for required environment variables
    const siteUrl = Deno.env.get('VITE_SITE_URL');
    if (!siteUrl) {
      throw new Error('Missing VITE_SITE_URL environment variable.');
    }

    const revenueReportRecipients = Deno.env.get('REVENUE_REPORT_RECIPIENTS');
    if (!revenueReportRecipients) {
      throw new Error('Missing REVENUE_REPORT_RECIPIENTS environment variable.');
    }

    // Parse recipients (comma-separated email addresses)
    const recipients = revenueReportRecipients.split(',').map(email => email.trim()).filter(Boolean);
    if (recipients.length === 0) {
      throw new Error('No valid recipients found in REVENUE_REPORT_RECIPIENTS.');
    }
    console.log(`Email recipients: ${recipients.join(', ')}`);

    // 4. Parse query parameters for custom period (optional)
    const url = new URL(req.url);
    const customPeriod = url.searchParams.get('period'); // Format: YYYY-MM

    // Calculate date range for last calendar month
    let startDate: Date;
    let endDate: Date;
    let monthName: string;
    let year: number;

    if (customPeriod) {
      // Parse custom period YYYY-MM
      const [yearStr, monthStr] = customPeriod.split('-');
      year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        throw new Error('Invalid period format. Use YYYY-MM (e.g., 2025-09).');
      }

      startDate = new Date(year, month - 1, 1); // Month is 0-indexed
      endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month
      monthName = startDate.toLocaleString('en-US', { month: 'long' });

      console.log(`Using custom period: ${monthName} ${year}`);
    } else {
      // Default to last calendar month
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      year = lastMonth.getFullYear();
      monthName = lastMonth.toLocaleString('en-US', { month: 'long' });

      startDate = new Date(year, lastMonth.getMonth(), 1);
      endDate = new Date(year, lastMonth.getMonth() + 1, 0, 23, 59, 59, 999); // Last day of month

      console.log(`Using last calendar month: ${monthName} ${year}`);
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    console.log(`Date range: ${startDateStr} to ${endDateStr}`);

    // 5. Query payments for sessions only (exclude store, events, seminars, invoices)
    // Payment types for sessions: monthly_group, yearly_group, individual_session
    // Exclude payments with order_id (store purchases)
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('id, type, total_amount, payment_date, status, order_id')
      .gte('payment_date', startDateStr)
      .lte('payment_date', endDateStr)
      .eq('status', 'succeeded')
      .is('order_id', null) // Exclude store purchases
      .in('type', ['monthly_group', 'yearly_group', 'individual_session']);

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      throw paymentsError;
    }

    console.log(`Found ${payments?.length || 0} session payments.`);

    // 6. Calculate totals and breakdown by payment type
    const breakdown: Map<string, PaymentBreakdown> = new Map();
    let totalRevenue = 0;

    if (payments && payments.length > 0) {
      for (const payment of payments) {
        totalRevenue += payment.total_amount;

        const existing = breakdown.get(payment.type) || {
          type: payment.type,
          count: 0,
          amount: 0,
        };

        existing.count += 1;
        existing.amount += payment.total_amount;
        breakdown.set(payment.type, existing);
      }
    }

    const breakdownArray = Array.from(breakdown.values()).sort((a, b) => b.amount - a.amount);

    console.log(`Total revenue: ${totalRevenue} cents (${(totalRevenue / 100).toFixed(2)} CAD)`);
    console.log('Breakdown:', breakdownArray);

    // 7. Generate email template
    const emailTemplate = createMonthlyRevenueReportEmail({
      monthName,
      year,
      totalRevenue,
      breakdown: breakdownArray,
      siteUrl,
    });

    // 8. Send email to all recipients
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const recipient of recipients) {
      try {
        const emailSent = await sendEmail({
          to: recipient,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
        });

        if (emailSent) {
          emailsSent++;
          console.log(`Email sent to ${recipient}`);
        } else {
          emailsFailed++;
          console.error(`Failed to send email to ${recipient}`);
        }
      } catch (emailError) {
        emailsFailed++;
        console.error(
          `Error sending email to ${recipient}:`,
          emailError instanceof Error ? emailError.message : 'Unknown error occurred',
        );
      }
    }

    // 9. Return response with summary
    const response = {
      success: true,
      period: `${monthName} ${year}`,
      dateRange: { start: startDateStr, end: endDateStr },
      totalRevenue: totalRevenue,
      totalRevenueFormatted: `$${(totalRevenue / 100).toFixed(2)}`,
      totalPayments: payments?.length || 0,
      breakdown: breakdownArray,
      emailsSent,
      emailsFailed,
      recipients,
    };

    console.log('Monthly revenue report complete:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error(
      'Error in Monthly Revenue Report function:',
      error instanceof Error ? error.message : String(error),
    );
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
