import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
    Bike, Package, IndianRupee, MapPin, ArrowLeft, CheckCircle, 
    ToggleRight, ToggleLeft, Bell, AlertCircle, Clock, Navigation,
    Phone, CreditCard, Wallet, TrendingUp, Calendar, Wifi, WifiOff,
    ExternalLink, Timer, AlertTriangle, User, Check
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useApp } from '../contexts/AppContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import DeliveryPartnerMap from '../components/DeliveryPartnerMap';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DeliveryDashboard() {
    const { user, isAuthenticated, detectLocation, location } = useApp();
    const { isConnected, notifications: wsNotifications } = useWebSocket();
    const [dashboard, setDashboard] = useState(null);
    const [earnings, setEarnings] = useState(null);
    const [nearbyOrders, setNearbyOrders] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showOrderDetail, setShowOrderDetail] = useState(null);
    const [showDelayDialog, setShowDelayDialog] = useState(false);
    const [delayReason, setDelayReason] = useState('heavy_traffic');
    const [delayMinutes, setDelayMinutes] = useState(10);
    const [orderDirections, setOrderDirections] = useState(null);
    const [locating, setLocating] = useState(false);
    // COD Settlement state
    const [codSettlements, setCodSettlements] = useState([]);
    const [showCodSubmit, setShowCodSubmit] = useState(false);
    const [codSubmitData, setCodSubmitData] = useState({ amount: '', comment: '' });
    // Payouts state
    const [payouts, setPayouts] = useState([]);
    // Custom orders assigned to this partner
    const [customOrders, setCustomOrders] = useState([]);
    // Today's stats (KM tracking)
    const [todayStats, setTodayStats] = useState(null);

    const fetchTodayStats = useCallback(async (partnerId) => {
        try {
            const response = await axios.get(`${API}/delivery-partner/${partnerId}/today-stats`);
            setTodayStats(response.data);
        } catch (error) {
            console.error('Failed to fetch today stats:', error);
        }
    }, []);

    const fetchDashboard = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/dashboard/delivery/${user.id}`);
            setDashboard(response.data);
        } catch (error) {
            if (error.response?.status === 404) {
                setDashboard(null);
            }
            console.error('Failed to fetch dashboard:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    const fetchEarnings = useCallback(async (partnerId) => {
        try {
            const response = await axios.get(`${API}/delivery-partners/${partnerId}/earnings`);
            setEarnings(response.data);
        } catch (error) {
            console.error('Failed to fetch earnings:', error);
        }
    }, []);

    const fetchNearbyOrders = useCallback(async (partnerId) => {
        try {
            const response = await axios.get(`${API}/delivery-partners/${partnerId}/nearby-orders`);
            setNearbyOrders(response.data.orders || []);
        } catch (error) {
            console.error('Failed to fetch nearby orders:', error);
        }
    }, []);

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/notifications/${user.id}`);
            setNotifications(response.data.notifications);
            setUnreadCount(response.data.unread_count);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    }, [user?.id]);

    const fetchCodSettlements = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/delivery/cod-settlements?user_id=${user.id}`);
            setCodSettlements(response.data);
        } catch (error) {
            console.error('Failed to fetch COD settlements:', error);
        }
    }, [user?.id]);

    const fetchPayouts = useCallback(async (partnerId) => {
        try {
            const response = await axios.get(`${API}/delivery-partners/${partnerId}/payments`);
            setPayouts(response.data);
        } catch (error) {
            console.error('Failed to fetch payouts:', error);
        }
    }, []);

    const fetchCustomOrders = useCallback(async (partnerId) => {
        if (!partnerId) return;
        try {
            const response = await axios.get(`${API}/delivery-partners/${partnerId}/custom-orders`);
            // Response: { orders: [...], total: N } — already filtered server-side
            setCustomOrders(response.data.orders || []);
        } catch (error) {
            console.error('Failed to fetch custom orders:', error);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated && user?.role === 'delivery') {
            fetchDashboard();
            fetchNotifications();
            fetchCodSettlements();
        } else {
            setLoading(false);
        }
    }, [isAuthenticated, user, fetchDashboard, fetchNotifications, fetchCodSettlements]);

    useEffect(() => {
        if (dashboard?.partner) {
            fetchEarnings(dashboard.partner.id);
            fetchPayouts(dashboard.partner.id);
            fetchCustomOrders(dashboard.partner.id);
            fetchTodayStats(dashboard.partner.id);
            if (dashboard.partner.is_online && dashboard.partner.approval_status === 'approved') {
                fetchNearbyOrders(dashboard.partner.id);
                // Fallback polling every 30 seconds (WebSocket handles real-time)
                const interval = setInterval(() => {
                    fetchNearbyOrders(dashboard.partner.id);
                    fetchNotifications();
                    fetchTodayStats(dashboard.partner.id);
                }, 30000);
                return () => clearInterval(interval);
            }
        }
    }, [dashboard?.partner, fetchEarnings, fetchNearbyOrders, fetchNotifications, fetchTodayStats]);

    // Continuous location tracking when online
    useEffect(() => {
        if (!dashboard?.partner?.is_online || dashboard?.partner?.approval_status !== 'approved') return;
        
        let watchId = null;
        const partnerId = dashboard.partner.id;
        
        // Start watching location
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                async (position) => {
                    const { latitude, longitude, heading, speed } = position.coords;
                    
                    try {
                        // Send location update to server
                        await axios.post(`${API}/tracking/update-partner-location`, {
                            partner_id: partnerId,
                            lat: latitude,
                            lng: longitude,
                            heading: heading || 0,
                            speed: speed || 0,
                            order_id: (dashboard?.assigned_orders?.length > 0) ? dashboard.assigned_orders[0].id : null
                        });
                    } catch (error) {
                        console.error('Failed to update location:', error);
                    }
                },
                (error) => {
                    console.error('Location error:', error);
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 10000,
                    timeout: 15000
                }
            );
        }
        
        return () => {
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
            }
        };
    }, [dashboard?.partner?.is_online, dashboard?.partner?.approval_status, dashboard?.partner?.id, dashboard?.assigned_orders]);

    // React to WebSocket notifications for real-time updates
    useEffect(() => {
        if (wsNotifications.length > 0 && dashboard?.partner) {
            const latestNotification = wsNotifications[0];
            if (latestNotification.type === 'new_order' || latestNotification.type === 'order_update' || latestNotification.type === 'delivery_assignment') {
                // Refresh nearby orders and notifications when new order arrives
                fetchNearbyOrders(dashboard.partner.id);
                fetchNotifications();
            }
        }
    }, [wsNotifications, dashboard?.partner, fetchNearbyOrders, fetchNotifications]);

    const handleToggleOnline = async () => {
        if (!dashboard?.partner) return;
        
        try {
            // Update location first if going online
            if (!dashboard.partner.is_online && location) {
                await axios.put(`${API}/delivery-partners/${dashboard.partner.id}/location`, {
                    lat: location.lat,
                    lng: location.lng,
                    address: location.address
                });
            }
            
            await axios.put(`${API}/delivery-partners/${dashboard.partner.id}/online`);
            toast.success(dashboard.partner.is_online ? 'You are now offline' : 'You are now online');
            fetchDashboard();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to update status');
        }
    };

    const handleUpdateLocation = async () => {
        setLocating(true);
        try {
            const loc = await detectLocation();
            if (dashboard?.partner) {
                await axios.put(`${API}/delivery-partners/${dashboard.partner.id}/location`, {
                    lat: loc.lat,
                    lng: loc.lng,
                    address: loc.address
                });
                toast.success('Location updated');
                fetchDashboard();
            }
        } catch (error) {
            toast.error('Failed to update location');
        } finally {
            setLocating(false);
        }
    };

    const handleAcceptOrder = async (orderId) => {
        try {
            await axios.put(`${API}/orders/${orderId}/status`, {
                status: 'picked_up',
                delivery_partner_id: dashboard.partner.id
            });
            toast.success('Order accepted! Head to the restaurant for pickup.');
            fetchDashboard();
            fetchNearbyOrders(dashboard.partner.id);
            setShowOrderDetail(null);
        } catch (error) {
            toast.error('Failed to accept order');
        }
    };

    const handleDeliverOrder = async (orderId) => {
        try {
            await axios.put(`${API}/orders/${orderId}/status`, { status: 'delivered' });
            toast.success('Order delivered! Great job!');
            fetchDashboard();
            fetchEarnings(dashboard.partner.id);
        } catch (error) {
            toast.error('Failed to update order');
        }
    };

    const fetchOrderDirections = async (orderId) => {
        try {
            const response = await axios.get(`${API}/orders/${orderId}/directions`);
            setOrderDirections(response.data);
        } catch (error) {
            console.error('Failed to fetch directions:', error);
        }
    };

    const openGoogleMaps = (url) => {
        window.open(url, '_blank');
    };

    const handleReportDelay = async (orderId) => {
        try {
            await axios.put(`${API}/orders/${orderId}/update-delay`, {
                delay_reason: delayReason,
                delay_minutes: parseInt(delayMinutes)
            });
            toast.success('Delay reported. Customer has been notified.');
            setShowDelayDialog(false);
        } catch (error) {
            toast.error('Failed to report delay');
        }
    };

    const handleSubmitCodSettlement = async () => {
        if (!codSubmitData.amount || parseFloat(codSubmitData.amount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }
        try {
            await axios.post(`${API}/delivery/cod-settlement?user_id=${user.id}`, {
                amount: parseFloat(codSubmitData.amount),
                comment: codSubmitData.comment || null
            });
            toast.success('COD settlement submitted for admin approval');
            setShowCodSubmit(false);
            setCodSubmitData({ amount: '', comment: '' });
            fetchCodSettlements();
        } catch (error) {
            toast.error('Failed to submit COD settlement');
        }
    };

    // Update custom order status (picked_up, delivered)
    const handleUpdateCustomOrderStatus = async (orderId, newStatus) => {
        try {
            const partnerId = dashboard?.partner?.id;
            if (!partnerId) {
                toast.error('Partner profile not loaded yet');
                return;
            }
            await axios.put(
                `${API}/delivery-partners/${partnerId}/custom-orders/${orderId}/status`,
                { status: newStatus }
            );
            toast.success(`Order marked as ${newStatus.replace('_', ' ')}`);
            fetchCustomOrders(partnerId);
        } catch (error) {
            toast.error(`Failed to update order status`);
            console.error('Custom order status update error:', error);
        }
    };

    const markNotificationRead = async (notificationId) => {
        try {
            await axios.put(`${API}/notifications/${notificationId}/read`);
            fetchNotifications();
        } catch (error) {
            console.error('Failed to mark notification as read');
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: 'bg-yellow-500/20 text-yellow-400',
            confirmed: 'bg-blue-500/20 text-blue-400',
            preparing: 'bg-orange-500/20 text-orange-400',
            ready: 'bg-purple-500/20 text-purple-400',
            picked_up: 'bg-cyan-500/20 text-cyan-400',
            delivered: 'bg-green-500/20 text-green-400',
            cancelled: 'bg-red-500/20 text-red-400',
        };
        return colors[status] || 'bg-gray-500/20 text-gray-400';
    };

    const getApprovalBadge = (status) => {
        const badges = {
            pending: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50', text: 'Pending Approval' },
            approved: { color: 'bg-green-500/20 text-green-400 border-green-500/50', text: 'Approved' },
            rejected: { color: 'bg-red-500/20 text-red-400 border-red-500/50', text: 'Rejected' }
        };
        return badges[status] || badges.pending;
    };

    if (!isAuthenticated || user?.role !== 'delivery') {
        return (
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-16 text-center">
                <Bike size={64} className="mx-auto text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold mb-2">Delivery Partner Dashboard</h1>
                <p className="text-muted-foreground mb-6">Please login as a delivery partner to access this dashboard</p>
                <Link to="/">
                    <Button className="btn-primary">Go Home</Button>
                </Link>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                <div className="skeleton h-8 w-1/3 mb-8" />
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    {[1, 2, 3].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}
                </div>
            </div>
        );
    }

    if (!dashboard?.partner) {
        return (
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-16 text-center" data-testid="no-partner-prompt">
                <Bike size={64} className="mx-auto text-primary mb-4" />
                <h1 className="text-2xl font-bold mb-2">Partner Registration Not Complete</h1>
                <p className="text-muted-foreground mb-6">
                    Your delivery partner registration is not complete. Please complete the registration process.
                </p>
                
                <Link to="/partner/delivery">
                    <Button className="btn-primary">
                        Complete Registration
                    </Button>
                </Link>
                
                <p className="text-sm text-muted-foreground mt-4">
                    If you've already submitted your registration, it may be pending admin approval.
                </p>
            </div>
        );
    }

    const { partner, assigned_orders, available_orders, stats } = dashboard;
    const approvalInfo = getApprovalBadge(partner.approval_status);

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8" data-testid="delivery-dashboard">
            {/* Header with Profile Section */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-2xl border border-green-200 dark:border-green-800 p-6 mb-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    {/* Profile Header */}
                    <div className="flex items-center gap-4">
                        {partner.photo ? (
                            <img src={partner.photo} alt={partner.name} className="w-20 h-20 rounded-full object-cover border-4 border-green-200" />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center">
                                <Bike size={32} className="text-green-500" />
                            </div>
                        )}
                        <div>
                            <Link to="/" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-1">
                                <ArrowLeft size={14} /> Back to Home
                            </Link>
                            <h1 className="text-2xl font-bold">{partner.name}</h1>
                            <p className="text-sm text-muted-foreground">Delivery Partner</p>
                            <Badge className={`mt-1 ${approvalInfo.color} border`}>
                                {approvalInfo.text}
                            </Badge>
                        </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* WebSocket Connection Status */}
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                            {isConnected ? 'Live' : 'Offline'}
                        </div>
                        {/* Notifications */}
                        <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="icon" className="relative">
                                    <Bell size={20} />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white text-xs rounded-full flex items-center justify-center">
                                            {unreadCount}
                                        </span>
                                    )}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Order Alerts & Notifications</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-2 mt-4">
                                    {notifications.length === 0 ? (
                                        <p className="text-center text-muted-foreground py-8">No notifications</p>
                                    ) : (
                                        notifications.map(notif => (
                                            <div 
                                                key={notif.id} 
                                                className={`p-3 rounded-lg border cursor-pointer ${notif.is_read ? 'bg-secondary/50' : 'bg-primary/10 border-primary/30'}`}
                                                onClick={() => !notif.is_read && markNotificationRead(notif.id)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {notif.type === 'order_available' && <Package size={16} className="text-green-400" />}
                                                    {notif.type === 'order_assigned' && <Bike size={16} className="text-primary" />}
                                                    <p className="font-medium text-sm">{notif.title}</p>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">{notif.message}</p>
                                                {notif.data?.estimated_earning && (
                                                    <p className="text-xs text-green-400 mt-1">
                                                        Estimated Earning: ₹{notif.data.estimated_earning}
                                                    </p>
                                                )}
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {notif.created_at ? format(new Date(notif.created_at), 'MMM d, h:mm a') : ''}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                        {/* Location Update */}
                        <Button variant="outline" onClick={handleUpdateLocation} disabled={locating}>
                            <Navigation size={18} className={locating ? 'animate-spin' : ''} />
                        </Button>
                        {/* Performance & Online Toggle */}
                        {partner.approval_status === 'approved' && (
                            <>
                                <Link to="/analytics/delivery">
                                    <Button variant="outline" data-testid="view-performance-btn">
                                        <TrendingUp size={18} className="mr-2" />
                                        Performance
                                    </Button>
                                </Link>
                                <Button 
                                    variant={partner.is_online ? 'default' : 'outline'}
                                    onClick={handleToggleOnline}
                                    className={partner.is_online ? 'bg-green-600 hover:bg-green-700' : ''}
                                data-testid="toggle-online"
                            >
                                {partner.is_online ? (
                                    <>
                                        <ToggleRight size={18} className="mr-2" />
                                        Online
                                    </>
                                ) : (
                                    <>
                                        <ToggleLeft size={18} className="mr-2" />
                                        Offline
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                    </div>
                </div>
            </div>

            {/* Pending Approval Notice */}
            {partner.approval_status === 'pending' && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 mb-8">
                    <div className="flex items-center gap-3">
                        <AlertCircle size={24} className="text-yellow-400" />
                        <div>
                            <h3 className="font-semibold text-yellow-400">Pending Admin Approval</h3>
                            <p className="text-sm text-muted-foreground">
                                Your registration is being reviewed. You'll be able to start delivering once approved.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejected Notice */}
            {partner.approval_status === 'rejected' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-8">
                    <div className="flex items-center gap-3">
                        <AlertCircle size={24} className="text-red-400" />
                        <div>
                            <h3 className="font-semibold text-red-400">Registration Rejected</h3>
                            <p className="text-sm text-muted-foreground">
                                {partner.approval_notes || 'Your registration was rejected. Please contact support.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Package size={24} className="text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{earnings?.deliveries?.total || 0}</p>
                            <p className="text-muted-foreground text-sm">Total Deliveries</p>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <Wallet size={24} className="text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold price-tag">₹{Math.round(earnings?.earnings?.total || 0)}</p>
                            <p className="text-muted-foreground text-sm">Total Earnings</p>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Calendar size={24} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold price-tag">₹{Math.round(earnings?.earnings?.today || 0)}</p>
                            <p className="text-muted-foreground text-sm">Today's Earnings</p>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                            <Navigation size={24} className="text-orange-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{todayStats?.total_km?.toFixed(1) || 0} km</p>
                            <p className="text-muted-foreground text-sm">Today's Distance</p>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                            <Bike size={24} className="text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{assigned_orders.length}</p>
                            <p className="text-muted-foreground text-sm">Active Deliveries</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="available" className="space-y-6">
                <TabsList className="flex-wrap">
                    <TabsTrigger value="available">
                        Available Orders ({nearbyOrders.length + customOrders.length})
                    </TabsTrigger>
                    <TabsTrigger value="active">
                        Active ({assigned_orders.length})
                    </TabsTrigger>
                    <TabsTrigger value="earnings">
                        Earnings
                    </TabsTrigger>
                    <TabsTrigger value="payouts" data-testid="payouts-tab">
                        <IndianRupee size={14} className="mr-1" />
                        Payouts
                    </TabsTrigger>
                    <TabsTrigger value="cod" data-testid="cod-settlements-tab">
                        <Wallet size={14} className="mr-1" />
                        COD Settlement
                    </TabsTrigger>
                    <TabsTrigger value="profile" data-testid="profile-tab">
                        <User size={14} className="mr-1" />
                        Profile
                    </TabsTrigger>
                </TabsList>

                {/* Available Orders */}
                <TabsContent value="available" className="space-y-4">
                    {partner.approval_status !== 'approved' ? (
                        <div className="text-center py-12">
                            <AlertCircle size={48} className="mx-auto text-yellow-400 mb-4" />
                            <p className="text-muted-foreground">Account pending approval</p>
                        </div>
                    ) : !partner.is_online ? (
                        <div className="text-center py-12">
                            <ToggleLeft size={48} className="mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground mb-4">Go online to see available orders</p>
                            <Button onClick={handleToggleOnline} className="btn-primary">
                                Go Online
                            </Button>
                        </div>
                    ) : nearbyOrders.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Package size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No orders available for pickup right now</p>
                            <p className="text-sm mt-2">New orders will appear here automatically</p>
                        </div>
                    ) : (
                        nearbyOrders.map(order => (
                            <div key={order.id} className="order-card border-2 border-green-500/30" data-testid={`available-order-${order.id}`}>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-mono text-sm text-muted-foreground">#{order.id}</p>
                                            <Badge className="bg-green-500/20 text-green-400">
                                                Ready for Pickup
                                            </Badge>
                                        </div>
                                        <p className="font-semibold mt-1">{order.restaurant_name}</p>
                                        <p className="text-sm text-muted-foreground">{order.restaurant_details?.address}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold price-tag">₹{Math.round(order.estimated_earnings)}</p>
                                        <p className="text-xs text-muted-foreground">Estimated Earning</p>
                                    </div>
                                </div>

                                {/* Order Details */}
                                <div className="bg-secondary/50 rounded-lg p-4 mb-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Badge variant={order.payment_method === 'cod' ? 'outline' : 'default'}>
                                            {order.payment_method === 'cod' ? (
                                                <><CreditCard size={12} className="mr-1" /> Cash on Delivery</>
                                            ) : (
                                                <><Wallet size={12} className="mr-1" /> Prepaid</>
                                            )}
                                        </Badge>
                                        <span className="text-sm">Order Total: ₹{order.total_amount}</span>
                                    </div>
                                    
                                    <div>
                                        <p className="text-sm font-medium">Customer: {order.user_name}</p>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            <Phone size={12} /> {order.user_phone}
                                        </p>
                                    </div>
                                    
                                    <div className="flex items-start gap-2 text-sm">
                                        <MapPin size={16} className="text-primary mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="font-medium">{order.delivery_address?.label}</p>
                                            <p className="text-muted-foreground">{order.delivery_address?.full_address}</p>
                                        </div>
                                    </div>

                                    <div className="text-sm">
                                        <p className="font-medium">Items:</p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {order.items?.map((item, idx) => (
                                                <span key={idx} className="bg-background px-2 py-0.5 rounded text-xs">
                                                    {item.name} x{item.quantity}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <Button onClick={() => handleAcceptOrder(order.id)} className="w-full btn-primary">
                                    Accept & Pickup
                                </Button>
                            </div>
                        ))
                    )}

                    {/* Custom Orders Assigned to This Partner */}
                    {customOrders.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Package size={20} className="text-orange-500" />
                                Custom Orders ({customOrders.length})
                            </h3>
                            <div className="space-y-4">
                                {customOrders.map(order => (
                                    <div key={order.id} className="order-card border-2 border-orange-500/30" data-testid={`custom-order-${order.id}`}>
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-mono text-sm text-muted-foreground">#{order.id}</p>
                                                    <Badge className="bg-orange-500/20 text-orange-500">
                                                        Custom Order
                                                    </Badge>
                                                </div>
                                                <p className="font-semibold mt-1">{order.restaurant_name}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold price-tag">₹{order.estimated_amount || '---'}</p>
                                                <p className="text-xs text-muted-foreground">Estimated Amount</p>
                                                {order.delivery_fee && (
                                                    <p className="text-xs text-blue-600">+₹{order.delivery_fee} delivery (70% yours)</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Shop Location */}
                                        {order.shop_location && (
                                            <div className="bg-blue-500/10 rounded-lg p-3 mb-4">
                                                <p className="text-xs text-blue-600 font-medium">Shop Location:</p>
                                                <p className="text-sm">{order.shop_location}</p>
                                            </div>
                                        )}

                                        <div className="bg-secondary/50 rounded-lg p-4 mb-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium">Customer: {order.user_name}</p>
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                            <Phone size={12} /> 
                                                            <a href={`tel:${order.user_phone}`} className="hover:text-primary underline">
                                                                {order.user_phone}
                                                            </a>
                                                        </p>
                                                        {order.alternate_phone && (
                                                            <p className="text-sm text-orange-600 flex items-center gap-1">
                                                                <Phone size={12} /> 
                                                                <a href={`tel:${order.alternate_phone}`} className="hover:text-orange-700 underline">
                                                                    Alt: {order.alternate_phone}
                                                                </a>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <a 
                                                    href={`tel:${order.user_phone}`}
                                                    className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                                                >
                                                    <Phone size={14} />
                                                    Call
                                                </a>
                                            </div>
                                            
                                            <div className="text-sm">
                                                <p className="font-medium mb-1">Product / Food Items:</p>
                                                <p className="text-muted-foreground whitespace-pre-wrap">{order.food_items || order.items_description}</p>
                                            </div>

                                            <div className="flex items-start gap-2 text-sm">
                                                <MapPin size={16} className="text-primary mt-0.5" />
                                                <div>
                                                    <p className="text-muted-foreground">{order.delivery_address?.full_address || order.delivery_address}</p>
                                                </div>
                                            </div>

                                            {/* Payment Status - Online Only for Custom Orders */}
                                            <div className={`p-2 rounded-lg ${order.payment_status === 'paid' ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <CreditCard size={14} className={order.payment_status === 'paid' ? 'text-green-500' : 'text-yellow-500'} />
                                                    <span className={`font-medium ${order.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                                                        Online Payment: {order.payment_status === 'paid' ? '✅ Paid' : '⏳ Pending'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {/* Navigate to Shop */}
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.shop_location || order.restaurant_name)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 min-w-[140px]"
                                            >
                                                <Button variant="outline" className="w-full">
                                                    <Navigation size={16} className="mr-2" />
                                                    Navigate to Shop
                                                </Button>
                                            </a>

                                            {/* Action buttons based on order status */}
                                            {(order.status === 'assigned' || order.status === 'accepted' || order.status === 'preparing') && (
                                                <Button 
                                                    className="flex-1 min-w-[140px] bg-blue-600 hover:bg-blue-700"
                                                    onClick={() => handleUpdateCustomOrderStatus(order.id, 'picked_up')}
                                                    data-testid={`pickup-custom-${order.id}`}
                                                >
                                                    <Package size={16} className="mr-2" />
                                                    Picked Up
                                                </Button>
                                            )}

                                            {order.status === 'picked_up' && (
                                                <>
                                                    {/* Navigate to Customer */}
                                                    {order.delivery_address?.lat && order.delivery_address?.lng && (
                                                        <a
                                                            href={`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_address.lat},${order.delivery_address.lng}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex-1 min-w-[140px]"
                                                        >
                                                            <Button variant="outline" className="w-full">
                                                                <MapPin size={16} className="mr-2" />
                                                                To Customer
                                                            </Button>
                                                        </a>
                                                    )}
                                                    <Button 
                                                        className="flex-1 min-w-[140px] bg-green-600 hover:bg-green-700"
                                                        onClick={() => handleUpdateCustomOrderStatus(order.id, 'delivered')}
                                                        data-testid={`deliver-custom-${order.id}`}
                                                    >
                                                        <Check size={16} className="mr-2" />
                                                        Delivered
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* Active Deliveries */}
                <TabsContent value="active" className="space-y-4">
                    {assigned_orders.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No active deliveries. Check available orders!
                        </div>
                    ) : (
                        assigned_orders.map(order => (
                            <div key={order.id} className="order-card" data-testid={`active-order-${order.id}`}>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                    <div>
                                        <p className="font-mono text-sm text-muted-foreground">#{order.id}</p>
                                        <p className="font-semibold">{order.restaurant_name}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`status-badge ${getStatusColor(order.status)}`}>
                                            {order.status.replace('_', ' ')}
                                        </span>
                                        <Badge variant={order.payment_method === 'cod' ? 'outline' : 'default'}>
                                            {order.payment_method === 'cod' ? 'COD' : 'Prepaid'}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="bg-secondary/50 rounded-lg p-4 mb-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium">Customer: {order.user_name}</p>
                                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                <Phone size={12} /> 
                                                <a href={`tel:${order.user_phone}`} className="hover:text-primary underline">
                                                    {order.user_phone}
                                                </a>
                                            </p>
                                        </div>
                                        <a 
                                            href={`tel:${order.user_phone}`}
                                            className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                                        >
                                            <Phone size={14} />
                                            Call
                                        </a>
                                    </div>
                                    
                                    <div className="flex items-start gap-2 text-sm">
                                        <MapPin size={16} className="text-primary mt-0.5" />
                                        <div>
                                            <p className="font-medium">{order.delivery_address?.label}</p>
                                            <p className="text-muted-foreground">{order.delivery_address?.full_address}</p>
                                        </div>
                                    </div>

                                    {order.payment_method === 'cod' && (
                                        <div className="p-2 bg-yellow-500/10 rounded border border-yellow-500/30">
                                            <p className="text-sm text-yellow-700 font-medium">
                                                💵 Collect ₹{(order.total_amount || 0) + (order.delivery_fee || 0) + (order.cod_fee || 0)} on delivery
                                            </p>
                                            <p className="text-xs text-yellow-600 mt-1">
                                                (Food: ₹{order.total_amount} + Delivery: ₹{order.delivery_fee || 0}
                                                {order.cod_fee > 0 && ` + COD Fee: ₹${order.cod_fee}`})
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Directions and Actions */}
                                <div className="space-y-3 mb-4">
                                    {/* Google Maps Directions */}
                                    <div className="flex flex-wrap gap-2">
                                        {order.status === 'ready' && (
                                            <Button 
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const restaurant = order.restaurant_address || '';
                                                    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(restaurant)}&travelmode=driving`;
                                                    window.open(url, '_blank');
                                                }}
                                                className="flex items-center gap-1"
                                            >
                                                <Navigation size={14} />
                                                Directions to Restaurant
                                                <ExternalLink size={12} />
                                            </Button>
                                        )}
                                        {order.status === 'picked_up' && order.delivery_address?.lat && order.delivery_address?.lng && (
                                            <Button 
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const url = `https://www.google.com/maps/dir/?api=1&destination=${order.delivery_address.lat},${order.delivery_address.lng}&travelmode=driving`;
                                                    window.open(url, '_blank');
                                                }}
                                                className="flex items-center gap-1"
                                            >
                                                <Navigation size={14} />
                                                Directions to Customer
                                                <ExternalLink size={12} />
                                            </Button>
                                        )}
                                        {order.status === 'picked_up' && !order.delivery_address?.lat && (
                                            <Button 
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const address = order.delivery_address?.full_address || '';
                                                    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
                                                    window.open(url, '_blank');
                                                }}
                                                className="flex items-center gap-1"
                                            >
                                                <Navigation size={14} />
                                                Directions to Customer
                                                <ExternalLink size={12} />
                                            </Button>
                                        )}
                                    </div>

                                    {/* Live Tracking Map for Delivery Partner */}
                                    {order.status === 'picked_up' && (
                                        <DeliveryPartnerMap
                                            orderId={order.id}
                                            partnerId={user?.id}
                                            customerLocation={{
                                                lat: order.delivery_address?.lat,
                                                lng: order.delivery_address?.lng,
                                                address: order.delivery_address?.full_address
                                            }}
                                            customerPhone={order.user_phone}
                                            customerName={order.user_name}
                                            restaurantLocation={{
                                                lat: order.restaurant_lat,
                                                lng: order.restaurant_lng
                                            }}
                                            orderStatus={order.status}
                                            onLocationSent={() => toast.success('Location shared with customer')}
                                        />
                                    )}

                                    {/* Estimated Time Info */}
                                    {order.estimated_delivery_time && (
                                        <div className="flex items-center gap-2 text-sm bg-blue-50 text-blue-700 p-2 rounded">
                                            <Timer size={14} />
                                            <span>Est. delivery: {order.estimated_delivery_time} mins from order</span>
                                        </div>
                                    )}

                                    {/* Report Delay */}
                                    {(order.status === 'picked_up' || order.status === 'ready') && (
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700">
                                                    <AlertTriangle size={14} className="mr-1" />
                                                    Report Delay
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Report Delivery Delay</DialogTitle>
                                                    <DialogDescription>
                                                        Let the customer know about the delay
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4 mt-4">
                                                    <div>
                                                        <Label>Reason for Delay</Label>
                                                        <Select value={delayReason} onValueChange={setDelayReason}>
                                                            <SelectTrigger className="mt-1">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="heavy_traffic">Heavy Traffic</SelectItem>
                                                                <SelectItem value="restaurant_busy">Restaurant Still Preparing</SelectItem>
                                                                <SelectItem value="weather">Weather Conditions</SelectItem>
                                                                <SelectItem value="other">Other</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <Label>Additional Time (minutes)</Label>
                                                        <Input
                                                            type="number"
                                                            value={delayMinutes}
                                                            onChange={(e) => setDelayMinutes(e.target.value)}
                                                            min="5"
                                                            max="60"
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                    <Button 
                                                        onClick={() => handleReportDelay(order.id)} 
                                                        className="w-full btn-primary"
                                                    >
                                                        Notify Customer
                                                    </Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-muted-foreground">
                                        {order.items?.reduce((sum, item) => sum + item.quantity, 0)} items • ₹{order.total_amount}
                                    </div>
                                    {order.status === 'picked_up' && (
                                        <Button onClick={() => handleDeliverOrder(order.id)} className="btn-primary">
                                            <CheckCircle size={16} className="mr-1" />
                                            Mark Delivered
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </TabsContent>

                {/* Earnings Tab */}
                <TabsContent value="earnings" className="space-y-6">
                    {/* Earnings Summary */}
                    <div className="grid md:grid-cols-4 gap-4">
                        <div className="bg-card rounded-xl border border-border p-4">
                            <p className="text-sm text-muted-foreground">Today</p>
                            <p className="text-xl font-bold price-tag">₹{Math.round(earnings?.earnings?.today || 0)}</p>
                            <p className="text-xs text-muted-foreground">{earnings?.deliveries?.today || 0} deliveries</p>
                        </div>
                        <div className="bg-card rounded-xl border border-border p-4">
                            <p className="text-sm text-muted-foreground">This Week</p>
                            <p className="text-xl font-bold price-tag">₹{Math.round(earnings?.earnings?.this_week || 0)}</p>
                            <p className="text-xs text-muted-foreground">{earnings?.deliveries?.this_week || 0} deliveries</p>
                        </div>
                        <div className="bg-card rounded-xl border border-border p-4">
                            <p className="text-sm text-muted-foreground">This Month</p>
                            <p className="text-xl font-bold price-tag">₹{Math.round(earnings?.earnings?.this_month || 0)}</p>
                            <p className="text-xs text-muted-foreground">{earnings?.deliveries?.this_month || 0} deliveries</p>
                        </div>
                        <div className="bg-card rounded-xl border border-border p-4">
                            <p className="text-sm text-muted-foreground">All Time</p>
                            <p className="text-xl font-bold price-tag">₹{Math.round(earnings?.earnings?.total || 0)}</p>
                            <p className="text-xs text-muted-foreground">{earnings?.deliveries?.total || 0} deliveries</p>
                        </div>
                    </div>

                    {/* COD Summary - Only show if there are COD orders */}
                    {earnings?.cod?.orders_count > 0 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6" data-testid="cod-summary">
                            <h3 className="font-semibold mb-4 flex items-center gap-2 text-yellow-400">
                                <CreditCard size={20} />
                                Cash on Delivery Summary
                            </h3>
                            <div className="grid md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">COD Collected</p>
                                    <p className="text-2xl font-bold price-tag">₹{Math.round(earnings?.cod?.total_collected || 0)}</p>
                                    <p className="text-xs text-muted-foreground">{earnings?.cod?.orders_count || 0} orders</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Your Earnings (95%)</p>
                                    <p className="text-2xl font-bold text-green-400">₹{Math.round(earnings?.cod?.your_earnings || 0)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">To Return to Company</p>
                                    <p className="text-2xl font-bold text-orange-400">₹{Math.round(earnings?.cod?.to_return || 0)}</p>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-4">
                                * From COD orders, keep 95% of delivery fee as your earning. Return the order amount + 5% delivery fee to the company.
                            </p>
                        </div>
                    )}

                    {/* Recent Deliveries */}
                    <div className="bg-card rounded-2xl border border-border p-6">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <TrendingUp size={20} className="text-primary" />
                            Recent Deliveries
                        </h3>
                        {earnings?.recent_deliveries?.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">No deliveries yet</p>
                        ) : (
                            <div className="space-y-3">
                                {earnings?.recent_deliveries?.map((delivery, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50" data-testid={`delivery-${idx}`}>
                                        <div>
                                            <p className="font-medium">{delivery.restaurant_name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                #{delivery.order_id} • 
                                                {delivery.delivered_at ? format(new Date(delivery.delivered_at), ' MMM d, h:mm a') : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {delivery.payment_method === 'cod' && (
                                                <div className="text-right text-xs">
                                                    <p className="text-muted-foreground">Collected: <span className="text-foreground">₹{Math.round(delivery.cod_collected)}</span></p>
                                                    <p className="text-orange-400">Return: ₹{Math.round(delivery.cod_to_return)}</p>
                                                </div>
                                            )}
                                            <div className="text-right">
                                                <p className="font-bold text-green-400">+₹{Math.round(delivery.earning)}</p>
                                                <Badge variant={delivery.payment_method === 'cod' ? 'outline' : 'default'} className="text-xs">
                                                    {delivery.payment_method === 'cod' ? 'COD' : 'Prepaid'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm">
                        <p className="font-medium text-blue-400 mb-2">Earnings Structure</p>
                        <ul className="space-y-1 text-muted-foreground">
                            <li>• You earn <span className="text-foreground font-medium">95% of delivery fee</span> per order</li>
                            <li>• For COD orders: Collect full amount → Keep 95% delivery fee → Return rest to company</li>
                            <li>• For Prepaid orders: Only collect the food, no cash handling needed</li>
                        </ul>
                    </div>
                </TabsContent>

                {/* Payouts Tab - Shows earnings and settlements */}
                <TabsContent value="payouts" className="space-y-6" data-testid="payouts-tab-content">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <IndianRupee size={20} className="text-green-500" />
                            Earnings & Payouts
                        </h3>
                        
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                                <p className="text-xs text-muted-foreground">Total Earnings</p>
                                <p className="text-xl font-bold text-green-600">
                                    ₹{payouts?.summary?.total_earnings || 0}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {payouts?.summary?.total_deliveries || 0} deliveries
                                </p>
                            </div>
                            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                                <p className="text-xs text-muted-foreground">Pending</p>
                                <p className="text-xl font-bold text-orange-600">
                                    ₹{payouts?.summary?.pending_settlement || 0}
                                </p>
                                <p className="text-xs text-orange-600 mt-1">
                                    {payouts?.summary?.total_pending_count || 0} orders
                                </p>
                            </div>
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                <p className="text-xs text-muted-foreground">Cleared</p>
                                <p className="text-xl font-bold text-blue-600">
                                    ₹{payouts?.summary?.cleared_earnings || 0}
                                </p>
                                <p className="text-xs text-blue-600 mt-1">
                                    {payouts?.summary?.total_cleared_count || 0} orders
                                </p>
                            </div>
                            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                                <p className="text-xs text-muted-foreground">COD to Return</p>
                                <p className="text-xl font-bold text-purple-600">
                                    ₹{payouts?.summary?.cod_to_return || 0}
                                </p>
                            </div>
                        </div>

                        {/* Earnings Breakdown */}
                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            <div className="p-4 bg-secondary/30 rounded-xl">
                                <h4 className="font-medium text-sm mb-2">Regular Orders (95% share)</h4>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Deliveries</p>
                                        <p className="font-bold">{payouts?.summary?.regular_deliveries || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Earned</p>
                                        <p className="font-bold text-green-600">₹{payouts?.summary?.regular_earnings || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Pending</p>
                                        <p className="font-bold text-orange-600">₹{payouts?.summary?.regular_pending || 0}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
                                <h4 className="font-medium text-sm mb-2 text-purple-600">Custom Orders (70% share)</h4>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Deliveries</p>
                                        <p className="font-bold">{payouts?.summary?.custom_deliveries || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Earned</p>
                                        <p className="font-bold text-green-600">₹{payouts?.summary?.custom_earnings || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Pending</p>
                                        <p className="font-bold text-orange-600">₹{payouts?.summary?.custom_pending || 0}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Payout List */}
                        <div className="space-y-3">
                            {/* Pending Deliveries */}
                            <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                                <Clock size={14} /> Pending Settlement ({payouts?.summary?.total_pending_count || 0})
                            </h4>
                            {payouts?.orders?.filter(o => o.delivery_partner_settlement_status !== 'cleared').length === 0 ? (
                                <div className="text-center py-4 text-muted-foreground text-sm">
                                    No pending settlements
                                </div>
                            ) : (
                                payouts?.orders?.filter(o => o.delivery_partner_settlement_status !== 'cleared').map(order => {
                                    const isCustom = order.order_type === 'custom';
                                    const sharePercent = order.partner_share_percent || (isCustom ? 70 : 95);
                                    
                                    return (
                                        <div key={order.id} className={`p-4 rounded-lg border ${isCustom ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800' : 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'}`}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-mono text-sm">#{order.id}</p>
                                                        {isCustom && (
                                                            <Badge className="bg-purple-500/20 text-purple-500 text-xs">
                                                                <Package size={10} className="mr-1" /> Custom
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{order.restaurant_name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {order.delivered_at ? new Date(order.delivered_at).toLocaleDateString() : 'N/A'}
                                                    </p>
                                                    
                                                    {/* Fee breakdown */}
                                                    <div className="mt-2 text-xs space-y-1">
                                                        <p>Delivery Fee: ₹{order.delivery_fee} × {sharePercent}% = <span className="font-bold text-green-600">₹{order.your_earning}</span></p>
                                                        {order.payment_method === 'cod' && order.cod_collected > 0 && (
                                                            <>
                                                                <p className="text-orange-600">
                                                                    COD Collected: ₹{Math.round(order.cod_collected)}
                                                                </p>
                                                                {order.cod_fee > 0 && (
                                                                    <p className="text-muted-foreground">COD Fee (to company): ₹{order.cod_fee}</p>
                                                                )}
                                                                <p className="text-orange-600 font-medium">
                                                                    Return to company: ₹{Math.round(order.cod_to_return)}
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <Badge className="bg-orange-500/20 text-orange-500 mb-1">
                                                        <Clock size={12} className="mr-1" />
                                                        Pending
                                                    </Badge>
                                                    <p className="text-lg font-bold text-green-600">₹{order.your_earning}</p>
                                                    <p className="text-xs text-muted-foreground">{sharePercent}% share</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {/* Cleared Deliveries */}
                            <h4 className="font-medium text-sm text-muted-foreground mt-6 flex items-center gap-2">
                                <CheckCircle size={14} /> Cleared ({payouts?.summary?.total_cleared_count || 0})
                            </h4>
                            {payouts?.orders?.filter(o => o.delivery_partner_settlement_status === 'cleared').length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <IndianRupee size={40} className="mx-auto mb-2 opacity-50" />
                                    <p>No payouts cleared yet</p>
                                    <p className="text-sm">Completed deliveries will appear here after admin clears them</p>
                                </div>
                            ) : (
                                payouts?.orders?.filter(o => o.delivery_partner_settlement_status === 'cleared').map(order => {
                                    const isCustom = order.order_type === 'custom';
                                    const sharePercent = order.partner_share_percent || (isCustom ? 70 : 95);
                                    
                                    return (
                                        <div key={order.id} className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-mono text-sm">#{order.id}</p>
                                                        {isCustom && (
                                                            <Badge className="bg-purple-500/20 text-purple-500 text-xs">
                                                                <Package size={10} className="mr-1" /> Custom
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{order.restaurant_name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Cleared: {order.delivery_cleared_date ? new Date(order.delivery_cleared_date).toLocaleDateString() : 'N/A'}
                                                    </p>
                                                    {order.delivery_clear_comment && (
                                                        <p className="text-xs text-muted-foreground mt-1">Note: {order.delivery_clear_comment}</p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <Badge className="bg-green-500/20 text-green-500 mb-1">
                                                        <CheckCircle size={12} className="mr-1" />
                                                        Cleared
                                                    </Badge>
                                                    <p className="text-lg font-bold text-green-600">₹{order.your_earning}</p>
                                                    <p className="text-xs text-muted-foreground">{sharePercent}% share</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Info Box */}
                        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm">
                            <p className="font-medium text-blue-400 mb-2">Earnings Structure</p>
                            <ul className="space-y-1 text-muted-foreground">
                                <li>• <span className="text-foreground font-medium">Regular Orders:</span> You earn 95% of delivery fee</li>
                                <li>• <span className="text-foreground font-medium">Custom Orders:</span> You earn 70% of delivery fee</li>
                                <li>• <span className="text-foreground font-medium">COD Fee (₹5):</span> Goes entirely to company</li>
                                <li>• For COD: Collect full amount → Keep your share → Return rest to company</li>
                            </ul>
                        </div>
                    </div>
                </TabsContent>

                {/* COD Settlement Tab */}
                <TabsContent value="cod" className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">COD Amount Settlement</h3>
                        <Dialog open={showCodSubmit} onOpenChange={setShowCodSubmit}>
                            <DialogTrigger asChild>
                                <Button className="btn-primary" data-testid="submit-cod-btn">
                                    <Wallet size={16} className="mr-2" /> Submit COD Amount
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Submit COD Settlement</DialogTitle>
                                    <DialogDescription>
                                        Submit the COD amount collected for admin approval
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 mt-4">
                                    <div>
                                        <Label>Amount (₹) *</Label>
                                        <Input
                                            type="number"
                                            value={codSubmitData.amount}
                                            onChange={(e) => setCodSubmitData(prev => ({ ...prev, amount: e.target.value }))}
                                            placeholder="Enter COD amount"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label>Comment (Optional)</Label>
                                        <Input
                                            value={codSubmitData.comment}
                                            onChange={(e) => setCodSubmitData(prev => ({ ...prev, comment: e.target.value }))}
                                            placeholder="Any note for admin..."
                                            className="mt-1"
                                        />
                                    </div>
                                    <Button onClick={handleSubmitCodSettlement} className="w-full btn-primary">
                                        Submit for Approval
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* COD Summary */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                            <p className="text-sm text-yellow-400">Pending Settlement</p>
                            <p className="text-3xl font-bold text-yellow-400">
                                ₹{codSettlements?.pending_total?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                            <p className="text-sm text-green-400">Total Cleared</p>
                            <p className="text-3xl font-bold text-green-400">
                                ₹{codSettlements?.approved_total?.toLocaleString() || 0}
                            </p>
                        </div>
                    </div>

                    {/* Settlement History */}
                    {codSettlements?.settlements?.length > 0 ? (
                        <div className="space-y-3">
                            <h4 className="font-semibold">Settlement History</h4>
                            {codSettlements.settlements.map(settlement => (
                                <div key={settlement.id} className="bg-card rounded-xl border border-border p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-lg">₹{settlement.amount}</span>
                                        <Badge variant={
                                            settlement.status === 'approved' ? 'default' :
                                            settlement.status === 'rejected' ? 'destructive' : 'secondary'
                                        }>
                                            {settlement.status}
                                        </Badge>
                                    </div>
                                    {settlement.comment && (
                                        <p className="text-sm text-muted-foreground mb-2">
                                            Your note: {settlement.comment}
                                        </p>
                                    )}
                                    {settlement.admin_comment && (
                                        <p className="text-sm text-muted-foreground mb-2">
                                            Admin: {settlement.admin_comment}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Submitted: {settlement.created_at ? format(new Date(settlement.created_at), 'MMM d, yyyy h:mm a') : 'N/A'}
                                        {settlement.approved_at && ` • Processed: ${format(new Date(settlement.approved_at), 'MMM d, yyyy')}`}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-secondary/30 rounded-xl">
                            <Wallet size={40} className="mx-auto text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">No COD settlements submitted yet</p>
                            <p className="text-sm text-muted-foreground">Submit COD amount collected for admin approval</p>
                        </div>
                    )}
                </TabsContent>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-6" data-testid="profile-tab-content">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <User size={20} className="text-green-500" />
                            Profile Details
                        </h3>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="flex items-center gap-3 p-4 bg-secondary/30 rounded-xl">
                                <Phone size={18} className="text-green-500" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Phone Number</p>
                                    <p className="font-medium">+91 {partner.phone}</p>
                                </div>
                            </div>
                            {partner.email && (
                                <div className="flex items-center gap-3 p-4 bg-secondary/30 rounded-xl">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Email</p>
                                        <p className="font-medium truncate max-w-[180px]">{partner.email}</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3 p-4 bg-secondary/30 rounded-xl">
                                <Bike size={18} className="text-green-500" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Vehicle</p>
                                    <p className="font-medium">{partner.vehicle_number} ({partner.vehicle_type})</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-4 bg-secondary/30 rounded-xl">
                                <CreditCard size={18} className="text-green-500" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Driving License</p>
                                    <p className="font-medium font-mono">{partner.license_number || 'N/A'}</p>
                                </div>
                            </div>
                            {partner.address && (
                                <div className="flex items-center gap-3 p-4 bg-secondary/30 rounded-xl lg:col-span-2">
                                    <MapPin size={18} className="text-green-500 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs text-muted-foreground">Address</p>
                                        <p className="font-medium truncate">{partner.address}</p>
                                        {partner.city && <p className="text-sm text-muted-foreground">{partner.city}, {partner.state} - {partner.pincode}</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
