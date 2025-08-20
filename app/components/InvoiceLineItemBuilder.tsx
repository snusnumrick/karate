import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Plus, Copy, Trash2 } from "lucide-react";
import type { CreateInvoiceLineItemData, TaxRate } from "~/types/invoice";
import { createEmptyLineItem, getAvailableItemTypes, duplicateLineItem, calculateLineItemTotalWithRates } from "~/utils/line-item-helpers";
import { formatCurrency } from "~/utils/misc";

interface InvoiceLineItemBuilderProps {
  lineItems: CreateInvoiceLineItemData[];
  onChange: (lineItems: CreateInvoiceLineItemData[]) => void;
  errors?: Record<number, string[]>;
  availableTaxRates?: TaxRate[];
}

export function InvoiceLineItemBuilder({ 
  lineItems, 
  onChange, 
  errors = {},
  availableTaxRates = []
}: InvoiceLineItemBuilderProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const handleAddLineItem = () => {
    const newLineItem = createEmptyLineItem();
    const newLineItems = [...lineItems, newLineItem];
    onChange(newLineItems);
    
    // Expand the new item
    setExpandedItems(prev => new Set([...prev, newLineItems.length - 1]));
  };

  const handleRemoveLineItem = (index: number) => {
    const newLineItems = lineItems.filter((_, i) => i !== index);
    onChange(newLineItems);
    
    // Update expanded items indices
    setExpandedItems(prev => {
      const newExpanded = new Set<number>();
      prev.forEach(i => {
        if (i < index) {
          newExpanded.add(i);
        } else if (i > index) {
          newExpanded.add(i - 1);
        }
      });
      return newExpanded;
    });
  };

  const handleDuplicateLineItem = (index: number) => {
    const itemToDuplicate = lineItems[index];
    const duplicatedItem = duplicateLineItem(itemToDuplicate);
    const newLineItems = [...lineItems];
    newLineItems.splice(index + 1, 0, duplicatedItem);
    onChange(newLineItems);
    
    // Expand the duplicated item
    setExpandedItems(prev => {
      const newExpanded = new Set<number>();
      prev.forEach(i => {
        if (i <= index) {
          newExpanded.add(i);
        } else {
          newExpanded.add(i + 1);
        }
      });
      newExpanded.add(index + 1);
      return newExpanded;
    });
  };

  const handleUpdateLineItem = (index: number, field: keyof CreateInvoiceLineItemData, value: string | number | string[]) => {
    const newLineItems = [...lineItems];
    newLineItems[index] = {
      ...newLineItems[index],
      [field]: value
    };
    onChange(newLineItems);
  };

  const handleInputClick = (event: React.MouseEvent<HTMLInputElement>) => {
    event.currentTarget.select();
  };

  const toggleExpanded = (index: number) => {
    setExpandedItems(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(index)) {
        newExpanded.delete(index);
      } else {
        newExpanded.add(index);
      }
      return newExpanded;
    });
  };

  const itemTypes = getAvailableItemTypes();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">Line Items</h3>
        <Button
          type="button"
          onClick={handleAddLineItem}
          className="inline-flex items-center"
          tabIndex={0}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Line Item
        </Button>
      </div>

      {lineItems.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No line items added yet.</p>
          <p className="text-sm">Click &quot;Add Line Item&quot; to get started.</p>
        </div>
      )}

      <div className="space-y-3">
        {lineItems.map((item, index) => {
          const isExpanded = expandedItems.has(index);
          const itemErrors = errors[index] || [];
          const lineTotal = calculateLineItemTotalWithRates(item, availableTaxRates);

          return (
            <div
              key={index}
              className={`border rounded-lg p-4 ${
                itemErrors.length > 0 ? 'border-red-300 bg-red-50 dark:border-red-500 dark:bg-red-900/20' : 'border-border bg-card'
              }`}
            >
              {/* Line Item Header */}
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(index)}
                    className="text-left w-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-md p-1"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={`line-item-details-${index}`}
                  >
                    <div className="flex items-center justify-between">
                      <div 
                        id={`line-item-header-${index}`}
                      >
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.description || `Line Item ${index + 1}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} × {formatCurrency(item.unit_price * 100)} = {formatCurrency(lineTotal * 100)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-foreground">
                          {formatCurrency(lineTotal * 100)}
                        </span>
                        <svg
                          className={`h-5 w-5 text-muted-foreground transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicateLineItem(index)}
                    tabIndex={0}
                    aria-label={`Duplicate line item ${index + 1}`}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveLineItem(index)}
                    className="text-red-600 hover:text-red-700"
                    tabIndex={0}
                    aria-label={`Delete line item ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Error Messages */}
              {itemErrors.length > 0 && (
                <div className="mt-2 text-sm text-red-600">
                  <ul className="list-disc list-inside">
                    {itemErrors.map((error, errorIndex) => (
                      <li key={errorIndex}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Expanded Form */}
              {isExpanded && (
                <div 
                  className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4"
                  id={`line-item-details-${index}`}
                  role="region"
                  aria-labelledby={`line-item-header-${index}`}
                >
                  {/* Item Type */}
                  <div>
                    <Label htmlFor={`item-type-${index}`} className="block text-sm font-medium mb-1">
                      Item Type <span className="text-red-500">*</span>
                    </Label>
                    <select
                              id={`item-type-${index}`}
                              value={item.item_type}
                              onChange={(e) => handleUpdateLineItem(index, 'item_type', e.target.value)}
                              className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 input-custom-styles ${
                                itemErrors.length > 0 ? 'border-red-500' : ''
                              }`}
                            >
                      {itemTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <Label htmlFor={`description-${index}`} className="block text-sm font-medium mb-1">
                      Description <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={`description-${index}`}
                      type="text"
                      value={item.description}
                      onChange={(e) => handleUpdateLineItem(index, 'description', e.target.value)}
                      onClick={handleInputClick}
                      placeholder="Enter item description"
                      className={`input-custom-styles ${
                        itemErrors.length > 0 ? 'border-red-500' : ''
                      }`}
                      tabIndex={0}
                    />
                  </div>

                  {/* Quantity */}
                  <div>
                    <Label htmlFor={`quantity-${index}`} className="block text-sm font-medium mb-1">
                      Quantity <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={`quantity-${index}`}
                      type="number"
                      min="0"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => handleUpdateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      onClick={handleInputClick}
                      className={`input-custom-styles ${
                        itemErrors.length > 0 ? 'border-red-500' : ''
                      }`}
                      tabIndex={0}
                      placeholder="0"
                    />
                  </div>

                  {/* Unit Price */}
                  <div>
                    <Label htmlFor={`unit-price-${index}`} className="block text-sm font-medium mb-1">
                      Unit Price <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={`unit-price-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => handleUpdateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      onClick={handleInputClick}
                      className={`input-custom-styles ${
                        itemErrors.length > 0 ? 'border-red-500' : ''
                      }`}
                      tabIndex={0}
                      placeholder="0.00"
                    />
                  </div>

                  {/* Tax Rates */}
                  <div>
                    <Label className="block text-sm font-medium mb-1">
                      Tax Rates
                    </Label>
                    <div className="space-y-2 mt-2">
                      {availableTaxRates.length > 0 ? (
                        availableTaxRates.map((taxRate) => (
                          <div key={taxRate.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`tax-${index}-${taxRate.id}`}
                              checked={item.tax_rate_ids?.includes(taxRate.id) || false}
                              onCheckedChange={(checked) => {
                                const currentIds = item.tax_rate_ids || [];
                                const newIds = checked
                                  ? [...currentIds, taxRate.id]
                                  : currentIds.filter(id => id !== taxRate.id);
                                handleUpdateLineItem(index, 'tax_rate_ids', newIds);
                              }}
                            />
                            <Label
                              htmlFor={`tax-${index}-${taxRate.id}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {taxRate.name} ({(taxRate.rate * 100).toFixed(2)}%)
                            </Label>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No tax rates available</p>
                      )}
                    </div>
                  </div>

                  {/* Discount Rate */}
                  <div>
                    <Label htmlFor={`discount-rate-${index}`} className="block text-sm font-medium mb-1">
                      Discount Rate (%)
                    </Label>
                    <Input
                      id={`discount-rate-${index}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.discount_rate || 0}
                      onChange={(e) => handleUpdateLineItem(index, 'discount_rate', parseFloat(e.target.value) || 0)}
                      onClick={handleInputClick}
                      className={`input-custom-styles ${
                        itemErrors.length > 0 ? 'border-red-500' : ''
                      }`}
                      tabIndex={0}
                      placeholder="0.00"
                    />
                  </div>

                  {/* Service Period (for enrollments) */}
                  {(item.item_type === 'class_enrollment' || item.item_type === 'individual_session') && (
                    <>
                      <div>
                        <Label htmlFor={`service-start-${index}`} className="block text-sm font-medium mb-1">
                          Service Period Start
                        </Label>
                        <Input
                          id={`service-start-${index}`}
                          type="date"
                          value={item.service_period_start || ''}
                          onChange={(e) => handleUpdateLineItem(index, 'service_period_start', e.target.value)}
                          onClick={handleInputClick}
                          className={`input-custom-styles ${
                            itemErrors.length > 0 ? 'border-red-500' : ''
                          }`}
                          tabIndex={0}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`service-end-${index}`} className="block text-sm font-medium mb-1">
                          Service Period End
                        </Label>
                        <Input
                          id={`service-end-${index}`}
                          type="date"
                          value={item.service_period_end || ''}
                          onChange={(e) => handleUpdateLineItem(index, 'service_period_end', e.target.value)}
                          onClick={handleInputClick}
                          className={`input-custom-styles ${
                            itemErrors.length > 0 ? 'border-red-500' : ''
                          }`}
                          tabIndex={0}
                        />
                      </div>
                    </>
                  )}

                  {/* Action Buttons */}
                  <div className="md:col-span-2 flex justify-end space-x-2 pt-4 border-t border-border">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicateLineItem(index)}
                      className="inline-flex items-center"
                      tabIndex={0}
                      aria-label={`Duplicate line item ${index + 1}`}
                    >
                      <Copy className="mr-1 h-4 w-4" />
                      Duplicate
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveLineItem(index)}
                      className="inline-flex items-center"
                      tabIndex={0}
                      aria-label={`Remove line item ${index + 1}`}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lineItems.length > 0 && (
        <div className="text-right text-sm text-gray-500">
          {lineItems.length} line item{lineItems.length !== 1 ? 's' : ''} total
        </div>
      )}
    </div>
  );
}