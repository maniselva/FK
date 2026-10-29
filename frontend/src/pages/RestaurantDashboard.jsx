import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    ChefHat, Package, IndianRupee, Clock, Plus, Edit, Trash2, 
    ToggleLeft, ToggleRight, ArrowLeft, Bell, AlertCircle, 
    CheckCircle, XCircle, Store, Timer, BarChart3, Wifi, WifiOff,
    CreditCard, Wallet, TrendingUp, Star, Share2, MessageCircle, Printer
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { useApp } from '../contexts/AppContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { openPrintBill } from '../components/PrintableBill';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RestaurantDashboard() {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useApp();
    const { isConnected, notifications: wsNotifications } = useWebSocket();
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showAddItem, setShowAddItem] = useState(false);
    const [showEditItem, setShowEditItem] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [showEditRestaurant, setShowEditRestaurant] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmOrderId, setConfirmOrderId] = useState(null);
    const [estimatedPrepTime, setEstimatedPrepTime] = useState('15');
    const [cancelOrderId, setCancelOrderId] = useState(null);
    const [cancelOrderItems, setCancelOrderItems] = useState([]);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelComment, setCancelComment] = useState('');
    const [unavailableItems, setUnavailableItems] = useState([]);
    const [payments, setPayments] = useState(null);
    const [showDeleteMenuItemDialog, setShowDeleteMenuItemDialog] = useState(false);
    const [deletingMenuItem, setDeletingMenuItem] = useState(null);
    const [newItem, setNewItem] = useState({
        name: '',
        description: '',
        price: '',
        image: '',
        category: '',
        is_veg: true,
        is_visible: true,
        available_after: ''  // Time like '11:00', '13:00', '18:00' or empty for always available
    });
    // Discount state
    const [discounts, setDiscounts] = useState([]);
    const [showAddDiscount, setShowAddDiscount] = useState(false);
    const [newDiscount, setNewDiscount] = useState({
        name: '',
        description: '',
        discount_type: 'percentage',
        discount_value: '',
        min_order_amount: 0,
        max_discount: '',
        display_message: '',
        applicable_items: []
    });
    // Payout state
    const [payouts, setPayouts] = useState(null);
    const [showPayoutComment, setShowPayoutComment] = useState(false);
    const [payoutComment, setPayoutComment] = useState({ order_id: '', comment: '' });

    const fetchDashboard = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/dashboard/restaurant/${user.id}`);
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

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/notifications/${user.id}`);
            setNotifications(response.data.notifications);
            setUnreadCount(response.data.unread_count);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    }, [user?.id]);

    const fetchPayments = useCallback(async (restaurantId) => {
        try {
            const response = await axios.get(`${API}/restaurant/${restaurantId}/payments`);
            setPayments(response.data);
        } catch (error) {
            console.error('Failed to fetch payments:', error);
        }
    }, []);

    const fetchDiscounts = useCallback(async (restaurantId) => {
        try {
            const response = await axios.get(`${API}/restaurants/${restaurantId}/discounts?active_only=false`);
            setDiscounts(response.data);
        } catch (error) {
            console.error('Failed to fetch discounts:', error);
        }
    }, []);

    const fetchPayouts = useCallback(async (restaurantId) => {
        try {
            const response = await axios.get(`${API}/restaurant/payouts/${restaurantId}`);
            setPayouts(response.data);
        } catch (error) {
            console.error('Failed to fetch payouts:', error);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated && user?.role === 'restaurant') {
            fetchDashboard();
            fetchNotifications();
            // Fallback polling every 60 seconds (WebSocket handles real-time)
            const interval = setInterval(() => {
                fetchDashboard();
                fetchNotifications();
            }, 60000);
            return () => clearInterval(interval);
        } else {
            setLoading(false);
        }
    }, [isAuthenticated, user, fetchDashboard, fetchNotifications]);

    // Fetch payments when dashboard loads
    useEffect(() => {
        if (dashboard?.restaurant?.id) {
            fetchPayments(dashboard.restaurant.id);
            fetchDiscounts(dashboard.restaurant.id);
            fetchPayouts(dashboard.restaurant.id);
        }
    }, [dashboard?.restaurant?.id, fetchPayments, fetchDiscounts, fetchPayouts]);

    // React to WebSocket notifications for real-time updates
    useEffect(() => {
        if (wsNotifications.length > 0) {
            const latestNotification = wsNotifications[0];
            if (latestNotification.type === 'new_order' || latestNotification.type === 'order_update') {
                // Refresh dashboard when new order arrives
                fetchDashboard();
                fetchNotifications();
            }
        }
    }, [wsNotifications, fetchDashboard, fetchNotifications]);

    const handleAddMenuItem = async () => {
        if (!newItem.name || !newItem.price || !newItem.category) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            const response = await axios.post(`${API}/restaurants/${dashboard.restaurant.id}/menu`, {
                ...newItem,
                price: parseFloat(newItem.price),
                is_visible: newItem.is_visible,
                available_after: newItem.available_after || null
            });
            
            toast.success('Menu item added successfully!');
            setShowAddItem(false);
            setNewItem({ name: '', description: '', price: '', image: '', category: '', is_veg: true, is_visible: true, available_after: '' });
            fetchDashboard();
        } catch (error) {
            toast.error('Failed to add menu item');
        }
    };

    const handleToggleItemAvailability = async (itemId) => {
        try {
            await axios.put(`${API}/restaurants/${dashboard.restaurant.id}/menu/${itemId}/availability`);
            fetchDashboard();
        } catch (error) {
            toast.error('Failed to update item');
        }
    };

    const handleToggleItemVisibility = async (itemId, currentVisibility) => {
        try {
            await axios.put(`${API}/restaurants/${dashboard.restaurant.id}/menu/${itemId}/visibility`, {
                is_visible: !currentVisibility
            });
            toast.success(currentVisibility ? 'Item hidden from menu' : 'Item shown on menu');
            fetchDashboard();
        } catch (error) {
            toast.error('Failed to update visibility');
        }
    };

    const handleUpdateItemAvailableTime = async (itemId, availableAfter) => {
        try {
            await axios.put(`${API}/restaurants/${dashboard.restaurant.id}/menu/${itemId}/available-time`, {
                available_after: availableAfter || null
            });
            toast.success('Availability time updated');
            fetchDashboard();
        } catch (error) {
            toast.error('Failed to update availability time');
        }
    };

    const handleDeleteMenuItem = async (itemId) => {
        try {
            await axios.delete(`${API}/restaurants/${dashboard.restaurant.id}/menu/${itemId}`);
            toast.success('Item deleted');
            setShowDeleteMenuItemDialog(false);
            setDeletingMenuItem(null);
            fetchDashboard();
        } catch (error) {
            toast.error('Failed to delete item');
        }
    };

    const openDeleteMenuItemDialog = (item) => {
        setDeletingMenuItem(item);
        setShowDeleteMenuItemDialog(true);
    };

    const handleEditMenuItem = (item) => {
        setEditingItem({
            ...item,
            price: item.price.toString()
        });
        setShowEditItem(true);
    };

    const handleSaveMenuItem = async () => {
        if (!editingItem.name || !editingItem.price || !editingItem.category) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            await axios.put(`${API}/restaurants/${dashboard.restaurant.id}/menu/${editingItem.id}`, {
                name: editingItem.name,
                description: editingItem.description,
                price: parseFloat(editingItem.price),
                image: editingItem.image,
                category: editingItem.category,
                is_veg: editingItem.is_veg,
                is_visible: editingItem.is_visible,
                available_after: editingItem.available_after || null
            });
            
            toast.success('Menu item updated successfully!');
            setShowEditItem(false);
            setEditingItem(null);
            fetchDashboard();
        } catch (error) {
            toast.error('Failed to update menu item');
        }
    };

    const handleUpdateRestaurant = async () => {
        try {
            await axios.put(`${API}/restaurants/${dashboard.restaurant.id}/profile`, {
                image: dashboard.restaurant.image,
                fssai_certificate: dashboard.restaurant.fssai_certificate
            });
            toast.success('Restaurant updated successfully!');
            setShowEditRestaurant(false);
            fetchDashboard();
        } catch (error) {
            toast.error('Failed to update restaurant');
        }
    };

    // Discount handlers
    const handleCreateDiscount = async () => {
        if (!newDiscount.name || !newDiscount.discount_value || !newDiscount.display_message) {
            toast.error('Please fill in required fields');
            return;
        }
        try {
            await axios.post(`${API}/restaurants/${dashboard.restaurant.id}/discounts`, {
                ...newDiscount,
                discount_value: parseFloat(newDiscount.discount_value),
                min_order_amount: parseFloat(newDiscount.min_order_amount) || 0,
                max_discount: newDiscount.max_discount ? parseFloat(newDiscount.max_discount) : null
            });
            toast.success('Discount created!');
            setShowAddDiscount(false);
            setNewDiscount({
                name: '', description: '', discount_type: 'percentage',
                discount_value: '', min_order_amount: 0, max_discount: '',
                display_message: '', applicable_items: []
            });
            fetchDiscounts(dashboard.restaurant.id);
        } catch (error) {
            toast.error('Failed to create discount');
        }
    };

    const handleToggleDiscount = async (discountId) => {
        try {
            await axios.put(`${API}/restaurants/${dashboard.restaurant.id}/discounts/${discountId}/toggle`);
            fetchDiscounts(dashboard.restaurant.id);
        } catch (error) {
            toast.error('Failed to toggle discount');
        }
    };

    const handleDeleteDiscount = async (discountId) => {
        try {
            await axios.delete(`${API}/restaurants/${dashboard.restaurant.id}/discounts/${discountId}`);
            toast.success('Discount deleted');
            fetchDiscounts(dashboard.restaurant.id);
        } catch (error) {
            toast.error('Failed to delete discount');
        }
    };

    // Payout comment handler
    const handleAddPayoutComment = async () => {
        if (!payoutComment.comment) {
            toast.error('Please enter a comment');
            return;
        }
        try {
            await axios.post(`${API}/restaurant/payouts/${dashboard.restaurant.id}/comment`, payoutComment);
            toast.success('Comment added');
            setShowPayoutComment(false);
            setPayoutComment({ order_id: '', comment: '' });
            fetchPayouts(dashboard.restaurant.id);
        } catch (error) {
            toast.error('Failed to add comment');
        }
    };

    const handleToggleRestaurantStatus = async () => {
        try {
            await axios.put(`${API}/restaurants/${dashboard.restaurant.id}/toggle-status`);
            toast.success('Restaurant status updated');
            fetchDashboard();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to update status');
        }
    };

    const handleUpdateOrderStatus = async (orderId, status) => {
        try {
            await axios.put(`${API}/orders/${orderId}/status`, { status });
            toast.success('Order status updated');
            fetchDashboard();
        } catch (error) {
            toast.error('Failed to update order');
        }
    };

    const openConfirmDialog = (orderId) => {
        setConfirmOrderId(orderId);
        setEstimatedPrepTime('20');
        setShowConfirmDialog(true);
    };

    const handleConfirmWithTime = async () => {
        try {
            await axios.put(`${API}/orders/${confirmOrderId}/confirm-with-time`, {
                estimated_prep_time: parseInt(estimatedPrepTime)
            });
            toast.success(`Order confirmed! Estimated prep time: ${estimatedPrepTime} mins`);
            setShowConfirmDialog(false);
            setConfirmOrderId(null);
            fetchDashboard();
        } catch (error) {
            toast.error('Failed to confirm order');
        }
    };

    const openCancelDialog = (orderId) => {
        setCancelOrderId(orderId);
        setCancelReason('');
        setCancelComment('');
        setUnavailableItems([]);
        // Get the order items for selection
        const order = dashboard?.orders?.find(o => o.id === orderId);
        setCancelOrderItems(order?.items || []);
        setShowCancelDialog(true);
    };

    const toggleUnavailableItem = (itemName) => {
        setUnavailableItems(prev => 
            prev.includes(itemName) 
                ? prev.filter(n => n !== itemName)
                : [...prev, itemName]
        );
    };

    const handleCancelOrder = async () => {
        if (!cancelReason.trim()) {
            toast.error('Please provide a reason for cancellation');
            return;
        }

        try {
            await axios.put(`${API}/orders/${cancelOrderId}/cancel`, { 
                reason: cancelReason.trim(),
                cancelled_by: 'restaurant',
                comment: cancelComment.trim() || null,
                unavailable_items: unavailableItems.length > 0 ? unavailableItems : null
            });
            toast.success('Order cancelled. Customer has been notified.');
            setShowCancelDialog(false);
            setCancelOrderId(null);
            setCancelReason('');
            setCancelComment('');
            setUnavailableItems([]);
            setCancelOrderItems([]);
            fetchDashboard();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to cancel order');
        }
    };

    // Share order to WhatsApp (for chef)
    const shareOrderToWhatsApp = (order, phoneNumber = '') => {
        const itemsList = order.items.map(item => 
            `• ${item.name} x${item.quantity} - ₹${(item.price * item.quantity).toFixed(0)}`
        ).join('\n');
        
        const message = `🍽️ *New Order #${order.id}*

*Customer:* ${order.user_name}
*Phone:* ${order.user_phone}

*Items:*
${itemsList}

*Total:* ₹${order.total_amount.toFixed(0)}
${order.notes ? `\n*Notes:* ${order.notes}` : ''}

*Delivery Address:*
${order.delivery_address?.address || 'Not provided'}
${order.delivery_address?.city ? `${order.delivery_address.city}, ${order.delivery_address.pincode}` : ''}

⏰ Please prepare ASAP!`;
        
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = phoneNumber 
            ? `https://wa.me/${phoneNumber}?text=${encodedMessage}`
            : `https://wa.me/?text=${encodedMessage}`;
        
        window.open(whatsappUrl, '_blank');
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
            pending: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50', icon: Clock, text: 'Pending Approval' },
            approved: { color: 'bg-green-500/20 text-green-400 border-green-500/50', icon: CheckCircle, text: 'Approved' },
            rejected: { color: 'bg-red-500/20 text-red-400 border-red-500/50', icon: XCircle, text: 'Rejected' }
        };
        return badges[status] || badges.pending;
    };

    if (!isAuthenticated || user?.role !== 'restaurant') {
        return (
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-16 text-center">
                <ChefHat size={64} className="mx-auto text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold mb-2">Restaurant Dashboard</h1>
                <p className="text-muted-foreground mb-6">Please login as a restaurant owner to access this dashboard</p>
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

    if (!dashboard?.restaurant) {
        return (
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-16 text-center" data-testid="no-restaurant-prompt">
                <ChefHat size={64} className="mx-auto text-primary mb-4" />
                <h1 className="text-2xl font-bold mb-2">Restaurant Not Found</h1>
                <p className="text-muted-foreground mb-6">
                    Your restaurant registration is not complete. Please complete the registration process.
                </p>
                
                <Link to="/partner/restaurant">
                    <Button className="btn-primary">
                        <Plus size={18} className="mr-2" />
                        Complete Registration
                    </Button>
                </Link>
                
                <p className="text-sm text-muted-foreground mt-4">
                    If you've already submitted your registration, it may be pending admin approval.
                </p>
            </div>
        );
    }

    const { restaurant, orders, stats } = dashboard;
    const approvalInfo = getApprovalBadge(restaurant.approval_status);
    const ApprovalIcon = approvalInfo.icon;

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8" data-testid="restaurant-dashboard">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <Link to="/" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-2">
                        <ArrowLeft size={16} /> Back to Home
                    </Link>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold">{restaurant.name}</h1>
                        <Badge className={`${approvalInfo.color} border`}>
                            <ApprovalIcon size={14} className="mr-1" />
                            {approvalInfo.text}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground">{restaurant.address}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="flex items-center gap-1">
                            <Timer size={14} />
                            {restaurant.opening_time} - {restaurant.closing_time}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
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
                                <DialogTitle>Notifications</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-2 mt-4">
                                {notifications.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">No notifications</p>
                                ) : (
                                    notifications.map(notif => (
                                        <div 
                                            key={notif.id} 
                                            className={`p-3 rounded-lg border ${notif.is_read ? 'bg-secondary/50' : 'bg-primary/10 border-primary/30'}`}
                                            onClick={() => !notif.is_read && markNotificationRead(notif.id)}
                                        >
                                            <p className="font-medium text-sm">{notif.title}</p>
                                            <p className="text-xs text-muted-foreground">{notif.message}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {notif.created_at ? format(new Date(notif.created_at), 'MMM d, h:mm a') : ''}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Status Toggle */}
                    {restaurant.approval_status === 'approved' && (
                        <Button 
                            variant={restaurant.is_open ? 'default' : 'outline'}
                            onClick={handleToggleRestaurantStatus}
                            className={restaurant.is_open ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                            {restaurant.is_open ? (
                                <>
                                    <ToggleRight size={18} className="mr-2" />
                                    Open
                                </>
                            ) : (
                                <>
                                    <ToggleLeft size={18} className="mr-2" />
                                    Closed
                                </>
                            )}
                        </Button>
                    )}

                    {restaurant.approval_status === 'approved' && (
                        <Link to={`/analytics/restaurant/${restaurant.id}`}>
                            <Button variant="outline" data-testid="view-analytics-btn">
                                <BarChart3 size={18} className="mr-2" />
                                Analytics
                            </Button>
                        </Link>
                    )}

                    <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
                        <DialogTrigger asChild>
                            <Button className="btn-primary" data-testid="add-menu-item-btn">
                                <Plus size={18} className="mr-2" />
                                Add Menu Item
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Menu Item</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                                <div>
                                    <Label>Item Name *</Label>
                                    <Input
                                        value={newItem.name}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g., Margherita Pizza"
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>Description</Label>
                                    <Textarea
                                        value={newItem.description}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Describe the dish"
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>Price (₹) *</Label>
                                    <Input
                                        type="number"
                                        value={newItem.price}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, price: e.target.value }))}
                                        placeholder="299"
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>Category *</Label>
                                    <Input
                                        value={newItem.category}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                                        placeholder="e.g., Pizza, Burgers, Drinks"
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>Image URL</Label>
                                    <Input
                                        value={newItem.image}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, image: e.target.value }))}
                                        placeholder="https://..."
                                        className="mt-1"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={newItem.is_veg}
                                        onCheckedChange={(checked) => setNewItem(prev => ({ ...prev, is_veg: checked }))}
                                    />
                                    <Label>Vegetarian</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={newItem.is_visible}
                                        onCheckedChange={(checked) => setNewItem(prev => ({ ...prev, is_visible: checked }))}
                                    />
                                    <Label>Show on Menu</Label>
                                </div>
                                <div>
                                    <Label>Available After (Time)</Label>
                                    <Select
                                        value={newItem.available_after || 'always'}
                                        onValueChange={(value) => setNewItem(prev => ({ 
                                            ...prev, 
                                            available_after: value === 'always' ? '' : value 
                                        }))}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue placeholder="Always available" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="always">Always Available</SelectItem>
                                            <SelectItem value="06:00">After 6:00 AM (Breakfast)</SelectItem>
                                            <SelectItem value="11:00">After 11:00 AM (Lunch)</SelectItem>
                                            <SelectItem value="13:00">After 1:00 PM (Afternoon)</SelectItem>
                                            <SelectItem value="17:00">After 5:00 PM (Evening)</SelectItem>
                                            <SelectItem value="18:00">After 6:00 PM (Dinner)</SelectItem>
                                            <SelectItem value="20:00">After 8:00 PM (Late Night)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Item will be visible but not orderable before this time
                                    </p>
                                </div>
                                <Button onClick={handleAddMenuItem} className="w-full btn-primary">
                                    Add Item
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Edit Menu Item Dialog */}
                    <Dialog open={showEditItem} onOpenChange={setShowEditItem}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Edit Menu Item</DialogTitle>
                            </DialogHeader>
                            {editingItem && (
                                <div className="space-y-4">
                                    <div>
                                        <Label>Item Name *</Label>
                                        <Input
                                            value={editingItem.name}
                                            onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                            placeholder="e.g., Chicken Biryani"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label>Description</Label>
                                        <Textarea
                                            value={editingItem.description || ''}
                                            onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                                            placeholder="Describe your dish..."
                                            className="mt-1"
                                            rows={2}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Price (₹) *</Label>
                                            <Input
                                                type="number"
                                                value={editingItem.price}
                                                onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                                                placeholder="199"
                                                className="mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label>Category *</Label>
                                            <Input
                                                value={editingItem.category}
                                                onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                                                placeholder="e.g., Main Course"
                                                className="mt-1"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Image URL</Label>
                                        <Input
                                            value={editingItem.image || ''}
                                            onChange={(e) => setEditingItem({ ...editingItem, image: e.target.value })}
                                            placeholder="https://..."
                                            className="mt-1"
                                        />
                                        {editingItem.image && (
                                            <img src={editingItem.image} alt="Preview" className="mt-2 h-20 w-20 object-cover rounded" />
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label>Vegetarian</Label>
                                        <Switch
                                            checked={editingItem.is_veg}
                                            onCheckedChange={(checked) => setEditingItem({ ...editingItem, is_veg: checked })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label>Visible on Menu</Label>
                                        <Switch
                                            checked={editingItem.is_visible !== false}
                                            onCheckedChange={(checked) => setEditingItem({ ...editingItem, is_visible: checked })}
                                        />
                                    </div>
                                    <Button onClick={handleSaveMenuItem} className="w-full btn-primary">
                                        Save Changes
                                    </Button>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>

                    {/* Edit Restaurant Dialog */}
                    <Dialog open={showEditRestaurant} onOpenChange={setShowEditRestaurant}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Edit Restaurant Profile</DialogTitle>
                            </DialogHeader>
                            {dashboard?.restaurant && (
                                <div className="space-y-4">
                                    <div>
                                        <Label>Restaurant Image URL</Label>
                                        <Input
                                            value={dashboard.restaurant.image || ''}
                                            onChange={(e) => setDashboard({
                                                ...dashboard,
                                                restaurant: { ...dashboard.restaurant, image: e.target.value }
                                            })}
                                            placeholder="https://..."
                                            className="mt-1"
                                        />
                                        {dashboard.restaurant.image && (
                                            <img src={dashboard.restaurant.image} alt="Preview" className="mt-2 h-24 w-24 object-cover rounded" />
                                        )}
                                    </div>
                                    <div>
                                        <Label>FSSAI Certificate URL</Label>
                                        <Input
                                            value={dashboard.restaurant.fssai_certificate || ''}
                                            onChange={(e) => setDashboard({
                                                ...dashboard,
                                                restaurant: { ...dashboard.restaurant, fssai_certificate: e.target.value }
                                            })}
                                            placeholder="https://... (upload your FSSAI certificate image)"
                                            className="mt-1"
                                        />
                                        {dashboard.restaurant.fssai_certificate && (
                                            <img src={dashboard.restaurant.fssai_certificate} alt="FSSAI" className="mt-2 h-24 object-contain rounded border" />
                                        )}
                                    </div>
                                    <Button onClick={handleUpdateRestaurant} className="w-full btn-primary">
                                        Save Changes
                                    </Button>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Pending Approval Notice */}
            {restaurant.approval_status === 'pending' && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 mb-8">
                    <div className="flex items-center gap-3">
                        <AlertCircle size={24} className="text-yellow-400" />
                        <div>
                            <h3 className="font-semibold text-yellow-400">Pending Admin Approval</h3>
                            <p className="text-sm text-muted-foreground">
                                Your restaurant is being reviewed by admin. You can add menu items while waiting for approval.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejected Notice */}
            {restaurant.approval_status === 'rejected' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-8">
                    <div className="flex items-center gap-3">
                        <XCircle size={24} className="text-red-400" />
                        <div>
                            <h3 className="font-semibold text-red-400">Registration Rejected</h3>
                            <p className="text-sm text-muted-foreground">
                                {restaurant.approval_notes || 'Your restaurant registration was rejected. Please contact support.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Pending Changes Notice */}
            {restaurant.has_pending_changes && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6 mb-8">
                    <div className="flex items-center gap-3">
                        <Clock size={24} className="text-blue-400" />
                        <div>
                            <h3 className="font-semibold text-blue-400">Changes Pending Approval</h3>
                            <p className="text-sm text-muted-foreground">
                                You have submitted changes that are waiting for admin approval.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Package size={24} className="text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.total_orders}</p>
                            <p className="text-muted-foreground text-sm">Total Orders</p>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                            <Clock size={24} className="text-orange-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.pending_orders}</p>
                            <p className="text-muted-foreground text-sm">Pending Orders</p>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <IndianRupee size={24} className="text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold price-tag">₹{stats.total_revenue}</p>
                            <p className="text-muted-foreground text-sm">Total Revenue</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="orders" className="space-y-6">
                <TabsList className="flex-wrap">
                    <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
                    <TabsTrigger value="menu">Menu ({restaurant.menu?.length || 0})</TabsTrigger>
                    <TabsTrigger value="discounts" data-testid="discounts-tab">
                        Discounts ({discounts.length})
                    </TabsTrigger>
                    <TabsTrigger value="payouts" data-testid="payouts-tab">
                        <Wallet size={14} className="mr-1" />
                        Payouts
                    </TabsTrigger>
                    <TabsTrigger value="payments" data-testid="payments-tab">
                        <IndianRupee size={14} className="mr-1" />
                        Payments
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="orders" className="space-y-4">
                    {orders.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No orders yet
                        </div>
                    ) : (
                        orders.map(order => (
                            <div key={order.id} className="order-card" data-testid={`order-${order.id}`}>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                    <div>
                                        <p className="font-mono text-sm text-muted-foreground">#{order.id}</p>
                                        <p className="font-semibold">{order.user_name}</p>
                                        <p className="text-sm text-muted-foreground">{order.user_phone}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`status-badge ${getStatusColor(order.status)}`}>
                                            {order.status.replace('_', ' ')}
                                        </span>
                                        <Badge variant={order.payment_method === 'cod' ? 'outline' : 'default'}>
                                            {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Prepaid'}
                                        </Badge>
                                        <span className="price-tag font-semibold">₹{order.total_amount}</span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 mb-4">
                                    {order.items?.map((item, idx) => (
                                        <span key={idx} className="text-sm bg-secondary px-2 py-1 rounded">
                                            {item.name} x{item.quantity}
                                        </span>
                                    ))}
                                </div>

                                {/* Estimated Time Display */}
                                {order.estimated_prep_time && (
                                    <div className="mb-3 flex items-center gap-2 text-sm bg-blue-50 text-blue-700 p-2 rounded">
                                        <Timer size={14} />
                                        <span>Prep time: {order.estimated_prep_time} mins | Total delivery: {order.estimated_delivery_time} mins</span>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    {/* Print Bill Button - Always show */}
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                                        onClick={() => openPrintBill(order, restaurant.name)}
                                        data-testid={`print-bill-${order.id}`}
                                    >
                                        <Printer size={14} className="mr-1" />
                                        Print Bill
                                    </Button>
                                    
                                    {/* WhatsApp Share Button - Always show for active orders */}
                                    {['pending', 'confirmed', 'preparing'].includes(order.status) && (
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                                            onClick={() => shareOrderToWhatsApp(order)}
                                            data-testid={`share-whatsapp-${order.id}`}
                                        >
                                            <MessageCircle size={14} className="mr-1" />
                                            Share to Chef
                                        </Button>
                                    )}
                                    
                                    {order.status === 'pending' && (
                                        <>
                                            <Button size="sm" onClick={() => openConfirmDialog(order.id)}>
                                                <Timer size={14} className="mr-1" />
                                                Confirm with Time
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => openCancelDialog(order.id)}>
                                                Cancel Order
                                            </Button>
                                        </>
                                    )}
                                    {order.status === 'confirmed' && (
                                        <>
                                            <Button size="sm" onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}>
                                                Start Preparing
                                            </Button>
                                            <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600" onClick={() => openCancelDialog(order.id)}>
                                                Cancel
                                            </Button>
                                        </>
                                    )}
                                    {order.status === 'preparing' && (
                                        <Button size="sm" onClick={() => handleUpdateOrderStatus(order.id, 'ready')}>
                                            Ready for Pickup
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </TabsContent>

                <TabsContent value="menu" className="space-y-4">
                    {restaurant.menu?.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No menu items yet. Add your first item!
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                            {restaurant.menu?.map(item => (
                                <div 
                                    key={item.id} 
                                    className={`flex gap-4 p-4 rounded-xl border ${item.is_visible === false ? 'border-dashed border-muted-foreground/50 opacity-60' : 'border-border'}`}
                                >
                                    <img
                                        src={item.image || 'https://via.placeholder.com/80'}
                                        alt={item.name}
                                        className="w-20 h-20 rounded-lg object-cover"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <div className={`veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}`} />
                                                    <h4 className="font-medium">{item.name}</h4>
                                                    {item.is_visible === false && (
                                                        <Badge variant="outline" className="text-xs">Hidden</Badge>
                                                    )}
                                                </div>
                                                <p className="price-tag">₹{item.price}</p>
                                                <p className="text-xs text-muted-foreground">{item.category}</p>
                                                {item.available_after && (
                                                    <p className="text-xs text-orange-400 flex items-center gap-1 mt-1">
                                                        <Clock size={12} />
                                                        Available after {item.available_after}
                                                    </p>
                                                )}
                                            </div>
                                                <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEditMenuItem(item)}
                                                        className="text-blue-400 hover:text-blue-500"
                                                        title="Edit item"
                                                    >
                                                        <Edit size={18} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleToggleItemVisibility(item.id, item.is_visible !== false)}
                                                        className={item.is_visible !== false ? 'text-blue-400' : 'text-muted-foreground'}
                                                        title={item.is_visible !== false ? 'Hide from menu' : 'Show on menu'}
                                                    >
                                                        {item.is_visible !== false ? <Store size={18} /> : <Store size={18} className="opacity-50" />}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleToggleItemAvailability(item.id)}
                                                        className={item.is_available ? 'text-green-400' : 'text-muted-foreground'}
                                                        title={item.is_available ? 'Mark unavailable' : 'Mark available'}
                                                    >
                                                        {item.is_available ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openDeleteMenuItemDialog(item)}
                                                        className="text-muted-foreground hover:text-destructive"
                                                        data-testid={`delete-menu-item-${item.id}`}
                                                    >
                                                        <Trash2 size={18} />
                                                    </Button>
                                                </div>
                                                <Select
                                                    value={item.available_after || 'always'}
                                                    onValueChange={(value) => handleUpdateItemAvailableTime(item.id, value === 'always' ? null : value)}
                                                >
                                                    <SelectTrigger className="h-7 text-xs w-28">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="always">Always</SelectItem>
                                                        <SelectItem value="06:00">After 6 AM</SelectItem>
                                                        <SelectItem value="11:00">After 11 AM</SelectItem>
                                                        <SelectItem value="13:00">After 1 PM</SelectItem>
                                                        <SelectItem value="17:00">After 5 PM</SelectItem>
                                                        <SelectItem value="18:00">After 6 PM</SelectItem>
                                                        <SelectItem value="20:00">After 8 PM</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Discounts Tab */}
                <TabsContent value="discounts" className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Restaurant Discounts</h3>
                        <Dialog open={showAddDiscount} onOpenChange={setShowAddDiscount}>
                            <DialogTrigger asChild>
                                <Button className="btn-primary">
                                    <Plus size={16} className="mr-2" /> Create Discount
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Create Discount Offer</DialogTitle>
                                    <DialogDescription>Create a new discount to attract customers</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 mt-4">
                                    <div>
                                        <Label>Discount Name *</Label>
                                        <Input
                                            value={newDiscount.name}
                                            onChange={(e) => setNewDiscount(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="e.g., Weekend Special"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label>Description</Label>
                                        <Textarea
                                            value={newDiscount.description}
                                            onChange={(e) => setNewDiscount(prev => ({ ...prev, description: e.target.value }))}
                                            placeholder="Describe the offer..."
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label>Discount Type *</Label>
                                        <Select
                                            value={newDiscount.discount_type}
                                            onValueChange={(v) => setNewDiscount(prev => ({ ...prev, discount_type: v }))}
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="percentage">Percentage Off</SelectItem>
                                                <SelectItem value="min_order_value">Flat Discount on Min Order</SelectItem>
                                                <SelectItem value="buy_one_get_one">Buy 1 Get 1 Free</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>
                                                {newDiscount.discount_type === 'percentage' ? 'Discount %' : 'Discount Amount (₹)'} *
                                            </Label>
                                            <Input
                                                type="number"
                                                value={newDiscount.discount_value}
                                                onChange={(e) => setNewDiscount(prev => ({ ...prev, discount_value: e.target.value }))}
                                                placeholder={newDiscount.discount_type === 'percentage' ? '20' : '50'}
                                                className="mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label>Min Order (₹)</Label>
                                            <Input
                                                type="number"
                                                value={newDiscount.min_order_amount}
                                                onChange={(e) => setNewDiscount(prev => ({ ...prev, min_order_amount: e.target.value }))}
                                                placeholder="0"
                                                className="mt-1"
                                            />
                                        </div>
                                    </div>
                                    {newDiscount.discount_type === 'percentage' && (
                                        <div>
                                            <Label>Max Discount (₹) - Optional Cap</Label>
                                            <Input
                                                type="number"
                                                value={newDiscount.max_discount}
                                                onChange={(e) => setNewDiscount(prev => ({ ...prev, max_discount: e.target.value }))}
                                                placeholder="100"
                                                className="mt-1"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <Label>Display Message * (shown below restaurant image)</Label>
                                        <Input
                                            value={newDiscount.display_message}
                                            onChange={(e) => setNewDiscount(prev => ({ ...prev, display_message: e.target.value }))}
                                            placeholder="e.g., 20% OFF on orders above ₹300!"
                                            className="mt-1"
                                        />
                                    </div>
                                    <Button onClick={handleCreateDiscount} className="w-full btn-primary">
                                        Create Discount
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {discounts.length === 0 ? (
                        <div className="text-center py-12 bg-secondary/30 rounded-xl">
                            <TrendingUp size={40} className="mx-auto text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">No discounts created yet</p>
                            <p className="text-sm text-muted-foreground">Create offers to attract more customers!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {discounts.map(discount => (
                                <div key={discount.id} className="bg-card rounded-xl border border-border p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <h4 className="font-semibold">{discount.name}</h4>
                                            <Badge variant={discount.is_active ? 'default' : 'secondary'}>
                                                {discount.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleToggleDiscount(discount.id)}
                                            >
                                                {discount.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleDeleteDiscount(discount.id)}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-2">{discount.description}</p>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <Badge variant="outline">
                                            {discount.discount_type === 'percentage' && `${discount.discount_value}% OFF`}
                                            {discount.discount_type === 'min_order_value' && `₹${discount.discount_value} OFF`}
                                            {discount.discount_type === 'buy_one_get_one' && 'Buy 1 Get 1'}
                                        </Badge>
                                        {discount.min_order_amount > 0 && (
                                            <Badge variant="outline">Min Order: ₹{discount.min_order_amount}</Badge>
                                        )}
                                        {discount.max_discount && (
                                            <Badge variant="outline">Max: ₹{discount.max_discount}</Badge>
                                        )}
                                    </div>
                                    <p className="mt-2 text-sm text-orange-500 font-medium">"{discount.display_message}"</p>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Payouts Tab */}
                <TabsContent value="payouts" className="space-y-4">
                    <h3 className="text-lg font-semibold">Payout Status</h3>
                    
                    {/* Payout Summary */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                            <p className="text-sm text-yellow-400">Pending Payout</p>
                            <p className="text-3xl font-bold text-yellow-400">₹{payouts?.pending_amount?.toLocaleString() || 0}</p>
                            <p className="text-xs text-muted-foreground mt-1">{payouts?.pending_orders?.length || 0} orders pending</p>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                            <p className="text-sm text-green-400">Total Cleared</p>
                            <p className="text-3xl font-bold text-green-400">₹{payouts?.cleared_amount?.toLocaleString() || 0}</p>
                            <p className="text-xs text-muted-foreground mt-1">{payouts?.cleared_orders?.length || 0} orders cleared</p>
                        </div>
                    </div>

                    {/* Recent Cleared Payouts */}
                    {payouts?.cleared_orders?.length > 0 && (
                        <div className="bg-card rounded-xl border border-border p-4">
                            <h4 className="font-semibold mb-3">Recent Cleared Payouts</h4>
                            <div className="space-y-2">
                                {payouts.cleared_orders.slice(0, 10).map(order => (
                                    <div key={order.order_id} className="flex items-center justify-between bg-secondary/30 p-3 rounded-lg">
                                        <div>
                                            <p className="font-mono text-sm">#{order.order_id}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Cleared: {order.cleared_date ? format(new Date(order.cleared_date), 'MMM d, yyyy') : 'N/A'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-green-400">₹{order.amount}</p>
                                            {order.admin_comment && (
                                                <p className="text-xs text-muted-foreground">Note: {order.admin_comment}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add Comment Section */}
                    <div className="bg-card rounded-xl border border-border p-4">
                        <h4 className="font-semibold mb-3">Add Comment on Payout</h4>
                        <Dialog open={showPayoutComment} onOpenChange={setShowPayoutComment}>
                            <DialogTrigger asChild>
                                <Button variant="outline">
                                    <Plus size={14} className="mr-2" /> Add Comment
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add Payout Comment</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 mt-4">
                                    <div>
                                        <Label>Order ID (optional)</Label>
                                        <Input
                                            value={payoutComment.order_id}
                                            onChange={(e) => setPayoutComment(prev => ({ ...prev, order_id: e.target.value }))}
                                            placeholder="e.g., abc123..."
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label>Comment *</Label>
                                        <Textarea
                                            value={payoutComment.comment}
                                            onChange={(e) => setPayoutComment(prev => ({ ...prev, comment: e.target.value }))}
                                            placeholder="Your message to admin..."
                                            className="mt-1"
                                        />
                                    </div>
                                    <Button onClick={handleAddPayoutComment} className="w-full btn-primary">
                                        Submit Comment
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        {/* Previous Comments */}
                        {payouts?.comments?.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <p className="text-sm font-medium">Previous Comments:</p>
                                {payouts.comments.map(comment => (
                                    <div key={comment.id} className="bg-secondary/30 p-3 rounded-lg text-sm">
                                        <p>{comment.comment}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {comment.created_at ? format(new Date(comment.created_at), 'MMM d, yyyy h:mm a') : ''}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* Payments Tab */}
                <TabsContent value="payments" className="space-y-6" data-testid="payments-content">
                    {/* Payment Summary Cards */}
                    <div className="grid md:grid-cols-4 gap-4">
                        <div className="bg-card rounded-xl border border-border p-4">
                            <p className="text-sm text-muted-foreground">Total Sales</p>
                            <p className="text-2xl font-bold price-tag">₹{payments?.summary?.total_sales?.toLocaleString() || 0}</p>
                            <p className="text-xs text-muted-foreground">{payments?.summary?.total_orders || 0} orders</p>
                        </div>
                        <div className="bg-card rounded-xl border border-border p-4">
                            <p className="text-sm text-muted-foreground">Platform Fee (1%)</p>
                            <p className="text-2xl font-bold text-red-400">₹{payments?.summary?.platform_fees?.toLocaleString() || 0}</p>
                        </div>
                        <div className="bg-card rounded-xl border border-border p-4">
                            <p className="text-sm text-muted-foreground">Pending Payout</p>
                            <p className="text-2xl font-bold text-yellow-400">₹{payments?.summary?.pending_payout?.toLocaleString() || 0}</p>
                        </div>
                        <div className="bg-card rounded-xl border border-border p-4">
                            <p className="text-sm text-muted-foreground">Cleared</p>
                            <p className="text-2xl font-bold text-green-400">₹{payments?.summary?.cleared_payout?.toLocaleString() || 0}</p>
                        </div>
                    </div>

                    {/* Order-wise Payment Details */}
                    <div className="bg-card rounded-2xl border border-border overflow-hidden">
                        <div className="p-4 border-b border-border">
                            <h3 className="font-semibold flex items-center gap-2">
                                <TrendingUp size={20} className="text-primary" />
                                Order-wise Payment Breakdown
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                You receive {payments?.commission_rate ? `${100 - parseFloat(payments.commission_rate)}%` : '95%'} of order value (5% platform fee)
                            </p>
                        </div>
                        
                        {payments?.orders?.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <IndianRupee size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No delivered orders yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {/* Header */}
                                <div className="grid grid-cols-6 gap-4 p-4 bg-secondary/30 text-sm font-medium text-muted-foreground">
                                    <span>Order ID</span>
                                    <span>Date</span>
                                    <span>Payment Type</span>
                                    <span>Order Amount</span>
                                    <span>Platform Fee</span>
                                    <span>Your Payout</span>
                                </div>
                                
                                {/* Order rows */}
                                {payments?.orders?.map(order => (
                                    <div 
                                        key={order.id} 
                                        className="grid grid-cols-6 gap-4 p-4 items-center text-sm hover:bg-secondary/30"
                                        data-testid={`payment-order-${order.id}`}
                                    >
                                        <span className="font-mono">#{order.id}</span>
                                        <span className="text-muted-foreground">
                                            {order.delivered_at ? format(new Date(order.delivered_at), 'MMM d, h:mm a') : '-'}
                                        </span>
                                        <Badge variant={order.payment_method === 'cod' ? 'outline' : 'default'}>
                                            {order.payment_method === 'cod' ? (
                                                <><CreditCard size={12} className="mr-1" /> COD</>
                                            ) : (
                                                <><Wallet size={12} className="mr-1" /> Prepaid</>
                                            )}
                                        </Badge>
                                        <span className="price-tag">₹{order.total_amount}</span>
                                        <span className="text-red-400">-₹{order.platform_fee || Math.round(order.total_amount * 0.05)}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold price-tag">₹{order.your_payout}</span>
                                            {order.restaurant_payout_status === 'cleared' ? (
                                                <Badge className="bg-green-500/20 text-green-400 text-xs">
                                                    <CheckCircle size={10} className="mr-1" />
                                                    Cleared
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                                                    <Clock size={10} className="mr-1" />
                                                    Pending
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm">
                        <p className="font-medium text-blue-400 mb-2">Payment Information</p>
                        <ul className="space-y-1 text-muted-foreground">
                            <li>• Payments are processed after order delivery</li>
                            <li>• COD payments are cleared after delivery partner returns cash</li>
                            <li>• Platform fee: 5% of order value</li>
                        </ul>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Cancel Order Dialog */}
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Cancel Order</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <p className="text-muted-foreground">
                            Please provide a reason for cancelling this order. The customer will be notified.
                        </p>
                        
                        {/* Unavailable Items Selection */}
                        {cancelOrderItems.length > 0 && (
                            <div>
                                <Label className="mb-2 block">Select Unavailable Items (if any)</Label>
                                <div className="border border-border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                                    {cancelOrderItems.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            <Checkbox
                                                id={`item-${idx}`}
                                                checked={unavailableItems.includes(item.name)}
                                                onCheckedChange={() => toggleUnavailableItem(item.name)}
                                            />
                                            <label 
                                                htmlFor={`item-${idx}`} 
                                                className="flex-1 cursor-pointer text-sm flex justify-between"
                                            >
                                                <span>{item.name} x{item.quantity}</span>
                                                <span className="text-muted-foreground">₹{(item.price * item.quantity).toFixed(0)}</span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                                {unavailableItems.length > 0 && (
                                    <p className="text-xs text-orange-600 mt-1">
                                        {unavailableItems.length} item(s) marked as unavailable
                                    </p>
                                )}
                            </div>
                        )}
                        
                        <div>
                            <Label>Cancellation Reason *</Label>
                            <Select value={cancelReason} onValueChange={setCancelReason}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Select a reason" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Items not available">Items not available</SelectItem>
                                    <SelectItem value="Kitchen closed">Kitchen closed</SelectItem>
                                    <SelectItem value="Too busy to prepare">Too busy to prepare</SelectItem>
                                    <SelectItem value="Ingredient shortage">Ingredient shortage</SelectItem>
                                    <SelectItem value="Restaurant temporarily closed">Restaurant temporarily closed</SelectItem>
                                    <SelectItem value="Other">Other (specify in comment)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div>
                            <Label>Additional Comment (optional)</Label>
                            <Textarea
                                value={cancelComment}
                                onChange={(e) => setCancelComment(e.target.value)}
                                placeholder="Add any additional notes for the customer..."
                                className="mt-1"
                                rows={2}
                            />
                        </div>
                        
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
                            <p className="font-medium">Customer Options:</p>
                            <p className="text-orange-700 mt-1">
                                The customer can reorder with available items or request a full refund.
                            </p>
                        </div>
                        
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                                Go Back
                            </Button>
                            <Button 
                                variant="destructive" 
                                onClick={handleCancelOrder}
                                disabled={!cancelReason.trim()}
                            >
                                <XCircle size={16} className="mr-2" />
                                Cancel Order
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Confirm Order with Prep Time Dialog */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Order</DialogTitle>
                        <DialogDescription>
                            Set the estimated preparation time for this order
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <Label>Estimated Preparation Time</Label>
                            <Select value={estimatedPrepTime} onValueChange={setEstimatedPrepTime}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10 minutes</SelectItem>
                                    <SelectItem value="15">15 minutes</SelectItem>
                                    <SelectItem value="20">20 minutes</SelectItem>
                                    <SelectItem value="25">25 minutes</SelectItem>
                                    <SelectItem value="30">30 minutes</SelectItem>
                                    <SelectItem value="40">40 minutes</SelectItem>
                                    <SelectItem value="45">45 minutes</SelectItem>
                                    <SelectItem value="60">60 minutes</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                                Customer will see estimated delivery time of ~{parseInt(estimatedPrepTime) + 20} mins
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="flex-1">
                                Cancel
                            </Button>
                            <Button onClick={handleConfirmWithTime} className="flex-1 btn-primary">
                                <CheckCircle size={16} className="mr-2" />
                                Confirm Order
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Menu Item Confirmation Dialog */}
            <Dialog open={showDeleteMenuItemDialog} onOpenChange={setShowDeleteMenuItemDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Menu Item</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this menu item?
                        </DialogDescription>
                    </DialogHeader>
                    {deletingMenuItem && (
                        <div className="space-y-4 py-2">
                            <div className="flex items-center gap-3 bg-secondary/50 rounded-lg p-3">
                                <div className={`w-3 h-3 rounded-full ${deletingMenuItem.is_veg ? 'bg-green-500' : 'bg-red-500'}`} />
                                <div className="flex-1">
                                    <p className="font-medium">{deletingMenuItem.name}</p>
                                    <p className="text-sm text-muted-foreground">₹{deletingMenuItem.price}</p>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                This action cannot be undone. The item will be permanently removed from your menu.
                            </p>
                            <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    onClick={() => {
                                        setShowDeleteMenuItemDialog(false);
                                        setDeletingMenuItem(null);
                                    }} 
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    variant="destructive" 
                                    onClick={() => handleDeleteMenuItem(deletingMenuItem.id)} 
                                    className="flex-1"
                                    data-testid="confirm-delete-menu-item"
                                >
                                    <Trash2 size={16} className="mr-2" />
                                    Delete Item
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
