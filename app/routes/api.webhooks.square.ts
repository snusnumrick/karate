import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";
import { getPaymentProvider } from '~/services/payments/index.server';
import { handlePaymentWebhook } from '~/services/payments/webhook.server';

export async function loader({ request }: LoaderFunctionArgs) {
    console.warn(`[Square Webhook] Received ${request.method} request. Only POST is supported.`);
    return json(
        { error: 'Method not allowed' },
        { status: 405, headers: { Allow: 'POST' } }
    );
}

export async function action({ request }: ActionFunctionArgs) {
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
    const signatureHeader = headers.get('x-square-signature');
    const contentType = headers.get('content-type');
    const userAgent = headers.get('user-agent');

    console.log(
        `[Square Webhook] ${method} ${url.pathname} (reqId=${requestId ?? 'n/a'}) from ${ipHeader}. ` +
        `content-type=${contentType ?? 'n/a'} user-agent=${userAgent ?? 'n/a'} ` +
        `signature=${signatureHeader ? `${signatureHeader.slice(0, 8)}...` : 'missing'}`
    );

    if (method !== 'POST') {
        console.warn(`[Square Webhook] Rejecting ${method} request. Only POST is supported.`);
        return json({ error: 'Method not allowed' }, { status: 405 });
    }

    const paymentProvider = getPaymentProvider();

    if (paymentProvider.id !== 'square') {
        console.error(`[Square Webhook] Received Square webhook but configured provider is '${paymentProvider.id}'.`);
        return json({ error: "Payment provider mismatch." }, { status: 400 });
    }

    const payload = await request.text();
    const payloadPreview = payload.substring(0, 200);
    console.log(
        `[Square Webhook] Payload length=${payload.length}. Preview=${payloadPreview}${payload.length > 200 ? '...' : ''}`
    );
    
    const result = await handlePaymentWebhook(paymentProvider, payload, request.headers, request.url);
    
    if (!result.success) {
        console.error(`[Square Webhook] Processing failed:`, result.error);
        return json({ error: result.error || 'Webhook processing failed' }, { status: 400 });
    }

    console.log(`[Square Webhook] Successfully processed webhook`);
    return json({ received: true }, { status: 200 });
}
