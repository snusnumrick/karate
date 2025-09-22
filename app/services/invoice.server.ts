import { SupabaseClient } from "@supabase/supabase-js";
import invariant from "tiny-invariant";
import { siteConfig } from "~/config/site";
import type { Database } from "~/types/database.types";
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceWithDetails,
  CreateInvoiceData,
  CreateInvoiceLineItemData,
  InvoiceFilters,
  InvoiceCalculations,
  LineItemCalculations,
  EntityType,
  PaymentTerms,
  InvoiceStatus,
  TaxRate,
  InvoiceLineItemTax,
} from "~/types/invoice";
import {
  calculateLineItemDiscount,
  calculateLineItemSubtotal,
  calculateLineItemTaxWithRates,

  getLineItemTaxBreakdown
} from "~/utils/line-item-helpers";
import { getApplicableTaxRates } from "~/services/tax-rates.server";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
import { toCents, addMoney, subtractMoney, ZERO_MONEY, type Money } from "~/utils/money";
import { convertRowToMoney, convertRowsToMoney, convertMoneyToRow, moneyFromRow } from "~/services/database-money.server";
import { getNum } from "~/utils/db-money";

/**
 * Calculate invoice totals from line items
 */
export function calculateInvoiceTotals(lineItems: InvoiceLineItem[]): InvoiceCalculations {
  // Assuming line items store values in cents, convert to Money objects
  const subtotalMoney = lineItems.reduce((sum, item) => 
    addMoney(sum, item.line_total), ZERO_MONEY);
  const taxAmountMoney = lineItems.reduce((sum, item) => 
    addMoney(sum, item.tax_amount ?? ZERO_MONEY), ZERO_MONEY);
  const discountAmountMoney = lineItems.reduce((sum, item) => 
    addMoney(sum, item.discount_amount ?? ZERO_MONEY), ZERO_MONEY);
  const totalAmountMoney = addMoney(subtotalMoney, subtractMoney(taxAmountMoney, discountAmountMoney));

  return {
    subtotal: subtotalMoney,
    tax_amount: taxAmountMoney,
    discount_amount: discountAmountMoney,
    total_amount: totalAmountMoney,
  };
}

/**
 * Create line item tax associations for multiple tax rates
 */
export async function createLineItemTaxAssociations(
  lineItemId: string,
  taxRateIds: string[],
  lineItemData: CreateInvoiceLineItemData,
  taxRates: TaxRate[],
  supabaseAdmin?: SupabaseClient<Database>
): Promise<void> {
  if (!taxRateIds || taxRateIds.length === 0) {
    return;
  }

  const client = supabaseAdmin ?? getSupabaseAdminClient();
  const taxBreakdown = getLineItemTaxBreakdown(lineItemData, taxRates);

  const taxAssociations_db = taxRateIds.map(taxRateId => {
    const taxRate = taxRates.find(tr => tr.id === taxRateId);
    const breakdown = taxBreakdown.find(tb => tb.taxRate.id === taxRateId);
    
    if (!taxRate || !breakdown) {
      throw new Error(`Tax rate not found: ${taxRateId}`);
    }

    return {
      invoice_line_item_id: lineItemId,
      tax_rate_id: taxRateId,
      tax_name_snapshot: taxRate.name,
      tax_rate_snapshot: taxRate.rate,
      tax_description_snapshot: taxRate.description,
      // invoice_line_item_taxes legacy numeric fields are dollars
      tax_amount: toCents(breakdown.amount) / 100,
      tax_amount_cents: toCents(breakdown.amount)
    };
  });

  console.log('[Service/createLineItemTaxAssociations] Tax associations prepared:', taxAssociations_db);
  
  const { error } = await client
    .from('invoice_line_item_taxes')
    .insert(taxAssociations_db);

  if (error) {
    console.error('[Service/createLineItemTaxAssociations] Error creating tax associations:', error);
    throw new Response(`Error creating line item tax associations: ${error.message}`, { status: 500 });
  }
  
  console.log('[Service/createLineItemTaxAssociations] Tax associations saved successfully');
}

/**
 * Calculate line item totals with multiple tax rates support
 */
