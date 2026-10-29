import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
    Package, Search, Filter, Eye, Bike, MapPin, Phone, 
    CreditCard, Clock, CheckCircle, XCircle, Truck
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useAdmin } from '../../contexts/AdminContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AdminOrders() {
    const { API } = useAdmin();
    const [orders, setOrders] = useState([]);
    const [availablePartners, setAvailablePartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [activeTab, setActiveTab] = useState('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        confirmed: 0,
        preparing: 0,
        ready: 0,
        picked_up: 0,
        delivered: 0,
        cancelled: 0
    });

    const fetchOrders = useCallback(async (status = null) => {
        try {
            let url = `${API}/admin/orders?limit=100`;
            if (status && status !== 'all') url += `&status=${status}`;
            
            const response = await axios.get(url);
            setOrders(response.data.orders);
            setStats({
                total: response.data.total,
                pending: response.data.stats?.pending || 0,
                confirmed: response.data.stats?.confirmed || 0,
                preparing: response.data.stats?.preparing || 0,
                ready: response.data.stats?.ready || 0,
                picked_up: response.data.stats?.picked_up || 0,
                delivered: response.data.stats?.delivered || 0,
                cancelled: response.data.stats?.cancelled || 0
            });
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setLoading(false);
        }
    }, [API]);

    const fetchAvailablePartners = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/admin/delivery-partners/available`);
            setAvailablePartners(response.data);
        } catch (error) {
            console.error('Failed to fetch partners:', error);
        }
    }, [API]);

    useEffect(() => {
        fetchOrders(activeTab);
        fetchAvailablePartners();
    }, [fetchOrders, fetchAvailablePartners, activeTab]);

    const handleUpdateStatus = async (orderId, newStatus) => {
        try {
            await axios.put(`${API}/orders/${orderId}/status`, { status: newStatus });
            toast.success('Order status updated');
            fetchOrders(activeTab);
        } catch (error) {
            toast.error('Failed to update order');
        }
    };

    const handleAssignDelivery = async (partnerId) => {
        if (!selectedOrder) return;
        
        try {
            await axios.put(`${API}/orders/${selectedOrder.id}/status`, {
                status: selectedOrder.status === 'ready' ? 'picked_up' : selectedOrder.status,
                delivery_partner_id: partnerId
            });
            toast.success('Delivery partner assigned');
            setShowAssignDialog(false);
            setSelectedOrder(null);
            fetchOrders(activeTab);
        } catch (error) {
            toast.error('Failed to assign delivery partner');
        }
    };

    const openAssignDialog = async (order) => {
        setSelectedOrder(order);
        await fetchAvailablePartners();
        setShowAssignDialog(true);
    };

    const openDetailDialog = (order) => {
        setSelectedOrder(order);
        setShowDetailDialog(true);
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
            confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
            preparing: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
            ready: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
            picked_up: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
            delivered: 'bg-green-500/20 text-green-400 border-green-500/50',
            cancelled: 'bg-red-500/20 text-red-400 border-red-500/50',
        };
        return colors[status] || 'bg-gray-500/20 text-gray-400';
    };

    const getNextStatus = (currentStatus) => {
        const statusFlow = {
            pending: 'confirmed',
            confirmed: 'preparing',
            preparing: 'ready',
            ready: 'picked_up',
            picked_up: 'delivered'
        };
        return statusFlow[currentStatus] || null;
    };

    const filteredOrders = orders.filter(o => 
        o.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.restaurant_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6" data-testid="admin-orders">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Orders</h1>
                    <p className="text-muted-foreground">Manage and track all orders</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400">
                        {stats.pending} Pending
                    </Badge>
                    <Badge variant="outline" className="bg-blue-500/20 text-blue-400">
                        {stats.confirmed} Confirmed
                    </Badge>
                    <Badge variant="outline" className="bg-orange-500/20 text-orange-400">
                        {stats.preparing} Preparing
                    </Badge>
                    <Badge variant="outline" className="bg-purple-500/20 text-purple-400">
                        {stats.ready} Ready
                    </Badge>
                    <Badge variant="outline" className="bg-cyan-500/20 text-cyan-400">
                        {stats.picked_up} In Transit
                    </Badge>
                    <Badge variant="outline" className="bg-green-500/20 text-green-400">
                        {stats.delivered} Delivered
                    </Badge>
                    <Badge variant="outline" className="bg-red-500/20 text-red-400">
                        {stats.cancelled} Cancelled
                    </Badge>
                </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by order ID, customer, or restaurant..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="flex-wrap h-auto gap-1">
                    <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-500/20">
                        Pending ({stats.pending})
                    </TabsTrigger>
                    <TabsTrigger value="confirmed" className="data-[state=active]:bg-blue-500/20">
                        Confirmed ({stats.confirmed})
                    </TabsTrigger>
                    <TabsTrigger value="preparing" className="data-[state=active]:bg-orange-500/20">
                        Preparing ({stats.preparing})
                    </TabsTrigger>
                    <TabsTrigger value="ready" className="data-[state=active]:bg-purple-500/20">
                        Ready ({stats.ready})
                    </TabsTrigger>
                    <TabsTrigger value="picked_up" className="data-[state=active]:bg-cyan-500/20">
                        In Transit ({stats.picked_up})
                    </TabsTrigger>
                    <TabsTrigger value="delivered" className="data-[state=active]:bg-green-500/20">
                        Delivered ({stats.delivered})
                    </TabsTrigger>
                    <TabsTrigger value="cancelled" className="data-[state=active]:bg-red-500/20">
                        Cancelled ({stats.cancelled})
                    </TabsTrigger>
                    <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-6">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="text-center py-12">
                            <Package size={48} className="mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No orders found</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredOrders.map(order => (
                                <div 
                                    key={order.id} 
                                    className="bg-card border border-border rounded-xl p-4"
                                    data-testid={`order-${order.id}`}
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <span className="font-mono text-sm">#{order.id}</span>
                                                <Badge className={`border ${getStatusColor(order.status)}`}>
                                                    {order.status?.replace('_', ' ')}
                                                </Badge>
                                                <Badge variant={order.payment_method === 'cod' ? 'outline' : 'default'}>
                                                    {order.payment_method === 'cod' ? 'COD' : 'Prepaid'}
                                                </Badge>
                                                {order.payment_status === 'paid' && (
                                                    <Badge className="bg-green-500/20 text-green-400">Paid</Badge>
                                                )}
                                            </div>
                                            
                                            <div className="grid md:grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <p className="text-muted-foreground">Customer</p>
                                                    <p className="font-medium">{order.user_name}</p>
                                                    <p className="text-muted-foreground flex items-center gap-1">
                                                        <Phone size={12} /> {order.user_phone}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground">Restaurant</p>
                                                    <p className="font-medium">{order.restaurant_name}</p>
                                                    {order.restaurant_address && (
                                                        <p className="text-xs text-muted-foreground">{order.restaurant_address}</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-3">
                                                <p className="text-xs text-muted-foreground">Delivery Address</p>
                                                <p className="text-sm flex items-start gap-1">
                                                    <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                                                    {order.delivery_address?.full_address || order.delivery_address?.address}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap gap-1 mt-3">
                                                {order.items?.map((item, idx) => (
                                                    <span key={idx} className="text-xs bg-secondary px-2 py-1 rounded">
                                                        {item.name} x{item.quantity}
                                                    </span>
                                                ))}
                                            </div>

                                            {order.delivery_partner_name && (
                                                <div className="mt-3 flex items-center gap-2 text-sm">
                                                    <Bike size={14} className="text-primary" />
                                                    <span>Delivery: {order.delivery_partner_name}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-end gap-2">
                                            <div className="text-right">
                                                <p className="text-lg font-bold price-tag">₹{(order.total_amount || 0) + (order.delivery_fee || 0) + (order.cod_fee || 0)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Food: ₹{order.total_amount} + Del: ₹{order.delivery_fee || 0}
                                                    {order.cod_fee > 0 && ` + COD: ₹${order.cod_fee}`}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => openDetailDialog(order)}
                                                >
                                                    <Eye size={14} className="mr-1" /> View
                                                </Button>
                                                
                                                {/* Status update buttons */}
                                                {order.status === 'pending' && (
                                                    <>
                                                        <Button 
                                                            size="sm" 
                                                            onClick={() => handleUpdateStatus(order.id, 'confirmed')}
                                                        >
                                                            Confirm
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="destructive"
                                                            onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </>
                                                )}
                                                
                                                {order.status === 'confirmed' && (
                                                    <Button 
                                                        size="sm" 
                                                        onClick={() => handleUpdateStatus(order.id, 'preparing')}
                                                    >
                                                        Start Preparing
                                                    </Button>
                                                )}
                                                
                                                {order.status === 'preparing' && (
                                                    <Button 
                                                        size="sm" 
                                                        onClick={() => handleUpdateStatus(order.id, 'ready')}
                                                    >
                                                        Mark Ready
                                                    </Button>
                                                )}
                                                
                                                {(order.status === 'ready' || order.status === 'confirmed' || order.status === 'preparing') && !order.delivery_partner_id && (
                                                    <Button 
                                                        size="sm" 
                                                        className="bg-primary"
                                                        onClick={() => openAssignDialog(order)}
                                                    >
                                                        <Bike size={14} className="mr-1" /> Assign Delivery
                                                    </Button>
                                                )}
                                                
                                                {order.status === 'picked_up' && (
                                                    <Button 
                                                        size="sm" 
                                                        className="bg-green-600 hover:bg-green-700"
                                                        onClick={() => handleUpdateStatus(order.id, 'delivered')}
                                                    >
                                                        <CheckCircle size={14} className="mr-1" /> Mark Delivered
                                                    </Button>
                                                )}
                                            </div>

                                            {order.created_at && (
                                                <p className="text-xs text-muted-foreground">
                                                    {format(new Date(order.created_at), 'MMM d, h:mm a')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Assign Delivery Dialog */}
            <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Assign Delivery Partner</DialogTitle>
                    </DialogHeader>
                    {selectedOrder && (
                        <div className="space-y-4 mt-4">
                            <div className="bg-secondary/50 rounded-lg p-4">
                                <p className="text-sm text-muted-foreground">Order</p>
                                <p className="font-mono">#{selectedOrder.id}</p>
                                <p className="text-sm mt-1">{selectedOrder.restaurant_name} → {selectedOrder.delivery_address?.label}</p>
                            </div>

                            {availablePartners.length === 0 ? (
                                <div className="text-center py-8">
                                    <Bike size={32} className="mx-auto text-muted-foreground mb-2" />
                                    <p className="text-muted-foreground">No available delivery partners</p>
                                    <p className="text-xs text-muted-foreground mt-1">All partners are busy or offline</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    <p className="text-sm text-muted-foreground">Available Partners ({availablePartners.length})</p>
                                    {availablePartners.map(partner => (
                                        <div 
                                            key={partner.id} 
                                            className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                                    <Bike size={18} className="text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">{partner.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {partner.vehicle_number} • {partner.total_deliveries || 0} deliveries
                                                    </p>
                                                </div>
                                            </div>
                                            <Button 
                                                size="sm"
                                                onClick={() => handleAssignDelivery(partner.id)}
                                            >
                                                Assign
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Order Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Order Details</DialogTitle>
                    </DialogHeader>
                    {selectedOrder && (
                        <div className="space-y-4 mt-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-mono text-lg">#{selectedOrder.id}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {selectedOrder.created_at && format(new Date(selectedOrder.created_at), 'MMM d, yyyy h:mm a')}
                                    </p>
                                </div>
                                <Badge className={`border ${getStatusColor(selectedOrder.status)}`}>
                                    {selectedOrder.status?.replace('_', ' ')}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-secondary/50 rounded-lg p-3">
                                    <p className="text-xs text-muted-foreground">Customer</p>
                                    <p className="font-medium">{selectedOrder.user_name}</p>
                                    <p className="text-sm">{selectedOrder.user_phone}</p>
                                </div>
                                <div className="bg-secondary/50 rounded-lg p-3">
                                    <p className="text-xs text-muted-foreground">Restaurant</p>
                                    <p className="font-medium">{selectedOrder.restaurant_name}</p>
                                    <p className="text-xs text-muted-foreground">{selectedOrder.restaurant_address}</p>
                                </div>
                            </div>

                            <div className="bg-secondary/50 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">Delivery Address</p>
                                <p className="font-medium">{selectedOrder.delivery_address?.label}</p>
                                <p className="text-sm">{selectedOrder.delivery_address?.full_address}</p>
                            </div>

                            <div>
                                <p className="text-sm font-medium mb-2">Items</p>
                                <div className="space-y-2">
                                    {selectedOrder.items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-secondary px-2 py-0.5 rounded text-xs">{item.quantity}x</span>
                                                <span>{item.name}</span>
                                            </div>
                                            <span className="price-tag">₹{item.price * item.quantity}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-border pt-3 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>₹{selectedOrder.total_amount}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Delivery Fee</span>
                                    <span>₹{selectedOrder.delivery_fee || 0}</span>
                                </div>
                                {selectedOrder.cod_fee > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">COD Fee</span>
                                        <span>₹{selectedOrder.cod_fee}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-medium">
                                    <span>Total</span>
                                    <span className="price-tag">₹{(selectedOrder.total_amount || 0) + (selectedOrder.delivery_fee || 0) + (selectedOrder.cod_fee || 0)}</span>
                                </div>
                                {selectedOrder.estimated_prep_time && (
                                    <div className="flex justify-between text-sm text-blue-600">
                                        <span>Est. Prep Time</span>
                                        <span>{selectedOrder.estimated_prep_time} mins</span>
                                    </div>
                                )}
                                {selectedOrder.estimated_delivery_time && (
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>Est. Delivery Time</span>
                                        <span>{selectedOrder.estimated_delivery_time} mins</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                    <CreditCard size={14} />
                                    <span>{selectedOrder.payment_method === 'cod' ? 'Cash on Delivery' : 'Prepaid'}</span>
                                </div>
                                <Badge variant={selectedOrder.payment_status === 'paid' ? 'default' : 'outline'}>
                                    {selectedOrder.payment_status}
                                </Badge>
                            </div>

                            {selectedOrder.delivery_partner_name && (
                                <div className="bg-primary/10 rounded-lg p-3 flex items-center gap-3">
                                    <Bike size={20} className="text-primary" />
                                    <div>
                                        <p className="text-xs text-muted-foreground">Delivery Partner</p>
                                        <p className="font-medium">{selectedOrder.delivery_partner_name}</p>
                                    </div>
                                </div>
                            )}

                            {selectedOrder.notes && (
                                <div className="bg-secondary/50 rounded-lg p-3">
                                    <p className="text-xs text-muted-foreground">Notes</p>
                                    <p className="text-sm">{selectedOrder.notes}</p>
                                </div>
                            )}

                            {/* Action buttons based on status */}
                            {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                                <div className="flex gap-2 pt-2">
                                    {getNextStatus(selectedOrder.status) && (
                                        <Button 
                                            className="flex-1"
                                            onClick={() => {
                                                handleUpdateStatus(selectedOrder.id, getNextStatus(selectedOrder.status));
                                                setShowDetailDialog(false);
                                            }}
                                        >
                                            Move to {getNextStatus(selectedOrder.status)?.replace('_', ' ')}
                                        </Button>
                                    )}
                                    {!selectedOrder.delivery_partner_id && (
                                        <Button 
                                            variant="outline"
                                            onClick={() => {
                                                setShowDetailDialog(false);
                                                openAssignDialog(selectedOrder);
                                            }}
                                        >
                                            <Bike size={14} className="mr-1" /> Assign
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
