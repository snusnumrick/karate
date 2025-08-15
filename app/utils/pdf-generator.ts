import { renderToBuffer } from '@react-pdf/renderer';
import { InvoiceTemplate } from '~/components/pdf/InvoiceTemplate';
import type { Invoice, InvoiceEntity, InvoiceLineItem } from '~/types/invoice';
import { siteConfig } from '~/config/site';

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
    // Validate required data
    if (!invoice) {
      throw new Error('Invoice data is required');
    }
    
    if (!invoice.entity) {
      throw new Error('Invoice entity is required');
    }
    
    if (!invoice.line_items || invoice.line_items.length === 0) {
      throw new Error('Invoice must have at least one line item');
    }

    // Sanitize text data to prevent font rendering issues
    const sanitizedInvoice = {
      ...invoice,
      entity: {
        ...invoice.entity,
        name: sanitizeText(invoice.entity.name),
        contact_person: sanitizeText(invoice.entity.contact_person),
        address_line1: sanitizeText(invoice.entity.address_line1),
        address_line2: sanitizeText(invoice.entity.address_line2),
        city: sanitizeText(invoice.entity.city),
        state: sanitizeText(invoice.entity.state),
        email: sanitizeText(invoice.entity.email),
        phone: sanitizeText(invoice.entity.phone),
      },
      line_items: invoice.line_items.map(item => ({
        ...item,
        description: sanitizeText(item.description),
      })),
      notes: sanitizeText(invoice.notes),
    };

    const sanitizedCompanyInfo = companyInfo ? {
      ...companyInfo,
      name: sanitizeText(companyInfo.name),
      address: sanitizeText(companyInfo.address),
      phone: sanitizeText(companyInfo.phone),
      email: sanitizeText(companyInfo.email),
      website: sanitizeText(companyInfo.website),
    } : undefined;
    
    const pdfBuffer = await renderToBuffer(
      InvoiceTemplate({ invoice: sanitizedInvoice, companyInfo: sanitizedCompanyInfo })
    );
    
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('fontkit') || error.message.includes('DataView')) {
        throw new Error('Font rendering error - please try again or contact support');
      }
      if (error.message.includes('Invalid character')) {
        throw new Error('Invalid characters in invoice data - please check text fields');
      }
    }
    
    throw new Error('Failed to generate invoice PDF');
  }
}

// Helper function to sanitize text and remove problematic characters
function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  
  // Remove or replace problematic characters that might cause font issues
  // Using String.fromCharCode to avoid control character regex lint issues
  const controlCharsPattern = new RegExp(
    `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}-${String.fromCharCode(159)}]`,
    'g'
  );
  
  return text
    .replace(controlCharsPattern, '') // Remove control characters
    .replace(/[\uFFFD]/g, '') // Remove replacement characters
    .trim();
}

export function getDefaultCompanyInfo(): CompanyInfo {
  const { name, legal, contact } = siteConfig;
  
  // Use the legal address for invoices
  const formattedAddress = legal.address;

  return {
    name: name,
    address: formattedAddress,
    phone: contact.phone,
    email: contact.email,
    website: siteConfig.url,
    // logo: process.env.COMPANY_LOGO_URL, // Optional logo URL
  };
}

export function generateInvoiceFilename(invoice: Invoice): string {
  const invoiceNumber = invoice.invoice_number.replace(/[^a-zA-Z0-9]/g, '_');
  const date = new Date(invoice.issue_date).toISOString().split('T')[0];
  return `invoice_${invoiceNumber}_${date}.pdf`;
}