import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Bell, BellOff, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { notificationService, showMessageNotification } from "~/utils/notifications.client";
import ClientOnly from "~/components/client-only";

function NotificationTestContent() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [userEnabled, setUserEnabled] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Check initial states
    setIsSupported(notificationService.isNotificationSupported());
    setPermission(notificationService.getPermission());
    setUserEnabled(notificationService.areNotificationsEnabledByUser());
    setIsPageVisible(notificationService.isPageVisible());
    setShouldShow(notificationService.shouldShowNotification());

    // Listen for visibility changes
    const handleVisibilityChange = () => {
      setIsPageVisible(notificationService.isPageVisible());
      setShouldShow(notificationService.shouldShowNotification());
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const requestPermission = async () => {
    const result = await notificationService.requestPermission();
    setPermission(result);
    setShouldShow(notificationService.shouldShowNotification());
  };

  const [countdown, setCountdown] = useState<number | null>(null);

  const testNotification = async () => {
    console.log('Testing notification...');
    console.log('Should show notification:', notificationService.shouldShowNotification());
    console.log('Page visible:', notificationService.isPageVisible());
    console.log('Notifications enabled:', notificationService.areNotificationsEnabled());
    console.log('User preference:', notificationService.areNotificationsEnabledByUser());
    
    await showMessageNotification({
      conversationId: 'test-123',
      senderId: 'test-sender',
      senderName: 'Test User',
      messageContent: 'This is a test notification message to verify the notification system is working correctly.',
      timestamp: new Date().toISOString()
    });
  };

  const testNotificationWithRules = async () => {
    console.log('Testing notification with rules...');
    const shouldShow = notificationService.shouldShowNotification();
    console.log('Should show notification:', shouldShow);
    
    if (!shouldShow) {
      alert('Notification blocked! Page must be hidden (switch tabs or minimize browser)');
      return;
    }

    // Send a test notification that respects the rules and requires interaction
    const testData = {
      conversationId: 'test-123',
      senderId: 'test-user',
      senderName: 'Test User (Persistent)',
      messageContent: 'This notification will stay visible until you click it! It should appear as a banner or alert on your screen.',
      timestamp: new Date().toISOString(),
    };

    // Override the notification to require interaction (won't auto-close)
    const options = {
      title: `New message from ${testData.senderName}`,
      body: testData.messageContent,
      icon: '/android-chrome-192x192.png',
      badge: '/android-chrome-192x192.png',
      tag: `message-${testData.conversationId}`,
      data: {
        type: 'message',
        conversationId: testData.conversationId,
        senderId: testData.senderId,
        timestamp: testData.timestamp,
      },
      requireInteraction: true, // This prevents auto-close
    };

    await notificationService.showNotification(options);
    console.log('Persistent notification sent!');
  };

  const testNotificationWithDelay = () => {
    let timeLeft = 5;
    setCountdown(timeLeft);
    
    const timer = setInterval(() => {
      timeLeft -= 1;
      setCountdown(timeLeft);
      
      if (timeLeft <= 0) {
        clearInterval(timer);
        setCountdown(null);
        // Use the rule-respecting test for the delayed version
        testNotificationWithRules();
      }
    }, 1000);
  };

  const toggleUserPreference = () => {
    const newValue = !userEnabled;
    notificationService.setNotificationPreference(newValue);
    setUserEnabled(newValue);
    setShouldShow(notificationService.shouldShowNotification());
  };

  const getPermissionBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Granted</Badge>;
      case 'denied':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Denied</Badge>;
      default:
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Not Asked</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification System Test
          </CardTitle>
          <CardDescription>
            Test and debug the notification system to identify any issues.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Browser Support */}
          <div className="space-y-2">
            <h3 className="font-semibold">Browser Support</h3>
            <div className="flex items-center gap-2">
              {isSupported ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Supported
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="w-3 h-3 mr-1" />
                  Not Supported
                </Badge>
              )}
            </div>
          </div>

          {/* Permission Status */}
          <div className="space-y-2">
            <h3 className="font-semibold">Permission Status</h3>
            <div className="flex items-center gap-2">
              {getPermissionBadge()}
              {permission !== 'granted' && (
                <Button onClick={requestPermission} size="sm">
                  Request Permission
                </Button>
              )}
            </div>
          </div>

          {/* User Preference */}
          <div className="space-y-2">
            <h3 className="font-semibold">User Preference</h3>
            <div className="flex items-center gap-2">
              {userEnabled ? (
                <Badge variant="default" className="bg-green-500">
                  <Bell className="w-3 h-3 mr-1" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <BellOff className="w-3 h-3 mr-1" />
                  Disabled
                </Badge>
              )}
              <Button onClick={toggleUserPreference} size="sm" variant="outline">
                {userEnabled ? 'Disable' : 'Enable'}
              </Button>
            </div>
          </div>

          {/* Page Visibility */}
          <div className="space-y-2">
            <h3 className="font-semibold">Page Visibility</h3>
            <div className="flex items-center gap-2">
              {isPageVisible ? (
                <Badge variant="default" className="bg-blue-500">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Visible
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Hidden
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                (Notifications only show when page is hidden)
              </span>
            </div>
          </div>

          {/* Should Show Notifications */}
          <div className="space-y-2">
            <h3 className="font-semibold">Should Show Notifications</h3>
            <div className="flex items-center gap-2">
              {shouldShow ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Yes
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="w-3 h-3 mr-1" />
                  No
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                (All conditions met for notifications)
              </span>
            </div>
          </div>

          {/* Test Button */}
          <div className="space-y-2">
            <h3 className="font-semibold">Test Notification</h3>
            <div className="space-y-2">
              <Button 
                onClick={testNotification} 
                disabled={!isSupported || permission !== 'granted'}
                className="w-full"
                variant="outline"
              >
                Send Test Notification (Force - Ignores Rules)
              </Button>
              <Button 
                onClick={testNotificationWithRules} 
                disabled={!isSupported || permission !== 'granted'}
                className="w-full"
                variant="default"
              >
                Send Test Notification (Respects Rules)
              </Button>
              <Button 
                onClick={testNotificationWithDelay} 
                disabled={!isSupported || permission !== 'granted' || countdown !== null}
                className="w-full"
              >
                {countdown !== null 
                  ? `Sending notification in ${countdown}s... (Minimize now!)` 
                  : 'Send Test Notification (5s delay + Rules)'
                }
              </Button>
            </div>
            {(!isSupported || permission !== 'granted') && (
              <p className="text-sm text-muted-foreground">
                {!isSupported 
                  ? "Notifications not supported in this browser" 
                  : "Permission required to send notifications"
                }
              </p>
            )}
            {countdown === null && (
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>💡 <strong>Recommended:</strong> Use the "5s delay + Rules" option:</p>
                <p>1. Click the button</p>
                <p>2. Quickly minimize browser or switch tabs</p>
                <p>3. Wait for notification (only works when page is hidden)</p>
              </div>
            )}
          </div>

          {/* Debug Info */}
          <div className="space-y-2">
            <h3 className="font-semibold">Debug Information</h3>
            <div className="bg-muted p-3 rounded text-sm font-mono">
              <div>Browser Support: {isSupported.toString()}</div>
              <div>Permission: {permission}</div>
              <div>User Enabled: {userEnabled.toString()}</div>
              <div>Page Visible: {isPageVisible.toString()}</div>
              <div>Should Show: {shouldShow.toString()}</div>
              <div>User Agent: {navigator.userAgent}</div>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <h3 className="font-semibold">Testing Instructions</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Ensure browser supports notifications</li>
              <li>Grant notification permission when prompted</li>
              <li>Switch to another tab or minimize the browser</li>
              <li>Send a message from another user/device</li>
              <li>You should receive a notification</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NotificationTest() {
  return (
    <ClientOnly fallback={
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification System Test
            </CardTitle>
            <CardDescription>
              Loading notification test...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      {() => <NotificationTestContent />}
    </ClientOnly>
  );
}