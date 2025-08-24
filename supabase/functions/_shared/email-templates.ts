// Email template system for generating styled HTML emails
// Matches the styling of existing Supabase email templates

interface EmailTemplateData {
  familyName: string;
  siteUrl: string;
  [key: string]: any;
}

interface EmailTemplate {
  subject: string;
  html: string;
}

// Base email template with consistent styling
function createBaseTemplate({
  title,
  content,
  siteUrl,
}: {
  title: string;
  content: string;
  siteUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Greenegin Karate</title>
    <style>
        :root {
            --primary-color: #469a45;
        }
        body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f9fafb;
            color: #374151;
            line-height: 1.6;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, var(--primary-color) 0%, #16a34a 100%);
            /*padding: 48px 20px;*/
            text-align: center;
            /*color: white;*/
            position: relative;
        }
        .logo {
            width: 120px;
            height: 120px;
            margin-bottom: 24px;
            filter: brightness(0) invert(1);
        }
        .welcome-title {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
            letter-spacing: -0.025em;
        }
        .content {
            /*padding: 48px 40px;*/
        }
        .message {
            font-size: 16px;
            margin-bottom: 24px;
            color: #4b5563;
            line-height: 1.7;
        }
        .highlight-box {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border: 2px solid var(--primary-color);
            border-radius: 12px;
            padding: 24px;
            margin: 24px 0;
            box-shadow: 0 4px 15px rgba(70, 154, 69, 0.1);
        }
        .student-list {
            list-style: none;
            padding: 0;
            margin: 16px 0;
        }
        .student-list li {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 16px;
            margin: 8px 0;
            font-weight: 600;
            color: #1f2937;
        }
        .student-list li.expired {
            background: #fef2f2;
            border-color: #fecaca;
            color: #dc2626;
        }
        .student-list li.expiring {
            background: #fffbeb;
            border-color: #fed7aa;
            color: #d97706;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, var(--primary-color) 0%, #16a34a 100%);
            /*color: white;*/
            text-decoration: none;
            /*padding: 16px 32px;*/
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            /*margin: 24px 0;*/
            box-shadow: 0 4px 15px rgba(70, 154, 69, 0.3);
            transition: all 0.2s ease;
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(70, 154, 69, 0.4);
        }
        .footer {
            background: linear-gradient(135deg, var(--primary-color) 0%, #16a34a 100%);
            padding: 40px;
            text-align: center;
            color: white;
            font-size: 16px;
            font-weight: 500;
        }
        .footer a {
            color: #ffffff;
            text-decoration: none;
            font-weight: 600;
        }
        .footer a:hover {
            color: #f0fdf4;
            text-decoration: underline;
        }
        .contact-info {
            background: rgba(255, 255, 255, 0.1);
            padding: 24px;
            border-radius: 8px;
            margin: 24px 0;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .contact-info h3 {
            color: #ffffff;
            margin-top: 0;
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 16px;
        }
        .contact-info strong {
            color: #ffffff;
            font-size: 18px;
            display: block;
            margin-bottom: 12px;
        }
        @media only screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
            }
            .header, .content, .footer {
                padding: 20px !important;
            }
            .welcome-title {
                font-size: 24px !important;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
<!--            <img src="${siteUrl}/logo-light.svg" alt="Greenegin Karate Logo" class="logo">-->
            <h1 class="welcome-title">${title}</h1>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <div class="contact-info">
                <h3>Contact Information</h3>
                <strong>Sensei Negin's Karate Class</strong>
                <p>Questions? Feel free to reach out to us!</p>
                <a href="${siteUrl}/contact">Contact Us</a>
            </div>
        </div>
    </div>
</body>
</html>
`;
}

// Payment reminder email template
export function createPaymentReminderEmail(data: {
  familyName: string;
  expiredStudents: Array<{ name: string }>;
  expiringSoonStudents: Array<{ name: string; daysUntilExpiration?: number }>;
  siteUrl: string;
}): EmailTemplate {
  const { familyName, expiredStudents, expiringSoonStudents, siteUrl } = data;
  
  const subject = `Action Required: Karate Payment Due for ${familyName}`;
  
  let content = `<p class="message">Hello ${familyName} family,</p>`;
  
  if (expiredStudents.length > 0) {
    content += `
      <div class="highlight-box">
        <p><strong>⚠️ Payment Overdue</strong></p>
        <p>The karate class payment is <strong>overdue</strong> for:</p>
        <ul class="student-list">
          ${expiredStudents.map(s => `<li class="expired">${s.name}</li>`).join('')}
        </ul>
        <p>Their current status is <strong>Expired</strong>. Please visit the family portal immediately to make a payment.</p>
      </div>
    `;
  }
  
  if (expiringSoonStudents.length > 0) {
    content += `
      <div class="highlight-box">
        <p><strong>📅 Payment Expiring Soon</strong></p>
        <p>The following students have payments expiring soon:</p>
        <ul class="student-list">
          ${expiringSoonStudents.map(s => 
            `<li class="expiring">${s.name} - Expires in ${s.daysUntilExpiration || 0} days</li>`
          ).join('')}
        </ul>
        <p>Please renew before the due date to ensure continued participation.</p>
      </div>
    `;
  }
  
  content += `
    <div style="text-align: center; margin: 32px 0;">
      <a href="${siteUrl}/family/payment" class="cta-button">Make Payment Now</a>
    </div>
    <p class="message">Thank you for your prompt attention to this matter.</p>
    <p class="message"><strong>Sensei Negin's Karate Class</strong></p>
  `;
  
  const html = createBaseTemplate({
    title: 'Payment Reminder',
    content,
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
  
  const subject = `Reminder: Please Sign Required Karate Waivers`;
  
  const content = `
    <p class="message">Hello ${familyName},</p>
    <div class="highlight-box">
      <p><strong>📋 Required Waivers</strong></p>
      <p>This is a friendly reminder to please sign the following required waiver(s) for participation in karate class:</p>
      <ul class="student-list">
        ${missingWaivers.map(w => `<li>${w.title}</li>`).join('')}
      </ul>
      <p>These waivers are required before students can participate in classes.</p>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${siteUrl}/waivers" class="cta-button">Sign Waivers Now</a>
    </div>
    <p class="message">You can sign these by logging into your family portal.</p>
    <p class="message">Thank you for your cooperation.</p>
    <p class="message"><strong>Sensei Negin's Karate Class</strong></p>
  `;
  
  const html = createBaseTemplate({
    title: 'Waiver Reminder',
    content,
    siteUrl,
  });
  
  return { subject, html };
}