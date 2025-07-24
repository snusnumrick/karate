/// <reference lib="webworker" />

// --- Constants ---
const STATIC_CACHE_NAME = 'greenegin-karate-static-v1';
const DYNAMIC_CACHE_NAME = 'greenegin-karate-dynamic-v1';
const DB_NAME = 'greenegin-pwa-db';
const DB_VERSION = 1;
const REPLY_STORE_NAME = 'queued-replies';

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

// --- IndexedDB Helpers for Background Sync ---

/**
 * Opens the IndexedDB database.
 */
function openDb() {
  return new Promise((resolve, reject) => {
    const request = self.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => reject('Error opening IndexedDB.');
    request.onsuccess = (event) => resolve(event.target.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(REPLY_STORE_NAME)) {
        db.createObjectStore(REPLY_STORE_NAME, { autoIncrement: true });
      }
    };
  });
}

/**
 * Adds a reply object to the queue in IndexedDB.
 */
async function addQueuedReply(replyData) {
  const db = await openDb();
  const tx = db.transaction(REPLY_STORE_NAME, 'readwrite');
  const store = tx.objectStore(REPLY_STORE_NAME);
  await store.add(replyData);
  return tx.complete;
}

/**
 * Retrieves and clears all queued replies from IndexedDB.
 */
async function getAndClearQueuedReplies() {
  const db = await openDb();
  const tx = db.transaction(REPLY_STORE_NAME, 'readwrite');
  const store = tx.objectStore(REPLY_STORE_NAME);
  const replies = await store.getAll();
  await store.clear();
  await tx.complete;
  return replies;
}

// --- Service Worker Lifecycle Events ---

// Install event - cache static assets
self.addEventListener('install', (event) => {
  // console.log('Service Worker: Installing...');
  event.waitUntil(
      caches.open(STATIC_CACHE_NAME)
          .then((cache) => cache.addAll(STATIC_ASSETS))
          .then(() => self.skipWaiting())
          .catch((error) => console.error('SW Install Error:', error))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  // console.log('Service Worker: Activating...');
  event.waitUntil(
      caches.keys()
          .then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                  if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                    // console.log('Service Worker: Deleting old cache', cacheName);
                    return caches.delete(cacheName);
                  }
                })
            );
          })
          .then(() => self.clients.claim())
  );
});

// --- Network & Cache Handling ---

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and external requests
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  // API requests: Network-first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
        fetch(request)
            .then((response) => {
              // Only cache successful API responses for specific endpoints
              if (response.ok && (url.pathname.includes('/api/classes') || url.pathname.includes('/api/programs'))) {
                const responseClone = response.clone();
                caches.open(DYNAMIC_CACHE_NAME).then((cache) => cache.put(request, responseClone));
              }
              return response;
            })
            .catch(() => caches.match(request))
    );
    return;
  }

  // Navigation requests: Network-first, fallback to cache, then offline page
  if (request.mode === 'navigate') {
    event.respondWith(
        fetch(request)
            .then((response) => {
              // Cache successful navigation responses
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(DYNAMIC_CACHE_NAME).then((cache) => cache.put(request, responseClone));
              }
              return response;
            })
            // if offline, return cached page or fallback to offline page
            .catch(() => caches.match(request).then((res) => res || caches.match('/offline.html')))
    );
    return;
  }

// Other requests (assets): Cache-first, fallback to network
  event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // If the asset is in the cache, return it.
        if (cachedResponse) {
          return cachedResponse;
        }

        // If not in cache, try to fetch it from the network.
        return fetch(request).then((response) => {
          // If fetch is successful, cache it and return it.
          if (response.ok && ['image', 'style', 'script', 'font'].includes(request.destination)) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          // If the fetch fails (e.g., offline)...
          // and if the request was for an image, return the fallback icon.
          if (request.destination === 'image') {
            return caches.match('/icon.svg');
          }
          // For other assets like scripts, we don't provide a fallback.
        });
      })
  );
});

// --- Background Sync Event ---

