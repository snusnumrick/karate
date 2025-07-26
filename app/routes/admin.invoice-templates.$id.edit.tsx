import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { AppBreadcrumb , breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { Plus, Trash2, Save } from "lucide-react";
import { useState, useEffect } from "react";
import type { CreateInvoiceLineItemData } from "~/types/invoice";
import { formatCurrency } from "~/utils/misc";
import { calculateLineItemTotal } from "~/utils/line-item-helpers";
import { InvoiceTemplateService } from "~/services/invoice-template.server";
import { getSupabaseServerClient } from "~/utils/supabase.server";

interface ActionData {
  errors?: {
    name?: string;
    category?: string;
    lineItems?: string;
    general?: string;
  };
  values?: {
    name?: string;
    category?: string;
    description?: string;
  };
  success?: boolean;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    const { id } = params;
    if (!id) {
        throw new Response('Template ID is required', { status: 400 });
    }
    
    const { supabaseServer } = getSupabaseServerClient(request);
    const templateService = new InvoiceTemplateService(supabaseServer);
    
    try {
        const template = await templateService.getTemplateById(id);
        if (!template) {
            throw new Response('Template not found', { status: 404 });
        }
        
        return json({ template });
    } catch (error) {
        console.error('Failed to load template:', error);
        throw new Response('Failed to load template', { status: 500 });
    }
}

export async function action({ request, params }: ActionFunctionArgs) {
    const { id } = params;
    if (!id) {
        throw new Response('Template ID is required', { status: 400 });
    }
    
    const formData = await request.formData();
    const { supabaseServer } = getSupabaseServerClient(request);
    const templateService = new InvoiceTemplateService(supabaseServer);
    
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as 'enrollment' | 'fees' | 'products' | 'custom';
    const defaultTerms = formData.get('defaultTerms') as string;
    const defaultNotes = formData.get('defaultNotes') as string;
    const defaultFooter = formData.get('defaultFooter') as string;
    
    // Validation
    const errors: ActionData["errors"] = {};
    const values: ActionData["values"] = {
        name: name || '',
        category: category || ''
    };
    
    if (!name?.trim()) {
        errors.name = "Template name is required";
    }
    
    if (!category) {
        errors.category = "Category is required";
    }
    
    // Parse line items from form data
    const lineItemsJson = formData.get('lineItems') as string;
    let lineItems: CreateInvoiceLineItemData[] = [];
    
    try {
        lineItems = JSON.parse(lineItemsJson);
        if (!lineItems.length) {
            errors.lineItems = "At least one line item is required";
        }
    } catch (error) {
        errors.lineItems = 'Invalid line items data';
    }
    
    if (Object.keys(errors).length > 0) {
        return json<ActionData>({ errors, values }, { status: 400 });
    }
    
    try {
        const templateData = {
            name,
            description: description || null,
            category,
            defaultTerms: defaultTerms || null,
            defaultNotes: defaultNotes || null,
            defaultFooter: defaultFooter || null
        };
        
        const dbLineItems = lineItems.map((item, index) => ({
            item_type: item.item_type,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate || 0,
            discount_rate: item.discount_rate || 0,
            service_period_start: item.service_period_start || null,
            service_period_end: item.service_period_end || null,
            sort_order: index
        }));
        
        await templateService.updateTemplate(id, templateData, dbLineItems);
        
        return redirect(`/admin/invoice-templates`);
    } catch (error) {
        console.error('Failed to update template:', error);
        return json<ActionData>({
            errors: { general: 'Failed to update template. Please try again.' },
            values
        }, { status: 500 });
    }
}

export default function EditInvoiceTemplate() {
    const { template } = useLoaderData<typeof loader>();
    const navigation = useNavigation();
    const actionData = useActionData<ActionData>();
    const isSubmitting = navigation.state === "submitting";
    
    const [name, setName] = useState(template.name);
    const [description, setDescription] = useState(template.description || '');
    const [category, setCategory] = useState(template.category);
    const [defaultTerms, setDefaultTerms] = useState(template.defaultTerms || '');
    const [defaultNotes, setDefaultNotes] = useState(template.defaultNotes || '');
    const [defaultFooter, setDefaultFooter] = useState(template.defaultFooter || '');
    const [lineItems, setLineItems] = useState<CreateInvoiceLineItemData[]>(template.lineItems || []);
    
    // Reset line items when template changes
    useEffect(() => {
        setLineItems(template.lineItems || []);
    }, [template.lineItems]);
    
    const addLineItem = () => {
        setLineItems([...lineItems, {
            item_type: 'fee',
            description: '',
            quantity: 1,
            unit_price: 0,
            tax_rate: 0,
            discount_rate: 0,
            service_period_start: undefined,
            service_period_end: undefined,
            sort_order: lineItems.length
        }]);
    };
    
    const removeLineItem = (index: number) => {
        setLineItems(lineItems.filter((_, i) => i !== index));
    };
    
    const updateLineItem = (index: number, field: keyof CreateInvoiceLineItemData, value: string | number) => {
        setLineItems(lineItems.map((item, i) => 
            i === index ? { ...item, [field]: value } : item
        ));
    };
    
    const handleInputClick = (event: React.MouseEvent<HTMLInputElement>) => {
        event.currentTarget.select();
    };
    

    
    const calculateTotal = () => {
        return lineItems.reduce((total, item) => total + calculateLineItemTotal(item), 0);
    };

    return (
        <div className="min-h-screen bg-amber-50 dark:bg-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <AppBreadcrumb items={breadcrumbPatterns.adminInvoiceTemplatesEdit(template.id, template.name)} className="mb-6" />
                
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Invoice Template</h1>
                    <p className="text-gray-600 dark:text-gray-300 mt-2">
                        Modify the template &quot;{template.name}&quot;
                    </p>
                </div>

            <Form method="post" className="space-y-6">
                <Card className="bg-white dark:bg-gray-900 shadow-sm">
                    <CardHeader>
                        <CardTitle>Template Details</CardTitle>
                        <CardDescription>
                            Basic information about the invoice template
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Template Name *</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="e.g., Monthly Membership Fee"
                                    value={actionData?.values?.name || name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={`input-custom-styles ${actionData?.errors?.name ? 'border-red-500 focus:border-red-500' : ''}`}
                                    required
                                    tabIndex={1}
                                />
                                {actionData?.errors?.name && (
                                    <p className="text-sm text-red-600">{actionData.errors.name}</p>
                                )}
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="category">Category *</Label>
                                <Select name="category" value={actionData?.values?.category || category} onValueChange={(value) => setCategory(value as 'enrollment' | 'fees' | 'products' | 'custom')} required>
                                    <SelectTrigger className={`input-custom-styles ${actionData?.errors?.category ? 'border-red-500 focus:border-red-500' : ''}`} tabIndex={2}>
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="enrollment">Enrollment</SelectItem>
                                        <SelectItem value="fees">Fees</SelectItem>
                                        <SelectItem value="products">Products</SelectItem>
                                        <SelectItem value="custom">Custom</SelectItem>
                                    </SelectContent>
                                </Select>
                                {actionData?.errors?.category && (
                                    <p className="text-sm text-red-600">{actionData.errors.category}</p>
                                )}
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                name="description"
                                placeholder="Optional description of when to use this template"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="input-custom-styles"
                                tabIndex={3}
                            />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="defaultTerms">Default Terms</Label>
                                <Textarea
                                    id="defaultTerms"
                                    name="defaultTerms"
                                    placeholder="Payment terms and conditions"
                                    value={defaultTerms}
                                    onChange={(e) => setDefaultTerms(e.target.value)}
                                    className="input-custom-styles"
                                    tabIndex={4}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="defaultNotes">Default Notes</Label>
                                <Textarea
                                    id="defaultNotes"
                                    name="defaultNotes"
                                    placeholder="Additional notes for invoices"
                                    value={defaultNotes}
                                    onChange={(e) => setDefaultNotes(e.target.value)}
                                    className="input-custom-styles"
                                    tabIndex={5}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="defaultFooter">Default Footer</Label>
                                <Textarea
                                    id="defaultFooter"
                                    name="defaultFooter"
                                    placeholder="Footer text for invoices"
                                    value={defaultFooter}
                                    onChange={(e) => setDefaultFooter(e.target.value)}
                                    className="input-custom-styles"
                                    tabIndex={6}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-900 shadow-sm">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Line Items</CardTitle>
                                <CardDescription>
                                    Define the default line items for this template
                                </CardDescription>
                            </div>
                            <Button type="button" onClick={addLineItem} variant="outline" size="sm" tabIndex={0}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Item
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {lineItems.map((item, index) => (
                            <div key={index} className="border rounded-lg p-4 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-medium">Line Item {index + 1}</h4>
                                    {lineItems.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeLineItem(index)}
                                            tabIndex={0}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="lg:col-span-2 space-y-2">
                                        <Label htmlFor={`lineItem_${index}_description`}>Description *</Label>
                                        <Input
                                            id={`lineItem_${index}_description`}
                                            name={`lineItem_${index}_description`}
                                            placeholder="Item description"
                                            value={item.description}
                                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                                            onClick={handleInputClick}
                                            className="input-custom-styles"
                                            tabIndex={0}
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label htmlFor={`lineItem_${index}_quantity`}>Quantity</Label>
                                        <Input
                                            id={`lineItem_${index}_quantity`}
                                            name={`lineItem_${index}_quantity`}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.quantity}
                                            onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                            onClick={handleInputClick}
                                            className="input-custom-styles"
                                            tabIndex={0}
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label htmlFor={`lineItem_${index}_unitPrice`}>Unit Price</Label>
                                        <Input
                                            id={`lineItem_${index}_unitPrice`}
                                            name={`lineItem_${index}_unitPrice`}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.unit_price}
                                            onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                            onClick={handleInputClick}
                                            className="input-custom-styles"
                                            tabIndex={0}
                                        />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor={`lineItem_${index}_taxRate`}>Tax Rate (%)</Label>
                                        <Input
                                            id={`lineItem_${index}_taxRate`}
                                            name={`lineItem_${index}_taxRate`}
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={item.tax_rate}
                                            onChange={(e) => updateLineItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                                            onClick={handleInputClick}
                                            className="input-custom-styles"
                                            tabIndex={0}
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label>Line Total</Label>
                                        <div className="h-10 px-3 py-2 border rounded-md bg-muted text-muted-foreground flex items-center">
                                            {formatCurrency(calculateLineItemTotal(item) * 100)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {actionData?.errors?.general && (
                            <p className="text-sm text-red-600">{actionData.errors.general}</p>
                        )}
                        
                        <div className="border-t pt-4">
                            <div className="flex justify-between items-center text-lg font-semibold">
                                <span>Template Total:</span>
                                <span>{formatCurrency(calculateTotal() * 100)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <input type="hidden" name="lineItems" value={JSON.stringify(lineItems)} />
                
                <div className="flex gap-4">
                    <Button type="submit" disabled={isSubmitting} tabIndex={0}>
                        {isSubmitting ? (
                            <>Saving...</>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Save Changes
                            </>
                        )}
                    </Button>
                    <Button type="button" variant="outline" asChild tabIndex={0}>
                        <a href="/admin/invoice-templates">Cancel</a>
                    </Button>
                </div>
            </Form>
            </div>
        </div>
    );
}