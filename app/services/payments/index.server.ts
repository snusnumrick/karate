import { siteConfig } from '~/config/site';
import type { PaymentProvider, PaymentProviderId } from './types.server';
import { StripePaymentProvider } from './stripe.server';
import { SquarePaymentProvider } from './square.server';

let cachedProvider: PaymentProvider | null = null;
let cachedProviderId: PaymentProviderId | null = null;

export function getPaymentProvider(): PaymentProvider {
  const providerId = siteConfig.payments?.provider ?? 'stripe';

  if (!cachedProvider || cachedProviderId !== providerId) {
    cachedProvider = instantiateProvider(providerId);
    cachedProviderId = providerId;
  }

  return cachedProvider;
}

function instantiateProvider(providerId: PaymentProviderId): PaymentProvider {
  switch (providerId) {
    case 'stripe':
      return new StripePaymentProvider();
    case 'square':
      return new SquarePaymentProvider();
    default:
      throw new Error(`Unsupported payment provider: ${providerId}`);
  }
}

export * from './types.server';