export function calculateLineItemTotalsWithRates(
  quantity: number,
  unitPrice: Money,
  taxRateIds: string[] = [],
  taxRates: TaxRate[] = [],
  discountRate: number = 0
): LineItemCalculations {
  // Create a temporary line item object to use with helper functions
  const tempItem: CreateInvoiceLineItemData = {
    item_type: 'other',
    description: '',
    quantity,
    unit_price: unitPrice,
    tax_rate_ids: taxRateIds,
    discount_rate: discountRate
  };

  // Use the centralized calculation functions
  const lineTotal = calculateLineItemSubtotal(tempItem);
  const taxAmount = calculateLineItemTaxWithRates(
    tempItem.quantity,
    tempItem.unit_price,
    tempItem.tax_rate_ids || [],
    taxRates,
    tempItem.discount_rate || 0
  );
  const discountAmount = calculateLineItemDiscount(tempItem);
  const finalAmount = subtractMoney(addMoney(lineTotal, taxAmount), discountAmount);

  return {
    line_total: lineTotal,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    final_amount: finalAmount,
  };
}

/**
 * Generate a unique invoice number
 */
export async function generateInvoiceNumber(
  supabaseAdmin?: SupabaseClient<Database>
): Promise<string> {
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  const { data, error } = await client.rpc('generate_invoice_number');
  
  if (error) {
    console.error('[Service/generateInvoiceNumber] Error generating invoice number:', error);
    throw new Response(`Error generating invoice number: ${error.message}`, { status: 500 });
  }
  
  return data;
}

/**
 * Create a new invoice with line items
 */
