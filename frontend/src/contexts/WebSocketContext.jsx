import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from './AppContext';
import { toast } from 'sonner';

const WebSocketContext = createContext(null);

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within WebSocketProvider');
    }
    return context;
};

export const WebSocketProvider = ({ children }) => {
    const { user, isAuthenticated } = useApp();
    const [isConnected, setIsConnected] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    const connect = useCallback(() => {
        if (!user?.id || !isAuthenticated) return;

        // Get WebSocket URL from backend URL - use /api/ws for proper routing
        const backendUrl = process.env.REACT_APP_BACKEND_URL;
        const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
        const wsHost = backendUrl.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}://${wsHost}/api/ws/${user.id}?user_type=${user.role || 'customer'}`;

        try {
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                
                // Start ping interval
                const pingInterval = setInterval(() => {
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send('ping');
                    }
                }, 30000);
                
                wsRef.current.pingInterval = pingInterval;
            };

            wsRef.current.onmessage = (event) => {
                if (event.data === 'pong') return;
                
                try {
                    const data = JSON.parse(event.data);
                    handleMessage(data);
                } catch (e) {
                    console.error('Failed to parse WebSocket message:', e);
                }
            };

            wsRef.current.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
                
                if (wsRef.current?.pingInterval) {
                    clearInterval(wsRef.current.pingInterval);
                }
                
                // Attempt to reconnect after 5 seconds
                reconnectTimeoutRef.current = setTimeout(() => {
                    if (isAuthenticated && user?.id) {
                        connect();
                    }
                }, 5000);
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
        }
    }, [user?.id, user?.role, isAuthenticated]);

    // Request notification permission on mount
    const requestNotificationPermission = useCallback(async () => {
        if ('Notification' in window && Notification.permission === 'default') {
            try {
                await Notification.requestPermission();
            } catch (error) {
                console.log('Notification permission request failed:', error);
            }
        }
    }, []);

    // Show browser notification when tab is not active
    const showBrowserNotification = useCallback((title, body, icon = '/favicon.ico') => {
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
            try {
                const notification = new Notification(title, {
                    body,
                    icon,
                    badge: '/favicon.ico',
                    tag: 'foodkey-notification',
                    requireInteraction: true
                });
                
                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };
                
                // Auto close after 10 seconds
                setTimeout(() => notification.close(), 10000);
            } catch (error) {
                console.log('Browser notification failed:', error);
            }
        }
    }, []);

    const handleMessage = useCallback((data) => {
        const { type, payload } = data;
        
        switch (type) {
            case 'new_order':
                toast.success('New Order!', {
                    description: payload.message || `New order received`,
                    duration: 5000,
                });
                // Show browser notification when tab is not active
                showBrowserNotification(
                    '🍽️ New Order!',
                    payload.message || 'You have a new order waiting',
                );
                setNotifications(prev => [payload, ...prev]);
                break;
            
            case 'order_update':
                toast.info('Order Updated', {
                    description: payload.message,
                    duration: 4000,
                });
                showBrowserNotification(
                    '📦 Order Updated',
                    payload.message || 'Order status has been updated',
                );
                setNotifications(prev => [payload, ...prev]);
                break;
            
            case 'delivery_assignment':
                toast.success('New Delivery!', {
                    description: payload.message || 'New delivery assigned to you',
                    duration: 5000,
                });
                showBrowserNotification(
                    '🚴 New Delivery!',
                    payload.message || 'A new delivery has been assigned to you',
                );
                setNotifications(prev => [payload, ...prev]);
                break;
            
            case 'notification':
                toast(payload.title, {
                    description: payload.message,
                    duration: 4000,
                });
                showBrowserNotification(
                    payload.title || 'Notification',
                    payload.message,
                );
                setNotifications(prev => [payload, ...prev]);
                break;
            
            default:
                console.log('Unknown WebSocket message type:', type);
        }
    }, [showBrowserNotification]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            if (wsRef.current.pingInterval) {
                clearInterval(wsRef.current.pingInterval);
            }
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
    }, []);

    useEffect(() => {
        if (isAuthenticated && user?.id) {
            connect();
            // Request notification permission for partners
            if (user?.role === 'restaurant' || user?.role === 'delivery') {
                requestNotificationPermission();
            }
        } else {
            disconnect();
        }
        
        return () => {
            disconnect();
        };
    }, [isAuthenticated, user?.id, user?.role, connect, disconnect, requestNotificationPermission]);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    // Check if browser notifications are enabled
    const notificationsEnabled = 'Notification' in window && Notification.permission === 'granted';

    const value = {
        isConnected,
        notifications,
        clearNotifications,
        connect,
        disconnect,
        requestNotificationPermission,
        notificationsEnabled,
    };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};

export default WebSocketContext;
