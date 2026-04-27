export type LocalNotificationConstructor = {
  permission: NotificationPermission;
  new (title: string, options?: NotificationOptions): Notification;
};

export type LocalNotificationEnvironment = {
  notificationConstructor?: LocalNotificationConstructor;
  serviceWorker?: {
    ready: PromiseLike<Pick<ServiceWorkerRegistration, 'showNotification'>>;
  };
};

export async function showLocalNotificationInEnvironment(
  title: string,
  options: NotificationOptions,
  environment: LocalNotificationEnvironment
): Promise<Notification | null> {
  const NotificationConstructor = environment.notificationConstructor;
  if (!NotificationConstructor || NotificationConstructor.permission !== 'granted') {
    return null;
  }

  try {
    return new NotificationConstructor(title, options);
  } catch (error) {
    if (environment.serviceWorker) {
      try {
        const registration = await environment.serviceWorker.ready;
        await registration.showNotification(title, options);
        return null;
      } catch (serviceWorkerError) {
        console.warn('Unable to show service worker notification:', serviceWorkerError);
      }
    }

    console.warn('Unable to show browser notification:', error);
    return null;
  }
}
