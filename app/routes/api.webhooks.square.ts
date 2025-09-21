import type { ActionFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";
import { getPaymentProvider } from '~/services/payments/index.server';
import { handlePaymentWebhook } from '~/services/payments/webhook.server';

export async function action({ request }: ActionFunctionArgs) {
    console.log(`[Square Webhook] Received webhook request`);
    
    const paymentProvider = getPaymentProvider();

    if (paymentProvider.id !== 'square') {
        console.error(`[Square Webhook] Received Square webhook but configured provider is '${paymentProvider.id}'.`);
        return json({ error: "Payment provider mismatch." }, { status: 400 });
    }

    const payload = await request.text();
    console.log(`[Square Webhook] Processing payload:`, payload.substring(0, 200) + '...');
    
    const result = await handlePaymentWebhook(paymentProvider, payload, request.headers);
    
    if (!result.success) {
        console.error(`[Square Webhook] Processing failed:`, result.error);
        return json({ error: result.error || 'Webhook processing failed' }, { status: 400 });
    }

    console.log(`[Square Webhook] Successfully processed webhook`);
    return json({ received: true }, { status: 200 });
}