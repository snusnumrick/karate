import { useState, useEffect, useMemo } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions, type Stripe } from "@stripe/stripe-js";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { ClientOnly } from "~/components/client-only";
import { isDarkThemeEnabled } from "~/utils/theme.client";
import type { ClientRenderConfig } from '~/services/payments/types.server';
import type { Money } from '~/utils/money';

interface PaymentWithDetails {
  id: string;
  family_id: string;
  subtotal_amount: Money;
  total_amount: Money;
  family: { email?: string; postal_code?: string | null } | null;
}

interface StripePaymentFormProps {
  payment: PaymentWithDetails;
  providerConfig: ClientRenderConfig;
  clientSecret: string | null;
  onError?: (message: string) => void;
}

interface StripeCheckoutFormProps {
  payment: PaymentWithDetails;
  onError?: (message: string) => void;
}

function StripeCheckoutForm({ payment, onError }: StripeCheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const defaultEmail = payment.family?.email ?? undefined;
  const defaultPostalCode = payment.family?.postal_code ?? undefined;

  const paymentElementOptions = useMemo(
    () => ({
      defaultValues: {
        billingDetails: {
          email: defaultEmail,
          address: {
            postal_code: defaultPostalCode,
          },
        },
      },
    }),
    [defaultEmail, defaultPostalCode],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setPaymentError("Payment system not ready. Please try again.");
      onError?.("Payment system not ready. Please try again.");
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/success?payment_intent={PAYMENT_INTENT_ID}`,
        },
      });

      if (result.error) {
        setPaymentError(result.error.message || "Payment failed. Please try again.");
        onError?.(result.error.message || "Payment failed. Please try again.");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      setPaymentError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={paymentElementOptions} />

      {paymentError && (
        <Alert variant="destructive">
          <AlertTitle>Payment Error</AlertTitle>
          <AlertDescription>{paymentError}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={!stripe || !elements || isProcessing}
        className="w-full"
      >
        {isProcessing ? "Processing..." : "Complete Payment"}
      </Button>
    </form>
  );
}

export default function StripePaymentForm({ 
  payment, 
  providerConfig, 
  clientSecret, 
  onError 
}: StripePaymentFormProps) {
  const [stripePromise, setStripePromise] = useState<Stripe | null>(null);
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">("light");

  // Theme detection
  useEffect(() => {
    const checkTheme = () => {
      setCurrentTheme(isDarkThemeEnabled() ? "dark" : "light");
    };
    checkTheme();
    const observer = new MutationObserver(() => checkTheme());
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // Stripe initialization
  useEffect(() => {
    if (!providerConfig.publishableKey) return;
    loadStripe(providerConfig.publishableKey).then(setStripePromise);
  }, [providerConfig.publishableKey]);

  // Stripe options
  const stripeOptions = useMemo<StripeElementsOptions | undefined>(() => {
    if (!clientSecret) return undefined;
    const appearance: StripeElementsOptions["appearance"] = {
      theme: currentTheme === "dark" ? "night" : "stripe",
      variables: {
        colorPrimary: "#22c55e",
        colorDanger: "#ef4444",
        borderRadius: "0.375rem",
      },
    };
    return {
      clientSecret,
      appearance,
    };
  }, [currentTheme, clientSecret]);

  return (
    <ClientOnly fallback={<p className="text-center text-gray-600 dark:text-gray-400 py-8">Loading payment form...</p>}>
      {() =>
        stripePromise && stripeOptions ? (
          <Elements key={clientSecret ?? "stripe"} stripe={stripePromise} options={stripeOptions}>
            <StripeCheckoutForm payment={payment} onError={onError} />
          </Elements>
        ) : (
          <p className="text-center text-gray-600 dark:text-gray-400 py-8">
            Initializing payment form...
          </p>
        )
      }
    </ClientOnly>
  );
}
