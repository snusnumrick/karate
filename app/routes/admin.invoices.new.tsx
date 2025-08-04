import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData } from "@remix-run/react";
import { InvoiceForm } from "~/components/InvoiceForm";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { createInvoice, getInvoiceById, updateInvoiceStatus } from "~/services/invoice.server";
import { getInvoiceEntities } from "~/services/invoice-entity.server";
import { sendInvoiceEmail } from "~/services/invoice-email.server";
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
  const action = formData.get("action") as string;
  
  try {
    // Parse form data
    const entity_id = formData.get("entity_id") as string;
    const issue_date = formData.get("issue_date") as string;
    const due_date = formData.get("due_date") as string;
    const line_items_json = formData.get("line_items") as string;
    
    console.log("Action received:", action);
    console.log("Form data:", { entity_id, issue_date, due_date, line_items_json });
    
    // Validation
    const errors: ActionData["errors"] = {};
    const values: ActionData["values"] = {
      entity_id: entity_id || '',
      issue_date: issue_date || '',
      due_date: due_date || ''
    };

    // For save_draft, we have more relaxed validation
    const isSaveAndSend = action === "save_and_send";
    const requiresFullValidation = isSaveAndSend; // Only save_and_send requires full validation

    if (!entity_id && requiresFullValidation) {
      errors.entity_id = "Please select a billing entity";
    }

    if (!issue_date && requiresFullValidation) {
      errors.issue_date = "Issue date is required";
    }

    if (!due_date && requiresFullValidation) {
      errors.due_date = "Due date is required";
    }

    // For save_and_send, we also need to validate that the entity has an email
    if (isSaveAndSend && entity_id) {
      try {
        const entitiesResult = await getInvoiceEntities();
        const selectedEntity = entitiesResult?.entities?.find(e => e.id === entity_id);
        if (!selectedEntity?.email) {
          errors.entity_id = "Selected entity must have an email address to send invoice";
        }
      } catch (error) {
        console.error("Error validating entity email:", error);
        errors.entity_id = "Error validating entity information";
      }
    }

    let line_items: CreateInvoiceLineItemData[] = [];
    try {
      if (line_items_json) {
        line_items = JSON.parse(line_items_json);
      }
      
      if (requiresFullValidation) {
        if (!line_items || line_items.length === 0) {
          errors.line_items = "At least one line item is required";
        } else {
          // Validate line items for save_and_send
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
      } else {
        // For drafts, just validate that line items with data are valid
        for (const item of line_items) {
          if (item.description?.trim() && item.quantity <= 0) {
            errors.line_items = "Line items with descriptions must have a positive quantity";
            break;
          }
          if (item.description?.trim() && item.unit_price < 0) {
            errors.line_items = "Line item prices cannot be negative";
            break;
          }
        }
      }
    } catch (parseError) {
      console.error("Error parsing line items:", parseError);
      errors.line_items = "Invalid line items data";
    }

    if (Object.keys(errors).length > 0) {
      console.log("Validation errors:", errors);
      return json<ActionData>({ errors, values });
    }

    const invoiceData: CreateInvoiceData = {
      entity_id: entity_id || '',
      issue_date: issue_date || new Date().toISOString().split('T')[0],
      due_date: due_date || new Date().toISOString().split('T')[0],
      service_period_start: formData.get("service_period_start") as string || undefined,
      service_period_end: formData.get("service_period_end") as string || undefined,
      terms: formData.get("terms") as string || undefined,
      notes: formData.get("notes") as string || undefined,
      footer_text: formData.get("footer_text") as string || undefined,
      line_items: line_items.length > 0 ? line_items : [{ 
        item_type: 'fee', 
        description: '', 
        quantity: 1, 
        unit_price: 0, 
        tax_rate: 0, 
        sort_order: 0 
      }]
    };

    // Create the invoice (always starts as draft)
    const invoice = await createInvoice(invoiceData);

    // If save_and_send, attempt to send the email
    if (isSaveAndSend) {
      try {
        // Fetch the full invoice object with details for email sending
        const fullInvoice = await getInvoiceById(invoice.id);
        if (fullInvoice) {
          const emailSent = await sendInvoiceEmail(fullInvoice);
          if (emailSent) {
            // Update invoice status to sent if email was successful
            await updateInvoiceStatus(invoice.id, "sent");
            console.log("Invoice email sent successfully and status updated to 'sent' for invoice:", invoice.id);
          } else {
            console.error("Failed to send invoice email for invoice:", invoice.id);
            // Don't fail the entire operation if email fails
            // The invoice is created, user can send email manually from detail page
          }
        }
      } catch (emailError) {
        console.error("Error sending invoice email:", emailError);
        // Don't fail the entire operation if email fails
        // The invoice is created, user can send email manually from detail page
      }
    }

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
    <div className="min-h-screen page-background-styles">
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