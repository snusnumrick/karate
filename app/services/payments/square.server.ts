import { 
  PaymentProvider, 
  PaymentIntent, 
  PaymentMethod, 
  PaymentProviderId,
  PaymentStatus,
  CreatePaymentIntentRequest,
  ConfirmPaymentRequest,
  RefundRequest,
  RefundResponse,
  Customer,
  CreateCustomerRequest,
  WebhookEvent,
  ParsedWebhookEvent,
  ClientRenderConfig,
  CSPDomains
} from './types.server';
import { fromCents, toCents } from '~/utils/money';
import type { InvoicePaymentMethod } from '~/types/invoice';
import { SquareClient, SquareEnvironment } from 'square';
import type * as SquareSdk from 'square';
import { siteConfig } from '~/config/site';

export class SquarePaymentProvider extends PaymentProvider {
  private applicationId: string;
  private locationId: string;
  private environment: string;
  private squareClient: SquareClient;
  private accessToken: string;
  private defaultCurrency: string;
  
  constructor() {
    super();
    
    const applicationId = process.env.SQUARE_APPLICATION_ID;
    const locationId = process.env.SQUARE_LOCATION_ID;
    const environment = process.env.SQUARE_ENVIRONMENT || 'sandbox';
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    
    // Validate required environment variables
    if (!applicationId) {
      throw new Error('SQUARE_APPLICATION_ID environment variable is required. Get this from your Square Developer Dashboard.');
    }
    
    if (!locationId) {
      throw new Error('SQUARE_LOCATION_ID environment variable is required. Get this from your Square Developer Dashboard.');
    }
    
    if (!accessToken) {
      throw new Error('SQUARE_ACCESS_TOKEN environment variable is required. Generate this in your Square Developer Dashboard.');
    }
    
    // Validate environment setting
    if (!['sandbox', 'production'].includes(environment)) {
      throw new Error('SQUARE_ENVIRONMENT must be either "sandbox" or "production"');
    }
    
    // Validate application ID format
    if (environment === 'production' && !applicationId.startsWith('sq0idp-')) {
      throw new Error('Production SQUARE_APPLICATION_ID must start with "sq0idp-"');
    }
    
    if (environment === 'sandbox' && !applicationId.startsWith('sandbox-')) {
      throw new Error('Sandbox SQUARE_APPLICATION_ID must start with "sandbox-"');
    }
    
    this.applicationId = applicationId;
    this.locationId = locationId;
    this.environment = environment;
    this.accessToken = accessToken;
    this.defaultCurrency = siteConfig.localization.currency; // Use currency from site configuration
    
    // Initialize Square client
    this.squareClient = new SquareClient({
      token: this.accessToken,
      environment: environment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
    });
  }

