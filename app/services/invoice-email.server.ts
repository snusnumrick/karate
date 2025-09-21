import { sendEmail } from "~/utils/email.server";
import { formatDate } from "~/utils/misc";
import {formatMoney, multiplyMoney, isPositive} from "~/utils/money";
import { formatEntityAddress } from "~/utils/entity-helpers";
import { formatServicePeriod, calculateLineItemDiscount } from "~/utils/line-item-helpers";
import { siteConfig } from "~/config/site";
import { generateInvoicePDF, getDefaultCompanyInfo, generateInvoiceFilename } from "~/utils/pdf-generator";
import type { InvoiceWithDetails } from "~/types/invoice";

const formatDateLocal = (dateString: string) => {
  return formatDate(dateString, {
    formatString: 'MMMM d, yyyy'
  });
};

function generateInvoiceEmailHTML(invoice: InvoiceWithDetails): string {
  const entityAddress = formatEntityAddress(invoice.entity);
  const companyInfo = getDefaultCompanyInfo();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice #${invoice.invoice_number}</title>
    <style>
        body {
            font-family: Helvetica, Arial, sans-serif;
            line-height: 1.3;
            color: #1f2937;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
            font-size: 14px;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid ${siteConfig.colors.primary};
        }
        .company-info {
            text-align: right;
            max-width: 250px;
        }
        .company-logo {
            width: 160px;
            height: 30px;
            margin-bottom: 6px;
        }
        .company-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 6px;
            margin-top: 12px;
            letter-spacing: 0.3px;
        }
        .company-details {
            font-size: 12px;
            color: #4b5563;
            line-height: 1.4;
            margin-bottom: 3px;
            margin-top: 2px;
        }
        .invoice-title {
            font-size: 32px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 30px;
            text-align: center;
            letter-spacing: 0.8px;
        }
        .invoice-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        .invoice-details, .billing-info {
            background-color: #f8fafc;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
        }
        .section-title {
            font-size: 16px;
            font-weight: bold;
            color: ${siteConfig.colors.primary};
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 3px;
        }
        .detail-row {
            display: flex;
            margin-bottom: 4px;
            align-items: flex-start;
        }
        .detail-label {
            width: 80px;
            font-size: 12px;
            color: #64748b;
            font-weight: bold;
        }
        .detail-value {
            font-size: 12px;
            color: #1f2937;
            flex: 1;
            line-height: 1.3;
        }
        .recipient-address {
            font-size: 12px;
            color: #1f2937;
            line-height: 1.4;
            margin-bottom: 2px;
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
            margin: 20px 0;
        }
        .line-items table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            border: 1px solid #cbd5e1;
        }
        .line-items th {
            background-color: ${siteConfig.colors.primary};
            color: white;
            padding: 8px 10px;
            text-align: left;
            font-weight: bold;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        .line-items th:last-child {
            text-align: right;
        }
        .line-items td {
            padding: 6px 10px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 12px;
            color: #1f2937;
            vertical-align: top;
        }
        .line-items td:last-child {
            text-align: right;
            font-weight: bold;
        }
        .line-items tr:nth-child(even) {
            background-color: #f8fafc;
        }
        .line-items .text-right {
            text-align: right;
        }
        .item-description {
            color: #64748b;
            font-size: 11px;
            margin-top: 2px;
            line-height: 1.3;
        }
        .totals {
            margin-top: 20px;
            display: flex;
            justify-content: flex-end;
        }
        .totals-table {
            border-collapse: collapse;
            min-width: 250px;
            border: 1px solid #cbd5e1;
        }
        .totals-table td {
            padding: 6px 12px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 12px;
        }
        .totals-table .label {
            text-align: right;
            font-weight: bold;
            color: #374151;
            background-color: #f8fafc;
        }
        .totals-table .amount {
            text-align: right;
            color: #1f2937;
            font-weight: bold;
            min-width: 80px;
        }
        .totals-table .total-row {
            font-weight: 600;
            font-size: 18px;
            border-top: 1px solid #e5e7eb;
            padding-top: 12px;
        }
        .totals-table .total-row .label {
            background-color: ${siteConfig.colors.primary};
            color: white;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        .totals-table .total-row .amount {
            background-color: ${siteConfig.colors.primary};
            color: white;
            font-size: 14px;
            font-weight: bold;
        }
        .notes {
            margin-top: 20px;
            padding: 12px;
            background-color: #f8fafc;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
        }
        .notes-title {
            font-size: 14px;
            font-weight: bold;
            color: #374151;
            margin-bottom: 6px;
        }
        .notes-content {
            font-size: 12px;
            color: #64748b;
            line-height: 1.4;
        }
        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #cbd5e1;
            text-align: center;
            color: #64748b;
            font-size: 11px;
        }
        .cta-button {
            display: inline-block;
            background-color: ${siteConfig.colors.primary};
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 4px;
            margin: 15px 8px;
            font-weight: bold;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
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
            <div class="company-info">
                <div class="company-name">${companyInfo.name}</div>
                <div class="company-details">${companyInfo.address}</div>
                <div class="company-details">${companyInfo.phone}</div>
                <div class="company-details">${companyInfo.email}</div>
            </div>
        </div>
        
        <div class="invoice-title">INVOICE</div>
        
        <div class="invoice-info">
            <div class="invoice-details">
                <div class="section-title">Invoice Details</div>
                <div class="detail-row">
                    <div class="detail-label">Number:</div>
                    <div class="detail-value">${invoice.invoice_number}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Date:</div>
                    <div class="detail-value">${formatDateLocal(invoice.issue_date)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Due Date:</div>
                    <div class="detail-value">${formatDateLocal(invoice.due_date)}</div>
                </div>
                ${invoice.service_period_start || invoice.service_period_end ? 
                  `<div class="detail-row">
                    <div class="detail-label">Service:</div>
                    <div class="detail-value">${formatServicePeriod(invoice.service_period_start, invoice.service_period_end)}</div>
                </div>` : ''}
            </div>
            
            <div class="billing-info">
                <div class="section-title">Bill To</div>
                <div class="recipient-address"><strong>${invoice.entity.name}</strong></div>
                ${invoice.entity.contact_person ? `<div class="recipient-address">${invoice.entity.contact_person}</div>` : ''}
                ${entityAddress ? `<div class="recipient-address">${entityAddress.split('\n').map(line => line.trim()).filter(line => line).join('<br>')}</div>` : ''}
                ${invoice.entity.phone ? `<div class="recipient-address">Phone: ${invoice.entity.phone}</div>` : ''}
                ${invoice.entity.email ? `<div class="recipient-address">Email: ${invoice.entity.email}</div>` : ''}
            </div>
        </div>

        <div class="line-items">
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th style="text-align: center; width: 80px;">Qty</th>
                        <th style="text-align: right; width: 100px;">Rate</th>
                        <th style="text-align: right; width: 100px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.line_items.map(item => {
                        const unitPrice = item.unit_price;
                        const itemSubtotalMoney = multiplyMoney(unitPrice, item.quantity);
                        const itemDiscount = calculateLineItemDiscount(item);
                        const itemTaxes = item.taxes || [];
                        
                        return `
                        <tr>
                            <td><strong>${item.description}</strong></td>
                            <td style="text-align: center;">${item.quantity}</td>
                            <td style="text-align: right;">${formatMoney(unitPrice)}</td>
                            <td style="text-align: right;"><strong>${formatMoney(itemSubtotalMoney)}</strong></td>
                        </tr>
                        ${isPositive(itemDiscount) ? `
                        <tr>
                            <td style="padding-left: 20px; color: #059669; font-size: 12px;">Discount (${(Number(item.discount_rate)).toFixed(2)}%):</td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right; color: #059669; font-size: 12px;">-${formatMoney(itemDiscount)}</td>
                        </tr>` : ''}
                        ${itemTaxes.map((tax) => `
                        <tr>
                            <td style="padding-left: 20px; color: #6b7280; font-size: 12px;">${tax.tax_name_snapshot} (${(tax.tax_rate_snapshot * 100).toFixed(2)}%):</td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right; color: #6b7280; font-size: 12px;">${formatMoney(tax.tax_amount)}</td>
                        </tr>`).join('')}
                        ${(item.service_period_start || item.service_period_end) ? `
                        <tr>
                            <td colspan="4" style="padding-left: 20px; color: #64748b; font-size: 11px; font-style: italic;">Service Period: ${formatServicePeriod(item.service_period_start, item.service_period_end)}</td>
                        </tr>` : ''}
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="totals">
            <table class="totals-table">
                <tr>
                    <td class="label">Subtotal:</td>
                    <td class="amount">${formatMoney(invoice.subtotal)}</td>
                </tr>
                ${isPositive(invoice.discount_amount) ? `
                <tr>
                    <td colspan="2">
                        <div class="breakdown-section">
                            <div class="breakdown-item breakdown-total">
                                <span>Discounts:</span>
                                
                                <span class="discount-text">-${formatMoney(invoice.discount_amount)}</span>
                            </div>
                        </div>
                    </td>
                </tr>
                ` : ''}
                ${isPositive(invoice.tax_amount) ? `
                <tr>
                    <td colspan="2">
                        <div class="breakdown-section">
                            <div class="breakdown-item breakdown-total">
                                <span>Tax:</span>
                                <span>${formatMoney(invoice.tax_amount)}</span>
                            </div>
                        </div>
                    </td>
                </tr>
                ` : ''}
                <tr class="total-row">
                    <td class="label">Total:</td>
                    <td class="amount">${formatMoney(invoice.total_amount)}</td>
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
        <div class="notes">
            <div class="notes-title">Notes</div>
            <div class="notes-content">${invoice.notes}</div>
        </div>
        ` : ''}
        
        <div class="footer">
            <p>Thank you for your business!</p>
            <p>If you have any questions about this invoice, please contact us at ${companyInfo.email} or ${companyInfo.phone}.</p>
            
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
      from: `${siteConfig.legal.businessName} <${siteConfig.contact.paymentsEmail}>`,
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