export async function createInvoice(
  invoiceData: CreateInvoiceData,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceWithDetails> {
  invariant(invoiceData.entity_id, "Missing entity_id");
  invariant(invoiceData.line_items.length > 0, "At least one line item is required");
  
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log('[Service/createInvoice] Creating invoice with data:', invoiceData);

  // Start a transaction
  const { data: invoice, error: invoiceError } = await client
    .from('invoices')
    .insert({
      entity_id: invoiceData.entity_id,
      family_id: invoiceData.family_id,
      issue_date: invoiceData.issue_date,
      due_date: invoiceData.due_date,
      service_period_start: invoiceData.service_period_start,
      service_period_end: invoiceData.service_period_end,
      notes: invoiceData.notes,
      terms: invoiceData.terms,
      footer_text: invoiceData.footer_text,
      invoice_number: '', // Will be auto-generated by trigger
    })
    .select()
    .single();

  if (invoiceError) {
    console.error('[Service/createInvoice] Error creating invoice:', invoiceError);
    throw new Response(`Error creating invoice: ${invoiceError.message}`, { status: 500 });
  }

  // Pre-fetch applicable tax rates for all item types to avoid multiple DB calls
  const uniqueItemTypes = [...new Set(invoiceData.line_items.map(item => item.item_type))];
  const taxRatesByItemType: Record<string, TaxRate[]> = {};
  
  for (const itemType of uniqueItemTypes) {
    taxRatesByItemType[itemType] = await getApplicableTaxRates(itemType, client);
  }

  // Calculate line item totals with pre-fetched tax rates
  const lineItemsWithTotals_db = invoiceData.line_items.map((item, index) => {
    // Use pre-fetched applicable tax rates based on item type
    const applicableTaxRates = taxRatesByItemType[item.item_type];
    
    const calculations = calculateLineItemTotalsWithRates(
      item.quantity,
      item.unit_price,
      item.tax_rate_ids || [],
      applicableTaxRates,
      item.discount_rate || 0
    );

    return {
      invoice_id: invoice.id,
      item_type: item.item_type,
      description: item.description,
      quantity: item.quantity,
      // Legacy numeric fields (without _cents) should be dollars; write both
      unit_price: toCents(item.unit_price) / 100,
      unit_price_cents: toCents(item.unit_price),
      line_total: toCents(calculations.line_total) / 100,
      line_total_cents: toCents(calculations.line_total),
      tax_amount: toCents(calculations.tax_amount ?? ZERO_MONEY) / 100,
      tax_amount_cents: toCents(calculations.tax_amount ?? ZERO_MONEY),
      discount_rate: (item.discount_rate || 0) / 100, // Convert percentage to decimal for database
      discount_amount: toCents(calculations.discount_amount ?? ZERO_MONEY) / 100,
      discount_amount_cents: toCents(calculations.discount_amount ?? ZERO_MONEY),
      enrollment_id: item.enrollment_id,
      product_id: item.product_id,
      service_period_start: item.service_period_start,
      service_period_end: item.service_period_end,
      sort_order: item.sort_order || index,
    };
  });

  const { data: insertedLineItems, error: lineItemsError } = await client
    .from('invoice_line_items')
    .insert(lineItemsWithTotals_db)
    .select('id');

  if (lineItemsError) {
    console.error('[Service/createInvoice] Error creating line items:', lineItemsError);
    // Clean up the invoice if line items failed
    await client.from('invoices').delete().eq('id', invoice.id);
    throw new Response(`Error creating invoice line items: ${lineItemsError.message}`, { status: 500 });
  }

  // Create tax associations for each line item
  if (insertedLineItems) {
    for (let i = 0; i < insertedLineItems.length; i++) {
      const lineItem = insertedLineItems[i];
      const originalItem = invoiceData.line_items[i];
      
      if (originalItem.tax_rate_ids && originalItem.tax_rate_ids.length > 0) {
        const applicableTaxRates = taxRatesByItemType[originalItem.item_type];
        await createLineItemTaxAssociations(
          lineItem.id,
          originalItem.tax_rate_ids,
          originalItem,
          applicableTaxRates,
          client
        );
      }
    }
  }

  // Denormalize totals onto invoices for easy querying and legacy compatibility
  try {
    const subtotalCents = lineItemsWithTotals_db.reduce((sum, li) => sum + (li.line_total_cents ?? 0), 0);
    const discountCents = lineItemsWithTotals_db.reduce((sum, li) => sum + (li.discount_amount_cents ?? 0), 0);
    const itemTaxCents = lineItemsWithTotals_db.reduce((sum, li) => sum + (li.tax_amount_cents ?? 0), 0);
    const totalCents = subtotalCents - discountCents + itemTaxCents;
    await client
      .from('invoices')
      .update({
        subtotal_cents: subtotalCents,
        subtotal: subtotalCents / 100,
        discount_amount_cents: discountCents,
        discount_amount: discountCents / 100,
        tax_amount_cents: itemTaxCents,
        tax_amount: itemTaxCents / 100,
        total_amount_cents: totalCents,
        total_amount: totalCents / 100,
      })
      .eq('id', invoice.id);
  } catch (e) {
    console.warn('[Service/createInvoice] Failed to denormalize invoice totals:', e);
  }

  // Fetch the complete invoice with details
  return getInvoiceById(invoice.id, client);
}

/**
 * Get invoice by ID with all related data
 */
export async function getInvoiceById(
  invoiceId: string,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceWithDetails> {
  invariant(invoiceId, "Missing invoiceId parameter");
  
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log(`[Service/getInvoiceById] Fetching invoice details for ID: ${invoiceId}`);

  const { data: invoice, error: invoiceError } = await client
    .from('invoices')
    .select(`
      *,
      invoice_entities(*),
      families(id, name),
      invoice_line_items(*),
      invoice_payments(*),
      invoice_status_history(*)
    `)
    .eq('id', invoiceId)
    .single();

  if (invoiceError) {
    console.error(`[Service/getInvoiceById] Error fetching invoice ${invoiceId}:`, invoiceError);
    throw new Response(`Database error: ${invoiceError.message}`, { status: 500 });
  }

  if (!invoice) {
    throw new Response("Invoice not found", { status: 404 });
  }

  // Fetch tax data for line items
  const lineItemIds = (invoice.invoice_line_items || []).map(item => item.id);
  console.log(`[Service/getInvoiceById] Fetching tax data for line items:`, lineItemIds);
  
  const { data: lineItemTaxes_db, error: taxError } = await client
    .from('invoice_line_item_taxes')
    .select('*')
    .in('invoice_line_item_id', lineItemIds);

  if (taxError) {
    console.error(`[Service/getInvoiceById] Error fetching tax data:`, taxError);
  }

  console.log(`[Service/getInvoiceById] Found tax data:`, lineItemTaxes_db);

  // Group tax data by line item ID
  const taxesByLineItem = (lineItemTaxes_db || []).reduce((acc, tax_db) => {
    if (!acc[tax_db.invoice_line_item_id]) {
      acc[tax_db.invoice_line_item_id] = [];
    }
    // Ensure created_at is not null before pushing
    if (tax_db.created_at) {
      acc[tax_db.invoice_line_item_id].push({
        ...tax_db,
        tax_amount: moneyFromRow('invoice_line_item_taxes', 'tax_amount', tax_db as unknown as Record<string, unknown>)
      } as InvoiceLineItemTax);
    }
    return acc;
  }, {} as Record<string, InvoiceLineItemTax[]>);

  // Also group tax rate IDs for backward compatibility
  const taxRatesByLineItem = (lineItemTaxes_db || []).reduce((acc, tax) => {
    if (!acc[tax.invoice_line_item_id]) {
      acc[tax.invoice_line_item_id] = [];
    }
    acc[tax.invoice_line_item_id].push(tax.tax_rate_id);
    return acc;
  }, {} as Record<string, string[]>);

  console.log(`[Service/getInvoiceById] Grouped taxes by line item:`, taxesByLineItem);

  // Fetch payment taxes separately
  const { data: paymentTaxes_db } = await client
    .from('payment_taxes')
    .select('*')
    .in('payment_id', (invoice.invoice_payments || []).map(p => p.id));

  // Convert main invoice money fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convertedInvoice = convertRowToMoney('invoices', invoice as any) as any;

  // Compute total tax amount across all line items (sum of all applied taxes)
  const invoiceTotalTax = Object.values(taxesByLineItem).reduce((sum, itemTaxes) => {
    return itemTaxes.reduce((innerSum, tax) => addMoney(innerSum, tax.tax_amount || ZERO_MONEY), sum);
  }, ZERO_MONEY);
  
  return {
    ...convertedInvoice,
    // Override tax_amount to reflect sum of all applied taxes across line items
    tax_amount: invoiceTotalTax,
    service_period_start: invoice.service_period_start || undefined,
    service_period_end: invoice.service_period_end || undefined,
    currency: invoice.currency || siteConfig.localization.currency,
    notes: invoice.notes || undefined,
    terms: invoice.terms || undefined,
    footer_text: invoice.footer_text || undefined,
    sent_at: invoice.sent_at || undefined,
    viewed_at: invoice.viewed_at || undefined,
    paid_at: invoice.paid_at || undefined,
    created_at: invoice.created_at || new Date().toISOString(),
    updated_at: invoice.updated_at || new Date().toISOString(),
    entity: {
      ...convertRowToMoney('invoice_entities', invoice.invoice_entities),
      entity_type: invoice.invoice_entities.entity_type as EntityType,
      contact_person: invoice.invoice_entities.contact_person || undefined,
      email: invoice.invoice_entities.email || undefined,
      phone: invoice.invoice_entities.phone || undefined,
      address_line1: invoice.invoice_entities.address_line1 || undefined,
      address_line2: invoice.invoice_entities.address_line2 || undefined,
      city: invoice.invoice_entities.city || undefined,
      state: invoice.invoice_entities.state || undefined,
      postal_code: invoice.invoice_entities.postal_code || undefined,
      country: invoice.invoice_entities.country || siteConfig.localization.country,
      tax_id: invoice.invoice_entities.tax_id || undefined,
      payment_terms: (invoice.invoice_entities.payment_terms as PaymentTerms) || 'Net 30',
      is_active: invoice.invoice_entities.is_active ?? true,
      notes: invoice.invoice_entities.notes || undefined,
      created_at: invoice.invoice_entities.created_at || new Date().toISOString(),
      updated_at: invoice.invoice_entities.updated_at || new Date().toISOString(),
    },
    family: invoice.families || undefined,
    family_id: invoice.family_id || undefined,
    line_items: (invoice.invoice_line_items || []).map(item => {
      // Normalize monetary fields on the line item using centralized converter
      const convertedItem = convertRowToMoney('invoice_line_items', item) as Record<string, unknown>;
      const itemTaxes = taxesByLineItem[item.id] || [];
      const totalTaxAmount = itemTaxes.reduce((sum, tax) => addMoney(sum, tax.tax_amount || ZERO_MONEY), ZERO_MONEY);
      
      return {
        ...(convertedItem as object),
        tax_rate: ((item.tax_rate ?? 0) as number) * 100, // Convert decimal back to percentage for frontend
        tax_amount: (convertedItem['tax_amount'] as unknown) ?? ZERO_MONEY,
        tax_rate_ids: taxRatesByLineItem[item.id] || [], // Include tax rate IDs from associations
        taxes: itemTaxes, // Include actual tax data
        total_tax_amount: totalTaxAmount, // Calculate total tax amount
        discount_rate: ((item.discount_rate ?? 0) as number) * 100, // Convert decimal back to percentage for frontend
        discount_amount: (convertedItem['discount_amount'] as unknown) ?? ZERO_MONEY,
        sort_order: (item.sort_order ?? 0) as number,
        enrollment_id: item.enrollment_id || undefined,
        product_id: item.product_id || undefined,
        service_period_start: item.service_period_start || undefined,
        service_period_end: item.service_period_end || undefined,
        created_at: item.created_at || new Date().toISOString(),
      };
    }),
    payments: (invoice.invoice_payments || []).map(payment => {
      const taxes_db = (paymentTaxes_db || []).filter(tax => tax.payment_id === payment.id);
      const rawPaymentIntentId = 'payment_intent_id' in payment
        ? (payment as { payment_intent_id: string | null }).payment_intent_id
        : (payment as { stripe_payment_intent_id?: string | null }).stripe_payment_intent_id ?? null;
      return {
        ...payment,
        reference_number: payment.reference_number || undefined,
        notes: payment.notes || undefined,
        payment_intent_id: rawPaymentIntentId || undefined, // Generic payment intent ID
        created_at: payment.created_at || new Date().toISOString(),
        updated_at: payment.updated_at || new Date().toISOString(),
        taxes: taxes_db,
        total_tax_amount: taxes_db.reduce((sum: Money, tax) => addMoney(sum, moneyFromRow('payment_taxes', 'tax_amount', tax as unknown as Record<string, unknown>)), ZERO_MONEY),
      };
    }),
    status_history: invoice.invoice_status_history || [],
  } as InvoiceWithDetails;
}

/**
 * Get invoice by invoice number with all related data
 */
export async function getInvoiceByNumber(
  invoiceNumber: string,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceWithDetails> {
  invariant(invoiceNumber, "Missing invoiceNumber parameter");
  
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log(`[Service/getInvoiceByNumber] Fetching invoice details for number: ${invoiceNumber}`);

  const { data: invoice, error: invoiceError } = await client
    .from('invoices')
    .select(`
      *,
      invoice_entities(*),
      families(id, name),
      invoice_line_items(*),
      invoice_payments(*),
      invoice_status_history(*)
    `)
    .eq('invoice_number', invoiceNumber)
    .single();

  if (invoiceError) {
    console.error(`[Service/getInvoiceByNumber] Error fetching invoice ${invoiceNumber}:`, invoiceError);
    throw new Response(`Database error: ${invoiceError.message}`, { status: 500 });
  }

  if (!invoice) {
    throw new Response("Invoice not found", { status: 404 });
  }

  // Use the existing getInvoiceById function to get the complete data
  return getInvoiceById(invoice.id, client);
}

/**
 * Get invoices with filtering and pagination
 */
export async function getInvoices(
  filters: InvoiceFilters = {},
  page: number = 1,
  limit: number = 20,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<{ invoices: InvoiceWithDetails[]; total: number; totalPages: number }> {
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log('[Service/getInvoices] Fetching invoices with filters:', filters);

  let query = client
    .from('invoices')
    .select(`
      *,
      invoice_entities(*),
      families(id, name),
      invoice_line_items(*),
      invoice_payments(*)
    `, { count: 'exact' });

  // Apply filters
  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }
  
  if (filters.entity_id) {
    query = query.eq('entity_id', filters.entity_id);
  }
  
  if (filters.family_id) {
    query = query.eq('family_id', filters.family_id);
  }
  
  if (filters.date_from) {
    query = query.gte('issue_date', filters.date_from);
  }
  
  if (filters.date_to) {
    query = query.lte('issue_date', filters.date_to);
  }
  
  if (filters.amount_min !== undefined) {
    // Use new *_cents field for filtering amounts
    query = query.gte('total_amount_cents', filters.amount_min);
  }
  
  if (filters.amount_max !== undefined) {
    query = query.lte('total_amount_cents', filters.amount_max);
  }
  
  if (filters.search) {
    query = query.or(`invoices.invoice_number.ilike.%${filters.search}%,invoices.notes.ilike.%${filters.search}%`);
  }

  // Apply pagination
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);
  
  // Order by creation date (newest first)
  query = query.order('created_at', { ascending: false });

  const { data: invoices, error, count } = await query;

  if (error) {
    console.error('[Service/getInvoices] Error fetching invoices:', error);
    throw new Response(`Error fetching invoices: ${error.message}`, { status: 500 });
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  // Convert monetary fields to Money objects
  const convertedInvoicesUnknown = convertRowsToMoney('invoices', invoices || []) ?? [];

  const invoicesWithDetails: InvoiceWithDetails[] = convertedInvoicesUnknown.map((inv) => {
    const invoice = inv as Record<string, unknown> & {
      invoice_entities: Database['public']['Tables']['invoice_entities']['Row'] & Record<string, unknown>;
      invoice_line_items?: Database['public']['Tables']['invoice_line_items']['Row'][];
      invoice_payments?: Database['public']['Tables']['invoice_payments']['Row'][];
      families?: Database['public']['Tables']['families']['Row'];
    };
    return {
      ...(invoice as object),
      status: (invoice.status as InvoiceStatus) || 'draft',
      service_period_start: (invoice.service_period_start as string | null) || undefined,
      service_period_end: (invoice.service_period_end as string | null) || undefined,
      currency: (invoice.currency as string | null) || siteConfig.localization.currency,
      notes: (invoice.notes as string | null) || undefined,
      terms: (invoice.terms as string | null) || undefined,
      footer_text: (invoice.footer_text as string | null) || undefined,
      sent_at: (invoice.sent_at as string | null) || undefined,
      viewed_at: (invoice.viewed_at as string | null) || undefined,
      paid_at: (invoice.paid_at as string | null) || undefined,
      created_at: (invoice.created_at as string | null) || new Date().toISOString(),
      updated_at: (invoice.updated_at as string | null) || new Date().toISOString(),
      entity: {
        ...(invoice.invoice_entities as object),
        entity_type: invoice.invoice_entities.entity_type as EntityType,
        contact_person: invoice.invoice_entities.contact_person || undefined,
        email: invoice.invoice_entities.email || undefined,
        phone: invoice.invoice_entities.phone || undefined,
        address_line1: invoice.invoice_entities.address_line1 || undefined,
        address_line2: invoice.invoice_entities.address_line2 || undefined,
        city: invoice.invoice_entities.city || undefined,
        state: invoice.invoice_entities.state || undefined,
        postal_code: invoice.invoice_entities.postal_code || undefined,
        country: invoice.invoice_entities.country || siteConfig.localization.country,
        tax_id: invoice.invoice_entities.tax_id || undefined,
        payment_terms: (invoice.invoice_entities.payment_terms as PaymentTerms) || 'Net 30',
        credit_limit: (invoice.invoice_entities as unknown as { credit_limit?: unknown }).credit_limit || undefined,
        is_active: (invoice.invoice_entities as unknown as { is_active?: boolean }).is_active ?? true,
        notes: invoice.invoice_entities.notes || undefined,
        created_at: invoice.invoice_entities.created_at || new Date().toISOString(),
        updated_at: invoice.invoice_entities.updated_at || new Date().toISOString(),
      },
      family: invoice.families || undefined,
      family_id: (invoice.family_id as string | null) || undefined,
      line_items: (invoice.invoice_line_items || []).map((item) => {
        const convertedItem = convertRowToMoney('invoice_line_items', item) as Record<string, unknown>;
        return {
          ...(convertedItem as object),
          tax_rate: ((item.tax_rate ?? 0) as number) * 100,
          tax_amount: (item.tax_amount as unknown) ?? ZERO_MONEY,
          discount_rate: ((item.discount_rate ?? 0) as number) * 100,
          discount_amount: (item.discount_amount as unknown) ?? ZERO_MONEY,
          sort_order: (item.sort_order ?? 0) as number,
          enrollment_id: item.enrollment_id || undefined,
          product_id: item.product_id || undefined,
          service_period_start: item.service_period_start || undefined,
          service_period_end: item.service_period_end || undefined,
          created_at: item.created_at || new Date().toISOString(),
        };
      }),
      payments: (invoice.invoice_payments || []).map((payment) => {
        const rawPaymentIntentId = 'payment_intent_id' in payment
          ? (payment as { payment_intent_id: string | null }).payment_intent_id
          : (payment as { stripe_payment_intent_id?: string | null }).stripe_payment_intent_id ?? null;
        return {
          ...payment,
          reference_number: payment.reference_number || undefined,
          notes: payment.notes || undefined,
          payment_intent_id: rawPaymentIntentId || undefined, // Generic payment intent ID
          created_at: payment.created_at || new Date().toISOString(),
          updated_at: payment.updated_at || new Date().toISOString(),
        };
      }),
      status_history: [],
    } as unknown as InvoiceWithDetails;
  });

  return {
    invoices: invoicesWithDetails,
    total,
    totalPages,
  };
}

/**
 * Update invoice with new data and line items
 */
export async function updateInvoice(
  invoiceId: string,
  invoiceData: Partial<CreateInvoiceData>,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceWithDetails> {
  invariant(invoiceId, "Missing invoiceId parameter");
  
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log(`[Service/updateInvoice] Updating invoice ${invoiceId} with data:`, invoiceData);

  // First, check if the invoice exists and is editable (only draft invoices can be fully edited)
  const { data: existingInvoice, error: fetchError } = await client
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .single();

  if (fetchError) {
    console.error(`[Service/updateInvoice] Error fetching invoice:`, fetchError);
    throw new Response(`Error fetching invoice: ${fetchError.message}`, { status: 500 });
  }

  if (!existingInvoice) {
    throw new Response("Invoice not found", { status: 404 });
  }

  if (existingInvoice.status !== 'draft') {
    throw new Response("Only draft invoices can be edited", { status: 400 });
  }

  // Update the invoice
  const updateData: Partial<Database['public']['Tables']['invoices']['Update']> = {};
  if (invoiceData.entity_id) updateData.entity_id = invoiceData.entity_id;
  if (invoiceData.family_id) updateData.family_id = invoiceData.family_id;
  if (invoiceData.issue_date) updateData.issue_date = invoiceData.issue_date;
  if (invoiceData.due_date) updateData.due_date = invoiceData.due_date;
  if (invoiceData.service_period_start !== undefined) updateData.service_period_start = invoiceData.service_period_start;
  if (invoiceData.service_period_end !== undefined) updateData.service_period_end = invoiceData.service_period_end;
  if (invoiceData.notes !== undefined) updateData.notes = invoiceData.notes;
  if (invoiceData.terms !== undefined) updateData.terms = invoiceData.terms;
  if (invoiceData.footer_text !== undefined) updateData.footer_text = invoiceData.footer_text;

  const { error: updateError } = await client
    .from('invoices')
    .update(updateData)
    .eq('id', invoiceId);

  if (updateError) {
    console.error(`[Service/updateInvoice] Error updating invoice:`, updateError);
    throw new Response(`Error updating invoice: ${updateError.message}`, { status: 500 });
  }

  // Update line items if provided
  if (invoiceData.line_items) {
    // Delete existing line items and their tax associations
    const { error: deleteError } = await client
      .from('invoice_line_items')
      .delete()
      .eq('invoice_id', invoiceId);

    if (deleteError) {
      console.error(`[Service/updateInvoice] Error deleting existing line items:`, deleteError);
      throw new Response(`Error updating line items: ${deleteError.message}`, { status: 500 });
    }

    // Pre-fetch applicable tax rates for all item types to avoid multiple DB calls
    const uniqueItemTypes = [...new Set(invoiceData.line_items.map(item => item.item_type))];
    const taxRatesByItemType: Record<string, TaxRate[]> = {};
    
    for (const itemType of uniqueItemTypes) {
      taxRatesByItemType[itemType] = await getApplicableTaxRates(itemType, client);
    }

    // Create new line items with calculated totals using pre-fetched tax rates
    const lineItemsWithTotals = invoiceData.line_items.map((item, index) => {
      // Use pre-fetched applicable tax rates based on item type
      const applicableTaxRates = taxRatesByItemType[item.item_type];
      
      const calculations = calculateLineItemTotalsWithRates(
        item.quantity,
        item.unit_price,
        item.tax_rate_ids || [],
        applicableTaxRates,
        item.discount_rate || 0
      );

      return {
        invoice_id: invoiceId,
        item_type: item.item_type,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: calculations.line_total,
        tax_amount: calculations.tax_amount ?? ZERO_MONEY,
        discount_rate: (item.discount_rate || 0) / 100, // Convert percentage to decimal for database
        discount_amount: calculations.discount_amount ?? ZERO_MONEY,
        enrollment_id: item.enrollment_id,
        product_id: item.product_id,
        service_period_start: item.service_period_start,
        service_period_end: item.service_period_end,
        sort_order: item.sort_order || index,
      };
    });

    // Convert Money objects to cents for database storage
    type LineItemInsert = Database['public']['Tables']['invoice_line_items']['Insert'];
    const lineItemsForDb: LineItemInsert[] = lineItemsWithTotals.map((item: Record<string, unknown>) => {
      const converted = convertMoneyToRow('invoice_line_items', item as Record<string, unknown>);
      return (converted as unknown) as LineItemInsert;
    });

    const { data: insertedLineItems, error: lineItemsError } = await client
      .from('invoice_line_items')
      .insert(lineItemsForDb)
      .select('id');

    if (lineItemsError) {
      console.error(`[Service/updateInvoice] Error creating new line items:`, lineItemsError);
      throw new Response(`Error updating line items: ${lineItemsError.message}`, { status: 500 });
    }

    // Create tax associations for each line item
    if (insertedLineItems) {
      for (let i = 0; i < insertedLineItems.length; i++) {
        const lineItem = insertedLineItems[i];
        const originalItem = invoiceData.line_items[i];
        
        if (originalItem.tax_rate_ids && originalItem.tax_rate_ids.length > 0) {
          const applicableTaxRates = taxRatesByItemType[originalItem.item_type];
          await createLineItemTaxAssociations(
            lineItem.id,
            originalItem.tax_rate_ids,
            originalItem,
            applicableTaxRates,
            client
          );
        }
      }
    }

    // Denormalize totals after replacement
    try {
      const subtotalCents = lineItemsForDb.reduce((sum, li) => sum + (getNum(li, 'line_total_cents') ?? 0), 0);
      const discountCents = lineItemsForDb.reduce((sum, li) => sum + (getNum(li, 'discount_amount_cents') ?? 0), 0);
      const itemTaxCents = lineItemsForDb.reduce((sum, li) => sum + (getNum(li, 'tax_amount_cents') ?? 0), 0);
      const totalCents = subtotalCents - discountCents + itemTaxCents;
      await client
        .from('invoices')
        .update({
          subtotal_cents: subtotalCents,
          subtotal: subtotalCents / 100,
          discount_amount_cents: discountCents,
          discount_amount: discountCents / 100,
          tax_amount_cents: itemTaxCents,
          tax_amount: itemTaxCents / 100,
          total_amount_cents: totalCents,
          total_amount: totalCents / 100,
        })
        .eq('id', invoiceId);
    } catch (e) {
      console.warn('[Service/updateInvoice] Failed to denormalize invoice totals:', e);
    }
  }

  // Fetch and return the updated invoice with details
  return getInvoiceById(invoiceId, client);
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: Invoice['status'],
  notes?: string,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<Invoice> {
  invariant(invoiceId, "Missing invoiceId parameter");
  invariant(status, "Missing status parameter");
  
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log(`[Service/updateInvoiceStatus] Updating invoice ${invoiceId} status to ${status}`);

  const { data: invoice, error } = await client
    .from('invoices')
    .update({ status })
    .eq('id', invoiceId)
    .select()
    .single();

  if (error) {
    console.error(`[Service/updateInvoiceStatus] Error updating invoice status:`, error);
    throw new Response(`Error updating invoice status: ${error.message}`, { status: 500 });
  }

  if (!invoice) {
    throw new Response("Invoice not found", { status: 404 });
  }

  // Add status history entry if notes provided
  if (notes) {
    await client
      .from('invoice_status_history')
      .insert({
        invoice_id: invoiceId,
        new_status: status,
        notes,
      });
  }

  return convertRowToMoney('invoices', invoice) as unknown as Invoice;
}

/**
 * Delete invoice (soft delete by setting status to cancelled)
 */
export async function deleteInvoice(
  invoiceId: string,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<void> {
  invariant(invoiceId, "Missing invoiceId parameter");
  
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log(`[Service/deleteInvoice] Deleting invoice ${invoiceId}`);

  // Check if invoice has payments
  const { data: payments } = await client
    .from('invoice_payments')
    .select('id')
    .eq('invoice_id', invoiceId)
    .limit(1);

  if (payments && payments.length > 0) {
    throw new Response("Cannot delete invoice with payments. Cancel instead.", { status: 400 });
  }

  // For draft invoices, we can actually delete them
  const { data: invoice } = await client
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .single();

  if (invoice?.status === 'draft') {
    const { error } = await client
      .from('invoices')
      .delete()
      .eq('id', invoiceId);

    if (error) {
      console.error(`[Service/deleteInvoice] Error deleting invoice:`, error);
      throw new Response(`Error deleting invoice: ${error.message}`, { status: 500 });
    }
  } else {
    // For non-draft invoices, cancel them instead
    await updateInvoiceStatus(invoiceId, 'cancelled', 'Invoice cancelled via deletion', client);
  }
}

/**
 * Get invoice statistics
 */
export async function getInvoiceStats(
  supabaseAdmin?: SupabaseClient<Database>
): Promise<{
  total_invoices: number;
  total_amount: Money;
  paid_amount: Money;
  outstanding_amount: Money;
  overdue_count: number;
}> {
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log('[Service/getInvoiceStats] Fetching invoice statistics');

  const { data : invoices_db, error } = await client
    .from('invoices')
    .select('status, total_amount_cents, amount_paid_cents, due_date')
    .neq('status', 'cancelled');

  if (error) {
    console.error('[Service/getInvoiceStats] Error fetching invoice stats:', error);
    throw new Response(`Error fetching invoice statistics: ${error.message}`, { status: 500 });
  }

  const stats = {
    total_invoices: invoices_db?.length || 0,
    total_amount: ZERO_MONEY,
    paid_amount: ZERO_MONEY,
    outstanding_amount: ZERO_MONEY,
    overdue_count: 0,
  };

  const today = new Date().toISOString().split('T')[0];

    invoices_db?.forEach((invoice_db) => {
    const inv = invoice_db as unknown as { total_amount_cents?: number; total_amount?: number; amount_paid_cents?: number; amount_paid?: number; status: string; due_date: string };
    const totalAmount = moneyFromRow('invoices', 'total_amount', inv as unknown as Record<string, unknown>);
    const paidAmount = moneyFromRow('invoices', 'amount_paid', inv as unknown as Record<string, unknown>);
    
    stats.total_amount = addMoney(stats.total_amount, totalAmount);
    stats.paid_amount = addMoney(stats.paid_amount, paidAmount);
    stats.outstanding_amount = addMoney(stats.outstanding_amount, subtractMoney(totalAmount, paidAmount));
    
    if (inv.status !== 'paid' && inv.due_date < today) {
      stats.overdue_count++;
    }
  });

  return stats;
}
