import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useNavigate } from '@remix-run/react';
import { getSupabaseAdminClient } from '~/utils/supabase.server';
import { requireUserId } from '~/utils/auth.server';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import RecordPaymentForm from '~/components/RecordPaymentForm';
import { AppBreadcrumb, breadcrumbPatterns } from '~/components/AppBreadcrumb';

import { formatDate } from '~/utils/misc';
import { calculateInvoicePaymentTaxBreakdown } from '~/utils/line-item-helpers';
import { formatMoney, fromDollars, toDollars, toCents, addMoney, subtractMoney, compareMoney, toMoney, type Money } from '~/utils/money';
import type { Database } from "~/types/database.types";
import { moneyFromRow } from "~/utils/database-money";
import { csrf } from "~/utils/csrf.server";



// Validation schema for payment recording
const RecordPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.number().positive('Amount must be positive'),
  payment_method: z.enum(['cash', 'check', 'bank_transfer', 'credit_card', 'ach', 'other']),
  payment_date: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date'),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
  receipt_url: z.string().url().optional()
});

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserId(request);
  const supabase = getSupabaseAdminClient();
  
  if (!params.id) {
    throw new Response('Invoice ID is required', { status: 400 });
  }

  // Check if the id looks like an invoice number (INV-YYYY-NNNN format)
  const isInvoiceNumber = /^INV-\d{4}-\d{4}$/.test(params.id);
  
  // Fetch invoice details
  const { data: invoice_db, error: invoiceError } = await supabase
    .from('invoices')
    .select(`
      id,
      invoice_number,
      total_amount,
      amount_paid,
      status,
      invoice_entities (
        id,
        name,
        entity_type
      )
    `)
    .eq(isInvoiceNumber ? 'invoice_number' : 'id', params.id)
    .single();

  if (invoiceError || !invoice_db) {
    throw new Response('Invoice not found', { status: 404 });
  }

  // Check if invoice can accept payments
  if (invoice_db.status === 'cancelled') {
    throw new Response('Cannot record payment for cancelled invoice', { status: 400 });
  }

  if (invoice_db.status === 'paid') {
    throw new Response('Invoice is already fully paid', { status: 400 });
  }

  // Fetch existing payments for this invoice
  const { data: payments_db, error: paymentsError } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', params.id)
    .order('payment_date', { ascending: false });

  if (paymentsError) {
    console.error('Error fetching payments:', paymentsError);
  }

  const invoice = {
    ...invoice_db,
    total_amount: moneyFromRow('invoices', 'total_amount', invoice_db as unknown as Record<string, unknown>),
    amount_paid: moneyFromRow('invoices', 'amount_paid', invoice_db as unknown as Record<string, unknown>),
  };

  const remainingBalance = subtractMoney(invoice.total_amount, invoice.amount_paid);

  return json({
    invoice,
    payments: payments_db || [],
    remainingBalance
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserId(request);
  await csrf.validate(request);
  const supabase = getSupabaseAdminClient();
  
  if (!params.id) {
    return json({ errors: { general: 'Invoice ID is required' } }, { status: 400 });
  }

  const formData = await request.formData();
  const action = formData.get('action');

  if (action !== 'record_payment') {
    return json({ errors: { general: 'Invalid action' } }, { status: 400 });
  }

  try {
    // Parse and validate form data
    const rawData = {
      invoice_id: params.id,
      amount: parseFloat(formData.get('amount') as string),
      payment_method: formData.get('payment_method') as string,
      payment_date: formData.get('payment_date') as string,
      reference_number: formData.get('reference_number') as string || undefined,
      notes: formData.get('notes') as string || undefined,
      receipt_url: (formData.get('receipt_url') as string) || undefined
    };

    const validatedData = RecordPaymentSchema.parse(rawData);

    // Fetch current invoice with line items and tax details to validate payment amount and calculate tax breakdown
    const { data: invoice_db, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        total_amount, 
        amount_paid, 
        status,
        tax_amount,
        line_items:invoice_line_items(
          id,
          invoice_line_item_taxes(
            tax_rate_id,
            tax_amount,
            tax_name_snapshot,
            tax_rate_snapshot,
            tax_description_snapshot
          )
        )
      `)
      .eq('id', params.id)
      .single();

    if (invoiceError || !invoice_db) {
      return json({ errors: { general: 'Invoice not found' } }, { status: 404 });
    }

    if (invoice_db.status === 'cancelled') {
      return json({ errors: { general: 'Cannot record payment for cancelled invoice' } }, { status: 400 });
    }

    const invoice = {
      ...invoice_db,
      total_amount: moneyFromRow('invoices', 'total_amount', invoice_db as unknown as Record<string, unknown>),
      amount_paid: moneyFromRow('invoices', 'amount_paid', invoice_db as unknown as Record<string, unknown>),
    };

    const remainingBalance = subtractMoney(invoice.total_amount, invoice.amount_paid);
    const paymentAmount = fromDollars(validatedData.amount);

    if (compareMoney(paymentAmount, remainingBalance) > 0) {
      return json({ 
        errors: { 
          amount: `Payment amount cannot exceed remaining balance of ${formatMoney(remainingBalance)}`
        } 
      }, { status: 400 });
    }

    // Record the payment
    const insertPayload = {
      invoice_id: validatedData.invoice_id,
      amount: toDollars(paymentAmount),
      amount_cents: toCents(paymentAmount),
      payment_method: validatedData.payment_method as Database['public']['Enums']['invoice_payment_method'],
      payment_date: validatedData.payment_date,
      reference_number: validatedData.reference_number ?? null,
      notes: validatedData.notes ?? null,
      receipt_url: validatedData.receipt_url ?? null,
    } satisfies Database['public']['Tables']['invoice_payments']['Insert'];

    const { data: payment, error: paymentError } = await supabase
      .from('invoice_payments')
      .insert(insertPayload)
      .select()
      .single();

    if (paymentError) {
      console.error('Error recording payment:', paymentError);
      return json({ errors: { general: 'Failed to record payment' } }, { status: 500 });
    }

    // Calculate and store tax breakdown for this payment
    const taxAmountCents = (invoice_db as unknown as Record<string, unknown>)['tax_amount_cents'] as number | undefined;
    const taxAmountDollars = (invoice_db as unknown as Record<string, unknown>)['tax_amount'] as number | undefined;
    if ((((typeof taxAmountCents === 'number' ? taxAmountCents : Math.round((taxAmountDollars || 0) * 100)) > 0)) && invoice_db.line_items) {
      // Transform the data structure to match what the helper function expects
      const lineItemsWithTaxes = invoice_db.line_items.map(item => ({
        id: item.id,
        taxes: item.invoice_line_item_taxes?.map(tax_db => ({
          tax_rate_id: tax_db.tax_rate_id,
          tax_amount: moneyFromRow('invoice_line_item_taxes', 'tax_amount', tax_db as unknown as Record<string, unknown>),
          tax_name_snapshot: tax_db.tax_name_snapshot,
          tax_rate_snapshot: tax_db.tax_rate_snapshot,
          tax_description_snapshot: tax_db.tax_description_snapshot || undefined
        }))
      }));

      const taxBreakdown = calculateInvoicePaymentTaxBreakdown(
        paymentAmount,
        moneyFromRow('invoices', 'total_amount', invoice_db as unknown as Record<string, unknown>),
        moneyFromRow('invoices', 'tax_amount', invoice_db as unknown as Record<string, unknown>),
        lineItemsWithTaxes
      );

      if (taxBreakdown.length > 0) {
        const taxRecords = taxBreakdown.map(tax => ({
          payment_id: payment.id,
          tax_rate_id: tax.tax_rate_id,
          tax_amount: toDollars(tax.tax_amount),
          tax_amount_cents: tax.tax_amount.getAmount(),
          tax_name_snapshot: tax.tax_name_snapshot,
          tax_rate_snapshot: tax.tax_rate_snapshot,
          tax_description_snapshot: tax.tax_description_snapshot
        }));

        const { error: taxError } = await supabase
          .from('payment_taxes')
          .insert(taxRecords);

        if (taxError) {
          console.error('Error recording payment tax breakdown:', taxError);
          // Continue with payment processing even if tax breakdown fails
          // This is not critical enough to rollback the entire payment
        }
      }
    }

    // Update invoice amount_paid and status
    const currentPaid = moneyFromRow('invoices', 'amount_paid', invoice_db as unknown as Record<string, unknown>);
    const currentTotal = moneyFromRow('invoices', 'total_amount', invoice_db as unknown as Record<string, unknown>);
    const newAmountPaid = addMoney(currentPaid, paymentAmount);
    const newStatus = compareMoney(newAmountPaid, currentTotal) >= 0 ? 'paid' : 'partially_paid';

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        amount_paid: toDollars(newAmountPaid),
        amount_paid_cents: newAmountPaid.getAmount(),
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id);

    if (updateError) {
      console.error('Error updating invoice:', updateError);
      // Try to rollback the payment
      await supabase
        .from('invoice_payments')
        .delete()
        .eq('id', payment.id);
      
      return json({ errors: { general: 'Failed to update invoice status' } }, { status: 500 });
    }

    // Redirect back to invoice detail page
    return redirect(`/admin/invoices/${params.id}`);

  } catch (error) {
    console.error('Payment recording error:', error);
    
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      error.errors.forEach((err) => {
        if (err.path.length > 0) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      return json({ errors: fieldErrors }, { status: 400 });
    }

    return json({ errors: { general: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export default function RecordPaymentPage() {
  const { invoice, payments: payments_db, remainingBalance } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const handleCancel = () => {
    navigate(`/admin/invoices/${invoice.id}`);
  };

  const invoiceTotal: Money = toMoney((invoice as { total_amount: unknown }).total_amount);
  const amountPaid: Money = toMoney((invoice as { amount_paid: unknown }).amount_paid);

  const remainingBalanceMoney: Money = toMoney(remainingBalance as unknown);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* Breadcrumbs */}
        <AppBreadcrumb 
          items={breadcrumbPatterns.adminInvoiceRecordPayment(invoice.id, invoice.invoice_number)}
          className="mb-6"
        />

        {/* Header */}
        <div className="mb-6">
          <button
            onClick={handleCancel}
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Invoice
          </button>
          
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Record Payment
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Invoice #{invoice.invoice_number} - {invoice.invoice_entities.name}
          </p>
        </div>

        {/* Payment History (if any) */}
        {payments_db.length > 0 && (
          <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">
              Payment History
            </h3>
            <div className="space-y-2">
              {payments_db.map((payment_db) => (
                <div key={payment_db.id} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                  <div>
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {formatMoney(moneyFromRow('invoice_payments', 'amount', payment_db as unknown as Record<string, unknown>))}
                    </span>
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                      via {payment_db.payment_method.replace('_', ' ')}
                    </span>
                    {payment_db.reference_number && (
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-500">
                        (Ref: {payment_db.reference_number})
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(payment_db.payment_date, { formatString: 'MMM d, yyyy' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Form */}
        <RecordPaymentForm
          invoiceId={invoice.id}
          invoiceTotal={invoiceTotal}
          amountPaid={amountPaid}
          remainingBalance={remainingBalanceMoney}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
