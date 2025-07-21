// Comprehensive notification debugging utility for cross-platform issues
// This utility helps identify and fix notification problems on macOS, Android, and other platforms

export interface TestResult {
    success: boolean;
    message: string;
    error?: Error;
}

export interface NotificationDebugInfo {
  // Browser Support
  notificationSupported: boolean;
  serviceWorkerSupported: boolean;
  pushManagerSupported: boolean;
  
  // Permissions
  notificationPermission: NotificationPermission;
  
  // Platform Detection
  isMacOS: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isChrome: boolean;
  isSafari: boolean;
  isFirefox: boolean;
  
  // Context
  isSecure: boolean;
  documentHidden: boolean;
  windowFocused: boolean;
  
  // Service Worker Status
  serviceWorkerController: string;
  serviceWorkerReady: boolean;
  
  // Additional Debug Info
  userAgent: string;
  timestamp: number;
}

export class NotificationDebugger {
  private static instance: NotificationDebugger;
  
  public static getInstance(): NotificationDebugger {
    if (!NotificationDebugger.instance) {
      NotificationDebugger.instance = new NotificationDebugger();
    }
    return NotificationDebugger.instance;
  }

  private constructor() {}

  public async getDebugInfo(): Promise<NotificationDebugInfo> {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    
    // Platform detection
    const isMacOS = userAgent.includes('Mac');
    const isAndroid = userAgent.includes('Android');
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Edg');
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
    const isFirefox = userAgent.includes('Firefox');

    // Service worker status
    let serviceWorkerController = 'not-supported';
    let serviceWorkerReady = false;
    
    if ('serviceWorker' in navigator) {
      if (navigator.serviceWorker.controller) {
        serviceWorkerController = 'active';
      } else {
        serviceWorkerController = 'inactive';
      }
      
      try {
        await navigator.serviceWorker.ready;
        serviceWorkerReady = true;
      } catch (error) {
        console.error('Service worker not ready:', error);
      }
    }

    return {
      // Browser Support
      notificationSupported: 'Notification' in window,
      serviceWorkerSupported: 'serviceWorker' in navigator,
      pushManagerSupported: 'serviceWorker' in navigator && 'PushManager' in window,
      
      // Permissions
      notificationPermission: 'Notification' in window ? Notification.permission : 'denied',
      
      // Platform Detection
      isMacOS,
      isAndroid,
      isIOS,
      isChrome,
      isSafari,
      isFirefox,
      
      // Context
      isSecure: location.protocol === 'https:' || location.hostname === 'localhost',
      documentHidden: document.hidden,
      windowFocused: document.hasFocus(),
      
      // Service Worker Status
      serviceWorkerController,
      serviceWorkerReady,
      
      // Additional Debug Info
      userAgent,
      timestamp: Date.now()
    };
  }

  public async testBasicNotification(): Promise<TestResult> {
    try {
      console.log('🧪 Testing basic notification...');
      
      if (!('Notification' in window)) {
        return { success: false, message: 'Notifications not supported in this browser' };
      }

      if (Notification.permission !== 'granted') {
        return { success: false, message: `Permission not granted. Current: ${Notification.permission}` };
      }

      const notification = new Notification('🧪 Basic Test', {
        body: 'This is a basic notification test',
        icon: '/icon.svg',
        tag: 'basic-test',
        requireInteraction: false,
        silent: false
      });

      // Set up event listeners for debugging
      notification.onshow = () => {
        console.log('✅ Basic notification shown');
      };

      notification.onerror = (error) => {
        console.error('❌ Basic notification error:', error);
      };

      notification.onclose = () => {
        console.log('🔒 Basic notification closed');
      };

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      return { success: true, message: 'Basic notification created successfully' };
    } catch (error) {
      console.error('Basic notification test failed:', error);
      return { success: false, message: 'Basic notification test failed', error: error as Error };
    }
  }

  public async testServiceWorkerNotification(): Promise<TestResult> {
    try {
      console.log('🧪 Testing service worker notification...');
      
      if (!('serviceWorker' in navigator)) {
        return { success: false, message: 'Service Worker not supported' };
      }

      // Wait for service worker to be ready
      const registration = await navigator.serviceWorker.ready;
      console.log('✅ Service Worker ready:', registration);

      if (Notification.permission !== 'granted') {
        return { success: false, message: `Permission not granted. Current: ${Notification.permission}` };
      }

      await registration.showNotification('🔧 Service Worker Test', {
        body: 'This notification comes from the service worker',
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: 'sw-test',
        requireInteraction: false,
        silent: false
      });

      return { success: true, message: 'Service Worker notification created successfully' };
    } catch (error) {
      console.error('Service Worker notification test failed:', error);
      return { success: false, message: 'Service Worker notification test failed', error: error as Error };
    }
  }

