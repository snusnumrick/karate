// Email template system for generating clean, minimal HTML emails
// This file uses a generated template from the email_templates directory
// Run: cd supabase/email_templates && ./generate-supabase-template.sh edgefunction
// Then copy the generated HTML template content here

// Generated email template - DO NOT EDIT MANUALLY
// This template is generated from edge-function-email-template.internal.html
// To update: modify the internal template and regenerate
const EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GREENEGIN KARATE</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f8fafc;
            color: #334155;
            line-height: 1.6;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .header {
            padding: 32px 24px;
            text-align: center;
            border-bottom: 1px solid #e2e8f0;
        }
        .title {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
            color: #469a45;
        }
        .content {
            padding: 32px 24px;
        }
        .message {
            margin: 0 0 24px 0;
            font-size: 16px;
        }
        .highlight {
            background-color: #f1f5f9;
            border-left: 4px solid #469a45;
            padding: 16px;
            margin: 24px 0;
        }
        .cta-button {
            display: inline-block;
            background-color: #469a45 !important;;
            color: #ffffff !important;;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 500;
            margin: 16px 0;
        }
        .footer {
            padding: 24px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            background-color: #f8fafc;
            font-size: 14px;
            color: #64748b;
        }
        .footer a {
            color: #469a45;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">GREENEGIN KARATE</h1>
        </div>
        
        <div class="content">
            <div class="message">
                \${content}
            </div>
            
            <div class="highlight">
                <a href="\${ctaUrl}" class="cta-button">\${ctaText}</a>
            </div>
        </div>
        
        <div class="footer">
            <p>
                GREENEGIN KARATE<br>
                Phone: (604) 690-7121<br>
                Email: <a href="mailto:info@karate.greenegin.ca">info@karate.greenegin.ca</a>
            </p>
        </div>
    </div>
</body>
</html>`;

interface EmailTemplateData {
  familyName?: string;
  subject?: string;
  content?: string;
  ctaText?: string;
  ctaUrl?: string;
  siteUrl: string;
  [key: string]: any;
}

interface EmailTemplate {
  subject: string;
  html: string;
}

// Base email template using the generated template
function createBaseTemplate(data: EmailTemplateData): string {
  // Use the generated EMAIL_TEMPLATE and replace placeholders
  let html = EMAIL_TEMPLATE
    .replace(/\$\{subject\}/g, data.subject || '')
    .replace(/\$\{content\}/g, data.content || '')
    .replace(/\$\{ctaText\}/g, data.ctaText || '')
    .replace(/\$\{ctaUrl\}/g, data.ctaUrl || '')
    .replace(/\$\{familyName\}/g, data.familyName || '')
    .replace(/\$\{siteUrl\}/g, data.siteUrl);

  // Remove CTA button section if ctaUrl or ctaText is empty
  if (!data.ctaUrl || !data.ctaText) {
    html = html.replace(/<div class="highlight">[\s\S]*?<\/div>/m, '');
  }

  return html;
}

// Payment reminder email template
export function createPaymentReminderEmail(data: {
  familyName: string;
  expiredStudents: Array<{ name: string }>;
  expiringSoonStudents: Array<{ name: string; daysUntilExpiration?: number }>;
  siteUrl: string;
}): EmailTemplate {
  const { familyName, expiredStudents, expiringSoonStudents, siteUrl } = data;
  
  const subject = `Payment Due`;
  
  let content = `<p>Hello ${familyName} family,</p>`;
  
  if (expiredStudents.length > 0) {
    content += `
      <p>Just a remineder, you are<strong> past due</strong> for the following students:</p>
      <p>${expiredStudents.map(s => `• ${s.name}`).join('<br>')}</p>
      <p>Please make payment to continue classes.</p>
    `;
  }
  
  if (expiringSoonStudents.length > 0) {
    content += `
      <p><strong>Payment Expiring Soon</strong></p>
      <p>${expiringSoonStudents.map(s => 
        `• ${s.name} - ${s.daysUntilExpiration || 0} days remaining`
      ).join('<br>')}</p>
      <p>Please renew before expiration.</p>
    `;
  }
  
  content += `<p>Thank you.</p>`;
  
  const html = createBaseTemplate({
    familyName,
    subject,
    content,
    ctaText: 'Make Payment',
    ctaUrl: `${siteUrl}/family/payment`,
    siteUrl,
  });
  
  return { subject, html };
}

// Waiver reminder email template
export function createWaiverReminderEmail(data: {
  familyName: string;
  missingWaivers: Array<{ id: string; title: string }>;
  siteUrl: string;
}): EmailTemplate {
  const { familyName, missingWaivers, siteUrl } = data;
  
  const subject = `Waiver Required`;
  
  const content = `
    <p>Hello ${familyName} family,</p>
    <p>Just a reminder, you are missing <strong>Required Waivers</strong>:</p>
    <p>${missingWaivers.map(w => `• ${w.title}`).join('<br>')}</p>
    <p>Please sign to continue participation.</p>
    <p>Thank you.</p>
  `;
  
  const html = createBaseTemplate({
    familyName,
    subject,
    content,
    ctaText: 'Sign Waivers',
    ctaUrl: `${siteUrl}/family/waivers`,
    siteUrl,
  });

  return { subject, html };
}

// Monthly revenue report email template
export function createMonthlyRevenueReportEmail(data: {
  monthName: string;
  year: number;
  totalRevenue: number; // in cents
  breakdown: Array<{ type: string; count: number; amount: number }>;
  siteUrl: string;
}): EmailTemplate {
  const { monthName, year, totalRevenue, breakdown, siteUrl } = data;

  const subject = `Monthly Revenue Report - ${monthName} ${year}`;

  // Format currency (cents to dollars)
  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Build breakdown section
  const breakdownHtml = breakdown.map(item => {
    const typeLabel = item.type === 'monthly_group' ? 'Monthly Group' :
                      item.type === 'yearly_group' ? 'Yearly Group' :
                      item.type === 'individual_session' ? 'Individual Session' : item.type;
    return `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${typeLabel}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.count}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatCurrency(item.amount)}</td>
    </tr>`;
  }).join('');

  const totalPayments = breakdown.reduce((sum, item) => sum + item.count, 0);

  const content = `
    <h2 style="color: #469a45; margin-top: 0;">Revenue Report</h2>
    <p><strong>Period:</strong> ${monthName} ${year}</p>

    <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; color: #334155;">Total Revenue</h3>
      <p style="font-size: 32px; font-weight: 600; color: #469a45; margin: 0;">${formatCurrency(totalRevenue)}</p>
      <p style="margin: 10px 0 0 0; color: #64748b;">${totalPayments} successful payments</p>
    </div>

    <h3 style="color: #334155;">Breakdown by Payment Type</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background-color: #f8fafc;">
          <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #469a45;">Payment Type</th>
          <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #469a45;">Count</th>
          <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #469a45;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${breakdownHtml}
      </tbody>
      <tfoot>
        <tr style="font-weight: 600; background-color: #f8fafc;">
          <td style="padding: 12px 8px; border-top: 2px solid #469a45;">Total</td>
          <td style="padding: 12px 8px; text-align: center; border-top: 2px solid #469a45;">${totalPayments}</td>
          <td style="padding: 12px 8px; text-align: right; border-top: 2px solid #469a45;">${formatCurrency(totalRevenue)}</td>
        </tr>
      </tfoot>
    </table>

    <p style="margin-top: 30px; color: #64748b; font-size: 14px;">
      This report includes revenue from session payments only (monthly, yearly, and individual sessions).
    </p>
  `;

  const html = createBaseTemplate({
    subject,
    content,
    siteUrl,
  });

  return { subject, html };
}