import { useFetcher } from '@remix-run/react';
import { useRef, useState, useEffect } from 'react';
import { Button } from '~/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { ExclamationTriangleIcon, ReloadIcon } from '@radix-ui/react-icons';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { CreditCard, DollarSign } from 'lucide-react';
import {addMoney, formatMoney, Money, multiplyMoney, ZERO_MONEY} from '~/utils/money';

interface TaxInfo {
  taxName: string;
  taxAmount: Money;
  taxRate: number;
}

interface EventPaymentFormProps {
  eventId: string;
  eventTitle: string;
  registrationFee: Money;
  studentCount: number;
  familyId: string;
  registrationId: string;
  studentIds?: string[];
  onSuccess?: (paymentId: string) => void;
  actionEndpoint?: string;
  taxes?: TaxInfo[];
  totalTaxAmount?: Money;
}

interface ActionResponse {
  success?: boolean;
  paymentId?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export function EventPaymentForm({
  eventId,
  eventTitle,
  registrationFee,
  studentCount,
  familyId,
  registrationId,
  studentIds = [],
  onSuccess,
  actionEndpoint = '/family/payment',
  taxes = [],
  totalTaxAmount = ZERO_MONEY
}: EventPaymentFormProps) {
  const fetcher = useFetcher<ActionResponse>();
  const formRef = useRef<HTMLFormElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const subtotalAmount = multiplyMoney(registrationFee, studentCount);
  const totalAmount = addMoney(subtotalAmount, totalTaxAmount);

  // Handle form submission response
  useEffect(() => {
    if (fetcher.data) {
      console.log('EventPaymentForm: Received fetcher data:', fetcher.data);
      if (fetcher.data.success) {
        console.log('EventPaymentForm: Payment successful, calling onSuccess with paymentId:', fetcher.data.paymentId || 'event-payment-success');
        onSuccess?.(fetcher.data.paymentId || 'event-payment-success');
      } else {
        console.log('EventPaymentForm: Payment failed or no success flag');
      }
      setIsProcessing(false);
    }
  }, [fetcher.data, onSuccess]);

  const handleSubmit = (e: React.FormEvent) => {
    console.log('EventPaymentForm handleSubmit called');
    e.preventDefault();
    
    if (!eventId || !registrationId) {
      console.error('Missing eventId or registrationId');
      return;
    }

    setIsProcessing(true);
    
    const formData = new FormData();
    formData.append('intent', 'payment');
    formData.append('eventId', eventId);
    formData.append('registrationId', registrationId);
    formData.append('familyId', familyId);
    formData.append('studentIds', JSON.stringify(studentIds));
    formData.append('totalAmount', totalAmount.toString());
    
    console.log('Submitting payment data:', {
      eventId,
      registrationId,
      familyId,
      studentIds,
      totalAmount
    });
    
    console.log('Form action URL:', actionEndpoint);
    
    fetcher.submit(formData, {
      method: 'POST',
      action: actionEndpoint
    });
  };

  const isSubmitting = fetcher.state === 'submitting' || isProcessing;

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {fetcher.data?.error && (
        <Alert variant="destructive">
          <ExclamationTriangleIcon className="h-4 w-4" />
          <AlertTitle>Payment Error</AlertTitle>
          <AlertDescription>{fetcher.data.error}</AlertDescription>
        </Alert>
      )}

      {fetcher.data?.fieldErrors && Object.keys(fetcher.data.fieldErrors).length > 0 && (
        <Alert variant="destructive">
          <ExclamationTriangleIcon className="h-4 w-4" />
          <AlertTitle>Please fix the following errors:</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside">
              {Object.entries(fetcher.data.fieldErrors).map(([field, error]) => (
                error ? <li key={field}>{error}</li> : null
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Payment Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Event Registration Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Event:</span>
              <span className="font-medium">{eventTitle}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Registration Fee:</span>
              <span className="font-medium">${formatMoney(registrationFee)} per student</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Number of Students:</span>
              <span className="font-medium">{studentCount}</span>
            </div>
            <div className="border-t pt-2 mt-2 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal:</span>
                <span className="font-medium">${formatMoney(subtotalAmount)}</span>
              </div>
              {taxes.length > 0 && (
                <>
                  {taxes.map((tax, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {tax.taxName} ({(tax.taxRate * 100).toFixed(1)}%):
                      </span>
                      <span className="font-medium">{formatMoney(tax.taxAmount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Tax:</span>
                    <span className="font-medium">${formatMoney(totalTaxAmount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center border-t pt-2">
                <span className="text-lg font-semibold">Total Amount:</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  ${formatMoney(totalAmount)}
                </span>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p>• Payment will be processed securely through our payment gateway</p>
            <p>• You will receive a confirmation email after successful payment</p>
            <p>• Registration will be confirmed once payment is complete</p>
          </div>
        </CardContent>
      </Card>

      {/* Payment Form */}
      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="flex justify-center">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-48 h-12 text-lg"
            size="lg"
            onClick={(e) => {
              console.log('=== PAY BUTTON CLICKED ===');
              console.log('Event:', e);
              console.log('Form will submit to:', actionEndpoint);
            }}
          >
            {isSubmitting ? (
              <>
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-5 w-5" />
                Pay ${formatMoney(totalAmount)}
              </>
            )}
          </Button>
        </div>
      </form>

      <div className="text-xs text-center text-gray-500 dark:text-gray-400">
        Secure payment processing with enterprise-grade encryption
      </div>
    </div>
  );
}