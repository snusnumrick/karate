import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { InvoiceForm } from "~/components/InvoiceForm";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { getInvoiceEntities } from "~/services/invoice-entity.server";
import { createInvoice } from "~/services/invoice.server";
import { requireUserId } from "~/utils/auth.server";
import type { CreateInvoiceData, CreateInvoiceLineItemData } from "~/types/invoice";

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
    const invoiceData: CreateInvoiceData = {
      entity_id: formData.get("entity_id") as string,
      issue_date: formData.get("issue_date") as string,
      due_date: formData.get("due_date") as string,
      service_period_start: formData.get("service_period_start") as string || undefined,
      service_period_end: formData.get("service_period_end") as string || undefined,
      terms: formData.get("terms") as string || undefined,
      notes: formData.get("notes") as string || undefined,
      footer_text: formData.get("footer_text") as string || undefined,
      line_items: JSON.parse(formData.get("line_items") as string) as CreateInvoiceLineItemData[]
    };

    // Validate required fields
    if (!invoiceData.entity_id) {
      return json({ error: "Please select a billing entity" }, { status: 400 });
    }

    if (!invoiceData.issue_date || !invoiceData.due_date) {
      return json({ error: "Issue date and due date are required" }, { status: 400 });
    }

    if (!invoiceData.line_items || invoiceData.line_items.length === 0) {
      return json({ error: "At least one line item is required" }, { status: 400 });
    }

    // Validate line items
    for (const item of invoiceData.line_items) {
      if (!item.description?.trim()) {
        return json({ error: "All line items must have a description" }, { status: 400 });
      }
      if (item.quantity <= 0) {
        return json({ error: "All line items must have a positive quantity" }, { status: 400 });
      }
      if (item.unit_price < 0) {
        return json({ error: "Line item prices cannot be negative" }, { status: 400 });
      }
    }

    // Create the invoice (status is managed by the database)
    const invoice = await createInvoice(invoiceData);

    // Redirect to the invoice detail page
    return redirect(`/admin/invoices/${invoice.id}`);
    
  } catch (error) {
    console.error("Error creating invoice:", error);
    return json(
      { error: "Failed to create invoice. Please try again." },
      { status: 500 }
    );
  }
}

export default function NewInvoicePage() {
  const { entities, preSelectedEntity } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-gray-800">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <AppBreadcrumb items={breadcrumbPatterns.adminInvoiceNew()}  className="mb-6" />

        {/* Invoice Form */}
        <InvoiceForm 
          entities={entities} 
          initialData={preSelectedEntity ? { entity_id: preSelectedEntity.id } : undefined}
          preSelectedEntity={preSelectedEntity}
        />
      </div>
    </div>
  );
}