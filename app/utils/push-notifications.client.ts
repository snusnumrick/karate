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
    [key: string]: any;
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
      // Fallback to environment variable or default
      this.vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || null;
    }
  }

  /**
   * Check for existing push subscription
   */
  private async checkExistingSubscription(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready;
      this.subscription = await registration.pushManager.getSubscription();
      
      if (this.subscription) {
        console.log('Existing push subscription found');
        // Verify subscription is still valid with server
        await this.verifySubscriptionWithServer();
      }
    } catch (error) {
      console.error('Error checking existing subscription:', error);
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
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
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
   * Test push notification
   */
  public async testPushNotification(): Promise<boolean> {
    if (!this.subscription) {
      console.error('No active subscription for testing');
      return false;
    }

    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: this.subscription.endpoint
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send test notification:', error);
      return false;
    }
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
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'FOCUS_MESSAGE_INPUT') {
        // Handle focus message input request from service worker
        const messageInput = document.querySelector('[data-message-input]') as HTMLElement;
        if (messageInput) {
          messageInput.focus();
        }
      }
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