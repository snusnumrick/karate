// Push notification service for managing subscriptions and server communication
// This service handles VAPID key management, subscription lifecycle, and server sync

import { useState, useEffect, useCallback } from 'react';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  userType?: 'admin' | 'family';
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  type: 'message' | 'payment' | 'attendance' | 'announcement';
  data?: {
    conversationId?: string;
    paymentId?: string;
    studentId?: string;
    isAdmin?: boolean;
    [key: string]: string | number | boolean | undefined;
  };
  icon?: string;
  badge?: string;
  tag?: string;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private vapidPublicKey: string | null = null;
  private subscription: PushSubscription | null = null;
  private isSupported: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    }
  }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Check if push notifications are supported
   */
  public isPushSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Initialize the push notification service
   */
  public async initialize(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Push notifications are not supported in this browser');
      return false;
    }

    try {
      // Get VAPID public key from server
      await this.fetchVapidPublicKey();
      
      // Check for existing subscription
      await this.checkExistingSubscription();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize push notification service:', error);
      return false;
    }
  }

  /**
   * Fetch VAPID public key from server
   */
  private async fetchVapidPublicKey(): Promise<void> {
    try {
      const response = await fetch('/api/push/vapid-key');
      if (!response.ok) {
        throw new Error('Failed to fetch VAPID key');
      }
      const data = await response.json();
      this.vapidPublicKey = data.publicKey;
    } catch (error) {
      console.error('Error fetching VAPID key:', error);
    }
  }

  /**
   * Check for existing push subscription
   */
  private async checkExistingSubscription(): Promise<void> {
    try {
      console.log('🔍 Checking for existing push subscription...');
      console.log('🔧 Waiting for service worker to be ready...');
      
      const registration = await navigator.serviceWorker.ready;
      console.log('✅ Service worker is ready:', registration);
      console.log('   - Scope:', registration.scope);
      console.log('   - Active worker:', !!registration.active);
      console.log('   - Installing worker:', !!registration.installing);
      console.log('   - Waiting worker:', !!registration.waiting);
      
      this.subscription = await registration.pushManager.getSubscription();
      
      if (this.subscription) {
        console.log('✅ Existing push subscription found');
        console.log('   - Endpoint:', this.subscription.endpoint);
        // Verify subscription is still valid with server
        await this.verifySubscriptionWithServer();
      } else {
        console.log('ℹ️ No existing push subscription found');
      }
    } catch (error) {
      console.error('❌ Error checking existing subscription:', error);
    }
  }

  /**
   * Subscribe to push notifications
   */
  public async subscribe(): Promise<PushSubscription | null> {
    if (!this.isSupported || !this.vapidPublicKey) {
      console.error('Push notifications not supported or VAPID key missing');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        this.subscription = existingSubscription;
        return existingSubscription;
      }

      // Create new subscription
      const vapidKeyBytes = this.urlBase64ToUint8Array(this.vapidPublicKey);
      const vapidKeyBuffer: ArrayBuffer = Uint8Array.from(vapidKeyBytes).buffer;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyBuffer
      });

      this.subscription = subscription;
      
      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      
      console.log('Successfully subscribed to push notifications');
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  public async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      // Remove subscription from server
      await this.removeSubscriptionFromServer();
      
      // Unsubscribe from browser
      const success = await this.subscription.unsubscribe();
      
      if (success) {
        this.subscription = null;
        console.log('Successfully unsubscribed from push notifications');
      }
      
      return success;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  /**
   * Get current subscription status
   */
  public getSubscription(): PushSubscription | null {
    return this.subscription;
  }

  /**
   * Check if currently subscribed
   */
  public isSubscribed(): boolean {
    return this.subscription !== null;
  }

  /**
   * Send subscription to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    const subscriptionData: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
      }
    };

    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscriptionData)
    });

    if (!response.ok) {
      throw new Error('Failed to send subscription to server');
    }
  }

  /**
   * Remove subscription from server
   */
  private async removeSubscriptionFromServer(): Promise<void> {
    if (!this.subscription) return;

    const response = await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: this.subscription.endpoint
      })
    });

    if (!response.ok) {
      throw new Error('Failed to remove subscription from server');
    }
  }

  /**
   * Verify subscription with server
   */
  private async verifySubscriptionWithServer(): Promise<void> {
    if (!this.subscription) return;

    try {
      const response = await fetch('/api/push/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: this.subscription.endpoint
        })
      });

      if (!response.ok) {
        // Subscription is invalid, remove it
        await this.subscription.unsubscribe();
        this.subscription = null;
      }
    } catch (error) {
      console.error('Error verifying subscription:', error);
    }
  }

  /**
   * Test push notification with enhanced Android support
   */
  public async testPushNotification(): Promise<boolean> {
    if (!this.subscription) {
      console.error('No active subscription for testing');
      return false;
    }

    // Detect Android for platform-specific handling
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isHTTPS = window.location.protocol === 'https:';
    
    console.log(`🔍 Testing push notification - Android: ${isAndroid}, HTTPS: ${isHTTPS}`);
    
    // Android-specific checks
    if (isAndroid && !isHTTPS && window.location.hostname !== 'localhost') {
      console.error('❌ Android requires HTTPS for push notifications');
      throw new Error('Android devices require HTTPS for push notifications to work properly');
    }

    try {
      // Verify subscription is still valid before testing
      const registration = await navigator.serviceWorker.ready;
      const currentSubscription = await registration.pushManager.getSubscription();
      
      if (!currentSubscription || currentSubscription.endpoint !== this.subscription.endpoint) {
        console.warn('⚠️ Subscription mismatch detected, refreshing...');
        this.subscription = currentSubscription;
        if (!this.subscription) {
          throw new Error('Push subscription lost. Please refresh the page and try again.');
        }
      }

      console.log('📤 Sending test push notification request...');
      
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: this.subscription.endpoint
        }),
        // Add timeout for mobile networks
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const result = await response.json().catch(() => ({}));
        console.log('✅ Test push notification sent successfully:', result);
        
        if (isAndroid) {
          console.log('📱 Android: Switch to another app to see the notification');
        }
        
        return true;
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('❌ Test push notification failed:', errorData);
        
        // Handle specific error cases
        if (response.status === 410) {
          console.error('🔄 Subscription expired, need to resubscribe');
          await this.handleExpiredSubscription();
        } else if (response.status === 403) {
          console.error('🔑 VAPID key mismatch or authentication issue');
        }
        
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to send test notification:', error);
      
      if (error instanceof Error) {
         if (error.name === 'TimeoutError') {
           console.error('⏰ Request timed out - possible network issue');
         } else if (error.name === 'NotAllowedError') {
           console.error('🚫 Notification permission denied');
         }
       }
      
      return false;
    }
  }

  /**
   * Handle expired subscription by resubscribing
   */
  private async handleExpiredSubscription(): Promise<void> {
    try {
      console.log('🔄 Handling expired subscription...');
      
      // Unsubscribe the old subscription
      if (this.subscription) {
        await this.subscription.unsubscribe();
        this.subscription = null;
      }
      
      // Create new subscription
      await this.subscribe();
      
      console.log('✅ Successfully resubscribed after expiration');
    } catch (error) {
      console.error('❌ Failed to handle expired subscription:', error);
    }
  }

  /**
   * Enhanced subscription method with Android-specific optimizations
   */
  public async subscribeWithAndroidOptimizations(): Promise<PushSubscription | null> {
    const isAndroid = /Android/i.test(navigator.userAgent);
    
    if (isAndroid) {
      console.log('📱 Using Android-optimized subscription flow');
      
      // Check for Android-specific requirements
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers not supported on this Android device');
      }
      
      if (!('PushManager' in window)) {
        throw new Error('Push messaging not supported on this Android device');
      }
      
      // Check if we're in a secure context
      if (!window.isSecureContext) {
        throw new Error('Push notifications require a secure context (HTTPS) on Android');
      }
    }
    
    return this.subscribe();
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
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
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Listen for service worker messages
   */
  public setupMessageListener(): void {
    console.log('🎧 Setting up service worker message listener...');
    
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ Service Worker not supported, message listener not set up');
      return;
    }

    // Check if service worker is available
    console.log('🔍 Checking service worker availability...');
    console.log('   - Controller:', !!navigator.serviceWorker.controller);
    console.log('   - Ready state:', navigator.serviceWorker.ready);

    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('📨 Received message from service worker:', event.data);
      console.log('📋 Message event details:', {
        origin: event.origin,
        source: event.source ? 'ServiceWorker' : 'Unknown',
        timestamp: new Date().toISOString()
      });
      
      if (event.data && event.data.type === 'FOCUS_MESSAGE_INPUT') {
        console.log('🎯 Handling FOCUS_MESSAGE_INPUT request');
        // Handle focus message input request from service worker
        const messageInput = document.querySelector('[data-message-input]') as HTMLElement;
        if (messageInput) {
          console.log('✅ Message input found, focusing');
          messageInput.focus();
        } else {
          console.warn('⚠️ Message input not found');
        }
      } else if (event.data && event.data.type === 'NAVIGATE') {
        console.log('🔗 Handling NAVIGATE request');
        console.log('🎯 Navigation URL:', event.data.url);
        console.log('🌐 Current location:', window.location.href);
        console.log('🔍 Window availability:', typeof window !== 'undefined');
        
        // Handle navigation request from service worker
        if (event.data.url && typeof window !== 'undefined') {
          console.log('✅ Navigating to:', event.data.url);
          try {
            window.location.href = event.data.url;
            console.log('✅ Navigation initiated successfully');
          } catch (error) {
            console.error('❌ Navigation failed:', error);
          }
        } else {
          console.error('❌ Cannot navigate - missing URL or window object');
          console.error('   - URL provided:', !!event.data.url);
          console.error('   - Window available:', typeof window !== 'undefined');
        }
      } else if (event.data && event.data.type === 'TEST_CONNECTION_RESPONSE') {
        console.log('🎉 Test connection response received from service worker!');
        console.log('   - Message:', event.data.message);
        console.log('   - Timestamp:', new Date(event.data.timestamp).toISOString());
        console.log('✅ Service worker communication is working correctly');
      } else {
        console.log('ℹ️ Unknown message type or missing data:', event.data?.type || 'no type');
      }
    });
    
    console.log('✅ Service worker message listener set up successfully');
    
    // Test if we can communicate with the service worker
    navigator.serviceWorker.ready.then((registration) => {
      console.log('🧪 Testing service worker communication...');
      if (registration.active) {
        console.log('📤 Sending test message to service worker...');
        registration.active.postMessage({ type: 'TEST_CONNECTION' });
      } else {
        console.warn('⚠️ No active service worker found for testing');
      }
    }).catch((error) => {
      console.error('❌ Error testing service worker communication:', error);
    });
  }
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance();

// Convenience functions
export const initializePushNotifications = () => pushNotificationService.initialize();
export const subscribeToPushNotifications = () => pushNotificationService.subscribe();
export const unsubscribeFromPushNotifications = () => pushNotificationService.unsubscribe();
export const isPushNotificationSupported = () => pushNotificationService.isPushSupported();
export const isPushNotificationSubscribed = () => pushNotificationService.isSubscribed();
export const testPushNotification = () => pushNotificationService.testPushNotification();

// React hook for push notifications
export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      setIsSupported(pushNotificationService.isPushSupported());
      
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      }
      
      await pushNotificationService.initialize();
      setIsSubscribed(pushNotificationService.isSubscribed());
    };

    initialize();
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const subscription = await pushNotificationService.subscribe();
      setIsSubscribed(!!subscription);
      
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      }
    } catch (error) {
      console.error('Failed to subscribe:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const success = await pushNotificationService.unsubscribe();
      if (success) {
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
