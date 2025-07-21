import { useState, useEffect } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Switch } from '~/components/ui/switch';
import { Label } from '~/components/ui/label';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Bell, BellOff, Settings, AlertCircle, CheckCircle, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { ClientOnly } from '~/components/client-only';

interface NotificationSettingsProps {
  className?: string;
}

function NotificationSettingsContent({ className }: NotificationSettingsProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [userEnabled, setUserEnabled] = useState(true);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    const supported = 'Notification' in window;
    const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    
    setIsSupported(supported);
    setIsPushSupported(pushSupported);
    
    if (supported) {
      setPermission(Notification.permission);
      
      // Get user preference from localStorage
      const preference = localStorage.getItem('notifications-enabled');
      setUserEnabled(preference !== 'false');
    }

    // Check push subscription status
    if (pushSupported) {
      checkPushSubscription();
    }
  }, []);

  const checkPushSubscription = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setPushSubscribed(subscription !== null);
      }
    } catch (error) {
      console.error('Error checking push subscription:', error);
    }
  };

  const handleRequestPermission = async () => {
    if (!isSupported) return;
    
    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        // Show a test notification
        new Notification('Notifications Enabled!', {
          body: 'You will now receive notifications for new messages.',
          icon: '/icon.svg',
        });

        // Try to subscribe to push notifications if user has enabled them
        if (userEnabled && isPushSupported) {
          await handleSubscribeToPush();
        }
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribeToPush = async () => {
    if (!isPushSupported || permission !== 'granted') return;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // For now, we'll use a placeholder VAPID key
      // In production, this should come from your server
      const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa40HI80NM9f8HtLlVLVWjSrWrTlYhk3ByL1kKSBdHKVxaahvAKd-dQQvfYSAY';
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      // Send subscription to server (you'll need to implement this endpoint)
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
            auth: arrayBufferToBase64(subscription.getKey('auth')!)
          }
        })
      });

      setPushSubscribed(true);
      console.log('Successfully subscribed to push notifications');
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribeFromPush = async () => {
    if (!isPushSupported) return;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Remove subscription from server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint
          })
        });
      }

      setPushSubscribed(false);
      console.log('Successfully unsubscribed from push notifications');
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleUserPreference = async (enabled: boolean) => {
    setUserEnabled(enabled);
    localStorage.setItem('notifications-enabled', enabled.toString());
    
    if (enabled && permission === 'granted') {
      // Show a test notification when enabling
      new Notification('Notifications Enabled!', {
        body: 'You will receive notifications for new messages.',
        icon: '/icon.svg',
      });

      // Subscribe to push notifications if supported
      if (isPushSupported && !pushSubscribed) {
        await handleSubscribeToPush();
      }
    } else if (!enabled && pushSubscribed) {
      // Unsubscribe from push notifications when disabling
      await handleUnsubscribeFromPush();
    }
  };

  const handleTestPushNotification = async () => {
    if (!pushSubscribed) return;

    setIsTestingPush(true);
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        console.log('Test push notification sent');
      } else {
        console.error('Failed to send test push notification');
      }
    } catch (error) {
      console.error('Error sending test push notification:', error);
    } finally {
      setIsTestingPush(false);
    }
  };

  // Helper functions for VAPID key conversion
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const getStatusInfo = () => {
    if (!isSupported) {
      return {
        status: 'unsupported',
        icon: <BellOff className="h-5 w-5 text-gray-500" />,
        title: 'Not Supported',
        description: 'Your browser does not support notifications.',
        variant: 'default' as const,
      };
    }

    if (permission === 'denied') {
      return {
        status: 'denied',
        icon: <BellOff className="h-5 w-5 text-red-500" />,
        title: 'Blocked',
        description: 'Notifications are blocked. Please enable them in your browser settings.',
        variant: 'destructive' as const,
      };
    }

    if (permission === 'granted' && userEnabled) {
      return {
        status: 'enabled',
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        title: 'Enabled',
        description: 'You will receive notifications for new messages.',
        variant: 'default' as const,
      };
    }

    if (permission === 'granted' && !userEnabled) {
      return {
        status: 'disabled',
        icon: <BellOff className="h-5 w-5 text-orange-500" />,
        title: 'Disabled',
        description: 'Notifications are disabled by your preference.',
        variant: 'default' as const,
      };
    }

    return {
      status: 'default',
      icon: <AlertCircle className="h-5 w-5 text-blue-500" />,
      title: 'Permission Required',
      description: 'Click to enable notifications for new messages.',
      variant: 'default' as const,
    };
  };

  const getPushStatusInfo = () => {
    if (!isPushSupported) {
      return {
        icon: <WifiOff className="h-4 w-4 text-gray-500" />,
        title: 'Push notifications not supported',
        description: 'Your browser or device does not support push notifications.',
      };
    }

    if (pushSubscribed) {
      return {
        icon: <Wifi className="h-4 w-4 text-green-500" />,
        title: 'Push notifications active',
        description: 'You will receive notifications even when the app is closed.',
      };
    }

    return {
      icon: <Smartphone className="h-4 w-4 text-orange-500" />,
      title: 'Push notifications available',
      description: 'Enable to receive notifications when the app is closed.',
    };
  };

  const statusInfo = getStatusInfo();
  const pushStatusInfo = getPushStatusInfo();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Message Notifications
        </CardTitle>
        <CardDescription>
          Get notified when you receive new messages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Alert */}
        <Alert variant={statusInfo.variant}>
          <div className="flex items-center gap-2">
            {statusInfo.icon}
            <div>
              <div className="font-medium">{statusInfo.title}</div>
              <div className="text-sm">{statusInfo.description}</div>
            </div>
          </div>
        </Alert>

        {/* Permission Request Button */}
        {isSupported && permission === 'default' && (
          <Button 
            onClick={handleRequestPermission}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Requesting...' : 'Enable Notifications'}
          </Button>
        )}

        {/* User Preference Toggle */}
        {isSupported && permission === 'granted' && (
          <div className="flex items-center justify-between">
            <Label htmlFor="notification-toggle" className="text-sm font-medium">
              Receive message notifications
            </Label>
            <Switch
              id="notification-toggle"
              checked={userEnabled}
              onCheckedChange={handleToggleUserPreference}
              disabled={isLoading}
            />
          </div>
        )}

        {/* Push Notification Status */}
        {isPushSupported && permission === 'granted' && userEnabled && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-2">
              {pushStatusInfo.icon}
              <div>
                <div className="text-sm font-medium">{pushStatusInfo.title}</div>
                <div className="text-xs text-muted-foreground">{pushStatusInfo.description}</div>
              </div>
            </div>
            
            {/* Push notification controls */}
            <div className="flex gap-2 mt-3">
              {!pushSubscribed ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSubscribeToPush}
                  disabled={isLoading}
                >
                  {isLoading ? 'Subscribing...' : 'Enable Push Notifications'}
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestPushNotification}
                    disabled={isTestingPush}
                  >
                    {isTestingPush ? 'Testing...' : 'Test Push'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUnsubscribeFromPush}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Unsubscribing...' : 'Disable Push'}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Browser Settings Help */}
        {permission === 'denied' && (
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">To enable notifications:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Click the lock icon in your browser's address bar</li>
              <li>Set "Notifications" to "Allow"</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        )}

        {/* Additional Info */}
        <div className="text-xs text-muted-foreground">
          <p>
            Notifications will only appear when you're not actively viewing the page.
            {isPushSupported && ' Push notifications work even when the app is closed.'}
            You can change these settings at any time.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function NotificationSettings({ className }: NotificationSettingsProps) {
  return (
    <ClientOnly fallback={
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Message Notifications
          </CardTitle>
          <CardDescription>
            Loading notification settings...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    }>
      {() => <NotificationSettingsContent className={className} />}
    </ClientOnly>
  );
}