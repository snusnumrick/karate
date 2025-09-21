import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData } from "@remix-run/react";
import { csrf } from "~/utils/csrf.server";
import { InvoiceForm } from "~/components/InvoiceForm";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { getInvoiceEntities } from "~/services/invoice-entity.server";
import { getInvoiceById, getInvoiceByNumber, updateInvoice } from "~/services/invoice.server";
import { getApplicableTaxRates } from "~/services/tax-rates.server";
import { requireUserId } from "~/utils/auth.server";
import type { CreateInvoiceData, CreateInvoiceLineItemData, TaxRate } from "~/types/invoice";
import { isNegative, toCents, fromCents } from "~/utils/money";

interface ActionData {
  errors?: {
    entity_id?: string;
    issue_date?: string;
    due_date?: string;
    line_items?: string;
    general?: string;
  };
  values?: {
    entity_id?: string;
    issue_date?: string;
    due_date?: string;
  };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserId(request);
  
  const { id } = params;
  if (!id) {
    throw new Response("Invoice ID is required", { status: 400 });
  }
  
  try {
    // Check if the id looks like an invoice number (INV-YYYY-NNNN format)
    const isInvoiceNumber = /^INV-\d{4}-\d{4}$/.test(id);
    
    // Get the invoice, entities, and tax rates by item type
    const [invoice, entitiesResult, classEnrollmentTaxRates, individualSessionTaxRates, productTaxRates, feeTaxRates, otherTaxRates] = await Promise.all([
      isInvoiceNumber ? getInvoiceByNumber(id) : getInvoiceById(id),
      getInvoiceEntities(),
      getApplicableTaxRates('class_enrollment'),
      getApplicableTaxRates('individual_session'),
      getApplicableTaxRates('product'),
      getApplicableTaxRates('fee'),
      getApplicableTaxRates('other')
    ]);

    const taxRatesByItemType = {
      class_enrollment: classEnrollmentTaxRates,
      individual_session: individualSessionTaxRates,
      product: productTaxRates,
      fee: feeTaxRates,
      other: otherTaxRates
    };

    // Ensure any tax rates already applied to this invoice are available in the editor,
    // even if current business rules would filter them out (e.g., PST on enrollments).
    // Build a map of referenced tax rates using snapshots from the invoice line item taxes.
    const referencedRatesMap = new Map<string, TaxRate>();
    invoice.line_items.forEach((item) => {
      (item.taxes || []).forEach((t) => {
        if (!referencedRatesMap.has(t.tax_rate_id)) {
          referencedRatesMap.set(t.tax_rate_id, {
            id: t.tax_rate_id,
            name: t.tax_name_snapshot,
            rate: t.tax_rate_snapshot,
            description: t.tax_description_snapshot || undefined,
            region: undefined,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      });
    });

    const referencedRates = Array.from(referencedRatesMap.values());
    // Merge referenced rates into all item type buckets so the UI can always display them
    const mergeRates = (arr: TaxRate[]) => {
      const existing = new Map(arr.map(r => [r.id, r] as const));
      referencedRates.forEach(r => {
        if (!existing.has(r.id)) arr.push(r);
      });
    };
    mergeRates(taxRatesByItemType.class_enrollment);
    mergeRates(taxRatesByItemType.individual_session);
    mergeRates(taxRatesByItemType.product);
    mergeRates(taxRatesByItemType.fee);
    mergeRates(taxRatesByItemType.other);
    
    // Check if invoice can be edited (only drafts)
    if (invoice.status !== 'draft') {
      throw new Response("Only draft invoices can be edited", { status: 400 });
    }
    
    const entities = entitiesResult?.entities || [];
    
    // Convert invoice data to form format
    const initialData: Partial<CreateInvoiceData> = {
      entity_id: invoice.entity_id,
      family_id: invoice.family_id,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      service_period_start: invoice.service_period_start,
      service_period_end: invoice.service_period_end,
      notes: invoice.notes,
      terms: invoice.terms,
      footer_text: invoice.footer_text,
      line_items: invoice.line_items.map(item => ({
        item_type: item.item_type,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        tax_rate_ids: item.tax_rate_ids,
        discount_rate: item.discount_rate,
        enrollment_id: item.enrollment_id,
        product_id: item.product_id,
        service_period_start: item.service_period_start,
        service_period_end: item.service_period_end,
        sort_order: item.sort_order,
      }))
    };
    
    // Find the selected entity
    const selectedEntity = entities.find(e => e.id === invoice.entity_id);
    
    // Serialize Money types for entities
    const serializedEntities = entities.map(entity => ({
      ...entity,
      credit_limit: entity.credit_limit ? toCents(entity.credit_limit) : null
    }));
    
    const serializedSelectedEntity = selectedEntity ? {
      ...selectedEntity,
      credit_limit: selectedEntity.credit_limit ? toCents(selectedEntity.credit_limit) : null
    } : null;
    
    return json({ 
      invoice, 
      entities: serializedEntities, 
      initialData, 
      selectedEntity: serializedSelectedEntity,
      taxRatesByItemType
    });
  } catch (error) {
    console.error("Error loading invoice for edit:", error);
    if (error instanceof Response) {
      throw error;
    }
    throw new Response("Error loading invoice", { status: 500 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserId(request);
  
  const { id } = params;
  if (!id) {
    throw new Response("Invoice ID is required", { status: 400 });
  }
  
  try {
    await csrf.validate(request);
  } catch (error) {
    console.error('CSRF validation failed:', error);
    return json({ errors: { general: 'Security validation failed. Please try again.' } }, { status: 403 });
  }
  
  const formData = await request.formData();
  const action = formData.get("action") as string;
  
  try {
    // Parse form data
    const entity_id = formData.get("entity_id") as string;
    const issue_date = formData.get("issue_date") as string;
    const due_date = formData.get("due_date") as string;
    const line_items_json = formData.get("line_items") as string;
    
    // Validation
    const errors: ActionData["errors"] = {};
    const values: ActionData["values"] = {
      entity_id: entity_id || '',
      issue_date: issue_date || '',
      due_date: due_date || ''
    };

    // For save_draft, we have more relaxed validation
    const isDraft = action === "save_draft";

    if (!entity_id && !isDraft) {
      errors.entity_id = "Please select a billing entity";
    }

    if (!issue_date && !isDraft) {
      errors.issue_date = "Issue date is required";
    }

    if (!due_date && !isDraft) {
      errors.due_date = "Due date is required";
    }

    // Validate that the entity has an email
    if (entity_id) {
      try {
        const entitiesResult = await getInvoiceEntities();
        const selectedEntity = entitiesResult?.entities?.find(e => e.id === entity_id);
        if (!selectedEntity?.email) {
          errors.entity_id = "Selected entity must have an email address";
        }
      } catch (error) {
        console.error("Error validating entity email:", error);
        errors.entity_id = "Error validating entity information";
      }
    }

    let line_items: CreateInvoiceLineItemData[] = [];
    try {
      line_items = JSON.parse(line_items_json);
      if (!isDraft) {
        if (!line_items || line_items.length === 0) {
          errors.line_items = "At least one line item is required";
        } else {
          // Validate line items for non-draft invoices
          for (const item of line_items) {
            if (!item.description?.trim()) {
              errors.line_items = "All line items must have a description";
              break;
            }
            if (item.quantity <= 0) {
              errors.line_items = "All line items must have a positive quantity";
              break;
            }
            if (isNegative(item.unit_price)) {
              errors.line_items = "Line item prices cannot be negative";
              break;
            }
          }
        }
      } else {
        // For drafts, just validate that line items with data are valid
        for (const item of line_items) {
          if (item.description?.trim() && item.quantity <= 0) {
            errors.line_items = "Line items with descriptions must have a positive quantity";
            break;
          }
          if (item.description?.trim() && isNegative(item.unit_price)) {
            errors.line_items = "Line item prices cannot be negative";
            break;
          }
        }
      }
    } catch {
      errors.line_items = "Invalid line items data";
    }

    if (Object.keys(errors).length > 0) {
      return json<ActionData>({ errors, values }, { status: 400 });
    }

    const invoiceData: Partial<CreateInvoiceData> = {
      entity_id: entity_id || undefined,
      family_id: formData.get("family_id") as string || undefined,
      issue_date: issue_date || undefined,
      due_date: due_date || undefined,
      service_period_start: formData.get("service_period_start") as string || undefined,
      service_period_end: formData.get("service_period_end") as string || undefined,
      terms: formData.get("terms") as string || undefined,
      notes: formData.get("notes") as string || undefined,
      footer_text: formData.get("footer_text") as string || undefined,
      line_items: line_items.length > 0 ? line_items : undefined
    };

    // Update the invoice
    await updateInvoice(id, invoiceData);

    // Redirect to the invoice detail page
    return redirect(`/admin/invoices/${id}`);
    
  } catch (error) {
    console.error("Error updating invoice:", error);
    
    if (error instanceof Response) {
      // Re-throw Response errors (like 400 for non-draft invoices)
      throw error;
    }
    
    return json<ActionData>({
      errors: { general: "Failed to update invoice. Please try again." },
      values: {
        entity_id: formData.get("entity_id") as string || '',
        issue_date: formData.get("issue_date") as string || '',
        due_date: formData.get("due_date") as string || ''
      }
    }, { status: 500 });
  }
}

export default function EditInvoicePage() {
  const { invoice, entities: rawEntities, initialData, selectedEntity: rawSelectedEntity, taxRatesByItemType } = useLoaderData<typeof loader>();
  
  // Deserialize Money types for entities
  const entities = rawEntities.map(entity => ({
    ...entity,
    credit_limit: entity.credit_limit ? fromCents(entity.credit_limit) : undefined
  }));
  
  const selectedEntity = rawSelectedEntity ? {
    ...rawSelectedEntity,
    credit_limit: rawSelectedEntity.credit_limit ? fromCents(rawSelectedEntity.credit_limit) : undefined
  } : null;
  const actionData = useActionData<ActionData>();

  return (
    <div className="min-h-screen page-background-styles">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <AppBreadcrumb 
          items={breadcrumbPatterns.adminInvoiceEdit(invoice.id, invoice.invoice_number)} 
          className="mb-6" 
        />

        {actionData?.errors?.general && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  {actionData.errors.general}
                </h3>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Form */}
        <InvoiceForm 
          entities={entities}
          initialData={initialData as Partial<CreateInvoiceData>}
          mode="edit"
          preSelectedEntity={selectedEntity}
          errors={actionData?.errors}
          values={actionData?.values}
          taxRatesByItemType={taxRatesByItemType}
        />
      </div>
    </div>
  );
}