/**
 * Handles processing the queue of replies when the network is available.
 */
async function processQueuedReplies() {
  const queuedReplies = await getAndClearQueuedReplies();
  for (const reply of queuedReplies) {
    try {
      const response = await fetch('/api/push/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reply),
      });
      if (!response.ok) {
        // If it fails again, re-add to the queue to be retried later.
        await addQueuedReply(reply);
      }
    } catch (error) {
      // Re-add to queue if the fetch itself fails.
      await addQueuedReply(reply);
      // Let the sync manager retry later.
      throw new Error('Failed to send queued reply, will retry later.');
    }
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queued-replies') {
    event.waitUntil(processQueuedReplies());
  }
});

// --- Push Notification Events ---

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('🔔 Push event received in service worker');
  
  let notificationData = { title: 'New Message', body: 'You have a new message.' };

  if (event.data) {
    try {
      notificationData = event.data.json();
      console.log('📨 Push notification data:', JSON.stringify(notificationData, null, 2));
    } catch (e) {
      console.warn('⚠️ Failed to parse push data as JSON, using text:', e);
      notificationData.body = event.data.text();
    }
  } else {
    console.warn('⚠️ Push event received with no data');
  }

  // Check if this is a test notification BEFORE setting up options
  console.log('🔍 Raw notification data structure:', {
    hasType: 'type' in notificationData,
    typeValue: notificationData.type,
    typeType: typeof notificationData.type,
    title: notificationData.title,
    body: notificationData.body,
    allKeys: Object.keys(notificationData),
    dataKeys: notificationData.data ? Object.keys(notificationData.data) : 'no data object',
    actions: notificationData.actions ? notificationData.actions.length : 'no actions'
  });
  
  const isTestNotification = notificationData.type === 'test' || 
                           (notificationData.data && notificationData.data.type === 'test') ||
                           (notificationData.title && notificationData.title.toLowerCase().includes('test'));
  console.log('🔍 Notification type check:', notificationData.type, 'isTest:', isTestNotification);

  // Ensure actions are properly formatted and available
  let actions = [];
  if ('actions' in Notification.prototype && notificationData.actions && Array.isArray(notificationData.actions)) {
    actions = notificationData.actions.map(action => ({
      action: action.action,
      title: action.title,
      icon: action.icon ? new URL(action.icon, self.location.origin).href : undefined
    }));
    console.log('🎬 Processed actions:', actions);
  } else {
    console.log('⚠️ No actions available or actions not supported');
  }

  const options = {
    body: notificationData.body,
    icon: new URL(notificationData.icon || '/icon.svg', self.location.origin).href,
    badge: new URL(notificationData.badge || '/icon.svg', self.location.origin).href,
    tag: notificationData.tag || (isTestNotification ? 'test-notification' : `message-${notificationData.data?.conversationId || 'default'}`),
    data: notificationData.data || {},
    requireInteraction: notificationData.requireInteraction || false,
    vibrate: notificationData.vibrate || [200, 100, 200],
    actions: actions,
    // Force show notification even when page is active (for test notifications)
    silent: false,
    renotify: true,
  };

  // Modify options for test notifications
  if (isTestNotification) {
    console.log('🧪 Test notification detected - applying special settings');
    options.body = `[TEST] ${options.body}`;
    options.tag = 'test-notification';
    options.requireInteraction = true; // Make test notifications persistent
    options.silent = false; // Ensure sound/vibration
    options.renotify = true; // Force renotification
    // Try to make it more visible
    options.vibrate = [300, 200, 300, 200, 300];
  }

  console.log('🎯 About to show notification with title:', notificationData.title);
  console.log('🎯 About to show notification with options:', JSON.stringify(options, null, 2));
  console.log('🎯 Notification type:', notificationData.type);
  console.log('🎯 Original title from payload:', notificationData.title);
  console.log('🎯 Actions count:', options.actions.length);

  // Check if any clients (tabs) are currently focused
  const showNotificationPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((clients) => {
      const hasVisibleClient = clients.some(client => client.visibilityState === 'visible');
      
      console.log(`📱 Found ${clients.length} client(s), visible clients: ${hasVisibleClient}`);
      
      if (isTestNotification) {
        console.log('🧪 Test notification - forcing display regardless of page visibility');
        console.log('🧪 Test notification will use tag:', options.tag);
      }
      
      // Always show the notification (browsers may still suppress if page is active)
      return self.registration.showNotification(notificationData.title, options);
    })
    .then(() => {
      console.log('✅ Notification displayed successfully');
      
      // Additional debugging: Check if notification was actually created
      return self.registration.getNotifications();
    })
    .then((notifications) => {
      console.log(`📋 Active notifications after creation: ${notifications.length}`);
      notifications.forEach((notification, index) => {
        console.log(`   ${index + 1}. "${notification.title}" (tag: ${notification.tag})`);
      });
    })
    .catch((error) => {
      console.error('❌ Failed to display notification:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    });

  event.waitUntil(showNotificationPromise);
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  const notificationData = event.notification.data;
  const action = event.action;

  if (action === 'dismiss') {
    event.notification.close();
    return;
  }

  // Handle quick reply action using Background Sync
  if (action === 'reply' && event.reply && notificationData) {
    // Close the notification immediately for quick replies
    event.notification.close();
    
    // Also close any other notifications with the same tag to prevent duplication
    const notificationTag = event.notification.tag;
    if (notificationTag) {
      self.registration.getNotifications({ tag: notificationTag }).then(notifications => {
        notifications.forEach(notification => notification.close());
      });
    }
    
    // console.log('--- Quick Reply Debug START ---');
    // console.log('Full notification data received:', JSON.stringify(notificationData, null, 2));
    // console.log('Action:', action);
    // console.log('Reply text:', event.reply);
    // console.log('Extracted conversationId:', notificationData.conversationId);
    // console.log('Extracted userId:', notificationData.userId);
    // console.log('--- Quick Reply Debug END ---');

    // Send debug info to main thread
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'QUICK_REPLY_DEBUG',
          data: {
            notificationData: notificationData,
            action: action,
            reply: event.reply,
            conversationId: notificationData.conversationId,
            userId: notificationData.userId
          }
        });
      });
    });

    const replyData = {
      conversationId: notificationData.conversationId,
      message: event.reply,
      userId: notificationData.userId,
      timestamp: new Date().toISOString(),
    };

    // console.log('--- Quick Reply Payload Debug ---');
    // console.log('Payload object being sent:', replyData);
    // console.log('Stringified body:', JSON.stringify(replyData));
    // console.log('-------------------------');

    event.waitUntil(
        fetch('/api/push/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(replyData),
        })
        .then(response => {
          if (!response.ok) {
            console.error('Quick reply failed:', response.status, response.statusText);
            // Show a failure notification
            return self.registration.showNotification('Reply Failed', {
              body: `Your reply could not be sent. Please try again. ${response.statusText}`,
              icon: '/icon.svg',
              tag: 'reply-failed',
              requireInteraction: false
            });
          } else {
            // console.log('Quick reply sent successfully');
            // Don't show any success notification to avoid clutter
            return Promise.resolve();
          }
        })
        .catch((error) => {
          console.error('Quick reply network error:', error);
          // If fetch fails (offline), queue for background sync
          return addQueuedReply(replyData)
            .then(() => self.registration.sync.register('sync-queued-replies'))
            .then(() => {
              // Show queued notification
              return self.registration.showNotification('Reply Queued', {
                body: 'Your reply will be sent when you\'re back online.',
                icon: '/icon.svg',
                tag: 'reply-queued',
                requireInteraction: false
              });
            });
        })
    );
    return;
  }

  // For all other actions (including default click), close notification and handle normally
  event.notification.close();

  // Handle default click action (open a URL)
  event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        const targetUrl = notificationData?.url || '/';

        for (const client of clientList) {
          if (new URL(client.url).pathname === new URL(targetUrl, client.url).pathname && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});