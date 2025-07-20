import { useState, useEffect } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Switch } from '~/components/ui/switch';
import { Label } from '~/components/ui/label';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Bell, BellOff, Settings, AlertCircle, CheckCircle } from 'lucide-react';
import { ClientOnly } from '~/components/client-only';

interface NotificationSettingsProps {
  className?: string;
}

function NotificationSettingsContent({ className }: NotificationSettingsProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [userEnabled, setUserEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    const supported = 'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      
      // Get user preference from localStorage
      const preference = localStorage.getItem('notifications-enabled');
      setUserEnabled(preference !== 'false');
    }
  }, []);

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
          icon: '/android-chrome-192x192.png',
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleUserPreference = (enabled: boolean) => {
    setUserEnabled(enabled);
    localStorage.setItem('notifications-enabled', enabled.toString());
    
    if (enabled && permission === 'granted') {
      // Show a test notification when enabling
      new Notification('Notifications Enabled!', {
        body: 'You will receive notifications for new messages.',
        icon: '/android-chrome-192x192.png',
      });
    }
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

  const statusInfo = getStatusInfo();

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
            />
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