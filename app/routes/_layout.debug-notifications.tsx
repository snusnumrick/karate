import { useState, useEffect } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { TestTube, AlertTriangle, Info } from 'lucide-react';
import { ClientOnly } from '~/components/client-only';
import { notificationDebugger, type DebugInfo, type ComprehensiveTestResults } from '~/utils/notification-debug.client';

function DebugNotificationsContent() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [comprehensiveResults, setComprehensiveResults] = useState<ComprehensiveTestResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadDebugInfo = async () => {
      try {
        const info = await notificationDebugger.getDebugInfo();
        setDebugInfo(info);
      } catch (error) {
        console.error('Failed to load debug info:', error);
      }
    };
    
    loadDebugInfo();
  }, []);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testBasicNotification = async () => {
    addTestResult('🧪 Testing basic notification...');
    const result = await notificationDebugger.testBasicNotification();
    addTestResult(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
    if (result.error) {
      addTestResult(`💥 Error details: ${result.error}`);
    }
  };

  const testServiceWorkerNotification = async () => {
    addTestResult('🧪 Testing service worker notification...');
    const result = await notificationDebugger.testServiceWorkerNotification();
    addTestResult(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
    if (result.error) {
      addTestResult(`💥 Error details: ${result.error}`);
    }
  };

  const requestPermission = async () => {
    addTestResult('🔐 Requesting notification permission...');
    const result = await notificationDebugger.requestPermissionSafely();
    addTestResult(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
    
    // Refresh debug info after permission change
    const newInfo = await notificationDebugger.getDebugInfo();
    setDebugInfo(newInfo);
  };

  const runComprehensiveTest = async () => {
    setIsLoading(true);
    setTestResults([]);
    addTestResult('🚀 Starting comprehensive notification test...');
    
    try {
      const results = await notificationDebugger.runComprehensiveTest();
      setComprehensiveResults(results);
      
      addTestResult('📊 Comprehensive test completed!');
      addTestResult(`Permission: ${results.permissionTest.success ? '✅' : '❌'} ${results.permissionTest.message}`);
      addTestResult(`Basic Test: ${results.basicTest.success ? '✅' : '❌'} ${results.basicTest.message}`);
      addTestResult(`Service Worker Test: ${results.serviceWorkerTest.success ? '✅' : '❌'} ${results.serviceWorkerTest.message}`);
      
      if (results.advice.length > 0) {
        addTestResult('💡 Platform-specific advice:');
        results.advice.forEach(advice => addTestResult(`   • ${advice}`));
      }
      
      // Update debug info
      setDebugInfo(results.debugInfo);
    } catch (error) {
      addTestResult(`💥 Comprehensive test failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getMacOSInstructions = () => {
    if (!debugInfo?.isMacOS) return null;

    return (
      <Alert className="mt-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>macOS Users:</strong> If notifications aren&apos;t showing, check:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong>System Settings → Notifications & Focus</strong> → Find your browser → Enable notifications</li>
            <li>Turn off <strong>Do Not Disturb</strong> or <strong>Focus</strong> mode</li>
            <li>Set notification style to <strong>Alerts</strong> or <strong>Banners</strong> (not &quot;None&quot;)</li>
            <li>Check that <strong>Allow notifications</strong> is enabled for your browser</li>
          </ul>
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🔍 Notification Debug Center</h1>
        <p className="text-muted-foreground">
          Comprehensive debugging tools to identify notification issues.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* System Information */}
        {debugInfo && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span>Operating System:</span>
                <Badge variant={debugInfo.isMacOS ? "default" : "secondary"}>
                  {debugInfo.isMacOS ? "macOS" : "Other"}
                </Badge>
                
                <span>Browser:</span>
                <Badge variant="outline">
                  {debugInfo.isChrome ? "Chrome" : debugInfo.isSafari ? "Safari" : debugInfo.isFirefox ? "Firefox" : "Other"}
                </Badge>
                
                <span>Notifications Supported:</span>
                <Badge variant={debugInfo.notificationSupported ? "default" : "destructive"}>
                  {debugInfo.notificationSupported ? "Yes" : "No"}
                </Badge>
                
                <span>Service Worker Supported:</span>
                <Badge variant={debugInfo.serviceWorkerSupported ? "default" : "destructive"}>
                  {debugInfo.serviceWorkerSupported ? "Yes" : "No"}
                </Badge>
                
                <span>Push Manager Supported:</span>
                <Badge variant={debugInfo.pushManagerSupported ? "default" : "destructive"}>
                  {debugInfo.pushManagerSupported ? "Yes" : "No"}
                </Badge>
                
                <span>Permission Status:</span>
                <Badge variant={debugInfo.notificationPermission === 'granted' ? "default" : 
                               debugInfo.notificationPermission === 'denied' ? "destructive" : "secondary"}>
                  {debugInfo.notificationPermission}
                </Badge>
                
                <span>Document Hidden:</span>
                <Badge variant={debugInfo.documentHidden ? "secondary" : "default"}>
                  {debugInfo.documentHidden ? "Yes" : "No"}
                </Badge>
                
                <span>Window Focused:</span>
                <Badge variant={debugInfo.windowFocused ? "default" : "secondary"}>
                  {debugInfo.windowFocused ? "Yes" : "No"}
                </Badge>
                
                <span>Service Worker:</span>
                <Badge variant={debugInfo.serviceWorkerController === 'active' ? "default" : "secondary"}>
                  {debugInfo.serviceWorkerController}
                </Badge>
                
                <span>Secure Context:</span>
                <Badge variant={debugInfo.isSecure ? "default" : "destructive"}>
                  {debugInfo.isSecure ? "Yes" : "No"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="w-5 h-5" />
              Notification Tests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={requestPermission} 
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              Request Permission
            </Button>
            
            <Button 
              onClick={testBasicNotification} 
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              Test Basic Notification
            </Button>
            
            <Button 
              onClick={testServiceWorkerNotification} 
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              Test Service Worker Notification
            </Button>
            
            <Button 
                onClick={runComprehensiveTest} 
                disabled={isLoading}
                className="w-full"
                variant="default"
              >
                {isLoading ? 'Running Tests...' : 'Run Comprehensive Test'}
              </Button>
          </CardContent>
        </Card>
      </div>

      {debugInfo && getMacOSInstructions()}

      {/* Comprehensive Test Results */}
      {comprehensiveResults && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📊 Comprehensive Test Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-3 rounded-lg ${comprehensiveResults.permissionTest.success ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                <div className="font-medium">Permission Test</div>
                <div className="text-sm">{comprehensiveResults.permissionTest.message}</div>
              </div>
              
              <div className={`p-3 rounded-lg ${comprehensiveResults.basicTest.success ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                <div className="font-medium">Basic Notification</div>
                <div className="text-sm">{comprehensiveResults.basicTest.message}</div>
              </div>
              
              <div className={`p-3 rounded-lg ${comprehensiveResults.serviceWorkerTest.success ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                <div className="font-medium">Service Worker</div>
                <div className="text-sm">{comprehensiveResults.serviceWorkerTest.message}</div>
              </div>
            </div>
            
            {comprehensiveResults.advice.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                <div className="font-medium mb-2">💡 Platform-specific Advice:</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                    {comprehensiveResults.advice.map((advice: string, index: number) => (
                      <li key={index}>{advice}</li>
                    ))}
                  </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <div className="font-mono text-sm space-y-1">
                {testResults.map((result, index) => (
                  <div key={index} className="whitespace-pre-wrap">
                    {result}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw Debug Data */}
      {debugInfo && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Raw Debug Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-x-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DebugNotifications() {
  return (
    <ClientOnly fallback={
      <div className="container mx-auto py-8">
        <div className="text-center">Loading debug tools...</div>
      </div>
    }>
      {() => <DebugNotificationsContent />}
    </ClientOnly>
  );
}