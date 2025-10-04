import { Suspense, lazy } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import type { ClientRenderConfig } from '~/services/payments/types.server';
import type { Money } from '~/utils/money';

interface PaymentWithDetails {
  id: string;
  family_id: string;
  subtotal_amount: Money;
  total_amount: Money;
  family: { email?: string; postal_code?: string | null } | null;
}

interface PaymentFormProps {
  payment: PaymentWithDetails;
  providerConfig: ClientRenderConfig;
  clientSecret: string | null;
  providerData?: Record<string, unknown>; // Generic provider-specific data
  onError?: (message: string) => void;
}

// Lazy load provider-specific components
const StripePaymentForm = lazy(() => import('./StripePaymentForm'));
const SquarePaymentForm = lazy(() => import('./SquarePaymentForm'));

// Loading fallback component
function PaymentFormLoading() {
  return (
    <div className="text-center text-gray-600 dark:text-gray-400 py-8">
      Loading payment form...
    </div>
  );
}

// Provider-neutral payment form
export default function PaymentForm({ 
  payment, 
  providerConfig, 
  clientSecret, 
  onError 
}: PaymentFormProps) {
  const { provider } = providerConfig;

  if (provider === "stripe") {
    return (
      <Suspense fallback={<PaymentFormLoading />}>
        <StripePaymentForm
          payment={payment}
          providerConfig={providerConfig}
          clientSecret={clientSecret}
          onError={onError}
        />
      </Suspense>
    );
  }

  if (provider === "square") {
    return (
      <Suspense fallback={<PaymentFormLoading />}>
        <SquarePaymentForm
          payment={payment}
          providerConfig={providerConfig}
          onError={onError}
        />
      </Suspense>
    );
  }

  // Fallback for unsupported or disabled providers
  return (
    <Alert className="mb-4">
      <AlertTitle>Online Payments Unavailable</AlertTitle>
      <AlertDescription>
        Online payments are not enabled for this provider. Please contact the office to complete payment.
      </AlertDescription>
    </Alert>
  );
}
