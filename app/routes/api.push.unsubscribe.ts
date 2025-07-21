import { json, type ActionFunctionArgs } from '@remix-run/node';
import { requireUserId } from '~/utils/auth.server';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const userId = await requireUserId(request);
    const { endpoint } = await request.json();

    if (!endpoint) {
      return json({ error: 'Endpoint is required' }, { status: 400 });
    }

    // TODO: Remove the subscription from your database
    console.log('Push unsubscription received:', {
      userId,
      endpoint
    });

    // In a real implementation, you would:
    // 1. Remove the subscription from your database
    // 2. Handle cases where the subscription doesn't exist
    // 3. Clean up any related data

    /*
    Example database operation:
    await db.pushSubscription.deleteMany({
      where: {
        endpoint,
        userId
      }
    });
    */

    return json({ success: true, message: 'Subscription removed successfully' });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    return json({ error: 'Failed to remove subscription' }, { status: 500 });
  }
}