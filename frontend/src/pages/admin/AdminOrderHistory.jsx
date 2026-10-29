import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { 
    History, RefreshCw, Search, Phone, MapPin, Clock, 
    Package, ChefHat, Bike, CheckCircle, XCircle, AlertCircle,
    CreditCard, Wallet, Timer, Eye, User, Store
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAdmin } from '../../contexts/AdminContext';
import { format } from 'date-fns';

export default function AdminOrderHistory() {
    const { API } = useAdmin();
    const [orders, setOrders] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const intervalRef = useRef(null);

    const fetchOrders = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/admin/order-history?limit=100`);
            setOrders(response.data.orders);
            setStats(response.data.stats);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setLoading(false);
        }
    }, [API]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // Auto-refresh every 5 seconds when enabled
    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = setInterval(() => {
                fetchOrders();
            }, 5000);
        }
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [autoRefresh, fetchOrders]);

    const getStatusColor = (status) => {
        const colors = {
            pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
            confirmed: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
            preparing: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
            ready: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
            picked_up: 'bg-cyan-500/20 text-cyan-500 border-cyan-500/30',
            delivered: 'bg-green-500/20 text-green-500 border-green-500/30',
            cancelled: 'bg-red-500/20 text-red-500 border-red-500/30'
        };
        return colors[status] || 'bg-gray-500/20 text-gray-500';
    };

    const getDeliveryStatusColor = (status) => {
        const colors = {
            awaiting_pickup: 'bg-gray-500/20 text-gray-400',
            awaiting_partner: 'bg-yellow-500/20 text-yellow-500',
            partner_assigned: 'bg-blue-500/20 text-blue-500',
            out_for_delivery: 'bg-cyan-500/20 text-cyan-500',
            delivered: 'bg-green-500/20 text-green-500',
            cancelled: 'bg-red-500/20 text-red-500'
        };
        return colors[status] || 'bg-gray-500/20 text-gray-400';
    };

    const formatDeliveryStatus = (status) => {
        const labels = {
            awaiting_pickup: 'Awaiting Pickup',
            awaiting_partner: 'Awaiting Partner',
            partner_assigned: 'Partner Assigned',
            out_for_delivery: 'Out for Delivery',
            delivered: 'Delivered',
            cancelled: 'Cancelled'
        };
        return labels[status] || status;
    };

    const filteredOrders = orders.filter(order => {
        const matchesSearch = searchQuery === '' || 
            order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.customer_phone?.includes(searchQuery) ||
            order.restaurant_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.id?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || order.restaurant_status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });

    const openOrderDetail = (order) => {
        setSelectedOrder(order);
        setShowDetailDialog(true);
    };

    if (loading) {
        return (
            <div className="space-y-6" data-testid="order-history-loading">
                <div className="skeleton h-20 rounded-2xl" />
                <div className="skeleton h-96 rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6" data-testid="admin-order-history">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <History className="text-primary" />
                        Order History
                    </h1>
                    <p className="text-muted-foreground">
                        Real-time order tracking • {autoRefresh && (
                            <span className="text-green-500">
                                Auto-refreshing every 5s
                            </span>
                        )}
                        {lastUpdated && (
                            <span className="ml-2 text-xs">
                                Last updated: {format(lastUpdated, 'h:mm:ss a')}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant={autoRefresh ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        data-testid="auto-refresh-toggle"
                    >
                        {autoRefresh ? (
                            <><RefreshCw size={16} className="mr-2 animate-spin" /> Live</>
                        ) : (
                            <><RefreshCw size={16} className="mr-2" /> Paused</>
                        )}
                    </Button>
                    <Button onClick={fetchOrders} variant="outline" size="sm">
                        <RefreshCw size={16} className="mr-2" />
                        Refresh Now
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                <div className="bg-card rounded-xl border border-border p-4 text-center">
                    <p className="text-2xl font-bold">{stats.total || 0}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="bg-yellow-500/10 rounded-xl border border-yellow-500/30 p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-500">{stats.pending || 0}</p>
                    <p className="text-xs text-yellow-500">Pending</p>
                </div>
                <div className="bg-blue-500/10 rounded-xl border border-blue-500/30 p-4 text-center">
                    <p className="text-2xl font-bold text-blue-500">{stats.confirmed || 0}</p>
                    <p className="text-xs text-blue-500">Confirmed</p>
                </div>
                <div className="bg-orange-500/10 rounded-xl border border-orange-500/30 p-4 text-center">
                    <p className="text-2xl font-bold text-orange-500">{stats.preparing || 0}</p>
                    <p className="text-xs text-orange-500">Preparing</p>
                </div>
                <div className="bg-purple-500/10 rounded-xl border border-purple-500/30 p-4 text-center">
                    <p className="text-2xl font-bold text-purple-500">{stats.ready || 0}</p>
                    <p className="text-xs text-purple-500">Ready</p>
                </div>
                <div className="bg-cyan-500/10 rounded-xl border border-cyan-500/30 p-4 text-center">
                    <p className="text-2xl font-bold text-cyan-500">{stats.picked_up || 0}</p>
                    <p className="text-xs text-cyan-500">Picked Up</p>
                </div>
                <div className="bg-green-500/10 rounded-xl border border-green-500/30 p-4 text-center">
                    <p className="text-2xl font-bold text-green-500">{stats.delivered || 0}</p>
                    <p className="text-xs text-green-500">Delivered</p>
                </div>
                <div className="bg-red-500/10 rounded-xl border border-red-500/30 p-4 text-center">
                    <p className="text-2xl font-bold text-red-500">{stats.cancelled || 0}</p>
                    <p className="text-xs text-red-500">Cancelled</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by customer, phone, restaurant, or order ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                        data-testid="search-input"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-48" data-testid="status-filter">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Orders</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="preparing">Preparing</SelectItem>
                        <SelectItem value="ready">Ready</SelectItem>
                        <SelectItem value="picked_up">Picked Up</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Orders Table */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-secondary/50 border-b border-border">
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Order ID</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Customer</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Restaurant</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Value</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Restaurant Status</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Delivery Partner</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Delivery Status</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Time</th>
                                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="p-8 text-center text-muted-foreground">
                                        <Package size={48} className="mx-auto mb-4 opacity-50" />
                                        <p>No orders found</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map(order => (
                                    <tr 
                                        key={order.id} 
                                        className="hover:bg-secondary/30 transition-colors"
                                        data-testid={`order-row-${order.id}`}
                                    >
                                        <td className="p-4">
                                            <span className="font-mono text-sm">#{order.id}</span>
                                            <div className="flex items-center gap-1 mt-1">
                                                <Badge variant={order.payment_method === 'cod' ? 'outline' : 'default'} className="text-xs">
                                                    {order.payment_method === 'cod' ? 'COD' : 'Prepaid'}
                                                </Badge>
                                                {order.is_delayed && (
                                                    <Badge className="bg-red-500/20 text-red-500 text-xs">
                                                        <AlertCircle size={10} className="mr-1" />
                                                        Delayed
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                                    <User size={14} className="text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{order.customer_name}</p>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Phone size={10} />
                                                        {order.customer_phone}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                                                    <Store size={14} className="text-orange-500" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{order.restaurant_name}</p>
                                                    {order.restaurant_phone ? (
                                                        <a href={`tel:${order.restaurant_phone}`} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary">
                                                            <Phone size={10} />
                                                            {order.restaurant_phone}
                                                        </a>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">{order.items_count} items</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <p className="font-semibold price-tag">₹{order.total_value}</p>
                                            <p className="text-xs text-muted-foreground">
                                                (₹{order.order_value} + ₹{order.delivery_fee}{order.cod_fee > 0 ? ` + ₹${order.cod_fee}` : ''})
                                            </p>
                                        </td>
                                        <td className="p-4">
                                            <Badge className={`${getStatusColor(order.restaurant_status)} border`}>
                                                {order.restaurant_status === 'preparing' && <ChefHat size={12} className="mr-1" />}
                                                {order.restaurant_status === 'ready' && <Package size={12} className="mr-1" />}
                                                {order.restaurant_status === 'delivered' && <CheckCircle size={12} className="mr-1" />}
                                                {order.restaurant_status === 'cancelled' && <XCircle size={12} className="mr-1" />}
                                                {order.restaurant_status.replace('_', ' ')}
                                            </Badge>
                                        </td>
                                        <td className="p-4">
                                            {order.delivery_partner_name ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                        <Bike size={14} className="text-blue-500" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">{order.delivery_partner_name}</p>
                                                        {order.delivery_partner_phone && (
                                                            <a href={`tel:${order.delivery_partner_phone}`} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary">
                                                                <Phone size={10} />
                                                                {order.delivery_partner_phone}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm italic">Not assigned</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <Badge className={`${getDeliveryStatusColor(order.delivery_status)}`}>
                                                {order.delivery_status === 'out_for_delivery' && <Bike size={12} className="mr-1" />}
                                                {order.delivery_status === 'delivered' && <CheckCircle size={12} className="mr-1" />}
                                                {formatDeliveryStatus(order.delivery_status)}
                                            </Badge>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm">
                                                <p className="text-muted-foreground">
                                                    {order.created_at ? format(new Date(order.created_at), 'MMM d, h:mm a') : '-'}
                                                </p>
                                                {order.estimated_delivery_time && (
                                                    <p className="text-xs text-blue-500 flex items-center gap-1">
                                                        <Timer size={10} />
                                                        Est: {order.estimated_delivery_time} mins
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <Button 
                                                variant="ghost" 
                                                size="sm"
                                                onClick={() => openOrderDetail(order)}
                                                data-testid={`view-order-${order.id}`}
                                            >
                                                <Eye size={16} />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Order Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package size={20} className="text-primary" />
                            Order Details
                        </DialogTitle>
                        <DialogDescription>
                            Order #{selectedOrder?.id}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedOrder && (
                        <div className="space-y-6 mt-4">
                            {/* Status Overview */}
                            <div className="flex flex-wrap gap-3">
                                <Badge className={`${getStatusColor(selectedOrder.restaurant_status)} border text-sm px-3 py-1`}>
                                    Restaurant: {selectedOrder.restaurant_status.replace('_', ' ')}
                                </Badge>
                                <Badge className={`${getDeliveryStatusColor(selectedOrder.delivery_status)} text-sm px-3 py-1`}>
                                    Delivery: {formatDeliveryStatus(selectedOrder.delivery_status)}
                                </Badge>
                                <Badge variant={selectedOrder.payment_method === 'cod' ? 'outline' : 'default'} className="text-sm px-3 py-1">
                                    {selectedOrder.payment_method === 'cod' ? (
                                        <><CreditCard size={14} className="mr-1" /> Cash on Delivery</>
                                    ) : (
                                        <><Wallet size={14} className="mr-1" /> Prepaid</>
                                    )}
                                </Badge>
                            </div>

                            {/* Customer & Restaurant */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="bg-secondary/50 rounded-xl p-4">
                                    <h4 className="font-medium mb-3 flex items-center gap-2">
                                        <User size={16} className="text-primary" />
                                        Customer
                                    </h4>
                                    <p className="font-semibold">{selectedOrder.customer_name}</p>
                                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                        <Phone size={12} />
                                        <a href={`tel:${selectedOrder.customer_phone}`} className="text-primary hover:underline">
                                            {selectedOrder.customer_phone}
                                        </a>
                                    </p>
                                    <p className="text-sm text-muted-foreground flex items-start gap-1 mt-2">
                                        <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                                        <span>
                                            {selectedOrder.delivery_address?.label}: {selectedOrder.delivery_address?.full_address}
                                        </span>
                                    </p>
                                </div>
                                <div className="bg-secondary/50 rounded-xl p-4">
                                    <h4 className="font-medium mb-3 flex items-center gap-2">
                                        <Store size={16} className="text-orange-500" />
                                        Restaurant
                                    </h4>
                                    <p className="font-semibold">{selectedOrder.restaurant_name}</p>
                                    {selectedOrder.restaurant_phone && (
                                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                            <Phone size={12} />
                                            <a href={`tel:${selectedOrder.restaurant_phone}`} className="text-primary hover:underline">
                                                {selectedOrder.restaurant_phone}
                                            </a>
                                        </p>
                                    )}
                                    {selectedOrder.delivery_partner_name && (
                                        <div className="mt-3 pt-3 border-t border-border">
                                            <h4 className="font-medium mb-1 flex items-center gap-2 text-sm">
                                                <Bike size={14} className="text-blue-500" />
                                                Delivery Partner
                                            </h4>
                                            <p className="font-semibold">{selectedOrder.delivery_partner_name}</p>
                                            {selectedOrder.delivery_partner_phone && (
                                                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                                    <Phone size={12} />
                                                    <a href={`tel:${selectedOrder.delivery_partner_phone}`} className="text-primary hover:underline">
                                                        {selectedOrder.delivery_partner_phone}
                                                    </a>
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Order Items */}
                            <div className="bg-secondary/50 rounded-xl p-4">
                                <h4 className="font-medium mb-3">Order Items</h4>
                                <div className="space-y-2">
                                    {selectedOrder.items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-sm">
                                            <span>{item.name} x {item.quantity}</span>
                                            <span className="price-tag">₹{item.price * item.quantity}</span>
                                        </div>
                                    ))}
                                    <div className="border-t border-border pt-2 mt-2 space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Subtotal</span>
                                            <span>₹{selectedOrder.order_value}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Delivery Fee</span>
                                            <span>₹{selectedOrder.delivery_fee}</span>
                                        </div>
                                        {selectedOrder.cod_fee > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">COD Fee</span>
                                                <span>₹{selectedOrder.cod_fee}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between font-semibold">
                                            <span>Total</span>
                                            <span className="price-tag">₹{selectedOrder.total_value}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Timing Info */}
                            <div className="flex flex-wrap gap-4 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Clock size={14} />
                                    Ordered: {selectedOrder.created_at ? format(new Date(selectedOrder.created_at), 'MMM d, yyyy h:mm a') : '-'}
                                </div>
                                {selectedOrder.estimated_delivery_time && (
                                    <div className="flex items-center gap-2 text-blue-500">
                                        <Timer size={14} />
                                        Est. Delivery: {selectedOrder.estimated_delivery_time} mins
                                    </div>
                                )}
                            </div>

                            {/* Delay Info */}
                            {selectedOrder.is_delayed && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                    <p className="text-red-500 font-medium flex items-center gap-2">
                                        <AlertCircle size={16} />
                                        Order Delayed
                                    </p>
                                    {selectedOrder.delay_reason && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Reason: {selectedOrder.delay_reason.replace('_', ' ')}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Notes */}
                            {selectedOrder.notes && (
                                <div className="bg-secondary/50 rounded-xl p-4">
                                    <h4 className="font-medium mb-2">Special Instructions</h4>
                                    <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
