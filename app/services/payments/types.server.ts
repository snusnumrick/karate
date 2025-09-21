import type { Money } from '~/utils/money';
import type { InvoicePaymentMethod } from '~/types/invoice';

export type PaymentProviderId = 'stripe' | 'square' | 'mock';

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'canceled';

export interface PaymentIntent {
  id: string;
  amount: Money;
  currency: string;
  status: PaymentStatus;
  client_secret?: string;
  metadata?: Record<string, string>;
  created_at: string;
  updated_at: string;
  // Optional, provider-enriched fields
  receiptUrl?: string;
  paymentMethodType?: string;
  cardLast4?: string;
}

export interface PaymentMethod {
  id: string;
  type: InvoicePaymentMethod;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  billing_details?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
}

export interface CreatePaymentIntentRequest {
  amount: Money;
  currency?: string;
  payment_method_types?: string[];
  metadata?: Record<string, string>;
  description?: string;
  receipt_email?: string;
  customer_id?: string;
}

export interface ConfirmPaymentRequest {
  payment_intent_id: string;
  payment_method_id?: string;
  return_url?: string;
}

export interface RefundRequest {
  payment_intent_id: string;
  amount?: Money;
  reason?: string;
  metadata?: Record<string, string>;
}

export interface RefundResponse {
  id: string;
  amount: Money;
  status: 'pending' | 'succeeded' | 'failed';
  reason?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
  created_at: string;
}

export interface CreateCustomerRequest {
  email?: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
  created: number;
  livemode: boolean;
}

export interface ParsedWebhookEvent {
  type: string;
  rawType: string;
  intent: {
    id: string;
    metadata: Record<string, string>;
    amount?: number;
    paymentMethodType?: string | null;
    cardLast4?: string | null;
    receiptUrl?: string | null;
  };
}

export interface ClientRenderConfig {
  provider: PaymentProviderId;
  publishableKey: string | null;
  environment?: string;
  applicationId?: string;
  locationId?: string;
}

export interface CSPDomains {
  connectSrc: string[];
  scriptSrc: string[];
  frameSrc: string[];
  styleSrc?: string[];  // Add style domains
  fontSrc?: string[];   // Add font domains
  imgSrc?: string[];    // Add image domains
}

export interface RetrievePaymentIntentOptions {
  includeLatestCharge?: boolean;
  includePaymentMethod?: boolean;
}

export abstract class PaymentProvider {
  abstract readonly providerId: PaymentProviderId;
  abstract readonly displayName: string;

  get id(): PaymentProviderId {
    return this.providerId;
  }

  // Payment Intent operations
  abstract createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntent>;
  abstract retrievePaymentIntent(id: string, options?: RetrievePaymentIntentOptions): Promise<PaymentIntent>;
  abstract confirmPaymentIntent(request: ConfirmPaymentRequest): Promise<PaymentIntent>;
  abstract cancelPaymentIntent(id: string): Promise<PaymentIntent>;

  // Refund operations
  abstract createRefund(request: RefundRequest): Promise<RefundResponse>;

  // Customer operations
  abstract createCustomer(request: CreateCustomerRequest): Promise<Customer>;
  abstract retrieveCustomer(id: string): Promise<Customer>;
  abstract updateCustomer(id: string, updates: Partial<CreateCustomerRequest>): Promise<Customer>;
  abstract deleteCustomer(id: string): Promise<void>;

  // Payment Method operations
  abstract listPaymentMethods(customer_id: string): Promise<PaymentMethod[]>;
  abstract attachPaymentMethod(payment_method_id: string, customer_id: string): Promise<PaymentMethod>;
  abstract detachPaymentMethod(payment_method_id: string): Promise<PaymentMethod>;

  // Webhook operations
  abstract constructWebhookEvent(payload: string, signature: string, secret: string): Promise<WebhookEvent>;
  abstract parseWebhookEvent(payload: string, headers: Headers): Promise<ParsedWebhookEvent>;
  abstract handleWebhookEvent(event: WebhookEvent): Promise<void>;

  // Utility methods
  abstract isConfigured(): boolean;
  abstract getPublishableKey(): string | null;
  abstract getClientConfig(): Record<string, unknown>;
  abstract getClientRenderConfig(): ClientRenderConfig;
  abstract getCSPDomains(): CSPDomains;
  
  // Provider capabilities
  abstract requiresClientSecret(): boolean;
  abstract requiresCheckoutUrl(): boolean;
  
  // Dashboard utilities
  abstract getDashboardUrl(paymentIntentId: string): string | null;
}