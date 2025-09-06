import { useState } from 'react';
import { Link } from '@remix-run/react';
import { Edit, Trash2, Download, Plus, DollarSign } from 'lucide-react';

import { InvoicePayment, InvoicePaymentMethod } from '~/types/invoice';
import { formatDate } from '~/utils/misc';

interface InvoicePaymentWithUser extends InvoicePayment {
  recorded_by?: string;
  // Optional user info for recorded_by
  recorded_by_user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

interface InvoicePaymentHistoryProps {
  invoiceId: string;
  payments: InvoicePaymentWithUser[];
  totalAmount: number; // in cents
  amountPaid: number; // in cents
  canRecordPayments?: boolean;
  canEditPayments?: boolean;
  canDeletePayments?: boolean;
}

export default function InvoicePaymentHistory({
  invoiceId,
  payments,
  totalAmount,
  amountPaid,
  canRecordPayments = true,
  canEditPayments = true,
  canDeletePayments = false
}: InvoicePaymentHistoryProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const remainingBalance = totalAmount - amountPaid;
  const isFullyPaid = remainingBalance <= 0;

  const formatPaymentMethod = (method: InvoicePaymentMethod): string => {
    const methodMap: Record<InvoicePaymentMethod, string> = {
      cash: 'Cash',
      check: 'Check',
      bank_transfer: 'Bank Transfer',
      credit_card: 'Credit Card',
      ach: 'ACH',
      other: 'Other'
    };
    return methodMap[method] || method;
  };

  const formatCurrency = (amountInCents: number): string => {
    return `$${(amountInCents / 100).toFixed(2)}`;
  };

  const formatDateLocal = (dateString: string): string => {
    return formatDate(dateString, {
      formatString: 'MMM d, yyyy'
    });
  };

  const getRecordedByName = (payment: InvoicePaymentWithUser): string => {
    if (payment.recorded_by_user) {
      const { first_name, last_name, email } = payment.recorded_by_user;
      if (first_name && last_name) {
        return `${first_name} ${last_name}`;
      }
      return email;
    }
    return 'System';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Payment History
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {payments.length} payment{payments.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
          
          {canRecordPayments && !isFullyPaid && (
            <Link
              to={`/admin/invoices/${invoiceId}/record-payment`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Record Payment
            </Link>
          )}
        </div>

        {/* Payment Summary */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Amount</div>
            <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {formatCurrency(totalAmount * 100)}
            </div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
            <div className="text-sm text-green-600 dark:text-green-400">Amount Paid</div>
            <div className="text-lg font-semibold text-green-800 dark:text-green-100">
              {formatCurrency(amountPaid * 100)}
            </div>
          </div>
          <div className={`p-3 rounded-lg ${
            isFullyPaid 
              ? 'bg-green-50 dark:bg-green-900/30' 
              : 'bg-red-50 dark:bg-red-900/30'
          }`}>
            <div className={`text-sm ${
              isFullyPaid 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {isFullyPaid ? 'Paid in Full' : 'Remaining Balance'}
            </div>
            <div className={`text-lg font-semibold ${
              isFullyPaid 
                ? 'text-green-800 dark:text-green-100' 
                : 'text-red-800 dark:text-red-100'
            }`}>
              {isFullyPaid ? '✓ Complete' : formatCurrency(remainingBalance * 100)}
            </div>
          </div>
        </div>
      </div>

      {/* Payment List */}
      <div className="p-6">
        {payments.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No payments recorded yet</p>
            {canRecordPayments && (
              <Link
                to={`/admin/invoices/${invoiceId}/record-payment`}
                className="inline-flex items-center mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Record First Payment
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        {formatCurrency(payment.amount)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        via {formatPaymentMethod(payment.payment_method)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDateLocal(payment.payment_date)}
                      </div>
                    </div>
                    
                    {payment.reference_number && (
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Reference: {payment.reference_number}
                      </div>
                    )}
                    
                    {payment.notes && (
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Notes: {payment.notes}
                      </div>
                    )}
                    
                    {payment.taxes && payment.taxes.length > 0 && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <div className="font-medium">Tax Breakdown:</div>
                        {payment.taxes.map((tax, index) => (
                          <div key={index} className="ml-2">
                            {tax.tax_name_snapshot}: {formatCurrency(tax.tax_amount)}
                          </div>
                        ))}
                        <div className="ml-2 font-medium">
                          Total Tax: {formatCurrency(payment.total_tax_amount || 0)}
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                      Recorded by {getRecordedByName(payment)} on {formatDate(payment.created_at)}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    {canEditPayments && (
                      <Link
                        to={`/admin/invoices/${invoiceId}/payments/${payment.id}/edit`}
                        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="Edit payment"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                    )}
                    
                    <button
                      onClick={() => {
                        // TODO: Implement payment receipt download
                        console.log('Download receipt for payment:', payment.id);
                      }}
                      className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                      title="Download receipt"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    
                    {canDeletePayments && (
                      <button
                        onClick={() => setShowDeleteConfirm(payment.id)}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Delete payment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
              Delete Payment
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this payment? This action cannot be undone and will affect the invoice balance.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // TODO: Implement payment deletion
                  console.log('Delete payment:', showDeleteConfirm);
                  setShowDeleteConfirm(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
              >
                Delete Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}