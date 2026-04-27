import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type LocalNotificationConstructor,
  showLocalNotificationInEnvironment,
} from '~/utils/local-notification';

class NativeNotificationMock {
  static permission: NotificationPermission = 'granted';

  title: string;
  options: NotificationOptions;

  constructor(title: string, options: NotificationOptions) {
    this.title = title;
    this.options = options;
  }
}

describe('showLocalNotification', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    NativeNotificationMock.permission = 'granted';
  });

  it('uses the browser Notification constructor when available', async () => {
    const notification = await showLocalNotificationInEnvironment(
      'Notifications Enabled!',
      {
        body: 'Browser notification body',
        icon: '/icon.svg',
      },
      {
        notificationConstructor: NativeNotificationMock as unknown as LocalNotificationConstructor,
      }
    );

    expect(notification).toBeInstanceOf(NativeNotificationMock);
    expect(notification).toMatchObject({
      title: 'Notifications Enabled!',
      options: {
        body: 'Browser notification body',
        icon: '/icon.svg',
      },
    });
  });

  it('falls back to service worker notifications when the constructor is illegal', async () => {
    class IllegalNotificationMock {
      static permission: NotificationPermission = 'granted';

      constructor() {
        throw new TypeError(
          "Failed to construct 'Notification': Illegal constructor. Use ServiceWorkerRegistration.showNotification() instead."
        );
      }
    }

    const showNotification = vi.fn().mockResolvedValue(undefined);
    const notification = await showLocalNotificationInEnvironment(
      'Mobile Test',
      {
        body: 'Use service worker',
        icon: '/icon.svg',
        tag: 'mobile-test',
      },
      {
        notificationConstructor: IllegalNotificationMock as unknown as LocalNotificationConstructor,
        serviceWorker: {
          ready: Promise.resolve({ showNotification }),
        },
      }
    );

    expect(notification).toBeNull();
    expect(showNotification).toHaveBeenCalledWith('Mobile Test', {
      body: 'Use service worker',
      icon: '/icon.svg',
      tag: 'mobile-test',
    });
  });

  it('does not attempt to notify without granted permission', async () => {
    NativeNotificationMock.permission = 'denied';

    await expect(
      showLocalNotificationInEnvironment(
        'Blocked',
        { body: 'No permission' },
        {
          notificationConstructor: NativeNotificationMock as unknown as LocalNotificationConstructor,
          serviceWorker: {
            ready: Promise.resolve({ showNotification: vi.fn() }),
          },
        }
      )
    ).resolves.toBeNull();
  });
});
