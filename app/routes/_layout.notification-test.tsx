import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Bell, BellOff, TestTube, CheckCircle, XCircle } from 'lucide-react';
import { usePushNotifications } from '~/utils/push-notifications.client';
import { ClientOnly } from '~/components/client-only';

function NotificationTestContent() {
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { 
    isSupported, 
    permission, 
    isSubscribed, 
    subscribe, 
    unsubscribe,
    isLoading: pushLoading 
  } = usePushNotifications();

  const handleTestNotification = async () => {
    setIsLoading(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (result.success) {
        setTestResult(`✅ ${result.message}`);
      } else {
        setTestResult(`❌ ${result.message || 'Failed to send test notification'}`);
      }
    } catch (error) {
      setTestResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getPermissionBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Granted</Badge>;
      case 'denied':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Denied</Badge>;
      case 'default':
        return <Badge variant="secondary">Not Asked</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Push Notification Test Center</h1>
        <p className="text-muted-foreground">
          Test and debug the push notification system functionality.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              System Status
            </CardTitle>
            <CardDescription>
              Current state of push notification support and permissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Browser Support:</span>
              {isSupported ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="w-3 h-3 mr-1" />Supported
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="w-3 h-3 mr-1" />Not Supported
                </Badge>
              )}
            </div>
            
            <div className="flex justify-between items-center">
              <span>Permission Status:</span>
              {getPermissionBadge()}
            </div>
            
            <div className="flex justify-between items-center">
              <span>Subscription Status:</span>
              {isSubscribed ? (
                <Badge variant="default" className="bg-blue-500">
                  <Bell className="w-3 h-3 mr-1" />Subscribed
                </Badge>
              ) : (
                <Badge variant="outline">
                  <BellOff className="w-3 h-3 mr-1" />Not Subscribed
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="w-5 h-5" />
              Test Actions
            </CardTitle>
            <CardDescription>
              Perform various push notification tests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSupported && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ Push notifications are not supported in this browser.
                </p>
              </div>
            )}
            
            {isSupported && permission === 'denied' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  ❌ Notifications are blocked. Please enable them in your browser settings.
                </p>
              </div>
            )}
            
            {isSupported && !isSubscribed && permission !== 'denied' && (
              <Button 
                onClick={subscribe} 
                disabled={pushLoading}
                className="w-full"
              >
                {pushLoading ? 'Subscribing...' : 'Subscribe to Notifications'}
              </Button>
            )}
            
            {isSupported && isSubscribed && (
              <>
                <Button 
                  onClick={handleTestNotification} 
                  disabled={isLoading}
                  className="w-full"
                  variant="default"
                >
                  {isLoading ? 'Sending...' : 'Send Test Notification'}
                </Button>
                
                <Button 
                  onClick={unsubscribe} 
                  disabled={pushLoading}
                  className="w-full"
                  variant="outline"
                >
                  {pushLoading ? 'Unsubscribing...' : 'Unsubscribe'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Test Results */}
      {testResult && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Test Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
              {testResult}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">1. Check Browser Support</h4>
            <p className="text-sm text-muted-foreground">
              Ensure your browser supports push notifications. Modern Chrome, Firefox, Safari, and Edge all support them.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">2. Grant Permission</h4>
            <p className="text-sm text-muted-foreground">
              Click "Subscribe to Notifications" and allow notifications when prompted by your browser.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">3. Send Test Notification</h4>
            <p className="text-sm text-muted-foreground">
              Once subscribed, click "Send Test Notification" to test the complete flow.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">4. Check Developer Tools</h4>
            <p className="text-sm text-muted-foreground">
              Open browser DevTools (F12) → Application → Service Workers to see registration status.
              Check Console for any error messages.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NotificationTestPage() {
  return (
    <ClientOnly fallback={
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Push Notification Test Center</h1>
          <p className="text-muted-foreground">
            Loading notification test interface...
          </p>
        </div>
      </div>
    }>
      {() => <NotificationTestContent />}
    </ClientOnly>
  );
}