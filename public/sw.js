const STATIC_CACHE_NAME = 'greenegin-karate-static-v1';
const DYNAMIC_CACHE_NAME = 'greenegin-karate-dynamic-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/offline.html',
  '/favicon.ico',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/logo.svg',
  '/logo-dark.svg',
  '/logo-light.svg',
];

// Routes to cache dynamically
// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Error caching static assets', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle API requests differently
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful API responses for specific endpoints
          if (response.ok && (
            url.pathname.includes('/api/classes') ||
            url.pathname.includes('/api/programs')
          )) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseClone);
              });
          }
          return response;
        })
        .catch(() => {
          // Return cached API response if available
          return caches.match(request);
        })
    );
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseClone);
              });
          }
          return response;
        })
        .catch(() => {
          // Return cached page or fallback to offline page
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Fallback to offline page for navigation
              return caches.match('/offline.html');
            });
        })
    );
    return;
  }

  // Handle other requests (assets, etc.)
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            // Cache successful responses for assets
            if (response.ok && (
              request.destination === 'image' ||
              request.destination === 'style' ||
              request.destination === 'script' ||
              request.destination === 'font'
            )) {
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseClone);
                });
            }
            return response;
          })
          .catch((error) => {
            console.log('Service Worker: Fetch failed for', request.url, error);
            // Return a fallback for images
            if (request.destination === 'image') {
              return caches.match('/icon.svg');
            }
          });
      })
  );
});

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle any queued offline actions here
      console.log('Service Worker: Processing background sync')
    );
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push received', event);
  console.log('Service Worker: Push event data:', event.data);

  const defaultIcon = new URL('/icon.svg', self.location.origin).href;
  const defaultBadge = new URL('/icon.svg', self.location.origin).href;

  let notificationData = {
    title: 'New Message',
    body: 'You have received a new message',
    icon: defaultIcon,
    badge: defaultBadge,
    tag: 'message-notification',
    data: {},
    type: 'message',
    actions: []
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      console.log('Service Worker: Parsed push data:', pushData);
      notificationData = {
        title: pushData.title || notificationData.title,
        body: pushData.body || notificationData.body,
        icon: new URL(pushData.icon || '/icon.svg', self.location.origin).href,
        badge: new URL(pushData.badge || '/icon.svg', self.location.origin).href,
        tag: pushData.tag || notificationData.tag,
        data: pushData.data || notificationData.data,
        type: pushData.type || notificationData.type,
        actions: (pushData.actions || []).map(action => ({
          ...action,
          icon: new URL(action.icon || '/icon.svg', self.location.origin).href
        }))
      };
    } catch (error) {
      console.error('Service Worker: Error parsing push data', error);
      // Try to parse as text if JSON parsing fails
      try {
        if (event.data.text) {
          const textData = event.data.text();
          console.log('Service Worker: Push data as text:', textData);
          notificationData.body = textData;
        }
      } catch (textError) {
        console.error('Service Worker: Error parsing push data as text', textError);
      }
    }
  } else {
    console.log('Service Worker: No push data received, using default notification');
  }

  // Use actions from server payload, or fallback to default actions based on type
  let actions = notificationData.actions || [];
  let requireInteraction = true;

  console.log('Service Worker: Actions from payload:', actions);
  console.log('Service Worker: Notification type:', notificationData.type);

  const actionIcon = new URL('/icon.svg', self.location.origin).href;

  // If no actions provided by server, use default actions based on type
  if (!actions || actions.length === 0) {
    switch (notificationData.type) {
      case 'message':
          actions = [
            {
              action: 'view',
              title: 'View',
              icon: actionIcon
            },
            {
              action: 'reply',
              title: 'Quick Reply',
              icon: actionIcon
            },
            {
              action: 'dismiss',
              title: 'Dismiss',
              icon: actionIcon
            }
          ];
        requireInteraction = false;
        break;
      case 'payment':
        actions = [
          {
            action: 'view',
            title: 'View Payment',
            icon: actionIcon
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
            icon: actionIcon
          }
        ];
        break;
      case 'attendance':
        actions = [
          {
            action: 'view',
            title: 'View Details',
            icon: actionIcon
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
            icon: actionIcon
          }
        ];
        requireInteraction = false; // Less critical notifications
        break;
      case 'announcement':
        actions = [
          {
            action: 'view',
            title: 'Read More',
            icon: actionIcon
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
            icon: actionIcon
          }
        ];
        requireInteraction = false;
        break;
      default:
        actions = [
          {
            action: 'view',
            title: 'View',
            icon: actionIcon
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
            icon: actionIcon
          }
        ];
    }
  } else {
    console.log('Service Worker: Using actions from payload:', actions);
  }

  // Check if actions are supported on this platform
  const supportsActions = 'actions' in Notification.prototype;
  
  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: notificationData.data,
    requireInteraction: requireInteraction,
    actions: supportsActions ? actions : [], // Enable actions on supported platforms
    vibrate: [200, 100, 200], // Vibration pattern for mobile devices
    timestamp: Date.now(),
    renotify: true, // Allow re-notification with same tag
    silent: false,
    // Platform-agnostic options
    dir: 'auto',
    lang: 'en'
  };

  console.log('Service Worker: About to show notification with title:', notificationData.title);
  console.log('Service Worker: Notification options:', options);
  console.log('Service Worker: User agent:', navigator.userAgent);
  console.log('Service Worker: Platform detection - macOS:', navigator.userAgent.includes('Mac'));

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
      .then(() => {
        console.log('Service Worker: Notification displayed successfully');
        // Additional check for macOS
        if (navigator.userAgent.includes('Mac')) {
          console.log('Service Worker: macOS detected - check System Preferences > Notifications for browser permissions');
        }
      })
      .catch((error) => {
        console.error('Service Worker: Failed to display notification:', error);
        console.log('Service Worker: Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      })
  );
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);
  
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notificationData = event.notification.data;
  let targetUrl = '/';

  // Handle different notification types and actions
  if (event.action === 'reply' && notificationData && notificationData.conversationId) {
    const replyText = event.reply;
    if (replyText) {
      event.waitUntil(
        fetch('/api/push/reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId: notificationData.conversationId,
            message: replyText,
            userId: notificationData.userId, // Assuming userId is sent in the push data
            timestamp: new Date().toISOString(),
          }),
        })
        .then(response => {
          if (!response.ok) {
            console.error('Failed to send quick reply');
          }
        })
        .catch(error => {
          console.error('Error sending quick reply:', error);
        })
      );
    }
    return;
  } else if (notificationData) {
    // Determine target URL based on notification type and data
    switch (notificationData.type) {
      case 'message':
        if (notificationData.conversationId) {
          const isAdmin = notificationData.isAdmin || false;
          targetUrl = isAdmin 
            ? `/admin/messages/${notificationData.conversationId}`
            : `/family/messages/${notificationData.conversationId}`;
        } else {
          targetUrl = notificationData.isAdmin ? '/admin/messages' : '/family/messages';
        }
        break;
      case 'payment':
        if (notificationData.paymentId) {
          targetUrl = notificationData.isAdmin 
            ? `/admin/payments/${notificationData.paymentId}`
            : `/family/payment-history`;
        } else {
          targetUrl = notificationData.isAdmin ? '/admin/payments' : '/family/payment';
        }
        break;
      case 'attendance':
        if (notificationData.studentId) {
          targetUrl = notificationData.isAdmin 
            ? `/admin/attendance`
            : `/family/student/${notificationData.studentId}/attendance`;
        } else {
          targetUrl = notificationData.isAdmin ? '/admin/attendance' : '/family/attendance';
        }
        break;
      case 'announcement':
        targetUrl = notificationData.isAdmin ? '/admin' : '/family';
        break;
      default:
        // Fallback to conversation if available
        if (notificationData.conversationId) {
          const isAdmin = notificationData.isAdmin || false;
          targetUrl = isAdmin 
            ? `/admin/messages/${notificationData.conversationId}`
            : `/family/messages/${notificationData.conversationId}`;
        }
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (const client of clientList) {
          const clientUrl = new URL(client.url);
          const targetUrlObj = new URL(targetUrl, client.url);
          
          // Check if the client is on the same page (ignoring query parameters for basic match)
          if (clientUrl.pathname === targetUrlObj.pathname && 'focus' in client) {
            // If it's a reply action, send a message to focus the input
            if (event.action === 'reply') {
              client.postMessage({
                type: 'FOCUS_MESSAGE_INPUT',
                conversationId: notificationData?.conversationId
              });
            }
            return client.focus();
          }
        }
        
        // If no existing window/tab, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
      .catch((error) => {
        console.error('Service Worker: Error handling notification click', error);
      })
  );
});

// Handle notification close events
self.addEventListener('notificationclose', (event) => {
  console.log('Service Worker: Notification closed', event);
  // You can track notification dismissals here if needed
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});