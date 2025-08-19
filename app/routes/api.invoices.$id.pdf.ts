import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireAdminUser } from '~/utils/auth.server';
import { getInvoiceById, getInvoiceByNumber } from '~/services/invoice.server';
import { generateInvoicePDF, getDefaultCompanyInfo, generateInvoiceFilename } from '~/utils/pdf-generator';

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdminUser(request);
  
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
    
    // Generate filename
    const filename = generateInvoiceFilename(invoice);

    // Return the PDF as a response
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
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
    
    return json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}