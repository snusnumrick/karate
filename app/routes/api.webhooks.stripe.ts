import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { handleWebhook, handleWebhookLoader } from '~/services/payments/webhook-route.server';

export async function loader({ request }: LoaderFunctionArgs) {
    return handleWebhookLoader('stripe', request);
}

export async function action({ request }: ActionFunctionArgs) {
    return handleWebhook('stripe', request);
}
