import { useState, useEffect } from 'react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Smartphone, Wifi, WifiOff, Download, CheckCircle, Globe } from 'lucide-react';
import { usePWAInstall, isPWA, getPWADisplayMode } from '~/components/ServiceWorkerRegistration';

export function PWAStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [displayMode, setDisplayMode] = useState('browser');
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { install, canInstall } = usePWAInstall();

  useEffect(() => {
    // Mark as client-side
    setIsClient(true);
    
    // Only run browser APIs on client
    if (typeof window !== 'undefined') {
      // Check online status
      setIsOnline(navigator.onLine);
      
      // Check if running as PWA
      setIsAppInstalled(isPWA());
      
      // Get display mode
      setDisplayMode(getPWADisplayMode());

      // Listen for online/offline events
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const handleInstall = async () => {
    await install();
  };

  // Don't render until client-side
  if (!isClient) {
    return (
      <Card className="form-container-styles">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            App Status
          </CardTitle>
          <CardDescription>
            Loading PWA information...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="form-container-styles">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          App Status
        </CardTitle>
        <CardDescription>
          Progressive Web App information and controls
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-muted-foreground" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">Connection</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{isOnline ? "Online" : "Offline"}</span>
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
        </div>

        {/* Installation Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isAppInstalled ? (
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Globe className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">Installation</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{isAppInstalled ? "Installed" : "Browser"}</span>
            <div className={`w-2 h-2 rounded-full ${isAppInstalled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          </div>
        </div>

        {/* Display Mode */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Display Mode</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm capitalize">{displayMode}</span>
            <div className={`w-2 h-2 rounded-full ${displayMode === 'standalone' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          </div>
        </div>

        {/* Install Button */}
        {canInstall && !isAppInstalled && (
          <Button 
            onClick={handleInstall}
            className="w-full"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Install App
          </Button>
        )}

        {/* PWA Features */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">PWA Features:</p>
          <ul className="space-y-1 ml-2">
            <li>• Offline access to cached content</li>
            <li>• Fast loading with service worker</li>
            <li>• App-like experience</li>
            <li>• Push notifications for messages</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// Simplified PWA badge component for headers/navbars
export function PWABadge() {
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      setIsAppInstalled(isPWA());
    }
  }, []);

  if (!isClient || !isAppInstalled) return null;

  return (
    <Badge variant="outline" className="text-xs">
      <Smartphone className="h-3 w-3 mr-1" />
      PWA
    </Badge>
  );
}