import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { useFetcher } from "@remix-run/react";
import type { ClientRenderConfig } from '~/services/payments/types.server';

// Import Square Web SDK from npm package
interface SquareCardElement {
  tokenize: () => Promise<{ token?: string; errors?: unknown[] }>;
  destroy: () => void;
  attach: (selector: string) => Promise<void>;
}

interface SquarePayments {
  card: (options?: Record<string, unknown>) => Promise<SquareCardElement>;
}

// Update to match actual Square SDK signature
interface SquareSDK {
  payments: (applicationId: string, locationId?: string, overrides?: { scriptSrc?: string }) => Promise<SquarePayments | null>;
}

let Square: SquareSDK | null = null;

interface PaymentWithDetails {
  id: string;
  family_id: string;
  subtotal_amount: number;
  total_amount: number;
  family: { email?: string; postal_code?: string } | null;
}

interface SquarePaymentFormProps {
  payment: PaymentWithDetails;
  providerConfig: ClientRenderConfig;
  onError?: (message: string) => void;
}

export default function SquarePaymentForm({ 
  payment,
  providerConfig,
  onError
}: SquarePaymentFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<SquarePayments | null>(null);
  const [card, setCard] = useState<SquareCardElement | null>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const fetcher = useFetcher();
  const loadAttempted = useRef(false);
  const initAttempted = useRef(false);

  // Load Square Web SDK from npm package
  useEffect(() => {
    // Prevent multiple load attempts
    if (loadAttempted.current) {
      return;
    }

    loadAttempted.current = true;

    const loadSquareSDK = async () => {
      try {
        if (Square) {
          console.log('Square SDK already loaded from import');
          setSdkLoaded(true);
          return;
        }

        console.log('Loading Square SDK from npm package...');
        const { payments } = await import('@square/web-sdk');
        Square = { payments }; // Square SDK exports { payments } function
        
        if (Square) {
          console.log('Square SDK loaded successfully from npm package');
          setSdkLoaded(true);
        } else {
          throw new Error('Square SDK module loaded but payments function not found');
        }
      } catch (error) {
        console.error('Failed to load Square SDK from npm package:', error);
        const errorMsg = 'Failed to load Square payment system. Please try refreshing the page.';
        setSdkError(errorMsg);
        onError?.(errorMsg);
      }
    };

    loadSquareSDK();
  }, [onError]);

  // Initialize Square Web Payments SDK
  useEffect(() => {
    if (!sdkLoaded || !Square) {
      return;
    }

    // Prevent multiple initializations
    if (initAttempted.current || paymentForm || card) {
      console.log('Square already initialized, skipping... initAttempted:', initAttempted.current, 'paymentForm:', !!paymentForm, 'card:', !!card);
      return;
    }
    
    initAttempted.current = true;

    // Double-check that container doesn't already have Square elements
    const container = document.getElementById('square-card-container');
    if (container && container.children.length > 0) {
      console.log('Container already has children, clearing and reinitializing...');
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    }

    // Check if we have the required configuration
    if (!providerConfig.applicationId || !providerConfig.locationId) {
      console.error('Square configuration missing:', {
        applicationId: !!providerConfig.applicationId,
        locationId: !!providerConfig.locationId,
        environment: providerConfig.environment
      });
      onError?.('Square payment configuration is incomplete. Please contact support.');
      return;
    }

    async function initializeSquare() {
      try {
        console.log('Initializing Square Web Payments SDK with:', {
          applicationId: providerConfig.applicationId,
          locationId: providerConfig.locationId,
          environment: providerConfig.environment,
          hasSquarePayments: !!Square?.payments
        });

        if (!Square) {
          throw new Error('Square SDK not available');
        }

        // Clear any existing content in the container and ensure it's empty
        const container = document.getElementById('square-card-container');
        if (container) {
          // Force clear all children
          while (container.firstChild) {
            container.removeChild(container.firstChild);
          }
          console.log('Container cleared, child count:', container.children.length);
        }

        console.log('Initializing Square payments with applicationId:', providerConfig.applicationId?.substring(0, 15) + '...');
        
        const payments = await Square.payments(
          providerConfig.applicationId!,
          providerConfig.locationId!
        );
        console.log('Square payments object created:', !!payments);
        
        if (!payments) {
          throw new Error('Failed to create Square payments object');
        }
        
        setPaymentForm(payments);

        console.log('Creating card element...');
        
        // Detect dark mode for color scheme
        const isDarkMode = document.documentElement.classList.contains('dark') || 
                          window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        const cardElement = await payments.card({
          style: {
            input: {
              fontSize: '14px',
              fontFamily: 'Arial, sans-serif',
              color: isDarkMode ? '#ffffff' : '#000000',
              backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
            },
            'input::placeholder': {
              color: isDarkMode ? '#9ca3af' : '#6b7280',
            },
            'input.is-error': {
              color: isDarkMode ? '#ffffff' : '#000000',
            },
            '.input-container': {
              borderRadius: '6px',
              borderColor: isDarkMode ? '#374151' : '#d1d5db',
            },
            '.input-container.is-focus': {
              borderColor: isDarkMode ? '#22c55e' : '#22c55e',
            },
            '.input-container.is-error': {
              borderColor: '#ef4444',
            },
            '.message-text': {
              color: isDarkMode ? '#9ca3af' : '#6b7280',
            },
            '.message-text.is-error': {
              color: '#ef4444',
            }
          }
        });
        console.log('Card element created, attaching to DOM...');
        
        await cardElement.attach('#square-card-container');
        console.log('Card element attached successfully');
        
        setCard(cardElement);
        console.log('Square Web Payments SDK initialized successfully');
      } catch (error) {
        console.error('Square initialization failed:', error);
        if (error instanceof Error) {
          onError?.(`Failed to initialize Square payment form: ${error.message}`);
        } else {
          onError?.('Failed to initialize Square payment form. Please try refreshing the page.');
        }
      }
    }

    initializeSquare();

    // Cleanup function
    return () => {
      if (card && typeof card === 'object' && 'destroy' in card) {
        console.log('Destroying Square card element...');
        try {
          (card as SquareCardElement).destroy();
        } catch (error) {
          console.warn('Error destroying Square card element:', error);
        }
        setCard(null);
      }
      if (paymentForm) {
        setPaymentForm(null);
      }
      // Reset initialization flag for next mount
      initAttempted.current = false;
    };
  // Only re-run when SDK loading state changes, not when config values change
  // eslint-disable-next-line react-hooks/exhaustive-deps  
  }, [sdkLoaded]);

  const handlePayment = async () => {
    if (!card || !paymentForm) {
      onError?.('Payment form not ready');
      return;
    }

    setIsLoading(true);

    try {
      // Tokenize the card
      const result = await card.tokenize();
      
      if (result.token) {
        // Send the token to our server to process the payment
        fetcher.submit(
          {
            payment_method_id: result.token,
            payment_intent_id: payment.id,
            action: 'confirm_payment'
          },
          {
            method: 'POST',
            action: `/pay/${payment.id}`
          }
        );
      } else {
        throw new Error('Failed to tokenize payment method');
      }
    } catch (error) {
      console.error('Payment failed:', error);
      setIsLoading(false);
      
      if (error instanceof Error) {
        onError?.(error.message);
      } else {
        onError?.('Payment failed. Please try again.');
      }
    }
  };

  // Handle payment confirmation response
  useEffect(() => {
    if (fetcher.data) {
      setIsLoading(false);
      
      // Type guard for the response data
      const responseData = fetcher.data as { success?: boolean; error?: string };
      
      if (responseData.success) {
        // Payment successful - redirect to general success page for smart routing
        window.location.href = `/payment/success?payment_intent=${payment.id}`;
      } else {
        // Payment failed
        onError?.(responseData.error || 'Payment failed. Please try again.');
      }
    }
  }, [fetcher.data, payment.id, onError]);

  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(cents / 100);
  };

  if (sdkError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Payment System Unavailable</AlertTitle>
          <AlertDescription>{sdkError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!sdkLoaded) {
    return (
      <div className="space-y-4">
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          Loading Square payment form...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      
      <Alert>
        <AlertTitle>Secure Payment</AlertTitle>
        <AlertDescription>
          {providerConfig.environment === "production"
            ? "Your payment information is processed securely by Square."
            : "This is a test environment. No real charges will be made."}
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="payment-amount" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Payment Amount
          </label>
          <div id="payment-amount" className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatAmount(payment.total_amount)}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="square-card-container" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Card Information
          </label>
          <div 
            id="square-card-container"
            ref={cardContainerRef}
            className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-3 text-sm shadow-sm transition-colors focus-within:outline-none focus-within:ring-1 focus-within:ring-ring"
          >
            {/* Square card element will be inserted here */}
          </div>
        </div>

        <Button
          onClick={handlePayment}
          disabled={isLoading || !card}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </>
          ) : (
            `Pay ${formatAmount(payment.total_amount)}`
          )}
        </Button>

        {providerConfig.environment !== "production" && (
          <Alert>
            <AlertTitle>Test Mode</AlertTitle>
            <AlertDescription>
              You can test payments with card number 4111 1111 1111 1111, any future expiry date, and any 3-digit CVC.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}