import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { requireAdminUser } from "~/utils/auth.server";
import { DiscountTemplateService } from "~/services/discount-template.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Plus, Edit, FileText } from "lucide-react";
import type { DiscountTemplate } from "~/types/discount";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminUser(request);
  const templates = await DiscountTemplateService.getAllTemplates();
  return json({ templates });
}

export default function DiscountTemplatesIndex() {
  const { templates } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Discount Templates</h1>
          <p className="text-muted-foreground">
            Manage reusable discount templates for quick discount creation
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/discount-templates/new">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Link>
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates found</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first discount template to streamline discount creation
            </p>
            <Button asChild>
              <Link to="/admin/discount-templates/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template: DiscountTemplate) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <Badge variant={template.is_active ? "default" : "secondary"}>
                    {template.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {template.description && (
                  <CardDescription>{template.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="capitalize">{template.discount_type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Value:</span>
                    <span>
                      {template.discount_type === 'percentage' 
                        ? `${template.discount_value}%` 
                        : `$${template.discount_value}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Usage:</span>
                    <span className="capitalize">{template.usage_type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Scope:</span>
                    <span className="capitalize">{template.scope.replace('_', ' ')}</span>
                  </div>
                  {template.max_uses && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Uses:</span>
                      <span>{template.max_uses}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link to={`/admin/discount-templates/${template.id}/edit`}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="flex-1">
                    <Link to={`/admin/discount-codes/new?template=${template.id}`}>
                      <Plus className="h-4 w-4 mr-1" />
                      Use Template
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}