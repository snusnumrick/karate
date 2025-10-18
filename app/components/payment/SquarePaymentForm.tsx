import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { isDarkThemeEnabled } from "~/utils/theme.client";
import { useNonce } from "~/context/nonce";
import { useFetcher } from "@remix-run/react";
import type { ClientRenderConfig } from '~/services/payments/types.server';
import { formatMoney, type Money } from "~/utils/money";
import * as Sentry from "@sentry/remix";

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
  subtotal_amount: Money;
  total_amount: Money;
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
  const nonce = useNonce();
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  useEffect(() => {
    if (!nonce || typeof document === 'undefined') {
      return;
    }

    const originalCreateElement = document.createElement;

    const patchedCreateElement = ((...args: Parameters<typeof document.createElement>) => {
      const element = originalCreateElement.apply(document, args);
      const [tagName] = args;
      if (typeof tagName === 'string' && tagName.toLowerCase() === 'style' && nonce) {
        if (!element.getAttribute('nonce')) {
          element.setAttribute('nonce', nonce);
        }
      }
      return element;
    }) as typeof document.createElement;

    document.createElement = patchedCreateElement;

    document
      .querySelectorAll('style')
      .forEach((styleNode) => {
        if (styleNode instanceof HTMLStyleElement && !styleNode.getAttribute('nonce')) {
          styleNode.setAttribute('nonce', nonce);
        }
      });

    return () => {
      document.createElement = originalCreateElement;
    };
  }, [nonce]);

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
        console.log('Browser info:', {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          vendor: navigator.vendor
        });

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
        console.error('Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          browser: navigator.userAgent
        });

        // Capture error in Sentry with detailed context
        Sentry.captureException(error, {
          tags: {
            component: 'SquarePaymentForm',
            error_type: 'sdk_load_failure',
            payment_provider: 'square',
            browser_platform: navigator.platform,
            is_ios: /iPhone|iPad|iPod/.test(navigator.userAgent).toString(),
          },
          contexts: {
            payment: {
              payment_id: payment.id,
              family_id: payment.family_id,
            },
            browser: {
              user_agent: navigator.userAgent,
              platform: navigator.platform,
              vendor: navigator.vendor,
              language: navigator.language,
            },
            config: {
              environment: providerConfig.environment,
              has_application_id: !!providerConfig.applicationId,
              has_location_id: !!providerConfig.locationId,
            }
          },
          level: 'error',
        });

        // Provide more helpful error message for iOS users
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const errorMsg = isIOS
          ? 'Unable to load payment system on this device. Please try: (1) Refreshing the page, (2) Clearing your browser cache, (3) Using Safari in regular mode (not Private Browsing), or (4) Try a different browser.'
          : 'Failed to load Square payment system. Please try refreshing the page or contact support if the issue persists.';

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
        const isDarkMode = isDarkThemeEnabled();
        
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
              borderColor: '#22c55e',
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
        
        if (nonce && typeof document !== 'undefined') {
          const recentStyles = Array.from(document.querySelectorAll('style')).slice(-3);
          recentStyles.forEach((style) => {
            if (!style.getAttribute('nonce') && style.textContent?.includes('.input-container')) {
              style.setAttribute('nonce', nonce);
            }
          });
        }
        console.log('Card element attached successfully');
        
        setCard(cardElement);
        console.log('Square Web Payments SDK initialized successfully');
      } catch (error) {
        console.error('Square initialization failed:', error);

        // Capture initialization errors in Sentry
        Sentry.captureException(error, {
          tags: {
            component: 'SquarePaymentForm',
            error_type: 'sdk_init_failure',
            payment_provider: 'square',
            browser_platform: navigator.platform,
            is_ios: /iPhone|iPad|iPod/.test(navigator.userAgent).toString(),
          },
          contexts: {
            payment: {
              payment_id: payment.id,
              family_id: payment.family_id,
            },
            browser: {
              user_agent: navigator.userAgent,
              platform: navigator.platform,
              vendor: navigator.vendor,
              language: navigator.language,
            },
            config: {
              environment: providerConfig.environment,
              has_application_id: !!providerConfig.applicationId,
              has_location_id: !!providerConfig.locationId,
            }
          },
          level: 'error',
        });

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

  const formatAmount = (amount: Money) => formatMoney(amount);

  const handleRetry = () => {
    if (retryCount < maxRetries) {
      console.log(`Retrying Square SDK load (attempt ${retryCount + 1}/${maxRetries})...`);
      setRetryCount(retryCount + 1);
      setSdkError(null);
      loadAttempted.current = false;
      initAttempted.current = false;
      Square = null;
    }
  };

  if (sdkError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Payment System Unavailable</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p>{sdkError}</p>
              {retryCount < maxRetries && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="mt-2"
                >
                  Retry Loading Payment Form
                </Button>
              )}
              {retryCount >= maxRetries && (
                <p className="text-sm mt-2">
                  If the problem persists, please contact support or try making a payment from a different device.
                </p>
              )}
            </div>
          </AlertDescription>
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
