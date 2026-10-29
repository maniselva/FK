import React from 'react';
import { Bell, BellOff, Check, AlertCircle, Smartphone } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { toast } from 'sonner';

export function NotificationSettings({ userId }) {
    const {
        isSupported,
        isSubscribed,
        permission,
        loading,
        error,
        subscribe,
        unsubscribe,
        testNotification
    } = usePushNotifications(userId);

    const handleToggle = async () => {
        if (isSubscribed) {
            const success = await unsubscribe();
            if (success) {
                toast.success('Push notifications disabled');
            } else {
                toast.error('Failed to disable notifications');
            }
        } else {
            const success = await subscribe();
            if (success) {
                toast.success('Push notifications enabled! You\'ll now receive updates even when the app is closed.');
            } else if (permission === 'denied') {
                toast.error('Notifications blocked. Please enable them in your browser settings.');
            } else {
                toast.error('Failed to enable notifications');
            }
        }
    };

    const handleTest = () => {
        testNotification();
        toast.info('Test notification sent!');
    };

    if (!isSupported) {
        return (
            <Card className="border-border">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BellOff size={20} />
                        Push Notifications
                    </CardTitle>
                    <CardDescription>
                        Push notifications are not supported in this browser
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Try using a modern browser like Chrome, Firefox, or Edge to enable push notifications.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border" data-testid="notification-settings">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell size={20} className={isSubscribed ? 'text-primary' : 'text-muted-foreground'} />
                    Push Notifications
                </CardTitle>
                <CardDescription>
                    Receive order updates and important alerts even when the app is closed
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isSubscribed ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                            {isSubscribed ? (
                                <Check className="text-green-600" size={20} />
                            ) : (
                                <BellOff className="text-gray-500" size={20} />
                            )}
                        </div>
                        <div>
                            <p className="font-medium">
                                {isSubscribed ? 'Notifications Enabled' : 'Notifications Disabled'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {isSubscribed 
                                    ? 'You\'ll receive push notifications'
                                    : 'Enable to get real-time updates'
                                }
                            </p>
                        </div>
                    </div>
                    <Switch
                        checked={isSubscribed}
                        onCheckedChange={handleToggle}
                        disabled={loading || permission === 'denied'}
                        data-testid="push-notification-toggle"
                    />
                </div>

                {/* Permission denied warning */}
                {permission === 'denied' && (
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="text-red-500 mt-0.5" size={20} />
                        <div>
                            <p className="font-medium text-red-700">Notifications Blocked</p>
                            <p className="text-sm text-red-600 mt-1">
                                You've blocked notifications for this site. To enable them:
                            </p>
                            <ol className="text-sm text-red-600 mt-2 list-decimal list-inside space-y-1">
                                <li>Click the lock/info icon in your browser's address bar</li>
                                <li>Find "Notifications" in the settings</li>
                                <li>Change it from "Block" to "Allow"</li>
                                <li>Refresh this page</li>
                            </ol>
                        </div>
                    </div>
                )}

                {/* Error message */}
                {error && permission !== 'denied' && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {/* Features */}
                <div className="space-y-3 pt-2">
                    <p className="text-sm font-medium">You'll be notified about:</p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                            <Check size={14} className="text-green-500" />
                            New orders (for restaurant partners)
                        </li>
                        <li className="flex items-center gap-2">
                            <Check size={14} className="text-green-500" />
                            Order status updates
                        </li>
                        <li className="flex items-center gap-2">
                            <Check size={14} className="text-green-500" />
                            Delivery assignments (for delivery partners)
                        </li>
                        <li className="flex items-center gap-2">
                            <Check size={14} className="text-green-500" />
                            Special offers and promotions
                        </li>
                    </ul>
                </div>

                {/* Test button */}
                {isSubscribed && (
                    <div className="pt-2 border-t border-border">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleTest}
                            className="w-full"
                            data-testid="test-notification-btn"
                        >
                            <Smartphone size={16} className="mr-2" />
                            Send Test Notification
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default NotificationSettings;
