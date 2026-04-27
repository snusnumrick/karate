import { showLocalNotificationInEnvironment } from '~/utils/local-notification';

export async function showLocalNotification(
  title: string,
  options: NotificationOptions
): Promise<Notification | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  return showLocalNotificationInEnvironment(title, options, {
    notificationConstructor: window.Notification,
    serviceWorker:
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? navigator.serviceWorker
        : undefined,
  });
}
