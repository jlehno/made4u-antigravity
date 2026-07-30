// public/sw.js - ProductionFlow Service Worker for Background & Lock-Screen Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming push messages
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'ProductionFlow Notification';
    const options = {
      body: data.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.tag || 'productionflow-notification-' + Date.now(),
      renotify: true,
      requireInteraction: true,
      data: { url: data.url || '/dashboard' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Error handling push event in Service Worker:', err);
  }
});

// Handle notification clicks (lock screen / background banner tap)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
