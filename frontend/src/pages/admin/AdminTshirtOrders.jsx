import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
    Shirt, Search, CheckCircle, Trash2, Phone, User, 
    Calendar, Package, AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useAdmin } from '../../contexts/AdminContext';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

export default function AdminTshirtOrders() {
    const { API } = useAdmin();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [activeTab, setActiveTab] = useState('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({ pending: 0, fulfilled: 0 });

    const fetchOrders = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/admin/tshirt-orders`);
            setOrders(response.data.tshirt_orders || []);
            setStats({
                pending: response.data.pending_count || 0,
                fulfilled: response.data.fulfilled_count || 0
            });
        } catch (error) {
            console.error('Failed to fetch t-shirt orders:', error);
        } finally {
            setLoading(false);
        }
    }, [API]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleFulfill = async (orderId) => {
        try {
            await axios.put(`${API}/admin/tshirt-orders/${orderId}/fulfill`);
            toast.success('T-shirt order marked as fulfilled');
            fetchOrders();
        } catch (error) {
            toast.error('Failed to update order');
        }
    };

    const handleDelete = async () => {
        if (!selectedOrder) return;
        
        try {
            await axios.delete(`${API}/admin/tshirt-orders/${selectedOrder.id}`);
            toast.success('T-shirt order deleted');
            setShowDeleteDialog(false);
            setSelectedOrder(null);
            fetchOrders();
        } catch (error) {
            toast.error('Failed to delete order');
        }
    };

    const openDeleteDialog = (order) => {
        setSelectedOrder(order);
        setShowDeleteDialog(true);
    };

    const filteredOrders = orders.filter(o => {
        const matchesSearch = o.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.user_phone?.includes(searchQuery) ||
            o.order_id?.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (activeTab === 'pending') return matchesSearch && o.status === 'pending';
        if (activeTab === 'fulfilled') return matchesSearch && o.status === 'fulfilled';
        return matchesSearch;
    });

    return (
        <div className="space-y-6" data-testid="admin-tshirt-orders">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Shirt className="text-orange-500" />
                        T-Shirt Reward Orders
                    </h1>
                    <p className="text-muted-foreground">Manage orders with free t-shirt reward (₹999+ orders)</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-yellow-500/20 text-yellow-600">
                        {stats.pending} Pending
                    </Badge>
                    <Badge variant="outline" className="bg-green-500/20 text-green-600">
                        {stats.fulfilled} Fulfilled
                    </Badge>
                </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, phone, or order ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
                    <TabsTrigger value="fulfilled">Fulfilled ({stats.fulfilled})</TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-6">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="text-center py-12">
                            <Shirt size={48} className="mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No t-shirt orders found</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredOrders.map(order => (
                                <div 
                                    key={order.id} 
                                    className={`bg-card border rounded-xl p-4 ${
                                        order.status === 'pending' ? 'border-yellow-500/30' : 'border-border'
                                    }`}
                                    data-testid={`tshirt-order-${order.id}`}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                                                <Shirt size={24} className="text-orange-500" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold">{order.user_name}</h3>
                                                    <Badge className={order.status === 'pending' 
                                                        ? 'bg-yellow-500/20 text-yellow-600 border-yellow-500/50' 
                                                        : 'bg-green-500/20 text-green-600 border-green-500/50'
                                                    }>
                                                        {order.status}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <Phone size={12} /> {order.user_phone}
                                                </p>
                                                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                                    <Package size={12} /> Order: {order.order_id}...
                                                </p>
                                                <p className="text-sm font-semibold text-green-600 mt-1">
                                                    Order Amount: ₹{order.order_amount}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <p className="text-xs text-muted-foreground mr-2">
                                                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                                            </p>
                                            {order.status === 'pending' && (
                                                <Button 
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700"
                                                    onClick={() => handleFulfill(order.id)}
                                                >
                                                    <CheckCircle size={14} className="mr-1" /> Fulfill
                                                </Button>
                                            )}
                                            <Button 
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => openDeleteDialog(order)}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete T-Shirt Order</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <p className="text-muted-foreground">
                            Are you sure you want to delete this t-shirt reward order for <strong>{selectedOrder?.user_name}</strong>?
                        </p>
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                className="flex-1"
                                onClick={() => setShowDeleteDialog(false)}
                            >
                                Cancel
                            </Button>
                            <Button 
                                variant="destructive"
                                className="flex-1"
                                onClick={handleDelete}
                            >
                                <Trash2 size={14} className="mr-1" /> Delete
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
