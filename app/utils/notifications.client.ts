// Client-side notification utilities for incoming messages
// This file handles browser notifications and permission management

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  silent?: boolean;
}

export interface MessageNotificationData {
  conversationId: string;
  senderId: string;
  senderName: string;
  messageContent: string;
  timestamp: string;
}

class NotificationService {
  private static instance: NotificationService;
  private isSupported: boolean = false;
  private permission: NotificationPermission = 'default';

  private constructor() {
    if (typeof window !== 'undefined') {
      this.isSupported = 'Notification' in window;
      this.permission = this.isSupported ? Notification.permission : 'denied';
    }
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Check if notifications are supported in this browser
   */
  public isNotificationSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Get current notification permission status
   */
  public getPermission(): NotificationPermission {
    if (this.isSupported) {
      this.permission = Notification.permission;
    }
    return this.permission;
  }

  /**
   * Request notification permission from the user
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Show a browser notification
   */
  public async showNotification(options: NotificationOptions): Promise<Notification | null> {
    console.log('🔔 showNotification called with options:', options);
    
    if (!this.isSupported || this.permission !== 'granted') {
      console.warn('❌ Notifications not supported or permission not granted', {
        isSupported: this.isSupported,
        permission: this.permission
      });
      return null;
    }

    try {
      console.log('✅ Creating notification...');
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/android-chrome-192x192.png',
        badge: options.badge || '/android-chrome-192x192.png',
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
      });

      console.log('🎉 Notification created successfully:', notification);

      // Add event listeners for debugging
      notification.onshow = () => {
        console.log('📱 Notification shown');
      };
      
      notification.onerror = (error) => {
        console.error('❌ Notification error:', error);
      };
      
      notification.onclose = () => {
        console.log('🔒 Notification closed');
      };

      // Auto-close notification after 5 seconds unless requireInteraction is true
      if (!options.requireInteraction) {
        setTimeout(() => {
          console.log('⏰ Auto-closing notification after 5 seconds');
          notification.close();
        }, 5000);
      }

      return notification;
    } catch (error) {
      console.error('💥 Error showing notification:', error);
      return null;
    }
  }

  /**
   * Show a notification for a new message
   */
  public async showMessageNotification(data: MessageNotificationData): Promise<Notification | null> {
    const options: NotificationOptions = {
      title: `New message from ${data.senderName}`,
      body: data.messageContent.length > 100 
        ? `${data.messageContent.substring(0, 100)}...` 
        : data.messageContent,
      icon: '/android-chrome-192x192.png',
      badge: '/android-chrome-192x192.png',
      tag: `message-${data.conversationId}`,
      data: {
        type: 'message',
        conversationId: data.conversationId,
        senderId: data.senderId,
        timestamp: data.timestamp,
      },
      requireInteraction: true,
    };

    const notification = await this.showNotification(options);

    // Handle notification click to navigate to conversation
    if (notification) {
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        
        // Determine the correct path based on user role
        // This is a simple check - you might want to make this more robust
        const isAdmin = window.location.pathname.includes('/admin');
        const conversationPath = isAdmin 
          ? `/admin/messages/${data.conversationId}`
          : `/family/messages/${data.conversationId}`;
        
        // Navigate to the conversation
        window.location.href = conversationPath;
        notification.close();
      };
    }

    return notification;
  }

  /**
   * Check if user has enabled notifications in browser settings
   */
  public areNotificationsEnabled(): boolean {
    return this.isSupported && this.permission === 'granted';
  }

  /**
   * Check if the page is currently visible (to avoid showing notifications when user is active)
   */
  public isPageVisible(): boolean {
    if (typeof document === 'undefined') return true;
    return !document.hidden;
  }

  /**
   * Check if user preferences allow notifications (stored in localStorage)
   */
  public areNotificationsEnabledByUser(): boolean {
    if (typeof window === 'undefined') return false;
    const preference = localStorage.getItem('notifications-enabled');
    return preference !== 'false'; // Default to true if not set
  }

  /**
   * Set user notification preference
   */
  public setNotificationPreference(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('notifications-enabled', enabled.toString());
  }

  /**
   * Check if we should show a notification based on all conditions
   */
  public shouldShowNotification(): boolean {
    return (
      this.areNotificationsEnabled() &&
      this.areNotificationsEnabledByUser() &&
      !this.isPageVisible()
    );
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

// Utility functions for easy access
export const requestNotificationPermission = () => notificationService.requestPermission();
export const showMessageNotification = (data: MessageNotificationData) => 
  notificationService.showMessageNotification(data);
export const areNotificationsSupported = () => notificationService.isNotificationSupported();
export const areNotificationsEnabled = () => notificationService.areNotificationsEnabled();
export const shouldShowNotification = () => notificationService.shouldShowNotification();