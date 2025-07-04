import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { requireAdminUser } from "~/utils/auth.server";
import { DiscountTemplateService } from "~/services/discount-template.server";
import type { CreateDiscountTemplateData, UpdateDiscountTemplateData } from "~/types/discount";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminUser(request);
  
  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("active") === "true";
  
  try {
    const templates = activeOnly 
      ? await DiscountTemplateService.getActiveTemplates()
      : await DiscountTemplateService.getAllTemplates();
    
    return json({ templates });
  } catch (error) {
    console.error("Error fetching discount templates:", error);
    return json(
      { error: "Failed to fetch discount templates" },
      { status: 500 }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const adminUser = await requireAdminUser(request);
  
  const method = request.method;
  
  switch (method) {
    case "POST": {
      try {
        const templateData: CreateDiscountTemplateData = await request.json();
        
        // Add created_by field
        const templateWithCreator = {
          ...templateData,
          created_by: adminUser.id,
        };
        
        const template = await DiscountTemplateService.createTemplate(templateWithCreator);
        return json({ template }, { status: 201 });
      } catch (error) {
        console.error("Error creating discount template:", error);
        return json(
          { error: "Failed to create discount template" },
          { status: 500 }
        );
      }
    }
    
    case "PUT": {
      try {
        const { id, ...updateData }: { id: string } & UpdateDiscountTemplateData = await request.json();
        
        if (!id) {
          return json(
            { error: "Template ID is required" },
            { status: 400 }
          );
        }
        
        const template = await DiscountTemplateService.updateTemplate(id, updateData);
        return json({ template });
      } catch (error) {
        console.error("Error updating discount template:", error);
        return json(
          { error: "Failed to update discount template" },
          { status: 500 }
        );
      }
    }
    
    case "DELETE": {
      try {
        const { id }: { id: string } = await request.json();
        
        if (!id) {
          return json(
            { error: "Template ID is required" },
            { status: 400 }
          );
        }
        
        await DiscountTemplateService.deleteTemplate(id);
        return json({ success: true });
      } catch (error) {
        console.error("Error deleting discount template:", error);
        return json(
          { error: "Failed to delete discount template" },
          { status: 500 }
        );
      }
    }
    
    default: {
      return json(
        { error: `Method ${method} not allowed` },
        { status: 405 }
      );
    }
  }
}