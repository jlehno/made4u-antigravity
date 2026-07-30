// src/lib/notifications.ts - Device Notification & Service Worker Helper

/**
 * Register the ProductionFlow Service Worker for background notifications if supported.
 */
export async function registerServiceWorker() {
  if (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    navigator.serviceWorker &&
    typeof navigator.serviceWorker.register === 'function'
  ) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('ProductionFlow Service Worker registered:', registration.scope);
      return registration;
    } catch (error) {
      console.warn('Service Worker registration skipped or not supported:', error);
    }
  }
  return null;
}

/**
 * Request notification permissions from the browser/device safely.
 * Prevents client-side crashes in mobile browsers/in-app QR scanners where Notification API is restricted.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'denied'> {
  try {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      window.Notification &&
      typeof window.Notification.requestPermission === 'function'
    ) {
      const permission = await window.Notification.requestPermission();
      if (permission === 'granted') {
        await registerServiceWorker();
      }
      return permission;
    }
  } catch (err) {
    console.warn('Notification permission request ignored or not supported in this browser context:', err);
  }
  return 'denied';
}

/**
 * Dispatch notification updates to the in-app Bell.
 */
export async function triggerNativeDeviceNotification(title: string, body: string, tag?: string) {
  return;
}
