/// <reference lib="webworker" />

// Service Worker for Karate School Management System
// Handles push notifications, caching, and offline functionality

console.log('🚀 SW: Service Worker script loading...');
console.log('🚀 SW: Timestamp:', new Date().toISOString());
console.log('🚀 SW: Location:', self.location.href);

// --- ADDED: Code to handle authentication token ---
let authToken = null; // Global variable to store the auth token

// Listen for messages from the main application to receive the token
self.addEventListener('message', (event) => {
   console.log(`📨 SW: Message from main app - ${event.data.type}`);
    if (event.data && event.data.type === 'SET_AUTH_TOKEN') {
        authToken = event.data.token;
        // console.log('🔑 SW: Auth token set');
    }
    if (event.data && event.data.type === 'CLEAR_AUTH_TOKEN') {
        authToken = null;
        // console.log('🗑️ SW: Auth token cleared');
    }
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('⏭️ SW: Skip waiting requested');
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'TEST_CONNECTION') {
        console.log('🧪 SW: Test connection received, responding back...');
        // Send a response back to confirm communication works
        event.source.postMessage({
            type: 'TEST_CONNECTION_RESPONSE',
            message: 'Service worker is active and responding',
            timestamp: Date.now()
        });
    }
});
// --- END ADDED CODE ---


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
        request.onerror = () => reject('Error opening IndexedDB.');
        request.onsuccess = (event) => resolve(event.target.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(REPLY_STORE_NAME)) {
                db.createObjectStore(REPLY_STORE_NAME, {autoIncrement: true});
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
    const {request} = event;
    const url = new URL(request.url);
    // console.log('Service Worker: Fetching', request.url, request.mode);

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
                .catch(() => {
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Return a proper offline response for API requests
                        return new Response(JSON.stringify({ error: 'Offline', message: 'This data is not available offline' }), {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
                })
        );
        return;
    }

    // Data route requests (Remix loader data): Network-first, fallback to cache, then offline response
    if (url.search.includes('_data=')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache successful data responses
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(DYNAMIC_CACHE_NAME).then((cache) => cache.put(request, responseClone));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Return a proper offline response for data routes
                        return new Response(JSON.stringify({ offline: true, message: 'Data not available offline' }), {
                            status: 200,
                            statusText: 'OK',
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
                })
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
                .catch(() => {
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        return caches.match('/offline.html');
                    });
                })
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
                    return caches.match('/icon.svg').then((fallbackIcon) => {
                        if (fallbackIcon) {
                            return fallbackIcon;
                        }
                        // If even the fallback icon is not cached, return a minimal SVG
                        return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" fill="#ccc"/></svg>', {
                            headers: { 'Content-Type': 'image/svg+xml' }
                        });
                    });
                }
                // For other assets like scripts, return a proper error response
                return new Response('', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            });
        })
    );
});

// --- Background Sync Event ---

/**
 * Handles processing the queue of replies when the network is available.
 */
