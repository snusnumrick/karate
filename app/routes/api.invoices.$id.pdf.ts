import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { withAdminLoader } from '~/utils/auth.server';
import { getInvoiceById } from '~/services/invoice.server';
import { toServiceErrorResponseInit } from '~/utils/service-errors.server';
import { generateInvoicePDF, getDefaultCompanyInfo, generateInvoiceFilename } from '~/utils/pdf-generator';

async function loaderImpl({ params }: LoaderFunctionArgs) {
  
  const invoiceId = params.id;
  if (!invoiceId) {
    throw new Response('Invoice ID is required', { status: 400 });
  }

  try {
    // Fetch the invoice with all related data
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Response('Invoice not found', { status: 404 });
    }

    // Generate the PDF
    const companyInfo = getDefaultCompanyInfo();
    const pdfBuffer = await generateInvoicePDF({ invoice, companyInfo });
    const pdfBytes = new Uint8Array(pdfBuffer);
    
    // Generate filename
    const filename = generateInvoiceFilename(invoice);

    // Return the PDF as a response
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': pdfBytes.byteLength.toString(),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    
    if (error instanceof Response) {
      throw error;
    }

    const { status, body } = toServiceErrorResponseInit(error);
    return json(
      { error: body.message },
      { status }
    );
  }
}

export const loader = withAdminLoader(loaderImpl);
