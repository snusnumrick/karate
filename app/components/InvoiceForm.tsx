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
import type { InvoiceEntity, CreateInvoiceData, CreateInvoiceLineItemData , InvoiceTemplate } from "~/types/invoice";
import { useInvoiceCalculations, formatCurrency } from "~/hooks/use-invoice-calculations";
import { createEmptyLineItem } from "~/utils/line-item-helpers";
import { calculateDueDate } from "~/utils/entity-helpers";
import { Calendar, FileText, Eye, Save, Send } from "lucide-react";

interface InvoiceFormProps {
  entities?: InvoiceEntity[];
  initialData?: Partial<CreateInvoiceData>;
  mode?: 'create' | 'edit';
}

export function InvoiceForm({ initialData, mode = 'create' }: InvoiceFormProps) {
  const actionData = useActionData<{ error?: string; success?: boolean }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Form state
  const [selectedEntity, setSelectedEntity] = useState<InvoiceEntity | null>(null);
  const [invoiceData, setInvoiceData] = useState<CreateInvoiceData>({
    entity_id: "",
    issue_date: new Date().toISOString().split('T')[0],
    due_date: "",
    service_period_start: "",
    service_period_end: "",
    terms: "",
    notes: "",
    footer_text: "Thank you for your business!",
    line_items: [createEmptyLineItem()]
  });

  const [activeTab, setActiveTab] = useState("entity");
  const [showPreview, setShowPreview] = useState(false);

  // Calculate totals
  const { subtotal, totalTax, totalDiscount, total } = useInvoiceCalculations({
    lineItems: invoiceData.line_items
  });

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
    // Auto-advance to details tab when entity is selected
    if (entity && activeTab === "entity") {
      setActiveTab("details");
    }
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

  const isFormValid = () => {
    return (
      selectedEntity &&
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
      {actionData?.error && (
        <Alert variant="destructive">
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )}

      <div className={`grid gap-6 ${showPreview ? 'grid-cols-1 xl:grid-cols-3' : 'grid-cols-1'}`}>
        {/* Form Section */}
        <div className={`space-y-6 ${showPreview ? 'xl:col-span-2' : ''}`}>
          <Form method="post" className="space-y-6">
            {/* Hidden fields for form submission */}
            <input type="hidden" name="entity_id" value={invoiceData.entity_id} />
            <input type="hidden" name="line_items" value={JSON.stringify(invoiceData.line_items)} />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="entity">Entity</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="line-items">Items</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
              </TabsList>

              {/* Entity Selection Tab */}
              <TabsContent value="entity" className="space-y-4">
                <Card className="dark:bg-gray-700 dark:border-gray-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 dark:text-white">
                      <FileText className="h-5 w-5" />
                      Select Billing Entity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InvoiceEntitySelector
                      selectedEntity={selectedEntity}
                      onEntitySelect={handleEntitySelect}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Invoice Details Tab */}
              <TabsContent value="details" className="space-y-4">
                <Card className="dark:bg-gray-700 dark:border-gray-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 dark:text-white">
                      <Calendar className="h-5 w-5" />
                      Invoice Details
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
                          name="issue_date"
                          type="date"
                          value={invoiceData.issue_date}
                          onChange={(e) => handleInputChange('issue_date', e.target.value)}
                          required
                          className="input-custom-styles"
                        />
                      </div>
                      <div>
                        <Label htmlFor="due_date" className="block text-sm font-medium mb-1">
                          Due Date<span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="due_date"
                          name="due_date"
                          type="date"
                          value={invoiceData.due_date}
                          onChange={(e) => handleInputChange('due_date', e.target.value)}
                          required
                          className="input-custom-styles"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="service_period_start" className="block text-sm font-medium mb-1">
                          Service Period Start
                        </Label>
                        <Input
                          id="service_period_start"
                          name="service_period_start"
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
                          name="service_period_end"
                          type="date"
                          value={invoiceData.service_period_end}
                          onChange={(e) => handleInputChange('service_period_end', e.target.value)}
                          className="input-custom-styles"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="terms" className="block text-sm font-medium mb-1">
                        Payment Terms
                      </Label>
                      <Textarea
                        id="terms"
                        name="terms"
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
                        name="notes"
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
                        name="footer_text"
                        value={invoiceData.footer_text}
                        onChange={(e) => handleInputChange('footer_text', e.target.value)}
                        placeholder="Thank you message or additional information..."
                        className="input-custom-styles"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Line Items Tab */}
              <TabsContent value="line-items" className="space-y-4">
                <Card className="dark:bg-gray-700 dark:border-gray-600">
                  <CardHeader>
                    <CardTitle className="dark:text-white">Invoice Line Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InvoiceLineItemBuilder
                      lineItems={invoiceData.line_items}
                      onChange={handleLineItemsChange}
                    />
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
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      {totalDiscount > 0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>Total Discount:</span>
                          <span>-{formatCurrency(totalDiscount)}</span>
                        </div>
                      )}
                      {totalTax > 0 && (
                        <div className="flex justify-between dark:text-gray-200">
                          <span>Total Tax:</span>
                          <span>{formatCurrency(totalTax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold text-lg border-t pt-2 dark:text-white dark:border-gray-600">
                        <span>Total:</span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Templates Tab */}
              <TabsContent value="templates" className="space-y-4">
                <Card className="dark:bg-gray-700 dark:border-gray-600">
                  <CardHeader>
                    <CardTitle className="dark:text-white">Invoice Templates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InvoiceTemplates onSelectTemplate={handleTemplateApply} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="mt-8 space-y-4">
              <Button
                type="submit"
                name="action"
                value="create_invoice"
                disabled={!isFormValid() || isSubmitting}
                className="w-full font-bold py-3 px-6 bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? 'Creating...' : 'CREATE INVOICE'}
              </Button>
              <Button
                type="submit"
                name="action"
                value="save_draft"
                variant="outline"
                disabled={!isFormValid() || isSubmitting}
                className="w-full font-bold py-3 px-6 flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                SAVE AS DRAFT
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
            />
          </div>
        )}
      </div>
    </div>
  );
}