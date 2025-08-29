import { useState, useEffect } from "react";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { InvoiceEntitySelector } from "~/components/InvoiceEntitySelector";
import { InvoiceLineItemBuilder } from "~/components/InvoiceLineItemBuilder";
import { InvoiceTemplates } from "~/components/InvoiceTemplates";
import { InvoicePreview } from "~/components/InvoicePreview";
import type { InvoiceEntity, CreateInvoiceData, CreateInvoiceLineItemData , InvoiceTemplate, TaxRate } from "~/types/invoice";
import { useInvoiceCalculations } from "~/hooks/use-invoice-calculations";
import { formatCurrency } from "~/utils/misc";
import { createEmptyLineItem } from "~/utils/line-item-helpers";
import { calculateDueDate } from "~/utils/entity-helpers";
import { Calendar, FileText, Eye, Save, Send, CheckCircle, AlertCircle, XCircle, Settings } from "lucide-react";

interface InvoiceFormProps {
  entities?: InvoiceEntity[];
  initialData?: Partial<CreateInvoiceData>;
  mode?: 'create' | 'edit';
  preSelectedEntity?: InvoiceEntity | null;
  taxRatesByItemType: {
    class_enrollment: TaxRate[];
    individual_session: TaxRate[];
    product: TaxRate[];
    fee: TaxRate[];
    other: TaxRate[];
  };
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

export function InvoiceForm({ entities, initialData, mode = 'create', preSelectedEntity, taxRatesByItemType = { class_enrollment: [], individual_session: [], product: [], fee: [], other: [] }, errors, values }: InvoiceFormProps) {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Use actionData errors if available, otherwise fall back to prop errors
  const formErrors = actionData?.errors || errors;
  const formValues = actionData?.values || values;

  // Debug logging for actionData
  useEffect(() => {
    if (actionData) {
      console.log("InvoiceForm actionData:", actionData);
      console.log("InvoiceForm errors:", actionData.errors);
    }
  }, [actionData]);

  // Form state
  const [selectedEntity, setSelectedEntity] = useState<InvoiceEntity | null>(preSelectedEntity || null);
  const [invoiceData, setInvoiceData] = useState<CreateInvoiceData>({
    entity_id: formValues?.entity_id || preSelectedEntity?.id || "",
    issue_date: formValues?.issue_date || new Date().toISOString().split('T')[0],
    due_date: formValues?.due_date || "",
    service_period_start: "",
    service_period_end: "",
    terms: "",
    notes: "",
    footer_text: "Thank you for your business!",
    line_items: [createEmptyLineItem()]
  });

  const [activeTab, setActiveTab] = useState("essentials");
  const [showPreview, setShowPreview] = useState(false);

  // Calculate totals
  const { subtotal, tax_amount: totalTax, discount_amount: totalDiscount, total_amount: total } = useInvoiceCalculations(
    invoiceData.line_items,
    taxRatesByItemType
  );

  // Initialize form with initial data
  useEffect(() => {
    if (initialData) {
      setInvoiceData(prev => ({
        ...prev,
        ...initialData,
        line_items: initialData.line_items || [createEmptyLineItem()]
      }));
    }
  }, [initialData]);

  // Update due date when entity or issue date changes
  useEffect(() => {
    if (selectedEntity && invoiceData.issue_date) {
      const dueDate = calculateDueDate(invoiceData.issue_date, selectedEntity.payment_terms);
      setInvoiceData(prev => ({ ...prev, due_date: dueDate }));
    }
  }, [selectedEntity, invoiceData.issue_date]);

  const handleEntitySelect = (entity: InvoiceEntity | null) => {
    setSelectedEntity(entity);
    setInvoiceData(prev => ({ ...prev, entity_id: entity?.id || "" }));
  };

  const handleInputChange = (field: keyof CreateInvoiceData, value: string) => {
    setInvoiceData(prev => ({ ...prev, [field]: value }));
  };

  const handleLineItemsChange = (lineItems: CreateInvoiceLineItemData[]) => {
    setInvoiceData(prev => ({ ...prev, line_items: lineItems }));
  };

  const handleTemplateApply = (template: InvoiceTemplate) => {
    setInvoiceData(prev => ({
      ...prev,
      line_items: template.lineItems.map((item: CreateInvoiceLineItemData) => ({
        ...item,
        service_period_start: prev.service_period_start || "",
        service_period_end: prev.service_period_end || ""
      }))
    }));
    setActiveTab("line-items");
  };
  
  const handleInputClick = (event: React.MouseEvent<HTMLInputElement>) => {
    event.currentTarget.select();
  };

  const isFormValid = () => {
    return (
      selectedEntity &&
      selectedEntity.email && // Email is now required
      invoiceData.issue_date &&
      invoiceData.due_date &&
      invoiceData.line_items.length > 0 &&
      invoiceData.line_items.every(item => 
        item.description.trim() && 
        item.quantity > 0 && 
        item.unit_price >= 0
      )
    );
  };

  // Validation status helpers
  const getValidationStatus = () => {
    const hasEntity = !!selectedEntity;
    const hasEntityEmail = !!(selectedEntity && selectedEntity.email);
    const hasIssueDate = !!invoiceData.issue_date;
    const hasDueDate = !!invoiceData.due_date;
    const hasValidLineItems = invoiceData.line_items.length > 0 && 
      invoiceData.line_items.every(item => 
        item.description.trim() && 
        item.quantity > 0 && 
        item.unit_price >= 0
      );

    return {
      entity: hasEntity && hasEntityEmail,
      dates: hasIssueDate && hasDueDate,
      lineItems: hasValidLineItems,
      overall: hasEntity && hasEntityEmail && hasIssueDate && hasDueDate && hasValidLineItems
    };
  };

  const getValidationIcon = (isValid: boolean) => {
    if (isValid) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getValidationMessage = () => {
    const status = getValidationStatus();
    const missing = [];
    
    if (!selectedEntity) {
      missing.push("billing entity");
    } else if (!selectedEntity.email) {
      missing.push("entity with email address");
    }
    if (!status.dates) missing.push("issue and due dates");
    if (!status.lineItems) missing.push("valid line items");
    
    if (missing.length === 0) {
      return "All required fields completed. Ready to create invoice!";
    }
    
    return `Please complete: ${missing.join(", ")}`;
  };

  const validationStatus = getValidationStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {mode === 'edit' ? 'Edit Invoice' : 'Create New Invoice'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {mode === 'edit' ? 'Update invoice details' : 'Generate a new invoice for billing'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {actionData?.errors?.general && (
        <Alert variant="destructive">
          <AlertDescription>{actionData.errors.general}</AlertDescription>
        </Alert>
      )}

      <div className={`grid gap-6 ${showPreview ? 'grid-cols-1 xl:grid-cols-3' : 'grid-cols-1'}`}>
        {/* Form Section */}
        <div className={`space-y-6 ${showPreview ? 'xl:col-span-2' : ''}`}>
          <Form method="post" className="space-y-6">
            {/* Hidden fields for form submission */}
            <input type="hidden" name="entity_id" value={invoiceData.entity_id} />
            <input type="hidden" name="issue_date" value={invoiceData.issue_date} />
            <input type="hidden" name="due_date" value={invoiceData.due_date} />
            <input type="hidden" name="service_period_start" value={invoiceData.service_period_start || ''} />
            <input type="hidden" name="service_period_end" value={invoiceData.service_period_end || ''} />
            <input type="hidden" name="terms" value={invoiceData.terms || ''} />
            <input type="hidden" name="notes" value={invoiceData.notes || ''} />
            <input type="hidden" name="footer_text" value={invoiceData.footer_text || ''} />
            <input type="hidden" name="line_items" value={JSON.stringify(invoiceData.line_items)} />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="essentials" className="flex items-center gap-2">
                  {getValidationIcon(validationStatus.entity && validationStatus.dates)}
                  Essentials
                </TabsTrigger>
                <TabsTrigger value="line-items" className="flex items-center gap-2">
                  {getValidationIcon(validationStatus.lineItems)}
                  Line Items
                </TabsTrigger>
                <TabsTrigger value="optional">Optional</TabsTrigger>
              </TabsList>

              {/* Essentials Tab - Contains all required fields */}
              <TabsContent value="essentials" className="space-y-4">
                {/* Entity Selection */}
                <Card className="dark:bg-gray-700 dark:border-gray-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 dark:text-white">
                      <FileText className="h-5 w-5" />
                      Billing Entity
                      {getValidationIcon(validationStatus.entity)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InvoiceEntitySelector
                      entities={entities}
                      selectedEntity={selectedEntity}
                      onEntitySelect={handleEntitySelect}
                      error={formErrors?.entity_id}
                    />
                  </CardContent>
                </Card>

                {/* Invoice Dates */}
                <Card className="dark:bg-gray-700 dark:border-gray-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 dark:text-white">
                      <Calendar className="h-5 w-5" />
                      Invoice Dates
                      {getValidationIcon(validationStatus.dates)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="issue_date" className="block text-sm font-medium mb-1">
                          Issue Date<span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="issue_date"
                          type="date"
                          value={invoiceData.issue_date}
                          onChange={(e) => handleInputChange('issue_date', e.target.value)}
                          onClick={handleInputClick}
                          required
                          className={`input-custom-styles ${formErrors?.issue_date ? 'border-red-500' : ''}`}
                        />
                        {formErrors?.issue_date && (
                          <p className="text-red-500 text-sm mt-1">{formErrors.issue_date}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="due_date" className="block text-sm font-medium mb-1">
                          Due Date<span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="due_date"
                          type="date"
                          value={invoiceData.due_date}
                          onChange={(e) => handleInputChange('due_date', e.target.value)}
                          onClick={handleInputClick}
                          required
                          className={`input-custom-styles ${formErrors?.due_date ? 'border-red-500' : ''}`}
                        />
                        {formErrors?.due_date && (
                          <p className="text-red-500 text-sm mt-1">{formErrors.due_date}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="service_period_start" className="block text-sm font-medium mb-1">
                          Service Period Start
                        </Label>
                        <Input
                          id="service_period_start"
                          type="date"
                          value={invoiceData.service_period_start}
                          onChange={(e) => handleInputChange('service_period_start', e.target.value)}
                          className="input-custom-styles"
                        />
                      </div>
                      <div>
                        <Label htmlFor="service_period_end" className="block text-sm font-medium mb-1">
                          Service Period End
                        </Label>
                        <Input
                          id="service_period_end"
                          type="date"
                          value={invoiceData.service_period_end}
                          onChange={(e) => handleInputChange('service_period_end', e.target.value)}
                          className="input-custom-styles"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                {validationStatus.entity && validationStatus.dates && (
                  <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span className="text-green-800 dark:text-green-200 font-medium">
                            Essential information completed!
                          </span>
                        </div>
                        <Button
                          type="button"
                          onClick={() => setActiveTab("line-items")}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Add Line Items →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Line Items Tab */}
              <TabsContent value="line-items" className="space-y-4">
                <Card className="dark:bg-gray-700 dark:border-gray-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 dark:text-white">
                      Invoice Line Items
                      {getValidationIcon(validationStatus.lineItems)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InvoiceLineItemBuilder
                      lineItems={invoiceData.line_items}
                      onChange={handleLineItemsChange}
                      availableTaxRatesByItemType={taxRatesByItemType}
                    />
                    {formErrors?.line_items && (
                      <p className="text-red-500 text-sm mt-1">{formErrors.line_items}</p>
                    )}
                  </CardContent>
                </Card>

                {/* Totals Summary */}
                <Card className="dark:bg-gray-700 dark:border-gray-600">
                  <CardHeader>
                    <CardTitle className="dark:text-white">Invoice Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between dark:text-gray-200">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(subtotal * 100)}</span>
                      </div>
                      {totalDiscount > 0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>Discount (from line items):</span>
                          <span>-{formatCurrency(totalDiscount * 100)}</span>
                        </div>
                      )}
                      {totalTax > 0 && (
                        <div className="flex justify-between dark:text-gray-200">
                          <span>Tax (from line items):</span>
                          <span>{formatCurrency(totalTax * 100)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold text-lg border-t pt-2 dark:text-white dark:border-gray-600">
                        <span>Total:</span>
                        <span>{formatCurrency(total * 100)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Optional Tab - Contains templates and optional fields */}
              <TabsContent value="optional" className="space-y-4">
                {/* Templates Section */}
                <Card className="dark:bg-gray-700 dark:border-gray-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 dark:text-white">
                      <FileText className="h-5 w-5" />
                      Invoice Templates
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Apply a template to quickly populate invoice fields
                    </p>
                  </CardHeader>
                  <CardContent>
                    <InvoiceTemplates onSelectTemplate={handleTemplateApply} />
                  </CardContent>
                </Card>

                {/* Optional Fields */}
                <Card className="dark:bg-gray-700 dark:border-gray-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 dark:text-white">
                      <Settings className="h-5 w-5" />
                      Additional Information
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Optional fields to customize your invoice
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="terms" className="block text-sm font-medium mb-1">
                        Payment Terms
                      </Label>
                      <Textarea
                        id="terms"
                        value={invoiceData.terms}
                        onChange={(e) => handleInputChange('terms', e.target.value)}
                        placeholder="Additional payment terms or instructions..."
                        rows={3}
                        className="input-custom-styles"
                      />
                    </div>

                    <div>
                      <Label htmlFor="notes" className="block text-sm font-medium mb-1">
                        Notes
                      </Label>
                      <Textarea
                        id="notes"
                        value={invoiceData.notes}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        placeholder="Internal notes or special instructions..."
                        rows={3}
                        className="input-custom-styles"
                      />
                    </div>

                    <div>
                      <Label htmlFor="footer_text" className="block text-sm font-medium mb-1">
                        Footer Text
                      </Label>
                      <Input
                        id="footer_text"
                        value={invoiceData.footer_text}
                        onChange={(e) => handleInputChange('footer_text', e.target.value)}
                        onClick={handleInputClick}
                        placeholder="Thank you message or additional information..."
                        className="input-custom-styles"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="mt-8 space-y-4">
              {/* Validation Status Alert */}
              {!validationStatus.overall && (
                <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 dark:text-red-200">
                      {getValidationMessage()}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {/* Display general errors */}
              {actionData?.errors?.general && (
                <Alert variant="destructive">
                  <AlertDescription>{actionData.errors.general}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                name="action"
                value="save_and_send"
                disabled={!isFormValid() || isSubmitting}
                className="w-full font-bold py-3 px-6 bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? 'Saving and Sending...' : 'SAVE AND SEND EMAIL'}
              </Button>
              <Button
                type="submit"
                name="action"
                value="save_draft"
                variant="outline"
                disabled={!isFormValid() || isSubmitting}
                className="w-full font-bold py-3 px-6 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSubmitting ? 'Saving...' : 'SAVE AS DRAFT'}
              </Button>
            </div>
          </Form>
        </div>

        {/* Preview Section */}
        {showPreview && selectedEntity && (
          <div className="lg:sticky lg:top-6">
            <InvoicePreview
              invoiceData={invoiceData}
              entity={selectedEntity}
              invoiceNumber="PREVIEW"
              taxRatesByItemType={taxRatesByItemType}
            />
          </div>
        )}
      </div>
    </div>
  );
}