  readonly providerId: PaymentProviderId = 'square';
  readonly displayName: string = 'Square';

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntent> {
    try {
      // Generate unique reference ID for tracking
      const referenceId = `karate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // For Square Web Payments SDK, we don't create a payment yet
      // Instead, we create a pending payment record that will be processed
      // when the client confirms with a payment token
      
      return {
        id: referenceId,
        amount: request.amount,
        currency: request.currency || this.defaultCurrency,
        status: 'pending',
        client_secret: referenceId, // Used by client to reference this payment
        metadata: request.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
    } catch (error) {
      console.error('Square payment intent creation failed:', error);
      throw new Error(`Failed to create Square payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async retrievePaymentIntent(id: string, options?: { includePaymentMethod?: boolean; includeLatestCharge?: boolean }): Promise<PaymentIntent> {
    try {
      // For Square Web Payments SDK, distinguish between reference IDs and actual payment IDs
      // Reference IDs start with "karate_" and don't exist in Square until payment is confirmed
      if (id.startsWith('karate_')) {
        // This is a reference ID from createPaymentIntent, not an actual Square payment
        // Return pending status without trying to query Square
        return {
          id,
          amount: fromCents(0),
          currency: this.defaultCurrency,
          status: 'pending',
          client_secret: id,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      
      // This should be an actual Square payment ID, try to retrieve it
      try {
        const result = await this.squareClient.payments.get({ paymentId: id });
        
        if (result && result.payment) {
          const payment = result.payment;
          let receiptUrl: string | undefined;
          let paymentMethodType: string | undefined;
          let cardLast4: string | undefined;

          // Extract payment method details if needed
          if (options?.includePaymentMethod) {
            paymentMethodType = payment.sourceType || 'card';
            
            if (payment.cardDetails?.card) {
              cardLast4 = payment.cardDetails.card.last4;
            }
          }

          if (options?.includeLatestCharge) {
            receiptUrl = payment.receiptUrl;
          }

          return {
            id: payment.id || id,
            amount: fromCents(Number(payment.amountMoney?.amount || 0)),
            currency: payment.amountMoney?.currency || this.defaultCurrency,
            status: this.mapSquareStatusToPaymentStatus(payment.status || 'PENDING'),
            client_secret: id,
            metadata: {
              receiptUrl: receiptUrl || '',
              paymentMethodType: paymentMethodType || '',
              cardLast4: cardLast4 || '',
            },
            created_at: payment.createdAt || new Date().toISOString(),
            updated_at: payment.updatedAt || new Date().toISOString(),
          };
        }
      } catch (paymentError) {
        console.warn(`Square payment ${id} not found:`, paymentError);
      }

      // Payment not found in Square, return pending status
      return {
        id,
        amount: fromCents(0),
        currency: this.defaultCurrency,
        status: 'pending',
        client_secret: id,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
    } catch (error) {
      console.error('Failed to retrieve Square payment intent:', error);
      return {
        id,
        amount: fromCents(0),
        currency: this.defaultCurrency,
        status: 'pending',
        client_secret: '',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  }

  async confirmPaymentIntent(request: ConfirmPaymentRequest): Promise<PaymentIntent> {
    try {
      // Validate input
      if (!request.payment_method_id) {
        throw new Error('Payment method ID (token) is required');
      }
      
      if (!request.payment_intent_id) {
        throw new Error('Payment intent ID is required');
      }
      
      console.log(`[Square] Confirming payment intent: ${request.payment_intent_id}`);
      
      // request.payment_method_id contains the token from Square Web Payments SDK
      // We need to get the amount from the original payment intent (stored in database)
      
      // Retrieve the actual payment amount from the database
      const { getSupabaseAdminClient } = await import('~/utils/supabase.server');
      const supabaseAdmin = getSupabaseAdminClient();
      
      const { data: paymentData, error: dbError } = await supabaseAdmin
        .from('payments')
        .select('total_amount')
        .eq('payment_intent_id', request.payment_intent_id)
        .single();
      
      if (dbError || !paymentData) {
        console.error(`[Square] Failed to retrieve payment amount for intent ${request.payment_intent_id}:`, dbError?.message);
        throw new Error('Failed to retrieve payment amount from database');
      }
      
      // For payments table, total_amount is stored in cents (INT4)
      const amountInCents = paymentData.total_amount;
      
      console.log(`[Square] Processing payment with token: ${request.payment_method_id?.substring(0, 10)}...`);
      console.log(`[Square] Using credentials - Location: ${this.locationId}, Environment: ${this.environment}`);
      
      const amountMoney: SquareSdk.Square.Money = {
        amount: BigInt(amountInCents),
        currency: this.defaultCurrency as SquareSdk.Square.Currency
      };

      const paymentRequest: SquareSdk.Square.CreatePaymentRequest = {
        idempotencyKey: `confirm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sourceId: request.payment_method_id,
        amountMoney,
        locationId: this.locationId,
        referenceId: request.payment_intent_id
      };

      const result = await this.squareClient.payments.create(paymentRequest);

      const payment = result.payment;
      if (!payment) {
        throw new Error('Payment creation failed');
      }

      console.log(`[Square] Payment creation response:`, {
        id: payment.id,
        status: payment.status,
        mappedStatus: this.mapSquareStatusToPaymentStatus(payment.status || 'PENDING')
      });

      return {
        id: payment.id || request.payment_intent_id,
        amount: fromCents(Number(payment.amountMoney?.amount || 0)),
        currency: payment.amountMoney?.currency || this.defaultCurrency,
        status: this.mapSquareStatusToPaymentStatus(payment.status || 'PENDING'),
        client_secret: request.payment_intent_id,
        metadata: {},
        created_at: payment.createdAt || new Date().toISOString(),
        updated_at: payment.updatedAt || new Date().toISOString(),
      };
    } catch (error) {
      // Enhanced error logging for production debugging
      console.error(`[Square] Payment confirmation failed for intent ${request.payment_intent_id}:`, {
        error: error instanceof Error ? error.message : String(error),
        paymentIntentId: request.payment_intent_id,
        hasPaymentMethodId: !!request.payment_method_id,
        environment: this.environment,
        timestamp: new Date().toISOString()
      });
      
      // Log Square-specific errors if available
      if (error && typeof error === 'object' && 'errors' in error) {
        console.error('[Square] API Errors:', error.errors);
      }
      
      // In production, you might want to send this to monitoring service
      if (this.environment === 'production') {
        // Example: sendToMonitoring(error, { context: 'square_payment_confirmation' });
      }
      
      return {
        id: request.payment_intent_id,
        amount: fromCents(0),
        currency: this.defaultCurrency,
        status: 'failed',
        client_secret: request.payment_intent_id,
        metadata: {
          error: error instanceof Error ? error.message : 'Payment processing failed',
          failedAt: new Date().toISOString()
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  }

  async cancelPaymentIntent(id: string): Promise<PaymentIntent> {
    try {
      // Try to cancel the payment if it exists and is cancelable
      const result = await this.squareClient.payments.cancel({ 
        paymentId: id
      });
      
      if (result && result.payment) {
        return {
          id: result.payment.id || id,
          amount: fromCents(Number(result.payment.amountMoney?.amount || 0)),
          currency: result.payment.amountMoney?.currency || 'CAD',
          status: 'cancelled',
          client_secret: id,
          metadata: {},
          created_at: result.payment.createdAt || new Date().toISOString(),
          updated_at: result.payment.updatedAt || new Date().toISOString(),
        };
      }
    } catch (error) {
      console.warn('Could not cancel Square payment:', error);
    }

    // Return cancelled status even if API call failed
    return {
      id,
      amount: fromCents(0),
      currency: this.defaultCurrency,
      status: 'cancelled',
      client_secret: id,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async createRefund(request: RefundRequest): Promise<RefundResponse> {
    try {
      const amountToRefund = request.amount ? toCents(request.amount) : undefined;
      
      const refundAmount: SquareSdk.Square.Money = {
        amount: BigInt(amountToRefund ?? 0),
        currency: this.defaultCurrency as SquareSdk.Square.Currency
      };

      const refundRequest: SquareSdk.Square.RefundPaymentRequest = {
        idempotencyKey: `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        paymentId: request.payment_intent_id,
        amountMoney: refundAmount,
        reason: request.reason || 'Refund requested'
      };

      const result = await this.squareClient.refunds.refundPayment(refundRequest);

      const refund = result.refund;
      if (!refund) {
        throw new Error('Refund creation failed');
      }

      return {
        id: refund.id || 'unknown',
        amount: fromCents(Number(refund.amountMoney?.amount || 0)),
        status: refund.status?.toLowerCase() === 'completed' ? 'succeeded' : 'pending',
        reason: refund.reason || undefined,
        created_at: refund.createdAt || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Square refund creation failed:', error);
      return {
        id: `failed_refund_${Date.now()}`,
        amount: request.amount || fromCents(0),
        status: 'failed',
        reason: request.reason,
        created_at: new Date().toISOString(),
      };
    }
  }

  async createCustomer(request: CreateCustomerRequest): Promise<Customer> {
    // Square customer creation would be handled through their API
    const customerId = `square_cus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: customerId,
      email: request.email,
      name: request.name,
      phone: request.phone,
      metadata: request.metadata || {},
      created_at: new Date().toISOString(),
    };
  }

  async retrieveCustomer(id: string): Promise<Customer> {
    // Would retrieve from Square API or database
    return {
      id,
      email: undefined,
      name: undefined,
      phone: undefined,
      metadata: {},
      created_at: new Date().toISOString(),
    };
  }

  async updateCustomer(id: string, updates: Partial<CreateCustomerRequest>): Promise<Customer> {
    // Would update through Square API
    return {
      id,
      email: updates.email,
      name: updates.name,
      phone: updates.phone,
      metadata: updates.metadata || {},
      created_at: new Date().toISOString(),
    };
  }

  async deleteCustomer(id: string): Promise<void> {
    // Would delete through Square API
    console.log(`Deleting Square customer: ${id}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listPaymentMethods(_customerId: string): Promise<PaymentMethod[]> {
    // Square payment methods would be retrieved from their API
    // This is a placeholder implementation
    return [];
  }

  private mapSquareStatusToPaymentStatus(squareStatus: string): PaymentStatus {
    // Map Square payment statuses to our internal PaymentStatus enum
    switch (squareStatus?.toLowerCase()) {
      case 'approved':
      case 'completed':
        return 'succeeded';
      case 'pending':
        return 'processing';
      case 'failed':
      case 'canceled':
        return 'failed';
      case 'refunded':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async attachPaymentMethod(payment_method_id: string, _customer_id: string): Promise<PaymentMethod> {
    // Square payment method attachment
    // This would need to be implemented based on your specific requirements
    throw new Error('Not implemented');
  }

  async detachPaymentMethod(payment_method_id: string): Promise<PaymentMethod> {
    // Square payment method detachment
    return {
      id: payment_method_id,
      type: 'credit_card' as InvoicePaymentMethod,
      card: {
        brand: 'unknown',
        last4: '0000',
        exp_month: 12,
        exp_year: 2025,
      },
      billing_details: undefined,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async constructWebhookEvent(payload: string, _signature: string, _secret: string): Promise<WebhookEvent> {
    try {
      const event = JSON.parse(payload);
      return {
        id: event.event_id || 'unknown',
        type: this.mapSquareEventType(event.type || 'unknown'),
        data: {
          object: event.data || {},
        },
        created: event.created_at ? new Date(event.created_at).getTime() / 1000 : Date.now() / 1000,
        livemode: this.environment === 'production',
      };
    } catch (error) {
      throw new Error(`Failed to construct webhook event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    // Implementation depends on specific webhook handling requirements
    // This is a placeholder that can be extended based on business logic
    console.log(`Handling Square webhook event: ${event.type}`);
    
    switch (event.type) {
      case 'payment.updated':
        // Handle payment updates
        break;
      case 'refund.updated':
        // Handle refund updates
        break;
      case 'customer.created':
        // Handle customer creation
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  isConfigured(): boolean {
    return !!(
      process.env.SQUARE_APPLICATION_ID &&
      process.env.SQUARE_LOCATION_ID &&
      process.env.SQUARE_ACCESS_TOKEN
    );
  }

  getPublishableKey(): string | null {
    return this.applicationId;
  }

  getEnvironment(): string {
    return this.environment;
  }

  // Additional Square-specific methods that might be needed
  getLocationId(): string {
    return this.locationId;
  }

  // Provide configuration for client usage
  getClientConfig(): Record<string, unknown> {
    return {
      applicationId: this.getPublishableKey(),
      locationId: this.getLocationId(),
      environment: this.getEnvironment(),
    };
  }

  getClientRenderConfig(): ClientRenderConfig {
    return {
      provider: this.providerId,
      publishableKey: this.getPublishableKey(),
      environment: this.getEnvironment(),
      applicationId: this.applicationId,
      locationId: this.locationId,
    };
  }

  getCSPDomains(): CSPDomains {
    return {
      connectSrc: [
        "https://connect.squareup.com", 
        "https://web.squarecdn.com",
        "https://sandbox.web.squarecdn.com",
        "https://production.web.squarecdn.com",
        "https://pci-connect.squareupsandbox.com", // Sandbox PCI endpoint
        "https://pci-connect.squareup.com"          // Production PCI endpoint
      ],
      scriptSrc: [
        "https://js.squareup.com", 
        "https://web.squarecdn.com",
        "https://sandbox.web.squarecdn.com",
        "https://production.web.squarecdn.com"
      ],
      frameSrc: [
        "https://js.squareup.com",
        "https://web.squarecdn.com", 
        "https://sandbox.web.squarecdn.com",
        "https://production.web.squarecdn.com"
      ],
      styleSrc: [
        "https://web.squarecdn.com",
        "https://sandbox.web.squarecdn.com", 
        "https://production.web.squarecdn.com"
      ],
      fontSrc: [
        "https://square-fonts-production-f.squarecdn.com",
        "https://fonts.squarecdn.com",
        "https://d1g145x70srn7h.cloudfront.net" // Square CloudFront font CDN
      ],
      imgSrc: [
        "https://web.squarecdn.com",
        "https://sandbox.web.squarecdn.com",
        "https://production.web.squarecdn.com"
      ],
    };
  }

  requiresClientSecret(): boolean {
    return false;
  }

  requiresCheckoutUrl(): boolean {
    return true;
  }

  getDashboardUrl(paymentIntentId: string): string | null {
    if (!paymentIntentId) return null;
    const isProduction = process.env.NODE_ENV === 'production';
    const environment = isProduction ? 'production' : 'sandbox';
    return `https://squareup.com/${environment}/dashboard/payments/transactions/${paymentIntentId}`;
  }

  // Method to parse webhook events (used by the existing webhook handler)
  async parseWebhookEvent(payload: string, headers: Headers): Promise<ParsedWebhookEvent> {
    try {
      // Verify Square webhook signature
      const signature = headers.get('X-Square-Signature');
      if (!signature) {
        throw new Error('Missing Square webhook signature');
      }

      const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
      if (!webhookSignatureKey) {
        throw new Error('SQUARE_WEBHOOK_SIGNATURE_KEY environment variable not configured');
      }

      // Square uses HMAC-SHA256 for webhook signature verification
      const crypto = await import('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', webhookSignatureKey)
        .update(payload, 'utf8')
        .digest('base64');

      if (signature !== expectedSignature) {
        throw new Error('Invalid Square webhook signature');
      }

      const event = JSON.parse(payload);
      
      if (!event.type || !event.data) {
        throw new Error('Invalid Square webhook payload structure');
      }
      
      const rawType = event.type;
      let normalizedType = this.mapSquareEventType(rawType);
      
      // Extract relevant data based on event type
      let intentId: string;
      const metadata: Record<string, string> = {};
      let receiptUrl: string | undefined;
      let paymentMethodType: string | undefined;
      let cardLast4: string | undefined;
      
      if (rawType.startsWith('payment.')) {
        // Payment events - data.object contains the Payment object
        const payment = event.data.object;
        intentId = payment.id;
        
        // Determine actual payment status for Square
        if (rawType === 'payment.updated' && payment.status) {
          if (payment.status === 'COMPLETED') {
            normalizedType = 'payment.succeeded';
          } else if (['FAILED', 'CANCELED'].includes(payment.status)) {
            normalizedType = 'payment.failed';
          }
        }
        
        // Extract payment method details
        if (payment.source_type) {
          paymentMethodType = payment.source_type.toLowerCase();
        }
        
        if (payment.card_details?.card) {
          cardLast4 = payment.card_details.card.last_4;
        }
        
        // Extract receipt URL if available
        receiptUrl = payment.receipt_url;
        
        // Extract order reference and metadata
        if (payment.order_id) {
          metadata.orderId = payment.order_id;
        }
        
        if (payment.reference_id) {
          metadata.referenceId = payment.reference_id;
        }
        
      } else if (rawType.startsWith('order.')) {
        // Order events - data.object contains the Order object
        const order = event.data.object;
        intentId = order.id;
        
        // Determine actual order/payment status for Square
        if (rawType === 'order.updated' && order.state) {
          if (order.state === 'COMPLETED') {
            normalizedType = 'payment.succeeded';
          } else if (['CANCELED'].includes(order.state)) {
            normalizedType = 'payment.failed';
          }
        }
        
        if (order.reference_id) {
          metadata.referenceId = order.reference_id;
        }
        
        // For orders, we might want to extract payment info from tenders
        if (order.tenders && order.tenders.length > 0) {
          const tender = order.tenders[0];
          if (tender.card_details?.card) {
            cardLast4 = tender.card_details.card.last_4;
          }
          paymentMethodType = tender.type?.toLowerCase();
          
          // Use payment ID as intent ID if available
          if (tender.payment_id) {
            intentId = tender.payment_id;
          }
        }
        
      } else {
        // Generic fallback
        intentId = event.data.object?.id || event.event_id || 'unknown';
      }
      
      return {
        type: normalizedType,
        rawType,
        intent: {
          id: intentId,
          metadata,
          receiptUrl,
          paymentMethodType,
          cardLast4,
        },
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse Square webhook event: ${errorMessage}`);
    }
  }

  private mapSquareEventType(squareEventType: string): string {
    // Map Square event types to standardized types
    switch (squareEventType) {
      case 'payment.created':
        return 'payment.created';
      case 'payment.updated':
        // Square payment.updated events need to be checked for status to determine if succeeded/failed
        // This will be handled in the webhook processing logic
        return 'payment.processing';
      case 'order.created':
        return 'payment.created';
      case 'order.updated':
        // Order completion indicates payment success
        return 'payment.processing';
      case 'order.fulfilled':
        return 'payment.succeeded';
      case 'refund.created':
        return 'refund.created';
      case 'refund.updated':
        return 'refund.updated';
      default:
        return squareEventType;
    }
  }
}
