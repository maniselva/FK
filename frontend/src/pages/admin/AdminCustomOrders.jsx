import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
    Store, Clock, Check, X, Bike, Phone, MapPin, 
    User, Package, ChefHat, Eye, Edit, Search, CreditCard
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../../components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminCustomOrders() {
    const [orders, setOrders] = useState([]);
    const [deliveryPartners, setDeliveryPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Dialog states
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [editData, setEditData] = useState({});
    const [selectedPartnerId, setSelectedPartnerId] = useState('');
    const [adminNotes, setAdminNotes] = useState('');
    const [estimatedAmount, setEstimatedAmount] = useState('');
    const [cancellingOrder, setCancellingOrder] = useState(null);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (activeTab !== 'all') {
                params.append('status', activeTab);
            }
            if (searchQuery) {
                params.append('search', searchQuery);
            }
            const response = await axios.get(`${API}/admin/custom-orders?${params.toString()}`);
            setOrders(response.data.orders || response.data);
        } catch (error) {
            console.error('Failed to fetch custom orders:', error);
            toast.error('Failed to fetch orders');
        } finally {
            setLoading(false);
        }
    }, [activeTab, searchQuery]);

    const fetchDeliveryPartners = useCallback(async () => {
        try {
            // Fetch approved delivery partners for assignment
            const response = await axios.get(`${API}/admin/delivery-partners?approval_status=approved&limit=100`);
            setDeliveryPartners(response.data.partners || []);
        } catch (error) {
            console.error('Failed to fetch delivery partners:', error);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
        fetchDeliveryPartners();
    }, [fetchOrders, fetchDeliveryPartners]);

    const updateOrderStatus = async (orderId, newStatus, additionalData = {}) => {
        try {
            await axios.put(`${API}/admin/custom-orders/${orderId}`, {
                status: newStatus,
                ...additionalData
            });
            toast.success(`Order ${newStatus.replace('_', ' ')}`);
            fetchOrders();
        } catch (error) {
            toast.error('Failed to update order');
        }
    };

    const handleAcceptOrder = async (order) => {
        if (!estimatedAmount) {
            toast.error('Please enter the estimated amount');
            return;
        }
        await updateOrderStatus(order.id, 'accepted', {
            estimated_amount: parseFloat(estimatedAmount),
            admin_notes: adminNotes
        });
        setEstimatedAmount('');
        setAdminNotes('');
    };

    const handleAssignPartner = async () => {
        if (!selectedPartnerId) {
            toast.error('Please select a delivery partner');
            return;
        }
        const partner = deliveryPartners.find(p => p.id === selectedPartnerId);
        await updateOrderStatus(selectedOrder.id, 'assigned', {
            delivery_partner_id: selectedPartnerId,
            delivery_partner_name: partner?.name
        });
        setShowAssignDialog(false);
        setSelectedPartnerId('');
    };

    const openDetailDialog = (order) => {
        setSelectedOrder(order);
        setShowDetailDialog(true);
    };

    const openEditDialog = (order) => {
        setSelectedOrder(order);
        setEditData({
            restaurant_name: order.restaurant_name || '',
            shop_location: order.shop_location || '',
            food_items: order.food_items || '',
            delivery_address: order.delivery_address || '',
            alternate_phone: order.alternate_phone || '',
            estimated_amount: order.estimated_amount || '',
            delivery_fee: order.delivery_fee || '',
            admin_notes: order.admin_notes || '',
            status: order.status
        });
        setShowEditDialog(true);
    };

    const handleSaveEdit = async () => {
        try {
            await axios.put(`${API}/admin/custom-orders/${selectedOrder.id}`, editData);
            toast.success('Order updated');
            setShowEditDialog(false);
            fetchOrders();
        } catch (error) {
            toast.error('Failed to update order');
        }
    };

    const handleCancelOrder = async (order) => {
        const reason = window.prompt('Enter cancellation reason (optional):');
        if (reason === null) return; // User clicked Cancel
        
        setCancellingOrder(order.id);
        try {
            await axios.put(`${API}/custom-orders/${order.id}/cancel`, {
                cancelled_by: 'admin',
                reason: reason || 'Cancelled by admin'
            });
            toast.success('Order cancelled');
            fetchOrders();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to cancel order');
        } finally {
            setCancellingOrder(null);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
            accepted: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
            preparing: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
            assigned: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
            picked_up: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50',
            delivered: 'bg-green-500/20 text-green-400 border-green-500/50',
            cancelled: 'bg-red-500/20 text-red-400 border-red-500/50'
        };
        return styles[status] || styles.pending;
    };

    const getStatusIcon = (status) => {
        const icons = {
            pending: Clock,
            accepted: Check,
            preparing: ChefHat,
            assigned: Bike,
            picked_up: Package,
            delivered: Check,
            cancelled: X
        };
        const Icon = icons[status] || Clock;
        return <Icon size={14} />;
    };

    const statusCounts = {
        pending: orders.filter(o => o.status === 'pending').length,
        accepted: orders.filter(o => o.status === 'accepted').length,
        preparing: orders.filter(o => o.status === 'preparing').length,
        assigned: orders.filter(o => o.status === 'assigned').length,
        picked_up: orders.filter(o => o.status === 'picked_up').length,
        delivered: orders.filter(o => o.status === 'delivered').length
    };

    return (
        <div className="space-y-6" data-testid="admin-custom-orders">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Store size={24} className="text-orange-500" />
                        Custom Orders
                    </h1>
                    <p className="text-muted-foreground">Orders from unlisted restaurants</p>
                </div>
                
                {/* Search */}
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                        placeholder="Search by name, phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-400">{statusCounts.pending}</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-blue-400">{statusCounts.accepted}</p>
                    <p className="text-sm text-muted-foreground">Accepted</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-purple-400">{statusCounts.preparing}</p>
                    <p className="text-sm text-muted-foreground">Preparing</p>
                </div>
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-cyan-400">{statusCounts.assigned}</p>
                    <p className="text-sm text-muted-foreground">Assigned</p>
                </div>
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-indigo-400">{statusCounts.picked_up}</p>
                    <p className="text-sm text-muted-foreground">Picked Up</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-400">{statusCounts.delivered}</p>
                    <p className="text-sm text-muted-foreground">Delivered</p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="flex-wrap">
                    <TabsTrigger value="pending" className="gap-1">
                        <Clock size={14} /> Pending
                    </TabsTrigger>
                    <TabsTrigger value="accepted" className="gap-1">
                        <Check size={14} /> Accepted
                    </TabsTrigger>
                    <TabsTrigger value="preparing" className="gap-1">
                        <ChefHat size={14} /> Preparing
                    </TabsTrigger>
                    <TabsTrigger value="assigned" className="gap-1">
                        <Bike size={14} /> Assigned
                    </TabsTrigger>
                    <TabsTrigger value="picked_up" className="gap-1">
                        <Package size={14} /> Picked Up
                    </TabsTrigger>
                    <TabsTrigger value="delivered" className="gap-1">
                        <Check size={14} /> Delivered
                    </TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-6">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-12">
                            <Store size={48} className="mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No custom orders found</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {orders.map(order => (
                                <div key={order.id} className="bg-card border border-border rounded-xl p-5">
                                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                        {/* Order Info */}
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <Badge className={`border ${getStatusBadge(order.status)}`}>
                                                    {getStatusIcon(order.status)}
                                                    <span className="ml-1 capitalize">{order.status.replace('_', ' ')}</span>
                                                </Badge>
                                                <span className="font-semibold text-lg">{order.restaurant_name}</span>
                                            </div>

                                            {/* Shop Location */}
                                            {order.shop_location && (
                                                <div className="flex items-start gap-2 text-sm bg-blue-500/10 rounded-lg p-2">
                                                    <Store size={14} className="mt-0.5 flex-shrink-0 text-blue-500" />
                                                    <div>
                                                        <span className="text-xs text-blue-600 font-medium">Shop Location:</span>
                                                        <p className="text-muted-foreground">{order.shop_location}</p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                                <span className="flex items-center gap-1">
                                                    <User size={14} /> {order.user_name}
                                                </span>
                                                <a href={`tel:${order.user_phone}`} className="flex items-center gap-1 hover:text-primary">
                                                    <Phone size={14} /> {order.user_phone}
                                                </a>
                                                {order.alternate_phone && (
                                                    <a href={`tel:${order.alternate_phone}`} className="flex items-center gap-1 hover:text-primary text-orange-600">
                                                        <Phone size={14} /> Alt: {order.alternate_phone}
                                                    </a>
                                                )}
                                            </div>

                                            <div className="bg-secondary/30 rounded-lg p-3">
                                                <p className="text-sm font-medium mb-1">Product / Food Items:</p>
                                                <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-3">
                                                    {order.food_items}
                                                </p>
                                            </div>

                                            <div className="flex items-start gap-2 text-sm">
                                                <MapPin size={14} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
                                                <span className="text-muted-foreground">{order.delivery_address}</span>
                                            </div>

                                            {(order.estimated_amount || order.delivery_fee) && (
                                                <div className="flex gap-4 text-sm">
                                                    {order.estimated_amount && (
                                                        <p>
                                                            <span className="text-muted-foreground">Amount:</span>
                                                            <span className="font-semibold ml-2 price-tag">₹{order.estimated_amount}</span>
                                                        </p>
                                                    )}
                                                    {order.delivery_fee && (
                                                        <p>
                                                            <span className="text-muted-foreground">Delivery Fee:</span>
                                                            <span className="font-semibold ml-2 text-blue-600">₹{order.delivery_fee}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Payment Status Display - Online Only */}
                                            <div className={`text-sm p-2 rounded-lg ${order.payment_status === 'paid' ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                                                <div className="flex items-center gap-2">
                                                    <CreditCard size={14} className={order.payment_status === 'paid' ? 'text-green-500' : 'text-yellow-500'} />
                                                    <span className={`font-medium ${order.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                                                        Online Payment: {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                                                    </span>
                                                </div>
                                                {order.cf_order_id && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Txn ID: {order.cf_order_id}
                                                    </p>
                                                )}
                                                {order.paid_at && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Paid: {format(new Date(order.paid_at), 'MMM d, h:mm a')}
                                                    </p>
                                                )}
                                            </div>

                                            {order.delivery_partner_name && (
                                                <p className="text-sm flex items-center gap-2">
                                                    <Bike size={14} className="text-green-500" />
                                                    <span>Assigned to: <strong>{order.delivery_partner_name}</strong></span>
                                                </p>
                                            )}

                                            <p className="text-xs text-muted-foreground">
                                                {order.created_at && format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-wrap lg:flex-col gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openDetailDialog(order)}
                                            >
                                                <Eye size={14} className="mr-1" /> View
                                            </Button>
                                            
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openEditDialog(order)}
                                            >
                                                <Edit size={14} className="mr-1" /> Edit
                                            </Button>

                                            {order.status === 'pending' && (
                                                <div className="flex flex-col gap-2 w-full lg:w-auto">
                                                    <Input
                                                        type="number"
                                                        placeholder="Est. ₹"
                                                        value={estimatedAmount}
                                                        onChange={(e) => setEstimatedAmount(e.target.value)}
                                                        className="w-24"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700"
                                                        onClick={() => handleAcceptOrder(order)}
                                                    >
                                                        <Check size={14} className="mr-1" /> Accept
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => updateOrderStatus(order.id, 'cancelled')}
                                                    >
                                                        <X size={14} className="mr-1" /> Reject
                                                    </Button>
                                                </div>
                                            )}

                                            {order.status === 'accepted' && (
                                                <Button
                                                    size="sm"
                                                    className="bg-purple-600 hover:bg-purple-700"
                                                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                                                >
                                                    <ChefHat size={14} className="mr-1" /> Start Preparing
                                                </Button>
                                            )}

                                            {order.status === 'preparing' && (
                                                <Button
                                                    size="sm"
                                                    className="bg-cyan-600 hover:bg-cyan-700"
                                                    onClick={() => { setSelectedOrder(order); setShowAssignDialog(true); }}
                                                >
                                                    <Bike size={14} className="mr-1" /> Assign Partner
                                                </Button>
                                            )}

                                            {order.status === 'assigned' && (
                                                <Button
                                                    size="sm"
                                                    className="bg-indigo-600 hover:bg-indigo-700"
                                                    onClick={() => updateOrderStatus(order.id, 'picked_up')}
                                                >
                                                    <Package size={14} className="mr-1" /> Picked Up
                                                </Button>
                                            )}

                                            {order.status === 'picked_up' && (
                                                <Button
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700"
                                                    onClick={() => updateOrderStatus(order.id, 'delivered')}
                                                >
                                                    <Check size={14} className="mr-1" /> Mark Delivered
                                                </Button>
                                            )}

                                            {/* Cancel button for non-completed orders */}
                                            {order.status !== 'delivered' && order.status !== 'cancelled' && order.status !== 'pending' && (
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleCancelOrder(order)}
                                                    disabled={cancellingOrder === order.id}
                                                    data-testid={`cancel-custom-order-${order.id}`}
                                                >
                                                    <X size={14} className="mr-1" /> 
                                                    {cancellingOrder === order.id ? 'Cancelling...' : 'Cancel Order'}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Custom Order Details</DialogTitle>
                    </DialogHeader>
                    {selectedOrder && (
                        <div className="space-y-4 mt-4">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={`border ${getStatusBadge(selectedOrder.status)}`}>
                                    {selectedOrder.status.replace('_', ' ')}
                                </Badge>
                                {selectedOrder.estimated_amount && (
                                    <span className="font-bold price-tag">₹{selectedOrder.estimated_amount}</span>
                                )}
                                {selectedOrder.delivery_fee && (
                                    <span className="text-sm text-blue-600">+₹{selectedOrder.delivery_fee} delivery</span>
                                )}
                            </div>

                            <div className="space-y-3 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Shop / Restaurant</p>
                                    <p className="font-medium">{selectedOrder.restaurant_name}</p>
                                </div>
                                {selectedOrder.shop_location && (
                                    <div className="bg-blue-500/10 rounded-lg p-3">
                                        <p className="text-muted-foreground text-xs">Shop Location</p>
                                        <p className="font-medium">{selectedOrder.shop_location}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-muted-foreground">Customer</p>
                                    <p className="font-medium">{selectedOrder.user_name}</p>
                                    <a href={`tel:${selectedOrder.user_phone}`} className="text-primary hover:underline">
                                        {selectedOrder.user_phone}
                                    </a>
                                    {selectedOrder.alternate_phone && (
                                        <span className="ml-2">
                                            <a href={`tel:${selectedOrder.alternate_phone}`} className="text-orange-600 hover:underline">
                                                Alt: {selectedOrder.alternate_phone}
                                            </a>
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Product / Food Items</p>
                                    <p className="whitespace-pre-line bg-secondary/30 p-2 rounded">{selectedOrder.food_items}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Delivery Address</p>
                                    <p>{selectedOrder.delivery_address}</p>
                                </div>
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                                    <p className="text-xs text-blue-600 font-medium">Payment: Online Only</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Status: {selectedOrder.payment_status === 'paid' ? '✅ Paid' : '⏳ Pending'}
                                    </p>
                                </div>
                                {selectedOrder.delivery_partner_name && (
                                    <div>
                                        <p className="text-muted-foreground">Delivery Partner</p>
                                        <p className="font-medium">{selectedOrder.delivery_partner_name}</p>
                                        {selectedOrder.delivery_partner_phone && (
                                            <a href={`tel:${selectedOrder.delivery_partner_phone}`} className="text-primary hover:underline text-xs">
                                                {selectedOrder.delivery_partner_phone}
                                            </a>
                                        )}
                                    </div>
                                )}
                                {selectedOrder.admin_notes && (
                                    <div>
                                        <p className="text-muted-foreground">Admin Notes</p>
                                        <p className="bg-blue-500/10 p-2 rounded">{selectedOrder.admin_notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Custom Order</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <Label>Shop / Restaurant Name</Label>
                            <Input
                                value={editData.restaurant_name}
                                onChange={(e) => setEditData(prev => ({ ...prev, restaurant_name: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Shop Location</Label>
                            <Textarea
                                value={editData.shop_location || ''}
                                onChange={(e) => setEditData(prev => ({ ...prev, shop_location: e.target.value }))}
                                placeholder="Shop address with landmarks..."
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Product / Food Items Needed</Label>
                            <Textarea
                                value={editData.food_items}
                                onChange={(e) => setEditData(prev => ({ ...prev, food_items: e.target.value }))}
                                className="mt-1 min-h-[120px]"
                            />
                        </div>
                        <div>
                            <Label>Delivery Address</Label>
                            <Textarea
                                value={editData.delivery_address}
                                onChange={(e) => setEditData(prev => ({ ...prev, delivery_address: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Alternate Phone Number</Label>
                            <Input
                                value={editData.alternate_phone || ''}
                                onChange={(e) => setEditData(prev => ({ ...prev, alternate_phone: e.target.value }))}
                                placeholder="Optional alternate contact"
                                className="mt-1"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Estimated Amount (₹)</Label>
                                <Input
                                    type="number"
                                    value={editData.estimated_amount}
                                    onChange={(e) => setEditData(prev => ({ ...prev, estimated_amount: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Delivery Fee (₹)</Label>
                                <Input
                                    type="number"
                                    value={editData.delivery_fee || ''}
                                    onChange={(e) => setEditData(prev => ({ ...prev, delivery_fee: e.target.value }))}
                                    placeholder="e.g., 30"
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select value={editData.status} onValueChange={(v) => setEditData(prev => ({ ...prev, status: v }))}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="accepted">Accepted</SelectItem>
                                    <SelectItem value="preparing">Preparing</SelectItem>
                                    <SelectItem value="assigned">Assigned</SelectItem>
                                    <SelectItem value="picked_up">Picked Up</SelectItem>
                                    <SelectItem value="delivered">Delivered</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Admin Notes</Label>
                            <Textarea
                                value={editData.admin_notes}
                                onChange={(e) => setEditData(prev => ({ ...prev, admin_notes: e.target.value }))}
                                placeholder="Internal notes..."
                                className="mt-1"
                            />
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
                            <p className="font-medium text-blue-600 mb-1">Payment: Online Only</p>
                            <p className="text-muted-foreground">Customer will pay online after you set the estimated amount.</p>
                        </div>
                        <Button onClick={handleSaveEdit} className="w-full">
                            Save Changes
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Assign Partner Dialog */}
            <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Assign Delivery Partner</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <Label>Select Delivery Partner</Label>
                            <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Choose a partner" />
                                </SelectTrigger>
                                <SelectContent>
                                    {deliveryPartners.length === 0 ? (
                                        <SelectItem value="" disabled>No partners available</SelectItem>
                                    ) : (
                                        deliveryPartners.map(partner => (
                                            <SelectItem key={partner.id} value={partner.id}>
                                                {partner.name} - {partner.vehicle_number}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleAssignPartner} className="w-full">
                            <Bike size={16} className="mr-2" /> Assign Partner
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
