// src/lib/notifications.ts - Device Notification & Service Worker Helper

/**
 * Register the ProductionFlow Service Worker for background and lock screen notifications.
 */
export async function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('ProductionFlow Service Worker registered:', registration.scope);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
  return null;
}

/**
 * Request notification permissions from the browser/device.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await registerServiceWorker();
      }
      return permission;
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
  }
  return 'denied';
}

/**
 * Dispatch notification updates to the in-app Bell.
 * Phone / OS native push banners are disabled per settings so only the top-right Notification Bell updates.
 */
export async function triggerNativeDeviceNotification(title: string, body: string, tag?: string) {
  // Phone/OS system push notifications disabled - top-right Bell is driven by Firestore userNotifications
  return;
}