  public async requestPermissionSafely(): Promise<{ success: boolean; permission: NotificationPermission; message: string }> {
    try {
      console.log('🔐 Requesting notification permission...');
      
      if (!('Notification' in window)) {
        return { 
          success: false, 
          permission: 'denied', 
          message: 'Notifications not supported in this browser' 
        };
      }

      // Check current permission
      let permission = Notification.permission;
      console.log('Current permission:', permission);

      if (permission === 'default') {
        // Wait for service worker to be ready before requesting permission
        if ('serviceWorker' in navigator) {
          try {
            await navigator.serviceWorker.ready;
            console.log('✅ Service Worker ready before permission request');
          } catch (error) {
            console.warn('⚠️ Service Worker not ready, proceeding anyway:', error);
          }
        }

        // Request permission
        permission = await Notification.requestPermission();
        console.log('Permission after request:', permission);
      }

      const success = permission === 'granted';
      const message = success 
        ? 'Notification permission granted successfully'
        : `Permission ${permission}. ${this.getPermissionAdvice(permission)}`;

      return { success, permission, message };
    } catch (error) {
      console.error('Permission request failed:', error);
      return { 
        success: false, 
        permission: 'denied', 
        message: `Permission request failed: ${error}` 
      };
    }
  }

  private getPermissionAdvice(permission: NotificationPermission): string {
    switch (permission) {
      case 'denied':
        return 'User has blocked notifications. Check browser settings to re-enable.';
      case 'default':
        return 'Permission not yet requested or user dismissed the prompt.';
      case 'granted':
        return 'Notifications are allowed.';
      default:
        return 'Unknown permission state.';
    }
  }

  public getPlatformSpecificAdvice(debugInfo: NotificationDebugInfo): string[] {
    const advice: string[] = [];

    if (debugInfo.isMacOS) {
      advice.push('macOS: Check System Settings → Notifications & Focus → [Your Browser] → Allow notifications');
      advice.push('macOS: Disable Do Not Disturb or Focus mode');
      advice.push('macOS: Set notification style to "Alerts" or "Banners" (not "None")');
      if (debugInfo.isSafari) {
        advice.push('Safari: Check Safari → Settings → Websites → Notifications');
      }
    }

    if (debugInfo.isAndroid) {
      advice.push('Android: Check Settings → Apps → [Your Browser] → Notifications → Allow notifications');
      advice.push('Android: Check Settings → Notifications → Do not disturb → Turn off');
      advice.push('Android: Ensure battery optimization is disabled for your browser');
      if (debugInfo.isChrome) {
        advice.push('Chrome Android: Check Chrome → Settings → Site Settings → Notifications');
      }
    }

    if (debugInfo.isIOS) {
      advice.push('iOS: Notifications may be limited in browser apps');
      advice.push('iOS: Consider adding to home screen for better notification support');
    }

    if (!debugInfo.isSecure) {
      advice.push('⚠️ HTTPS required: Notifications only work on secure connections (HTTPS or localhost)');
    }

    if (!debugInfo.serviceWorkerReady) {
      advice.push('⚠️ Service Worker not ready: Wait for service worker registration to complete');
    }

    return advice;
  }

  public async runComprehensiveTest(): Promise<{
    debugInfo: NotificationDebugInfo;
    permissionTest: { success: boolean; permission: NotificationPermission; message: string };
    basicTest: TestResult;
    serviceWorkerTest: TestResult;
    advice: string[];
  }> {
    console.log('🚀 Running comprehensive notification test...');
    
    const debugInfo = await this.getDebugInfo();
    const permissionTest = await this.requestPermissionSafely();
    
    let basicTest = { success: false, message: 'Skipped - permission not granted' };
    let serviceWorkerTest = { success: false, message: 'Skipped - permission not granted' };
    
    if (permissionTest.success) {
      // Wait a bit for permission to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      basicTest = await this.testBasicNotification();
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      serviceWorkerTest = await this.testServiceWorkerNotification();
    }
    
    const advice = this.getPlatformSpecificAdvice(debugInfo);
    
    return {
      debugInfo,
      permissionTest,
      basicTest,
      serviceWorkerTest,
      advice
    };
  }
}

// Export types
export type DebugInfo = NotificationDebugInfo;
export type ComprehensiveTestResults = {
  debugInfo: NotificationDebugInfo;
  permissionTest: { success: boolean; permission: NotificationPermission; message: string };
  basicTest: TestResult;
  serviceWorkerTest: TestResult;
  advice: string[];
};

// Export singleton instance
export const notificationDebugger = NotificationDebugger.getInstance();