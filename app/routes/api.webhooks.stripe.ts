import type { ActionFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";
import { getPaymentProvider } from '~/services/payments/index.server';
import { handlePaymentWebhook } from '~/services/payments/webhook.server';

export async function action({request}: ActionFunctionArgs) {
    const paymentProvider = getPaymentProvider();

    if (paymentProvider.id !== 'stripe') {
        console.error(`[Webhook] Received Stripe webhook but configured provider is '${paymentProvider.id}'.`);
        return json({error: "Payment provider mismatch."}, {status: 400});
    }

    const payload = await request.text();
    const result = await handlePaymentWebhook(paymentProvider, payload, request.headers, request.url);
    
    if (!result.success) {
        return json({ error: result.error || 'Webhook processing failed' }, { status: 400 });
    }

    return json({received: true}, {status: 200});
}
