import { renderToBuffer } from '@react-pdf/renderer';
import { InvoiceTemplate } from '~/components/pdf/InvoiceTemplate';
import type { Invoice, InvoiceEntity, InvoiceLineItem } from '~/types/invoice';

interface CompanyInfo {
  name: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
}

interface GeneratePDFOptions {
  invoice: Invoice & {
    entity: InvoiceEntity;
    line_items: InvoiceLineItem[];
  };
  companyInfo?: CompanyInfo;
}

export async function generateInvoicePDF({ invoice, companyInfo }: GeneratePDFOptions): Promise<Buffer> {
  try {
    const pdfBuffer = await renderToBuffer(
      InvoiceTemplate({ invoice, companyInfo })
    );
    
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate invoice PDF');
  }
}

export function getDefaultCompanyInfo(): CompanyInfo {
  return {
    name: process.env.COMPANY_NAME || 'Your Karate School',
    address: process.env.COMPANY_ADDRESS || '123 Main Street\nYour City, State 12345',
    phone: process.env.COMPANY_PHONE || '(555) 123-4567',
    email: process.env.COMPANY_EMAIL || 'info@yourkarateschool.com',
    website: process.env.COMPANY_WEBSITE || 'www.yourkarateschool.com',
    // logo: process.env.COMPANY_LOGO_URL, // Optional logo URL
  };
}

export function generateInvoiceFilename(invoice: Invoice): string {
  const invoiceNumber = invoice.invoice_number.replace(/[^a-zA-Z0-9]/g, '_');
  const date = new Date(invoice.issue_date).toISOString().split('T')[0];
  return `invoice_${invoiceNumber}_${date}.pdf`;
}