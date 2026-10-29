import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Convert base64 string to Uint8Array for applicationServerKey
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export function usePushNotifications(userId) {
    const [isSupported, setIsSupported] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscription, setSubscription] = useState(null);
    const [permission, setPermission] = useState('default');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [registration, setRegistration] = useState(null);

    // Check if push notifications are supported
    useEffect(() => {
        const supported = 'serviceWorker' in navigator && 
                         'PushManager' in window && 
                         'Notification' in window;
        setIsSupported(supported);
        
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    // Register service worker
    useEffect(() => {
        if (!isSupported) return;

        const registerServiceWorker = async () => {
            try {
                const reg = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', reg);
                setRegistration(reg);
                
                // Check existing subscription
                const existingSub = await reg.pushManager.getSubscription();
                if (existingSub) {
                    setSubscription(existingSub);
                    setIsSubscribed(true);
                }
            } catch (err) {
                console.error('Service Worker registration failed:', err);
                setError('Failed to register service worker');
            }
        };

        registerServiceWorker();
    }, [isSupported]);

    // Request permission and subscribe
    const subscribe = useCallback(async () => {
        if (!isSupported || !registration || !userId) {
            setError('Push notifications not supported or not ready');
            return false;
        }

        setLoading(true);
        setError(null);

        try {
            // Request notification permission
            const permissionResult = await Notification.requestPermission();
            setPermission(permissionResult);
            
            if (permissionResult !== 'granted') {
                setError('Notification permission denied');
                setLoading(false);
                return false;
            }

            // Get VAPID public key from server
            const vapidResponse = await axios.get(`${API}/push/vapid-key`);
            const vapidPublicKey = vapidResponse.data.publicKey;

            // Subscribe to push notifications
            const pushSubscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });

            // Extract keys from subscription
            const p256dhKey = pushSubscription.getKey('p256dh');
            const authKey = pushSubscription.getKey('auth');

            // Send subscription to server
            await axios.post(`${API}/push/subscribe?user_id=${userId}`, {
                endpoint: pushSubscription.endpoint,
                keys: {
                    p256dh: arrayBufferToBase64(p256dhKey),
                    auth: arrayBufferToBase64(authKey)
                }
            });

            setSubscription(pushSubscription);
            setIsSubscribed(true);
            setLoading(false);
            return true;
        } catch (err) {
            console.error('Push subscription failed:', err);
            setError(err.message || 'Failed to subscribe to push notifications');
            setLoading(false);
            return false;
        }
    }, [isSupported, registration, userId]);

    // Unsubscribe
    const unsubscribe = useCallback(async () => {
        if (!subscription || !userId) return false;

        setLoading(true);
        setError(null);

        try {
            // Unsubscribe from push manager
            await subscription.unsubscribe();

            // Remove subscription from server
            await axios.delete(`${API}/push/unsubscribe?user_id=${userId}`);

            setSubscription(null);
            setIsSubscribed(false);
            setLoading(false);
            return true;
        } catch (err) {
            console.error('Push unsubscription failed:', err);
            setError(err.message || 'Failed to unsubscribe');
            setLoading(false);
            return false;
        }
    }, [subscription, userId]);

    // Test push notification (for debugging)
    const testNotification = useCallback(() => {
        if (!registration) return;

        registration.showNotification('Food Key Test', {
            body: 'Push notifications are working!',
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'test-notification',
            requireInteraction: false
        });
    }, [registration]);

    return {
        isSupported,
        isSubscribed,
        permission,
        loading,
        error,
        subscribe,
        unsubscribe,
        testNotification
    };
}

export default usePushNotifications;
