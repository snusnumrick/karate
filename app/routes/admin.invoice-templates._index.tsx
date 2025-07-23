import { Link, useLoaderData } from '@remix-run/react';
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { Edit, FileText, Plus, Users, DollarSign, Package } from 'lucide-react';
import { AppBreadcrumb, breadcrumbPatterns } from '~/components/AppBreadcrumb';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { formatCurrency } from '~/hooks/use-invoice-calculations';
import { calculateLineItemTotal } from '~/utils/line-item-helpers';
import { InvoiceTemplateService } from '~/services/invoice-template.server';
import { getSupabaseServerClient } from '~/utils/supabase.server';
import type { InvoiceTemplate } from '~/types/invoice';

export async function loader({ request }: LoaderFunctionArgs) {
    const { supabaseServer } = getSupabaseServerClient(request);
    const templateService = new InvoiceTemplateService(supabaseServer);
    
    try {
        const templates = await templateService.getAllTemplates();
        return json({
            templates
        });
    } catch (error) {
        console.error('Failed to load invoice templates:', error);
        return json({
            templates: []
        });
    }
}

export default function InvoiceTemplatesIndex() {
    const { templates } = useLoaderData<typeof loader>();

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'enrollment': return Users;
            case 'fees': return DollarSign;
            case 'products': return Package;
            case 'custom': return FileText;
            default: return FileText;
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'enrollment': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'fees': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'products': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
            case 'custom': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
        }
    };

    const calculateTemplateTotal = (template: InvoiceTemplate): number => {
        return template.lineItems.reduce((total, item) => total + calculateLineItemTotal(item), 0);
    };

    return (
        <div className="min-h-screen bg-amber-50 dark:bg-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <AppBreadcrumb items={breadcrumbPatterns.adminInvoiceTemplates()} className="mb-6" />
                
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Invoice Templates</h1>
                        <p className="text-gray-600 dark:text-gray-300 mt-2">
                            Manage reusable invoice templates for quick invoice creation
                        </p>
                    </div>
                    <Link to="/admin/invoice-templates/new">
                        <Button className="input-custom-styles" tabIndex={0}>
                            <Plus className="h-4 w-4 mr-2" />
                            New Template
                        </Button>
                    </Link>
                </div>

            {templates.length === 0 ? (
                <Card className="bg-white dark:bg-gray-900 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No templates found</h3>
                        <p className="text-muted-foreground text-center mb-4">
                            Create your first invoice template to streamline invoice creation
                        </p>
                        <Link to="/admin/invoice-templates/new">
                            <Button tabIndex={0}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create Template
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template: InvoiceTemplate) => {
                        const CategoryIcon = getCategoryIcon(template.category);
                        const templateTotal = calculateTemplateTotal(template);
                        
                        return (
                            <Card key={template.id} className="bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center space-x-2">
                                            <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                                            <CardTitle className="text-lg">{template.name}</CardTitle>
                                        </div>
                                        <Badge className={getCategoryColor(template.category)}>
                                            {template.category}
                                        </Badge>
                                    </div>
                                    {template.description && (
                                        <CardDescription>{template.description}</CardDescription>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Line Items:</span>
                                            <span>{template.lineItems.length}</span>
                                        </div>
                                        
                                        {templateTotal > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Template Total:</span>
                                                <span className="font-medium">{formatCurrency(templateTotal)}</span>
                                            </div>
                                        )}

                                        {template.lineItems.length > 0 && (
                                            <div className="text-sm">
                                                <span className="text-muted-foreground">Preview:</span>
                                                <ul className="mt-1 space-y-1">
                                                    {template.lineItems.slice(0, 2).map((item, index) => (
                                                        <li key={index} className="text-xs text-muted-foreground truncate">
                                                            • {item.description}
                                                        </li>
                                                    ))}
                                                    {template.lineItems.length > 2 && (
                                                        <li className="text-xs text-muted-foreground">
                                                            +{template.lineItems.length - 2} more items
                                                        </li>
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex gap-2 mt-4">
                                        <Link to={`/admin/invoice-templates/${template.id}/edit`} className="flex-1">
                                            <Button variant="outline" size="sm" className="w-full" tabIndex={0}>
                                                <Edit className="h-4 w-4 mr-2" />
                                                Edit
                                            </Button>
                                        </Link>
                                        <Link to={`/admin/invoices/new?template=${template.id}`} className="flex-1">
                                            <Button size="sm" className="w-full" tabIndex={0}>
                                                <FileText className="h-4 w-4 mr-2" />
                                                Use Template
                                            </Button>
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
            </div>
        </div>
    );
}