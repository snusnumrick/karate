import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData } from "@remix-run/react";
import { InvoiceForm } from "~/components/InvoiceForm";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { getInvoiceEntities } from "~/services/invoice-entity.server";
import { createInvoice } from "~/services/invoice.server";
import { requireUserId } from "~/utils/auth.server";
import type { CreateInvoiceData, CreateInvoiceLineItemData } from "~/types/invoice";

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

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  
  // Get entity_id from URL parameters if provided
  const url = new URL(request.url);
  const entityId = url.searchParams.get("entity_id");
  
  try {
    const result = await getInvoiceEntities();
    const entities = result?.entities || [];
    
    // Find the pre-selected entity if entity_id is provided
    const preSelectedEntity = entityId ? entities.find(e => e.id === entityId) : null;
    
    return json({ entities, preSelectedEntityId: entityId, preSelectedEntity });
  } catch (error) {
    console.error("Error loading invoice entities:", error);
    return json({ entities: [], preSelectedEntityId: null, preSelectedEntity: null });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  
  const formData = await request.formData();
  
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

    if (!entity_id) {
      errors.entity_id = "Please select a billing entity";
    }

    if (!issue_date) {
      errors.issue_date = "Issue date is required";
    }

    if (!due_date) {
      errors.due_date = "Due date is required";
    }

    let line_items: CreateInvoiceLineItemData[] = [];
    try {
      line_items = JSON.parse(line_items_json);
      if (!line_items || line_items.length === 0) {
        errors.line_items = "At least one line item is required";
      } else {
        // Validate line items
        for (const item of line_items) {
          if (!item.description?.trim()) {
            errors.line_items = "All line items must have a description";
            break;
          }
          if (item.quantity <= 0) {
            errors.line_items = "All line items must have a positive quantity";
            break;
          }
          if (item.unit_price < 0) {
            errors.line_items = "Line item prices cannot be negative";
            break;
          }
        }
      }
    } catch (parseError) {
      errors.line_items = "Invalid line items data";
    }

    if (Object.keys(errors).length > 0) {
      return json<ActionData>({ errors, values }, { status: 400 });
    }

    const invoiceData: CreateInvoiceData = {
      entity_id,
      issue_date,
      due_date,
      service_period_start: formData.get("service_period_start") as string || undefined,
      service_period_end: formData.get("service_period_end") as string || undefined,
      terms: formData.get("terms") as string || undefined,
      notes: formData.get("notes") as string || undefined,
      footer_text: formData.get("footer_text") as string || undefined,
      line_items
    };

    // Create the invoice (status is managed by the database)
    const invoice = await createInvoice(invoiceData);

    // Redirect to the invoice detail page
    return redirect(`/admin/invoices/${invoice.id}`);
    
  } catch (error) {
    console.error("Error creating invoice:", error);
    return json<ActionData>({
      errors: { general: "Failed to create invoice. Please try again." },
      values: {
        entity_id: formData.get("entity_id") as string || '',
        issue_date: formData.get("issue_date") as string || '',
        due_date: formData.get("due_date") as string || ''
      }
    }, { status: 500 });
  }
}

export default function NewInvoicePage() {
  const { entities, preSelectedEntity } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-gray-800">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <AppBreadcrumb items={breadcrumbPatterns.adminInvoiceNew()}  className="mb-6" />

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
          initialData={preSelectedEntity ? { entity_id: preSelectedEntity.id } : undefined}
          preSelectedEntity={preSelectedEntity}
          errors={actionData?.errors}
          values={actionData?.values}
        />
      </div>
    </div>
  );
}