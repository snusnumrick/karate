3333333x# Offline Testing Guide for Greenegin Karate PWA

This guide will help you test the offline functionality of the Greenegin Karate Progressive Web App (PWA).

## What Offline Features Are Available?

Based on the service worker implementation, the app provides:

### 🔄 Cached Content
- **Static Assets**: App shell, icons, manifest, offline page
- **Dynamic Content**: API responses for classes and programs
- **Navigation Pages**: Previously visited pages are cached
- **Offline Fallback**: Custom offline page when content isn't cached

### 📱 PWA Features
- **Installation**: Can be installed as a standalone app
- **Background Sync**: Queued replies for messages (stored in IndexedDB)
- **Push Notifications**: Works offline for cached notifications
- **App-like Experience**: Runs without browser UI when installed

## How to Test Offline Functionality

### Method 1: Using Browser Developer Tools (Recommended)

1. **Open the App**
   - Navigate to `http://localhost:5175/` in Chrome, Edge, or Firefox
   - Open Developer Tools (F12 or Cmd+Option+I on Mac)

2. **Enable Service Worker**
   - Go to the **Application** tab (Chrome) or **Storage** tab (Firefox)
   - Click on **Service Workers** in the left sidebar
   - Verify that `sw.js` is registered and active

3. **Simulate Offline Mode**
   - In Developer Tools, go to the **Network** tab
   - Check the **Offline** checkbox (or use the throttling dropdown and select "Offline")
   - Alternatively, in the **Application** tab, find the **Service Workers** section and check "Offline"

4. **Test Cached Content**
   - Refresh the page - it should still load
   - Navigate to different pages you've visited before
   - Try accessing the classes page (`/classes`) - should work if previously cached

5. **Test Offline Fallback**
   - Try navigating to a page you haven't visited before
   - You should see the custom offline page with the karate emoji 🥋

### Method 2: Using Network Disconnection

1. **Load the App First**
   - Visit `http://localhost:5175/` and browse around
   - Visit key pages like `/classes`, `/about`, `/contact`
   - This ensures content is cached

2. **Disconnect Network**
   - **WiFi**: Turn off WiFi on your device
   - **Ethernet**: Unplug network cable
   - **Mobile**: Enable airplane mode

3. **Test Functionality**
   - Refresh the browser - app should still work
   - Navigate between previously visited pages
   - Try accessing new pages - should show offline page

### Method 3: Testing PWA Installation

1. **Install the App**
   - Look for the install icon in the browser address bar
   - Or visit `/pwa` page for installation instructions
   - Click "Install" when prompted

2. **Test Offline in Standalone Mode**
   - Close the browser
   - Open the installed PWA app
   - Disconnect from internet
   - App should work with cached content

## What to Expect When Offline

### ✅ Should Work Offline
- **Home page** (if previously visited)
- **Classes page** (cached API data)
- **About page** (if previously visited)
- **Contact page** (if previously visited)
- **Static assets** (images, CSS, JS)
- **PWA features** (if installed)

### ❌ Won't Work Offline
- **Login/Authentication** (requires server)
- **New API requests** (unless cached)
- **Form submissions** (except queued messages)
- **Real-time data** (attendance, new messages)
- **Payment processing**

### 🔄 Queued for Later
- **Message replies** (stored in IndexedDB, sent when online)
- **Push notification interactions**

## Testing Specific Features

### 1. Service Worker Caching
```javascript
// Open browser console and run:
navigator.serviceWorker.ready.then(registration => {
  console.log('Service Worker is ready:', registration);
});

// Check cache contents:
caches.keys().then(cacheNames => {
  console.log('Available caches:', cacheNames);
});
```

### 2. PWA Installation Status
```javascript
// Check if running as PWA:
console.log('Is PWA:', window.matchMedia('(display-mode: standalone)').matches);

// Check installation capability:
console.log('Can install:', 'BeforeInstallPromptEvent' in window);
```

### 3. IndexedDB Queue (for messages)
```javascript
// Check queued messages:
const request = indexedDB.open('greenegin-pwa-db', 1);
request.onsuccess = (event) => {
  const db = event.target.result;
  const transaction = db.transaction(['queued-replies'], 'readonly');
  const store = transaction.objectStore('queued-replies');
  const getAllRequest = store.getAll();
  getAllRequest.onsuccess = () => {
    console.log('Queued messages:', getAllRequest.result);
  };
};
```

## Debugging Offline Issues

### Check Service Worker Status
1. Go to `chrome://serviceworker-internals/` (Chrome)
2. Find your app's service worker
3. Check if it's running and has no errors

### View Cache Contents
1. Developer Tools → Application → Storage → Cache Storage
2. Expand cache entries to see what's cached
3. Verify expected content is present

### Monitor Network Requests
1. Network tab in Developer Tools
2. Look for requests that fail when offline
3. Check if they're being served from cache

### Console Logs
The service worker logs helpful information:
- `🚀 SW: Service Worker script loading...`
- Cache hit/miss information
- Error messages for debugging

## Advanced Testing

### Test Background Sync
1. Go offline
2. Try to send a message (if you have access to messaging)
3. Go back online
4. Check if message was sent automatically

### Test Push Notifications
1. Enable notifications when prompted
2. Go offline
3. Trigger a notification (if possible)
4. Verify it works without internet

### Test App Updates
1. Make a change to the service worker
2. Reload the app
3. Should prompt for update when new version is available

## Troubleshooting

### Service Worker Not Registering
- Check browser console for errors
- Ensure you're on HTTPS or localhost
- Clear browser cache and try again

### Content Not Caching
- Check network tab for failed requests
- Verify service worker is intercepting requests
- Check cache storage in Developer Tools

### Offline Page Not Showing
- Ensure `/offline.html` is in the cache
- Check service worker fetch event handler
- Verify navigation requests are being handled

## Performance Testing

### Measure Cache Performance
1. Use Lighthouse in Developer Tools
2. Run audit with "Simulated throttling"
3. Check PWA score and offline functionality

### Test Load Times
1. Clear cache
2. Load app online (first visit)
3. Go offline and reload
4. Compare load times

This comprehensive testing approach will help you verify that all offline features are working correctly!