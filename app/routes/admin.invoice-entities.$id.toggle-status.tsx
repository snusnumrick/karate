import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { deactivateInvoiceEntity, reactivateInvoiceEntity } from "~/services/invoice-entity.server";

export async function action({ params, request }: ActionFunctionArgs) {
  const entityId = params.id;
  
  if (!entityId) {
    return json({ error: "Entity ID is required" }, { status: 400 });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const isActive = formData.get("is_active") === "true";

    let updatedEntity;
    if (isActive) {
      updatedEntity = await reactivateInvoiceEntity(entityId);
    } else {
      updatedEntity = await deactivateInvoiceEntity(entityId);
    }

    return json({ 
      success: true, 
      entity: updatedEntity,
      message: `Entity ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error("Error toggling entity status:", error);
    
    if (error instanceof Response) {
      const errorText = await error.text();
      return json({ error: errorText }, { status: error.status });
    }
    
    return json({ error: "Failed to update entity status" }, { status: 500 });
  }
}