/* eslint-disable no-restricted-globals */

// Service Worker for Food Key Push Notifications

const CACHE_NAME = 'foodkey-v1';

// Install event
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('Service Worker activated');
    event.waitUntil(self.clients.claim());
});

// Push notification event
self.addEventListener('push', (event) => {
    console.log('Push notification received:', event);
    
    let data = {
        title: 'Food Key',
        body: 'You have a new notification',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'foodkey-push',
        data: {}
    };
    
    if (event.data) {
        try {
            const payload = event.data.json();
            data = {
                title: payload.title || data.title,
                body: payload.body || payload.message || data.body,
                icon: payload.icon || data.icon,
                badge: payload.badge || data.badge,
                tag: payload.tag || data.tag,
                data: payload.data || payload,
                actions: payload.actions || [],
                requireInteraction: payload.requireInteraction || false
            };
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        tag: data.tag,
        data: data.data,
        actions: data.actions,
        requireInteraction: data.requireInteraction,
        vibrate: [200, 100, 200]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);
    
    event.notification.close();
    
    const data = event.notification.data || {};
    let targetUrl = '/';
    
    // Determine where to navigate based on notification type
    if (data.type === 'new_order') {
        targetUrl = data.restaurant_id 
            ? `/dashboard/restaurant` 
            : '/orders';
    } else if (data.type === 'order_update') {
        targetUrl = data.order_id 
            ? `/track/${data.order_id}` 
            : '/orders';
    } else if (data.type === 'delivery_assignment') {
        targetUrl = '/dashboard/delivery';
    } else if (data.url) {
        targetUrl = data.url;
    }
    
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Try to focus an existing window
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(targetUrl);
                        return client.focus();
                    }
                }
                // Open a new window if no existing window
                if (self.clients.openWindow) {
                    return self.clients.openWindow(targetUrl);
                }
            })
    );
});

// Handle notification close event
self.addEventListener('notificationclose', (event) => {
    console.log('Notification closed:', event);
});

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('Push subscription changed:', event);
    
    event.waitUntil(
        self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: event.oldSubscription?.options?.applicationServerKey
        }).then((subscription) => {
            // Send new subscription to server
            return fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: btoa(String.fromCharCode.apply(null, 
                            new Uint8Array(subscription.getKey('p256dh')))),
                        auth: btoa(String.fromCharCode.apply(null, 
                            new Uint8Array(subscription.getKey('auth'))))
                    }
                })
            });
        })
    );
});
