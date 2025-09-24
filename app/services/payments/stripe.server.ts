import Stripe from 'stripe';
import { 
  PaymentProvider, 
  PaymentIntent, 
  PaymentMethod, 
  PaymentProviderId,
  CreatePaymentIntentRequest,
  ConfirmPaymentRequest,
  RefundRequest,
  RefundResponse,
  Customer,
  CreateCustomerRequest,
  WebhookEvent,
  ParsedWebhookEvent,
  ClientRenderConfig,
  CSPDomains,
  RetrievePaymentIntentOptions
} from './types.server';
import { fromCents, toCents } from '~/utils/money';
import type { InvoicePaymentMethod } from '~/types/invoice';

export class StripePaymentProvider extends PaymentProvider {
  private stripe: Stripe;
  
  constructor() {
    super();
    
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  readonly providerId: PaymentProviderId = 'stripe';
  readonly displayName: string = 'Stripe';

  get id(): PaymentProviderId {
    return this.providerId;
  }

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: toCents(request.amount),
        currency: request.currency?.toLowerCase() || 'cad',
        metadata: request.metadata || {},
        description: request.description,
        // receipt_email: request.receipt_email, // Removed to disable Stripe receipts - using custom receipt system
        customer: request.customer_id,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        id: paymentIntent.id,
        amount: fromCents(paymentIntent.amount),
        currency: paymentIntent.currency.toUpperCase(),
        status: this.mapStripeStatus(paymentIntent.status),
        client_secret: paymentIntent.client_secret || undefined,
        metadata: paymentIntent.metadata,
        created_at: new Date(paymentIntent.created * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to create Stripe payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async retrievePaymentIntent(id: string, options?: RetrievePaymentIntentOptions): Promise<PaymentIntent> {
    try {
      const expand: Array<'latest_charge' | 'payment_method'> = [];
      if (options?.includeLatestCharge) expand.push('latest_charge');
      if (options?.includePaymentMethod) expand.push('payment_method');

      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        id,
        expand.length ? { expand } : undefined
      ) as Stripe.PaymentIntent;

      // Enriched fields if available
      let receiptUrl: string | undefined;
      let paymentMethodType: string | undefined;
      let cardLast4: string | undefined;

      const latestCharge = paymentIntent.latest_charge as Stripe.Charge | null;
      if (latestCharge && typeof latestCharge === 'object' && 'receipt_url' in latestCharge) {
        receiptUrl = latestCharge.receipt_url || undefined;
      }

      if (paymentIntent.payment_method && typeof paymentIntent.payment_method === 'object') {
        const pm = paymentIntent.payment_method as Stripe.PaymentMethod;
        paymentMethodType = pm.type;
        if (pm.card) cardLast4 = pm.card.last4 || undefined;
      }

      return {
        id: paymentIntent.id,
        amount: fromCents(paymentIntent.amount),
        currency: paymentIntent.currency.toUpperCase(),
        status: this.mapStripeStatus(paymentIntent.status),
        client_secret: paymentIntent.client_secret || undefined,
        metadata: paymentIntent.metadata,
        created_at: new Date(paymentIntent.created * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        receiptUrl,
        paymentMethodType,
        cardLast4,
      };
    } catch (error) {
      throw new Error(`Failed to retrieve Stripe payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async confirmPaymentIntent(request: ConfirmPaymentRequest): Promise<PaymentIntent> {
    try {
      const confirmParams: Stripe.PaymentIntentConfirmParams = {};
      
      if (request.payment_method_id) {
        confirmParams.payment_method = request.payment_method_id;
      }
      
      if (request.return_url) {
        confirmParams.return_url = request.return_url;
      }

      const paymentIntent = await this.stripe.paymentIntents.confirm(
        request.payment_intent_id,
        confirmParams
      );

      return {
        id: paymentIntent.id,
        amount: fromCents(paymentIntent.amount),
        currency: paymentIntent.currency.toUpperCase(),
        status: this.mapStripeStatus(paymentIntent.status),
        client_secret: paymentIntent.client_secret || undefined,
        metadata: paymentIntent.metadata,
        created_at: new Date(paymentIntent.created * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to confirm Stripe payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cancelPaymentIntent(id: string): Promise<PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(id);

      return {
        id: paymentIntent.id,
        amount: fromCents(paymentIntent.amount),
        currency: paymentIntent.currency.toUpperCase(),
        status: this.mapStripeStatus(paymentIntent.status),
        client_secret: paymentIntent.client_secret || undefined,
        metadata: paymentIntent.metadata,
        created_at: new Date(paymentIntent.created * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to cancel Stripe payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createRefund(request: RefundRequest): Promise<RefundResponse> {
    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: request.payment_intent_id,
      };

      if (request.amount) {
        refundParams.amount = toCents(request.amount);
      }

      if (request.reason) {
        refundParams.reason = request.reason as Stripe.RefundCreateParams.Reason;
      }

      if (request.metadata) {
        refundParams.metadata = request.metadata;
      }

      const refund = await this.stripe.refunds.create(refundParams);

      return {
        id: refund.id,
        amount: fromCents(refund.amount),
        status: refund.status === 'succeeded' ? 'succeeded' : refund.status === 'pending' ? 'pending' : 'failed',
        reason: refund.reason || undefined,
        created_at: new Date(refund.created * 1000).toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to create Stripe refund: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createCustomer(request: CreateCustomerRequest): Promise<Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email: request.email,
        name: request.name,
        phone: request.phone,
        metadata: request.metadata,
      });

      return {
        id: customer.id,
        email: customer.email || undefined,
        name: customer.name || undefined,
        phone: customer.phone || undefined,
        metadata: customer.metadata,
        created_at: new Date(customer.created * 1000).toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to create Stripe customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async retrieveCustomer(id: string): Promise<Customer> {
    try {
      const customer = await this.stripe.customers.retrieve(id);

      if (customer.deleted) {
        throw new Error('Customer has been deleted');
      }

      return {
        id: customer.id,
        email: customer.email || undefined,
        name: customer.name || undefined,
        phone: customer.phone || undefined,
        metadata: customer.metadata,
        created_at: new Date(customer.created * 1000).toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to retrieve Stripe customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateCustomer(id: string, updates: Partial<CreateCustomerRequest>): Promise<Customer> {
    try {
      const customer = await this.stripe.customers.update(id, {
        email: updates.email,
        name: updates.name,
        phone: updates.phone,
        metadata: updates.metadata,
      });

      return {
        id: customer.id,
        email: customer.email || undefined,
        name: customer.name || undefined,
        phone: customer.phone || undefined,
        metadata: customer.metadata,
        created_at: new Date(customer.created * 1000).toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to update Stripe customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteCustomer(id: string): Promise<void> {
    try {
      await this.stripe.customers.del(id);
    } catch (error) {
      throw new Error(`Failed to delete Stripe customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listPaymentMethods(customer_id: string): Promise<PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customer_id,
        type: 'card',
      });

      return paymentMethods.data.map(pm => ({
        id: pm.id,
        type: 'card' as InvoicePaymentMethod,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          exp_month: pm.card.exp_month,
          exp_year: pm.card.exp_year,
        } : undefined,
        billing_details: pm.billing_details ? {
          name: pm.billing_details.name || undefined,
          email: pm.billing_details.email || undefined,
          phone: pm.billing_details.phone || undefined,
          address: pm.billing_details.address ? {
            line1: pm.billing_details.address.line1 || undefined,
            line2: pm.billing_details.address.line2 || undefined,
            city: pm.billing_details.address.city || undefined,
            state: pm.billing_details.address.state || undefined,
            postal_code: pm.billing_details.address.postal_code || undefined,
            country: pm.billing_details.address.country || undefined,
          } : undefined,
        } : undefined,
      }));
    } catch (error) {
      throw new Error(`Failed to list Stripe payment methods: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async attachPaymentMethod(payment_method_id: string, customer_id: string): Promise<PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(payment_method_id, {
        customer: customer_id,
      });

      return {
        id: paymentMethod.id,
        type: 'card' as InvoicePaymentMethod,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          exp_month: paymentMethod.card.exp_month,
          exp_year: paymentMethod.card.exp_year,
        } : undefined,
        billing_details: paymentMethod.billing_details ? {
          name: paymentMethod.billing_details.name || undefined,
          email: paymentMethod.billing_details.email || undefined,
          phone: paymentMethod.billing_details.phone || undefined,
          address: paymentMethod.billing_details.address ? {
            line1: paymentMethod.billing_details.address.line1 || undefined,
            line2: paymentMethod.billing_details.address.line2 || undefined,
            city: paymentMethod.billing_details.address.city || undefined,
            state: paymentMethod.billing_details.address.state || undefined,
            postal_code: paymentMethod.billing_details.address.postal_code || undefined,
            country: paymentMethod.billing_details.address.country || undefined,
          } : undefined,
        } : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to attach Stripe payment method: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async detachPaymentMethod(payment_method_id: string): Promise<PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.detach(payment_method_id);

      return {
        id: paymentMethod.id,
        type: 'card' as InvoicePaymentMethod,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          exp_month: paymentMethod.card.exp_month,
          exp_year: paymentMethod.card.exp_year,
        } : undefined,
        billing_details: paymentMethod.billing_details ? {
          name: paymentMethod.billing_details.name || undefined,
          email: paymentMethod.billing_details.email || undefined,
          phone: paymentMethod.billing_details.phone || undefined,
          address: paymentMethod.billing_details.address ? {
            line1: paymentMethod.billing_details.address.line1 || undefined,
            line2: paymentMethod.billing_details.address.line2 || undefined,
            city: paymentMethod.billing_details.address.city || undefined,
            state: paymentMethod.billing_details.address.state || undefined,
            postal_code: paymentMethod.billing_details.address.postal_code || undefined,
            country: paymentMethod.billing_details.address.country || undefined,
          } : undefined,
        } : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to detach Stripe payment method: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async constructWebhookEvent(payload: string, signature: string, secret: string): Promise<WebhookEvent> {
    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, secret);
      
      return {
        id: event.id,
        type: event.type,
        data: {
          object: (event.data?.object as unknown as Record<string, unknown>) ?? {},
        },
        created: event.created,
        livemode: event.livemode,
      };
    } catch (error) {
      throw new Error(`Failed to construct Stripe webhook event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    // Implementation depends on specific webhook handling requirements
    // This is a placeholder that can be extended based on business logic
    console.log(`Handling Stripe webhook event: ${event.type}`);
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        // Handle successful payment
        break;
      case 'payment_intent.payment_failed':
        // Handle failed payment
        break;
      case 'customer.created':
        // Handle customer creation
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  isConfigured(): boolean {
    return !!process.env.STRIPE_SECRET_KEY && !!this.getPublishableKey();
  }

  getPublishableKey(): string | null {
    return process.env.STRIPE_PUBLISHABLE_KEY || null;
  }

  getClientConfig(): Record<string, unknown> {
    return { publishableKey: this.getPublishableKey() };
  }

  getClientRenderConfig(): ClientRenderConfig {
    return {
      provider: this.providerId,
      publishableKey: this.getPublishableKey(),
    };
  }

  getCSPDomains(): CSPDomains {
    return {
      connectSrc: ["https://api.stripe.com"],
      scriptSrc: ["https://js.stripe.com"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
      styleSrc: [], // Stripe doesn't need additional style domains
      fontSrc: [],  // Stripe doesn't need additional font domains
      imgSrc: [],   // Stripe doesn't need additional image domains
    };
  }

  requiresClientSecret(): boolean {
    return true;
  }

  requiresCheckoutUrl(): boolean {
    return false;
  }

  getDashboardUrl(paymentIntentId: string): string | null {
    if (!paymentIntentId) return null;
    const isProduction = process.env.NODE_ENV === 'production';
    const testPrefix = isProduction ? '' : 'test/';
    return `https://dashboard.stripe.com/${testPrefix}payments/${paymentIntentId}`;
  }

  async parseWebhookEvent(
    payload: string,
    headers: Headers,
    _requestUrl: string
  ): Promise<ParsedWebhookEvent> {
    const signature = headers.get('Stripe-Signature') || headers.get('stripe-signature') || '';
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('Missing STRIPE_WEBHOOK_SECRET environment variable');
    }
    
    const stripeEvent = await this.constructWebhookEvent(payload, signature, secret);
    const rawType = stripeEvent.type;
    const obj = stripeEvent.data?.object as Record<string, unknown>;
    
    const normalizedType = rawType === 'payment_intent.succeeded'
      ? 'payment.succeeded'
      : rawType === 'payment_intent.payment_failed'
        ? 'payment.failed'
        : rawType === 'payment_intent.processing'
          ? 'payment.processing'
          : rawType;
          
    return {
      type: normalizedType,
      rawType,
      intent: {
        id: obj?.id as string,
        metadata: (obj?.metadata ?? {}) as Record<string, string>,
        amount: typeof obj?.amount === 'number' ? obj.amount : undefined,
        paymentMethodType: Array.isArray(obj?.payment_method_types) 
          ? obj.payment_method_types[0] 
          : ((obj?.payment_method as Record<string, unknown>)?.type as string ?? null),
        cardLast4: ((obj?.payment_method as Record<string, unknown>)?.card as Record<string, unknown>)?.last4 as string ?? null,
        receiptUrl: null,
      },
    };
  }

  private mapStripeStatus(stripeStatus: string): PaymentIntent['status'] {
    switch (stripeStatus) {
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return 'pending';
      case 'processing':
        return 'processing';
      case 'succeeded':
        return 'succeeded';
      case 'canceled':
        return 'canceled';
      case 'requires_capture':
        return 'pending';
      default:
        return 'failed';
    }
  }
}
