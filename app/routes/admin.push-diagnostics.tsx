import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { Form, useActionData, useLoaderData } from '@remix-run/react';
import { requireUserId } from '~/utils/auth.server';
import { getSupabaseServerClient } from '~/utils/supabase.server';
import { 
  generateVAPIDKeys, 
  validateVAPIDConfiguration,
  clearAllPushSubscriptions 
} from '~/utils/push-notifications.server';

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  
  const { supabaseServer } = getSupabaseServerClient(request);
  
  // Get current VAPID configuration status
  const vapidConfig = validateVAPIDConfiguration();
  
  // Get push subscription count
  const { data: subscriptions, error } = await supabaseServer
    .from('push_subscriptions')
    .select('id, user_id, endpoint, created_at')
    .order('created_at', { ascending: false });
  
  return json({
    vapidConfig,
    subscriptionCount: subscriptions?.length || 0,
    subscriptions: subscriptions || [],
    error: error?.message
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  
  const formData = await request.formData();
  const action = formData.get('action');
  
  const { supabaseServer } = getSupabaseServerClient(request);
  
  switch (action) {
    case 'generate-vapid-keys': {
      try {
        const newKeys = generateVAPIDKeys();
        return json({
          success: true,
          message: 'New VAPID keys generated. Update your .env file with these keys:',
          data: {
            publicKey: newKeys.publicKey,
            privateKey: newKeys.privateKey,
            subject: process.env.VAPID_SUBJECT || 'mailto:your-email@example.com'
          }
        } as const);
      } catch (error) {
        return json({
          success: false,
          message: 'Failed to generate VAPID keys',
          error: error instanceof Error ? error.message : 'Unknown error'
        } as const);
      }
    }
    
    case 'clear-subscriptions': {
      try {
        const result = await clearAllPushSubscriptions(supabaseServer);
        if (result.success) {
          return json({
            success: true,
            message: `Successfully cleared ${result.clearedCount} push subscriptions. Users will need to re-subscribe.`
          } as const);
        } else {
          return json({
            success: false,
            message: 'Failed to clear push subscriptions',
            error: result.error
          } as const);
        }
      } catch (error) {
        return json({
          success: false,
          message: 'Failed to clear push subscriptions',
          error: error instanceof Error ? error.message : 'Unknown error'
        } as const);
      }
    }
    
    default:
      return json({
        success: false,
        message: 'Invalid action'
      } as const);
  }
}

export default function PushDiagnostics() {
  const { vapidConfig, subscriptionCount, subscriptions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Push Notification Diagnostics</h1>
      
      {/* VAPID Configuration Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">VAPID Configuration Status</h2>
        
        {vapidConfig.isValid ? (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            <p className="font-semibold">✅ VAPID configuration is valid</p>
            <p className="text-sm mt-2">Public Key: {vapidConfig.publicKey?.substring(0, 20)}...</p>
            <p className="text-sm">Subject: {vapidConfig.subject}</p>
          </div>
        ) : (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="font-semibold">❌ VAPID configuration has issues:</p>
            <ul className="list-disc list-inside mt-2">
              {vapidConfig.issues.map((issue, index) => (
                <li key={index} className="text-sm">{issue}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Push Subscriptions Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Push Subscriptions</h2>
        <p className="text-gray-600 mb-4">
          Current active subscriptions: <span className="font-semibold">{subscriptionCount}</span>
        </p>
        
        {subscriptions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-gray-900">User ID</th>
                  <th className="px-4 py-2 text-left text-gray-900">Endpoint</th>
                  <th className="px-4 py-2 text-left text-gray-900">Created</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.slice(0, 10).map((sub) => (
                  <tr key={sub.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">{sub.user_id.substring(0, 8)}...</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{sub.endpoint.substring(0, 50)}...</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{sub.created_at ? new Date(sub.created_at).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {subscriptions.length > 10 && (
              <p className="text-sm text-gray-500 mt-2">Showing first 10 of {subscriptions.length} subscriptions</p>
            )}
          </div>
        )}
      </div>

      {/* Action Results */}
      {actionData && (
        <div className={`rounded-lg p-4 mb-6 ${
          actionData.success 
            ? 'bg-green-100 border border-green-400 text-green-700' 
            : 'bg-red-100 border border-red-400 text-red-700'
        }`}>
          <p className="font-semibold">{actionData.message}</p>
          {'error' in actionData && actionData.error && (
            <p className="text-sm mt-2">Error: {actionData.error}</p>
          )}
          {'data' in actionData && actionData.data && (
            <div className="mt-4 bg-gray-800 text-green-400 p-4 rounded font-mono text-sm">
              <p>VAPID_PUBLIC_KEY={actionData.data.publicKey}</p>
              <p>VAPID_PRIVATE_KEY={actionData.data.privateKey}</p>
              <p>VAPID_SUBJECT={actionData.data.subject}</p>
            </div>
          )}
        </div>
      )}

      {/* Diagnostic Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Diagnostic Actions</h2>
        
        <div className="space-y-4">
          {/* Generate New VAPID Keys */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Generate New VAPID Keys</h3>
            <p className="text-gray-600 text-sm mb-3">
              Generate new VAPID keys if you suspect the current ones are compromised or causing issues.
              <strong className="text-red-600"> Warning: This will require all users to re-subscribe to push notifications.</strong>
            </p>
            <Form method="post">
              <input type="hidden" name="action" value="generate-vapid-keys" />
              <button 
                type="submit" 
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Generate New VAPID Keys
              </button>
            </Form>
          </div>

          {/* Clear All Subscriptions */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Clear All Push Subscriptions</h3>
            <p className="text-gray-600 text-sm mb-3">
              Remove all push subscriptions from the database. Use this when VAPID keys have been changed
              or when you need to force all users to re-subscribe.
              <strong className="text-red-600"> Warning: This action cannot be undone.</strong>
            </p>
            <Form method="post">
              <input type="hidden" name="action" value="clear-subscriptions" />
              <button 
                type="submit" 
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                onClick={(e) => {
                  if (!confirm('Are you sure you want to clear all push subscriptions? This cannot be undone.')) {
                    e.preventDefault();
                  }
                }}
              >
                Clear All Subscriptions
              </button>
            </Form>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">How to Fix VAPID Credential Mismatch</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>If you&apos;re seeing VAPID credential mismatch errors, generate new VAPID keys using the button above.</li>
          <li>Update your <code className="bg-gray-200 px-1 rounded">.env</code> file with the new keys.</li>
          <li>Restart your application to load the new environment variables.</li>
          <li>Clear all existing push subscriptions using the button above.</li>
          <li>Ask users to visit their notification settings and re-enable push notifications.</li>
        </ol>
      </div>
    </div>
  );
}