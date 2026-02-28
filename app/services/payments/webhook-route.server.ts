import { json } from "@vercel/remix";
import { getPaymentProvider } from '~/services/payments/index.server';
import { handlePaymentWebhook } from '~/services/payments/webhook.server';

type RouteWebhookProvider = 'stripe' | 'square';

function getProviderLabel(provider: RouteWebhookProvider): 'Stripe' | 'Square' {
  return provider === 'stripe' ? 'Stripe' : 'Square';
}

function getSignatureLogContext(provider: RouteWebhookProvider, headers: Headers): {
  signature: string | null;
  signatureHeaderName: string;
} {
  if (provider === 'square') {
    const canonicalSignature = headers.get('x-square-hmacsha256-signature');
    const legacySignature = headers.get('x-square-signature');
    return {
      signature: canonicalSignature ?? legacySignature,
      signatureHeaderName: canonicalSignature
        ? 'x-square-hmacsha256-signature'
        : legacySignature
          ? 'x-square-signature'
          : 'missing',
    };
  }

  return {
    signature: headers.get('stripe-signature'),
    signatureHeaderName: 'stripe-signature',
  };
}

export async function handleWebhookLoader(provider: RouteWebhookProvider, request: Request) {
  const providerLabel = getProviderLabel(provider);
  console.warn(`[${providerLabel} Webhook] Received ${request.method} request. Only POST is supported.`);
  return json(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}

export async function handleWebhook(provider: RouteWebhookProvider, request: Request) {
  const providerLabel = getProviderLabel(provider);
  const url = new URL(request.url);
  const headers = request.headers;
  const method = request.method;
  const ipHeader = headers.get('x-real-ip')
    ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? headers.get('cf-connecting-ip')
    ?? 'unknown';
  const requestId = headers.get('x-vercel-id')
    ?? headers.get('x-request-id')
    ?? headers.get('traceparent');
  const contentType = headers.get('content-type');
  const userAgent = headers.get('user-agent');
  const { signature, signatureHeaderName } = getSignatureLogContext(provider, headers);

  const signatureLogContext = provider === 'square'
    ? `signatureHeader=${signatureHeaderName} signature=${signature ? `${signature.slice(0, 8)}...` : 'missing'}`
    : `signature=${signature ? `${signature.slice(0, 8)}...` : 'missing'}`;

  console.log(
    `[${providerLabel} Webhook] ${method} ${url.pathname} (reqId=${requestId ?? 'n/a'}) from ${ipHeader}. ` +
    `content-type=${contentType ?? 'n/a'} user-agent=${userAgent ?? 'n/a'} ${signatureLogContext}`,
  );

  if (method !== 'POST') {
    console.warn(`[${providerLabel} Webhook] Rejecting ${method} request. Only POST is supported.`);
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const paymentProvider = getPaymentProvider();

  if (paymentProvider.id !== provider) {
    console.error(`[${providerLabel} Webhook] Received ${providerLabel} webhook but configured provider is '${paymentProvider.id}'.`);
    return json({ error: "Payment provider mismatch." }, { status: 400 });
  }

  const payload = await request.text();
  const payloadPreview = payload.substring(0, 200);
  console.log(
    `[${providerLabel} Webhook] Payload length=${payload.length}. Preview=${payloadPreview}${payload.length > 200 ? '...' : ''}`,
  );

  const result = await handlePaymentWebhook(paymentProvider, payload, request.headers, request.url);

  if (result.isDuplicate) {
    console.log(`[${providerLabel} Webhook] Duplicate event acknowledged`);
    return json({ received: true, duplicate: true }, { status: 200 });
  }

  if (!result.success) {
    console.error(`[${providerLabel} Webhook] Processing failed:`, result.error);
    return json({ error: result.error || 'Webhook processing failed' }, { status: 400 });
  }

  console.log(`[${providerLabel} Webhook] Successfully processed webhook`);
  return json({ received: true }, { status: 200 });
}
