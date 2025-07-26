import { sendEmail } from "~/utils/email.server";
import { formatCurrency } from "~/utils/misc";
import { formatEntityAddress } from "~/utils/entity-helpers";
import { getItemTypeLabel, formatServicePeriod, calculateLineItemSubtotal, calculateLineItemDiscount, calculateLineItemTax } from "~/utils/line-item-helpers";
import { siteConfig } from "~/config/site";
import { generateInvoicePDF, getDefaultCompanyInfo, generateInvoiceFilename } from "~/utils/pdf-generator";
import type { InvoiceWithDetails } from "~/types/invoice";

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString(siteConfig.localization.locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

function generateInvoiceEmailHTML(invoice: InvoiceWithDetails): string {
  const entityAddress = formatEntityAddress(invoice.entity);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice #${invoice.invoice_number}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
        }
        .container {
            background-color: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 20px;
        }
        .header h1 {
            color: #2563eb;
            margin: 0;
            font-size: 28px;
        }
        .invoice-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        .info-section h3 {
            color: #374151;
            margin-bottom: 10px;
            font-size: 16px;
            font-weight: 600;
        }
        .info-section p {
            margin: 5px 0;
            color: #6b7280;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .status-draft { background-color: #f3f4f6; color: #374151; }
        .status-sent { background-color: #fef3c7; color: #92400e; }
        .status-paid { background-color: #d1fae5; color: #065f46; }
        .status-overdue { background-color: #fee2e2; color: #991b1b; }
        .status-cancelled { background-color: #f3f4f6; color: #374151; }
        .line-items {
            margin: 30px 0;
        }
        .line-items table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        .line-items th,
        .line-items td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        .line-items th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #374151;
        }
        .line-items .text-right {
            text-align: right;
        }
        .totals {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #f0f0f0;
        }
        .totals-table {
            width: 100%;
            max-width: 300px;
            margin-left: auto;
        }
        .totals-table td {
            padding: 8px 0;
            border: none;
        }
        .totals-table .total-row {
            font-weight: 600;
            font-size: 18px;
            border-top: 1px solid #e5e7eb;
            padding-top: 12px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
        .cta-button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
        }
        .discount-text {
            color: #059669;
            font-size: 12px;
        }
        .tax-text {
            color: #6b7280;
            font-size: 12px;
        }
        .breakdown-section {
            background-color: #f9fafb;
            padding: 8px 12px;
            margin: 4px 0;
            border-left: 3px solid #e5e7eb;
        }
        .breakdown-item {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #6b7280;
            margin: 2px 0;
        }
        .breakdown-total {
            font-weight: 600;
            color: #374151;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Invoice #${invoice.invoice_number}</h1>
            <p>From ${siteConfig.name}</p>
        </div>

        <div class="invoice-info">
            <div class="info-section">
                <h3>Bill To:</h3>
                <p><strong>${invoice.entity.name}</strong></p>
                ${invoice.entity.contact_person ? `<p>${invoice.entity.contact_person}</p>` : ''}
                ${entityAddress ? `<p>${entityAddress}</p>` : ''}
                ${invoice.entity.phone ? `<p>Phone: ${invoice.entity.phone}</p>` : ''}
                ${invoice.entity.email ? `<p>Email: ${invoice.entity.email}</p>` : ''}
            </div>
            
            <div class="info-section">
                <h3>Invoice Details:</h3>
                <p><strong>Issue Date:</strong> ${formatDate(invoice.issue_date)}</p>
                <p><strong>Due Date:</strong> ${formatDate(invoice.due_date)}</p>
                ${invoice.service_period_start || invoice.service_period_end ? 
                  `<p><strong>Service Period:</strong> ${formatServicePeriod(invoice.service_period_start, invoice.service_period_end)}</p>` : ''}
            </div>
        </div>

        <div class="line-items">
            <h3>Items & Services</h3>
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Type</th>
                        <th class="text-right">Qty</th>
                        <th class="text-right">Unit Price</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.line_items.map(item => `
                        <tr>
                            <td>
                                <strong>${item.description}</strong>
                                ${(item.service_period_start || item.service_period_end) ? 
                                  `<br><small>Service Period: ${formatServicePeriod(item.service_period_start, item.service_period_end)}</small>` : ''}
                                ${item.discount_rate && item.discount_rate > 0 ? 
                                  `<br><small class="discount-text">Discount: ${(Number(item.discount_rate) * 100).toFixed(2)}%</small>` : ''}
                                ${item.tax_rate && item.tax_rate > 0 ? 
                                  `<br><small class="tax-text">Tax: ${(Number(item.tax_rate) * 100).toFixed(2)}%</small>` : ''}
                            </td>
                            <td>${getItemTypeLabel(item.item_type)}</td>
                            <td class="text-right">${item.quantity}</td>
                            <td class="text-right">${formatCurrency(item.unit_price * 100)}</td>
                            <td class="text-right"><strong>${formatCurrency(item.line_total * 100)}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="totals">
            <table class="totals-table">
                <tr>
                    <td>Subtotal:</td>
                    <td class="text-right">${formatCurrency(invoice.subtotal * 100)}</td>
                </tr>
                ${invoice.discount_amount > 0 ? `
                <tr>
                    <td colspan="2">
                        <div class="breakdown-section">
                            <div class="breakdown-item breakdown-total">
                                <span>Total Discounts:</span>
                                <span class="discount-text">-${formatCurrency(invoice.discount_amount * 100)}</span>
                            </div>
                            ${invoice.line_items.map(item => {
                                const itemDiscount = calculateLineItemDiscount(item);
                                if (itemDiscount > 0) {
                                    return `
                                    <div class="breakdown-item">
                                        <span>${item.description} (${Number(item.discount_rate).toFixed(2)}%):</span>
                                        <span class="discount-text">-${formatCurrency(itemDiscount * 100)}</span>
                                    </div>`;
                                }
                                return '';
                            }).join('')}
                        </div>
                    </td>
                </tr>
                ` : ''}
                ${invoice.tax_amount > 0 ? `
                <tr>
                    <td colspan="2">
                        <div class="breakdown-section">
                            <div class="breakdown-item breakdown-total">
                                <span>Total Tax:</span>
                                <span>${formatCurrency(invoice.tax_amount * 100)}</span>
                            </div>
                            ${invoice.line_items.map(item => {
                                const itemTax = calculateLineItemTax(item);
                                if (itemTax > 0) {
                                    return `
                                     <div class="breakdown-item">
                                         <span>${item.description} (${Number(item.tax_rate).toFixed(2)}%):</span>
                                         <span>${formatCurrency(itemTax * 100)}</span>
                                     </div>`;
                                }
                                return '';
                            }).join('')}
                        </div>
                    </td>
                </tr>
                ` : ''}
                <tr class="total-row">
                    <td><strong>Total:</strong></td>
                    <td class="text-right"><strong>${formatCurrency(invoice.total_amount * 100)}</strong></td>
                </tr>
            </table>
        </div>

        ${invoice.terms ? `
        <div style="margin-top: 30px;">
            <h3>Payment Terms</h3>
            <p style="white-space: pre-wrap;">${invoice.terms}</p>
        </div>
        ` : ''}

        ${invoice.notes ? `
        <div style="margin-top: 20px;">
            <h3>Notes</h3>
            <p style="white-space: pre-wrap;">${invoice.notes}</p>
        </div>
        ` : ''}

        <div class="footer">
            <p>Thank you for your business!</p>
            <p>If you have any questions about this invoice, please contact us.</p>
            <p><strong>${siteConfig.name}</strong></p>
        </div>
    </div>
</body>
</html>
  `;
}

export async function sendInvoiceEmail(invoice: InvoiceWithDetails): Promise<boolean> {
  if (!invoice.entity.email) {
    console.error(`Cannot send invoice email: No email address for entity ${invoice.entity.name}`);
    return false;
  }

  const subject = `Invoice #${invoice.invoice_number} from ${siteConfig.name}`;
  const html = generateInvoiceEmailHTML(invoice);

  try {
    // Generate PDF with 'sent' status (not draft) for attachment
    const invoiceForPdf = {
      ...invoice,
      status: 'sent' as const // Ensure PDF shows 'sent' status, not 'draft'
    };
    
    const companyInfo = getDefaultCompanyInfo();
    const pdfBuffer = await generateInvoicePDF({ 
      invoice: invoiceForPdf, 
      companyInfo 
    });
    
    const filename = generateInvoiceFilename(invoice);

    const success = await sendEmail({
      to: invoice.entity.email,
      subject,
      html,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    if (success) {
      console.log(`Invoice email sent successfully to ${invoice.entity.email} for invoice #${invoice.invoice_number}`);
    } else {
      console.error(`Failed to send invoice email to ${invoice.entity.email} for invoice #${invoice.invoice_number}`);
    }

    return success;
  } catch (error) {
    console.error(`Error sending invoice email for invoice #${invoice.invoice_number}:`, error);
    return false;
  }
}