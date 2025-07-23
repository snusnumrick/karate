import type { InvoiceEntity, CreateInvoiceData } from "~/types/invoice";
import { useInvoiceCalculations, formatCurrency } from "~/hooks/use-invoice-calculations";
import { formatEntityAddress, getPaymentTermsLabel } from "~/utils/entity-helpers";
import { getItemTypeLabel, formatServicePeriod } from "~/utils/line-item-helpers";

interface InvoicePreviewProps {
  invoiceData: CreateInvoiceData;
  entity: InvoiceEntity;
  invoiceNumber?: string;
}

export function InvoicePreview({ invoiceData, entity, invoiceNumber }: InvoicePreviewProps) {
  const { subtotal, totalTax, totalDiscount, total, lineItemTotals } = useInvoiceCalculations({
    lineItems: invoiceData.line_items
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
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
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unit Price
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoiceData.line_items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>
                          <p className="font-medium">{item.description}</p>
                          {(item.service_period_start || item.service_period_end) && (
                            <p className="text-xs text-gray-500 mt-1">
                              Service Period: {formatServicePeriod(item.service_period_start, item.service_period_end)}
                            </p>
                          )}
                          {item.discount_rate && item.discount_rate > 0 && (
                            <p className="text-xs text-green-600 mt-1">
                              Discount: {item.discount_rate}%
                            </p>
                          )}
                          {item.tax_rate && item.tax_rate > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              Tax: {item.tax_rate}%
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {getItemTypeLabel(item.item_type)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(lineItemTotals[index])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-8">
            <div className="w-64">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="text-gray-900">{formatCurrency(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount:</span>
                    <span className="text-green-600">-{formatCurrency(totalDiscount)}</span>
                  </div>
                )}
                {totalTax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="text-gray-900">{formatCurrency(totalTax)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2">
                  <div className="flex justify-between text-lg font-semibold">
                    <span className="text-gray-900">Total:</span>
                    <span className="text-gray-900">{formatCurrency(total)}</span>
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