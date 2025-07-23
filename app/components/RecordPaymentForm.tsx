import { useState } from 'react';
import { Form, useActionData, useNavigation } from '@remix-run/react';
import { InvoicePaymentMethod } from '~/types/invoice';

interface RecordPaymentFormProps {
  invoiceId: string;
  invoiceTotal: number;
  amountPaid: number;
  remainingBalance: number;
  onCancel?: () => void;
}

interface PaymentFormData {
  amount: number;
  payment_method: InvoicePaymentMethod;
  payment_date: string;
  reference_number?: string;
  notes?: string;
}

interface ActionData {
  errors?: {
    amount?: string;
    payment_method?: string;
    payment_date?: string;
    reference_number?: string;
    general?: string;
  };
  success?: boolean;
}

export default function RecordPaymentForm({
  invoiceId,
  invoiceTotal,
  amountPaid,
  remainingBalance,
  onCancel
}: RecordPaymentFormProps) {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [formData, setFormData] = useState<PaymentFormData>({
    amount: remainingBalance / 100, // Convert from cents to dollars
    payment_method: 'cash',
    payment_date: new Date().toISOString().split('T')[0],
    reference_number: '',
    notes: ''
  });

  const handleInputChange = (field: keyof PaymentFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const paymentMethods: { value: InvoicePaymentMethod; label: string }[] = [
    { value: 'cash', label: 'Cash' },
    { value: 'check', label: 'Check' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'ach', label: 'ACH' },
    { value: 'other', label: 'Other' }
  ];

  const maxAmount = remainingBalance / 100;
  const isPartialPayment = formData.amount < maxAmount;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
        Record Payment
      </h3>

      {/* Payment Summary */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Invoice Total:</span>
            <span className="ml-2 font-medium text-gray-800 dark:text-gray-100">
              ${(invoiceTotal / 100).toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Amount Paid:</span>
            <span className="ml-2 font-medium text-gray-800 dark:text-gray-100">
              ${(amountPaid / 100).toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Remaining Balance:</span>
            <span className="ml-2 font-medium text-red-600 dark:text-red-400">
              ${(remainingBalance / 100).toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Payment Amount:</span>
            <span className="ml-2 font-medium text-green-600 dark:text-green-400">
              ${formData.amount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <Form method="post" className="space-y-4">
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <input type="hidden" name="action" value="record_payment" />

        {/* Payment Amount */}
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Payment Amount *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              id="amount"
              name="amount"
              min="0.01"
              max={maxAmount}
              step="0.01"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
              className="pl-8 input-custom-styles"
              required
            />
          </div>
          {actionData?.errors?.amount && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{actionData.errors.amount}</p>
          )}
          {isPartialPayment && (
            <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
              This is a partial payment. Remaining balance will be ${(maxAmount - formData.amount).toFixed(2)}
            </p>
          )}
        </div>

        {/* Payment Method */}
        <div>
          <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Payment Method *
          </label>
          <select
            id="payment_method"
            name="payment_method"
            value={formData.payment_method}
            onChange={(e) => handleInputChange('payment_method', e.target.value as InvoicePaymentMethod)}
            className="input-custom-styles"
            required
          >
            {paymentMethods.map(method => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
          {actionData?.errors?.payment_method && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{actionData.errors.payment_method}</p>
          )}
        </div>

        {/* Payment Date */}
        <div>
          <label htmlFor="payment_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Payment Date *
          </label>
          <input
            type="date"
            id="payment_date"
            name="payment_date"
            value={formData.payment_date}
            onChange={(e) => handleInputChange('payment_date', e.target.value)}
            className="input-custom-styles"
            required
          />
          {actionData?.errors?.payment_date && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{actionData.errors.payment_date}</p>
          )}
        </div>

        {/* Reference Number */}
        <div>
          <label htmlFor="reference_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Reference Number
            <span className="text-gray-500 text-xs ml-1">(Check #, Transaction ID, etc.)</span>
          </label>
          <input
            type="text"
            id="reference_number"
            name="reference_number"
            value={formData.reference_number}
            onChange={(e) => handleInputChange('reference_number', e.target.value)}
            placeholder="Optional reference number"
            className="input-custom-styles"
          />
          {actionData?.errors?.reference_number && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{actionData.errors.reference_number}</p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Optional payment notes"
            className="input-custom-styles"
          />
        </div>

        {/* General Error */}
        {actionData?.errors?.general && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{actionData.errors.general}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting || formData.amount <= 0 || formData.amount > maxAmount}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </Form>
    </div>
  );
}