async function processQueuedReplies() {
  console.log('--- Background Sync: Processing queued replies ---');
  const queuedReplies = await getAndClearQueuedReplies();
    for (const reply of queuedReplies) {
        try {
            // --- MODIFIED: Use the payload and token from the queued object ---
            const response = await fetch('/api/push/reply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${reply.authToken}`
                },
                body: JSON.stringify(reply.payload),
            });
            // --- END MODIFICATION ---
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
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('📊 Event details:', {
        hasData: !!event.data,
        dataType: event.data ? typeof event.data : 'no data',
        origin: self.location.origin
    });
    
    // Detect Android for platform-specific handling
    const isAndroid = /Android/i.test(navigator.userAgent);
    console.log(`📱 Platform detection: Android=${isAndroid}, UserAgent=${navigator.userAgent}`);

    let notificationData = {title: 'New Message', body: 'You have a new message.'};

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
            icon: action.icon ? new URL(action.icon, self.location.origin).href : undefined,
            type: action.type, // Preserve type for text input fields
            placeholder: action.placeholder // Preserve placeholder for text input fields
        }));
        console.log(`🎬 Processed actions (${actions.length}/${notificationData.actions.length}):`, actions);
    } else {
        console.log('⚠️ No actions available or actions not supported');
    }

    // Android-specific vibration patterns (some Android devices are picky about vibration)
    const getVibrationPattern = (isTest = false) => {
        if (!isAndroid) {
            return isTest ? [300, 200, 300, 200, 300] : [200, 100, 200];
        }
        
        // Android-specific patterns (shorter, more compatible)
        if (isTest) {
            return [200, 100, 200, 100, 200]; // Shorter pattern for Android
        }
        return [200, 100, 200]; // Standard pattern for Android
    };

    const options = {
        body: notificationData.body,
        icon: new URL(notificationData.icon || '/icon.svg', self.location.origin).href,
        badge: new URL(notificationData.badge || '/icon.svg', self.location.origin).href,
        tag: notificationData.tag || (isTestNotification ? 'test-notification' : `message-${notificationData.data?.messageId || notificationData.data?.conversationId || 'default'}`),
        data: notificationData.data || {},
        requireInteraction: notificationData.requireInteraction || false,
        vibrate: getVibrationPattern(isTestNotification),
        actions: actions,
        silent: false,
        renotify: true,
        // Android-specific optimizations
        ...(isAndroid && {
            // Some Android versions work better with these settings
            timestamp: Date.now(),
            // Ensure proper icon sizing for Android
            image: notificationData.image ? new URL(notificationData.image, self.location.origin).href : undefined
        })
    };

    // Modify options for test notifications
    if (isTestNotification) {
        console.log('🧪 Test notification detected - applying special settings');
        options.body = `[TEST] ${options.body}`;
        options.tag = 'test-notification';
        options.requireInteraction = true; // Make test notifications persistent
        options.silent = false; // Ensure sound/vibration
        options.renotify = true; // Force renotification
        options.vibrate = getVibrationPattern(true);
        
        // Android-specific test notification enhancements
        if (isAndroid) {
            console.log('📱 Applying Android-specific test notification settings');
            // Force timestamp to ensure uniqueness
            options.timestamp = Date.now();
            // Ensure the notification is not grouped with others
            options.tag = `test-notification-${Date.now()}`;
        }
    }

    console.log('🎯 About to show notification with title:', notificationData.title);
    console.log('🎯 About to show notification with options:', JSON.stringify(options, null, 2));
    console.log('🎯 Notification type:', notificationData.type);
    console.log('🎯 Original title from payload:', notificationData.title);
    console.log('🎯 Actions count:', options.actions.length);
    console.log(`🎯 Platform: ${isAndroid ? 'Android' : 'Desktop'}`);

    // Check if any clients (tabs) are currently focused
    const showNotificationPromise = self.clients.matchAll({type: 'window', includeUncontrolled: true})
        .then((clients) => {
            const hasVisibleClient = clients.some(client => client.visibilityState === 'visible');

            console.log(`📱 Found ${clients.length} client(s), visible clients: ${hasVisibleClient}`);

            if (isTestNotification) {
                console.log('🧪 Test notification - forcing display regardless of page visibility');
                console.log('🧪 Test notification will use tag:', options.tag);
                
                if (isAndroid) {
                    console.log('📱 Android test notification - using enhanced visibility settings');
                }
            }

            // Always show the notification (browsers may still suppress if page is active)
            return self.registration.showNotification(notificationData.title, options);
        })
        .then(() => {
            console.log(`✅ Notification displayed successfully`);

            // Additional debugging: Check if notification was actually created
            return self.registration.getNotifications();
        })
        .then((notifications) => {
            console.log(`📋 Active notifications after creation: ${notifications.length}`);
            notifications.forEach((notification, index) => {
                console.log(`   ${index + 1}. "${notification.title}" (tag: ${notification.tag})`);
            });
            
            // Android-specific debugging
            if (isAndroid && notifications.length === 0) {
                console.warn('⚠️ Android: No notifications found after creation - possible Android-specific issue');
                console.warn('💡 Android troubleshooting:');
                console.warn('   - Check if browser has notification permission');
                console.warn('   - Check if device is in Do Not Disturb mode');
                console.warn('   - Check if app is in battery optimization whitelist');
                console.warn('   - Verify network connectivity');
            }
        })
        .catch((error) => {
            console.error('❌ Failed to display notification:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                platform: isAndroid ? 'Android' : 'Desktop'
            });
            
            // Android-specific error handling
            if (isAndroid) {
                console.error('📱 Android-specific error occurred');
                if (error.name === 'NotAllowedError') {
                    console.error('🚫 Android: Notification permission denied or restricted');
                } else if (error.name === 'AbortError') {
                    console.error('⏹️ Android: Notification was aborted (possibly by system)');
                } else {
                    console.error('❓ Android: Unknown notification error');
                }
            }
        });

    event.waitUntil(showNotificationPromise);
});

