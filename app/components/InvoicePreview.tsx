import type { InvoiceEntity, CreateInvoiceData } from "~/types/invoice";
import { siteConfig } from "~/config/site";
import { useInvoiceCalculations } from "~/hooks/use-invoice-calculations";
import { formatCurrency } from "~/utils/misc";
import { formatEntityAddress, getPaymentTermsLabel } from "~/utils/entity-helpers";
import { getItemTypeLabel, formatServicePeriod, calculateLineItemSubtotal, calculateLineItemDiscount, calculateLineItemTax } from "~/utils/line-item-helpers";

interface InvoicePreviewProps {
  invoiceData: CreateInvoiceData;
  entity: InvoiceEntity;
  invoiceNumber?: string;
}

export function InvoicePreview({ invoiceData, entity, invoiceNumber }: InvoicePreviewProps) {
  const { subtotal, totalTax, totalDiscount, total } = useInvoiceCalculations(
    invoiceData.line_items
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(siteConfig.localization.locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Invoice Preview</h3>
        <p className="text-sm text-gray-500">Preview how your invoice will appear</p>
      </div>

      {/* Invoice Content */}
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Invoice Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">INVOICE</h1>
              {invoiceNumber && (
                <p className="text-lg text-gray-600 mt-1">#{invoiceNumber}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                <p><strong>Issue Date:</strong> {formatDate(invoiceData.issue_date)}</p>
                <p><strong>Due Date:</strong> {formatDate(invoiceData.due_date)}</p>
                {invoiceData.service_period_start && invoiceData.service_period_end && (
                  <p><strong>Service Period:</strong> {formatServicePeriod(invoiceData.service_period_start, invoiceData.service_period_end)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Bill To Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
                From
              </h3>
              <div className="text-sm text-gray-600">
                <p className="font-medium">Karate School</p>
                <p>123 Main Street</p>
                <p>City, State 12345</p>
                <p>Phone: (555) 123-4567</p>
                <p>Email: info@karateschool.com</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
                Bill To
              </h3>
              <div className="text-sm text-gray-600">
                <p className="font-medium">{entity.name}</p>
                {entity.contact_person && <p>{entity.contact_person}</p>}
                {formatEntityAddress(entity) && <p>{formatEntityAddress(entity)}</p>}
                {entity.phone && <p>Phone: {entity.phone}</p>}
                {entity.email && <p>Email: {entity.email}</p>}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mb-8">
            <div className="space-y-4">
              {invoiceData.line_items.map((item, index) => {
                const itemSubtotal = calculateLineItemSubtotal(item);
                const itemDiscount = calculateLineItemDiscount(item);
                const itemTax = calculateLineItemTax(item);
                
                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    {/* Item Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{item.description}</h4>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span>{getItemTypeLabel(item.item_type)}</span>
                          {(item.service_period_start || item.service_period_end) && (
                            <span>Service Period: {formatServicePeriod(item.service_period_start, item.service_period_end)}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">
                          {formatCurrency((itemSubtotal - itemDiscount + itemTax) * 100)}
                        </div>
                        <div className="text-xs text-gray-500">Total</div>
                      </div>
                    </div>
                    
                    {/* Item Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Quantity</div>
                        <div className="font-medium text-gray-900">{item.quantity}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Unit Price</div>
                        <div className="font-medium text-gray-900">{formatCurrency(item.unit_price * 100)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Subtotal</div>
                        <div className="font-medium text-gray-900">{formatCurrency(itemSubtotal * 100)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">After Adjustments</div>
                        <div className="space-y-1">
                          {itemDiscount > 0 && (
                              <div className="flex justify-between">
                                <span className="text-green-600">Discount ({Number(item.discount_rate).toFixed(2)}%):</span>
                                <span className="text-green-600">-{formatCurrency(itemDiscount * 100)}</span>
                              </div>
                            )}
                            {itemTax > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Tax ({Number(item.tax_rate).toFixed(2)}%):</span>
                                <span className="text-gray-900">{formatCurrency(itemTax * 100)}</span>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-8">
            <div className="w-80">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="text-gray-900">{formatCurrency(subtotal * 100)}</span>
                </div>
                
                {/* Detailed Discount Breakdown */}
                {totalDiscount > 0 && (
                  <div className="border-l-2 border-green-200 pl-3 py-1 bg-green-50">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-gray-700">Total Discounts:</span>
                      <span className="text-green-600">-{formatCurrency(totalDiscount * 100)}</span>
                    </div>
                    <div className="mt-1 space-y-1">
                      {invoiceData.line_items.map((item, index) => {
                        const itemDiscount = calculateLineItemDiscount(item);
                        if (itemDiscount > 0) {
                          return (
                            <div key={index} className="flex justify-between text-xs text-gray-600">
                              <span className="truncate max-w-48">{item.description} ({Number(item.discount_rate).toFixed(2)}%):</span>
                              <span className="text-green-600 ml-2">-{formatCurrency(itemDiscount * 100)}</span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}
                
                {/* Detailed Tax Breakdown */}
                {totalTax > 0 && (
                  <div className="border-l-2 border-blue-200 pl-3 py-1 bg-blue-50">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-gray-700">Total Tax:</span>
                      <span className="text-gray-900">{formatCurrency(totalTax * 100)}</span>
                    </div>
                    <div className="mt-1 space-y-1">
                      {invoiceData.line_items.map((item, index) => {
                        const itemTax = calculateLineItemTax(item);
                        if (itemTax > 0) {
                          return (
                            <div key={index} className="flex justify-between text-xs text-gray-600">
                              <span className="truncate max-w-48">{item.description} ({Number(item.tax_rate).toFixed(2)}%):</span>
                              <span className="text-gray-900 ml-2">{formatCurrency(itemTax * 100)}</span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}
                
                <div className="border-t border-gray-200 pt-2">
                  <div className="flex justify-between text-lg font-semibold">
                    <span className="text-gray-900">Total:</span>
                    <span className="text-gray-900">{formatCurrency(total * 100)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Payment Terms</h4>
            <p className="text-sm text-gray-600">
              {getPaymentTermsLabel(entity.payment_terms)}
            </p>
            {invoiceData.terms && (
              <p className="text-sm text-gray-600 mt-2">{invoiceData.terms}</p>
            )}
          </div>

          {/* Notes */}
          {invoiceData.notes && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Notes</h4>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoiceData.notes}</p>
            </div>
          )}

          {/* Footer */}
          {invoiceData.footer_text && (
            <div className="border-t border-gray-200 pt-6">
              <p className="text-xs text-gray-500 text-center">{invoiceData.footer_text}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}