// Handle notification click events
console.log('🔧 SW: Registering notificationclick event listener');
self.addEventListener('notificationclick', (event) => {
    console.log('🚨 SW: NOTIFICATION CLICK EVENT TRIGGERED!');
    console.log('🚨 SW: Event object:', event);
    console.log('🚨 SW: Event type:', event.type);
    console.log('🚨 SW: Notification object:', event.notification);
    
    const notificationData = event.notification.data;
    const action = event.action;
    console.log(`🔔 Notification clicked - Action: ${action || 'default'}`);
    console.log(`🔔 Notification data:`, JSON.stringify(notificationData, null, 2));

    // Handle dismiss action - close and do nothing else
    if (action === 'dismiss') {
        event.notification.close();
        return;
    }

    // Handle quick reply action using Background Sync
    if (action === 'reply' && event.reply && notificationData) {
      console.log('--- Quick Reply Debug START ---');
        // Close any other notifications with the same tag to prevent duplication
        const notificationTag = event.notification.tag;
        if (notificationTag) {
            self.registration.getNotifications({tag: notificationTag}).then(notifications => {
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
        /*    self.clients.matchAll().then(clients => {
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
            });*/

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
            (async () => {
                if (!authToken) {
                    console.error("Quick Reply Error: Auth token not available.");
                    return self.registration.showNotification('Reply Failed', {
                        body: 'Authentication required. Please open the app to send.',
                        icon: '/icon.svg',
                        tag: 'reply-failed',
                    });
                }

                try {
                    const response = await fetch('/api/push/reply', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(replyData),
                    });

                    if (!response.ok) {
                        throw new Error('Server error'); // This will be caught below
                    }
                } catch (error) {
                    console.log('Online reply failed, queueing for background sync.', error);
                    await addQueuedReply({payload: replyData, authToken: authToken});
                    await self.registration.sync.register('sync-queued-replies');

                    return self.registration.showNotification('Reply Queued', {
                        body: 'Your reply will be sent when you\'re back online.',
                        icon: '/icon.svg',
                        tag: 'reply-queued',
                    });
                }
            })()
        );
        return;
    }

    // For view action and default click, navigate to the URL
    if (action === 'view' || !action) {
        console.log(`🔔 Handling navigation action: ${action || 'default click'}`);
        console.log('📋 Full notification data:', JSON.stringify(notificationData, null, 2));
        
        event.waitUntil(
            self.clients.matchAll({type: 'window', includeUncontrolled: true}).then((clientList) => {
                const targetUrl = notificationData?.url || '/';
                
                console.log('🔍 Client search results:');
                console.log(`   - Total clients found: ${clientList.length}`);
                clientList.forEach((client, index) => {
                    console.log(`   - Client ${index + 1}: ${client.url} (focused: ${client.focused}, type: ${client.type})`);
                });
                
                // Validate URL to prevent navigation to undefined paths
                if (targetUrl.includes('/undefined') || targetUrl.includes('undefined')) {
                    console.error('🚫 Invalid URL detected, preventing navigation:', targetUrl);
                    event.notification.close();
                    return;
                }
                
                console.log('🔗 Target URL for navigation:', targetUrl);
                console.log('🌐 Service worker origin:', self.location.origin);
                
                // Try to find an existing client with the same origin and focus it
                for (const client of clientList) {
                    console.log(`🔍 Checking client: ${client.url}`);
                    console.log(`   - Has same origin: ${client.url.includes(self.location.origin)}`);
                    console.log(`   - Has focus capability: ${'focus' in client}`);
                    
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        console.log('🎯 Found matching client, focusing and sending navigation message');
                        console.log('📤 Sending postMessage with data:', {
                            type: 'NAVIGATE',
                            url: targetUrl
                        });
                        
                        event.notification.close();
                        return client.focus().then(() => {
                            console.log('✅ Client focused successfully');
                            // Send message to client to handle navigation
                            const message = {
                                type: 'NAVIGATE',
                                url: targetUrl
                            };
                            console.log('📨 Posting navigation message:', message);
                            return client.postMessage(message);
                        }).then(() => {
                            console.log('✅ Navigation message sent successfully');
                        }).catch((error) => {
                            console.error('❌ Error during client focus/message:', error);
                        });
                    }
                }
                
                // No existing client found, open a new window
                if (self.clients.openWindow) {
                    console.log('🆕 No matching clients found, opening new window');
                    console.log('🔗 Opening URL:', targetUrl);
                    event.notification.close();
                    return self.clients.openWindow(targetUrl).then((newClient) => {
                        console.log('✅ New window opened successfully:', newClient ? 'with client' : 'without client reference');
                    }).catch((error) => {
                        console.error('❌ Error opening new window:', error);
                    });
                }
                
                // Fallback: close notification
                console.warn('⚠️ No navigation method available, closing notification');
                event.notification.close();
            }).catch((error) => {
                console.error('❌ Navigation error:', error);
                console.error('Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
                event.notification.close();
            })
        );
        return;
    }
});