import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
    IndianRupee, Store, Bike, CheckCircle, Clock, 
    AlertCircle, ChevronDown, ChevronUp, CreditCard, Wallet,
    FileText, RefreshCw, Calendar, MessageSquare, Package
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, 
    DialogDescription, DialogFooter
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useAdmin } from '../../contexts/AdminContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AdminPayments() {
    const { API } = useAdmin();
    const [restaurantPayments, setRestaurantPayments] = useState({ orders: [], summary: [] });
    const [deliveryPayments, setDeliveryPayments] = useState({ orders: [], summary: [], global_stats: {} });
    const [loading, setLoading] = useState(true);
    const [expandedRestaurant, setExpandedRestaurant] = useState(null);
    const [expandedPartner, setExpandedPartner] = useState(null);
    const [clearing, setClearing] = useState(null);
    
    // Clear payment dialog state
    const [clearDialog, setClearDialog] = useState({ open: false, type: null, id: null, item: null });
    const [clearDate, setClearDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [clearComment, setClearComment] = useState('');

    const fetchPayments = useCallback(async () => {
        setLoading(true);
        try {
            const [restRes, delRes] = await Promise.all([
                axios.get(`${API}/admin/payments/restaurants`),
                axios.get(`${API}/admin/payments/delivery-partners`)
            ]);
            setRestaurantPayments(restRes.data);
            setDeliveryPayments(delRes.data);
        } catch (error) {
            console.error('Failed to fetch payments:', error);
            toast.error('Failed to load payment data');
        } finally {
            setLoading(false);
        }
    }, [API]);

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    const handleClearRestaurantPayment = async (orderId, comment, clearedDate) => {
        setClearing(orderId);
        try {
            await axios.put(`${API}/admin/payments/restaurants/${orderId}/clear`, {
                comment: comment || '',
                cleared_date: clearedDate || new Date().toISOString()
            });
            toast.success('Payment marked as cleared');
            fetchPayments();
            setClearDialog({ open: false, type: null, id: null, item: null });
            setClearComment('');
            setClearDate(format(new Date(), 'yyyy-MM-dd'));
        } catch (error) {
            toast.error('Failed to clear payment');
        } finally {
            setClearing(null);
        }
    };

    const handleBulkClearRestaurant = async (restaurantId, comment, clearedDate) => {
        setClearing(restaurantId);
        try {
            const res = await axios.put(`${API}/admin/payments/restaurants/bulk-clear`, {
                restaurant_id: restaurantId,
                comment: comment || '',
                cleared_date: clearedDate || new Date().toISOString()
            });
            toast.success(`Cleared ₹${res.data.total_amount} for ${res.data.orders_count} orders`);
            fetchPayments();
            setClearDialog({ open: false, type: null, id: null, item: null });
            setClearComment('');
            setClearDate(format(new Date(), 'yyyy-MM-dd'));
        } catch (error) {
            toast.error('Failed to clear payments');
        } finally {
            setClearing(null);
        }
    };

    const handleClearDeliverySettlement = async (orderId, orderType, comment, clearedDate) => {
        setClearing(orderId);
        // Remember the currently expanded partner
        const currentExpandedPartner = expandedPartner;
        try {
            const endpoint = orderType === 'custom' 
                ? `${API}/admin/payments/custom-orders/${orderId}/clear`
                : `${API}/admin/payments/delivery-partners/${orderId}/clear`;
            
            await axios.put(endpoint, {
                comment: comment || '',
                cleared_date: clearedDate || new Date().toISOString()
            });
            toast.success('Settlement marked as cleared');
            await fetchPayments();
            // Keep the same partner expanded after refresh
            setExpandedPartner(currentExpandedPartner);
            setClearDialog({ open: false, type: null, id: null, item: null });
            setClearComment('');
            setClearDate(format(new Date(), 'yyyy-MM-dd'));
        } catch (error) {
            console.error('Clear error:', error);
            toast.error(error.response?.data?.detail || 'Failed to clear settlement');
        } finally {
            setClearing(null);
        }
    };

    const openClearDialog = (type, id, item = null) => {
        setClearDialog({ open: true, type, id, item });
        setClearDate(format(new Date(), 'yyyy-MM-dd'));
        setClearComment('');
    };

    const handleConfirmClear = () => {
        const { type, id, item } = clearDialog;
        if (type === 'restaurant_order') {
            handleClearRestaurantPayment(id, clearComment, clearDate);
        } else if (type === 'restaurant_bulk') {
            handleBulkClearRestaurant(id, clearComment, clearDate);
        } else if (type === 'delivery') {
            handleClearDeliverySettlement(id, item?.order_type || 'regular', clearComment, clearDate);
        }
    };

    // Calculate totals
    const totalPendingRestaurant = restaurantPayments.summary.reduce(
        (sum, r) => sum + (r.pending_payout || 0), 0
    );
    const totalClearedRestaurant = restaurantPayments.summary.reduce(
        (sum, r) => sum + (r.cleared_payout || 0), 0
    );
    
    const globalStats = deliveryPayments.global_stats || {};

    if (loading) {
        return (
            <div className="space-y-6" data-testid="admin-payments-loading">
                <div className="skeleton h-32 rounded-2xl" />
                <div className="skeleton h-64 rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="space-y-8" data-testid="admin-payments">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Payments & Settlements</h1>
                    <p className="text-muted-foreground">Manage restaurant payouts and delivery partner settlements</p>
                </div>
                <Button onClick={fetchPayments} variant="outline" size="sm">
                    <RefreshCw size={16} className="mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Tabs for separate sections */}
            <Tabs defaultValue="restaurants" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="restaurants" data-testid="tab-restaurants">
                        <Store size={16} className="mr-2" />
                        Restaurant Payouts
                    </TabsTrigger>
                    <TabsTrigger value="delivery" data-testid="tab-delivery">
                        <Bike size={16} className="mr-2" />
                        Delivery Partners
                    </TabsTrigger>
                </TabsList>

                {/* ==================== RESTAURANT PAYOUTS SECTION ==================== */}
                <TabsContent value="restaurants" className="space-y-6">
                    {/* Restaurant Stats Cards */}
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="stat-card bg-card rounded-2xl border border-border p-6">
                            <div className="flex items-start justify-between">
                                <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                    <Clock size={24} className="text-orange-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold mt-4 text-orange-500">₹{Math.round(totalPendingRestaurant).toLocaleString()}</p>
                            <p className="text-muted-foreground text-sm">Pending Payouts</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {restaurantPayments.orders.filter(o => o.restaurant_payout_status !== 'cleared').length} orders
                            </p>
                        </div>
                        
                        <div className="stat-card bg-card rounded-2xl border border-border p-6">
                            <div className="flex items-start justify-between">
                                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                                    <CheckCircle size={24} className="text-green-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold mt-4 text-green-500">₹{Math.round(totalClearedRestaurant).toLocaleString()}</p>
                            <p className="text-muted-foreground text-sm">Cleared Payouts</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {restaurantPayments.orders.filter(o => o.restaurant_payout_status === 'cleared').length} orders
                            </p>
                        </div>

                        <div className="stat-card bg-card rounded-2xl border border-border p-6">
                            <div className="flex items-start justify-between">
                                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                    <Store size={24} className="text-blue-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold mt-4">{restaurantPayments.summary.length}</p>
                            <p className="text-muted-foreground text-sm">Active Restaurants</p>
                        </div>
                    </div>

                    {/* Restaurant Info */}
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                        <h3 className="font-semibold text-orange-400 mb-2 flex items-center gap-2">
                            <AlertCircle size={18} />
                            Restaurant Payout Structure
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Restaurants receive <span className="text-foreground font-medium">99% of order value</span> (1% platform fee). 
                            Clear payments after collecting COD from delivery partners.
                        </p>
                    </div>

                    {/* Restaurant List */}
                    {restaurantPayments.summary.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Store size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No delivered orders yet</p>
                        </div>
                    ) : (
                        restaurantPayments.summary.map(restaurant => (
                            <div 
                                key={restaurant._id} 
                                className="bg-card rounded-2xl border border-border overflow-hidden"
                                data-testid={`restaurant-payment-${restaurant._id}`}
                            >
                                <div 
                                    className="p-4 md:p-6 cursor-pointer hover:bg-secondary/50 transition-colors"
                                    onClick={() => setExpandedRestaurant(expandedRestaurant === restaurant._id ? null : restaurant._id)}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                                                <Store size={24} className="text-orange-400" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-lg">{restaurant.restaurant_name}</h3>
                                                <p className="text-sm text-muted-foreground">{restaurant.total_orders} orders delivered</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-4 pl-14 sm:pl-0">
                                            <div className="text-right">
                                                <p className="text-sm text-muted-foreground">Pending</p>
                                                <p className="text-xl font-bold text-orange-500">₹{Math.round(restaurant.pending_payout).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-muted-foreground">Cleared</p>
                                                <p className="text-xl font-bold text-green-500">₹{Math.round(restaurant.cleared_payout || 0).toLocaleString()}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {restaurant.pending_payout > 0 && (
                                                    <Button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openClearDialog('restaurant_bulk', restaurant._id, restaurant);
                                                        }}
                                                        disabled={clearing === restaurant._id}
                                                        className="btn-primary text-sm"
                                                    >
                                                        {clearing === restaurant._id ? 'Clearing...' : 'Clear All'}
                                                    </Button>
                                                )}
                                                {expandedRestaurant === restaurant._id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {expandedRestaurant === restaurant._id && (
                                    <div className="border-t border-border divide-y divide-border">
                                        {restaurantPayments.orders
                                            .filter(o => o.restaurant_id === restaurant._id)
                                            .map(order => (
                                                <div key={order.id} className="p-4 hover:bg-secondary/30">
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                        <div className="flex items-center gap-4">
                                                            <div>
                                                                <span className="font-mono text-sm">#{order.id}</span>
                                                                <p className="text-xs text-muted-foreground mt-1">
                                                                    {order.delivered_at ? format(new Date(order.delivered_at), 'MMM d, h:mm a') : '-'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Order Value</p>
                                                                <p className="font-medium">₹{order.total_amount}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Platform Fee (1%)</p>
                                                                <p className="text-red-400">-₹{Math.round(order.total_amount * 0.01)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Payout</p>
                                                                <p className="font-semibold text-green-500">₹{Math.round(order.total_amount * 0.99)}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {order.restaurant_payout_status === 'cleared' ? (
                                                                <Badge className="bg-green-500/20 text-green-400">
                                                                    <CheckCircle size={12} className="mr-1" /> Cleared
                                                                </Badge>
                                                            ) : (
                                                                <>
                                                                    <Badge className="bg-yellow-500/20 text-yellow-400">
                                                                        <Clock size={12} className="mr-1" /> Pending
                                                                    </Badge>
                                                                    <Button 
                                                                        size="sm" 
                                                                        variant="outline"
                                                                        onClick={() => openClearDialog('restaurant_order', order.id, order)}
                                                                        disabled={clearing === order.id}
                                                                    >
                                                                        Clear
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </TabsContent>

                {/* ==================== DELIVERY PARTNER SECTION ==================== */}
                <TabsContent value="delivery" className="space-y-6">
                    {/* Delivery Partner Stats Cards */}
                    <div className="grid md:grid-cols-4 gap-6">
                        <div className="stat-card bg-card rounded-2xl border border-border p-6">
                            <div className="flex items-start justify-between">
                                <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                                    <Clock size={24} className="text-yellow-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold mt-4 text-yellow-500">₹{Math.round(globalStats.pending_amount || 0).toLocaleString()}</p>
                            <p className="text-muted-foreground text-sm">Pending Settlements</p>
                            <p className="text-xs text-muted-foreground mt-1">{globalStats.pending_count || 0} orders</p>
                        </div>
                        
                        <div className="stat-card bg-card rounded-2xl border border-border p-6">
                            <div className="flex items-start justify-between">
                                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                                    <CheckCircle size={24} className="text-green-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold mt-4 text-green-500">₹{Math.round(globalStats.cleared_amount || 0).toLocaleString()}</p>
                            <p className="text-muted-foreground text-sm">Cleared Settlements</p>
                            <p className="text-xs text-muted-foreground mt-1">{globalStats.cleared_count || 0} orders</p>
                        </div>

                        <div className="stat-card bg-card rounded-2xl border border-border p-6">
                            <div className="flex items-start justify-between">
                                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                    <CreditCard size={24} className="text-blue-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold mt-4 text-blue-500">
                                ₹{Math.round(deliveryPayments.summary.reduce((sum, p) => sum + (p.cod_to_return || 0), 0)).toLocaleString()}
                            </p>
                            <p className="text-muted-foreground text-sm">COD to Collect</p>
                        </div>

                        <div className="stat-card bg-card rounded-2xl border border-border p-6">
                            <div className="flex items-start justify-between">
                                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                    <Bike size={24} className="text-purple-400" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold mt-4">{deliveryPayments.summary.length}</p>
                            <p className="text-muted-foreground text-sm">Active Partners</p>
                        </div>
                    </div>

                    {/* Delivery Partner Info */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                        <h3 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                            <AlertCircle size={18} />
                            Delivery Partner Earnings Structure
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="font-medium mb-1">Regular Orders:</p>
                                <ul className="space-y-1 text-muted-foreground">
                                    <li>• Partner gets: <span className="text-green-400 font-medium">95%</span> of delivery fee</li>
                                    <li>• Company gets: <span className="text-foreground">5%</span> of delivery fee</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-medium mb-1">Custom Orders:</p>
                                <ul className="space-y-1 text-muted-foreground">
                                    <li>• Partner gets: <span className="text-green-400 font-medium">70%</span> of delivery fee</li>
                                    <li>• Company gets: <span className="text-foreground">30%</span> of delivery fee</li>
                                </ul>
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-muted-foreground">
                                    <span className="font-medium text-foreground">COD Fee (₹5):</span> 100% goes to company
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Delivery Partner List */}
                    {deliveryPayments.summary.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Bike size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No delivery partner payments yet</p>
                        </div>
                    ) : (
                        deliveryPayments.summary.map(partner => (
                            <div 
                                key={partner._id} 
                                className="bg-card rounded-2xl border border-border overflow-hidden"
                                data-testid={`partner-payment-${partner._id}`}
                            >
                                <div 
                                    className="p-4 md:p-6 cursor-pointer hover:bg-secondary/50 transition-colors"
                                    onClick={() => setExpandedPartner(expandedPartner === partner._id ? null : partner._id)}
                                >
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                                <Bike size={24} className="text-blue-400" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg">{partner.partner_name || 'Unknown Partner'}</h3>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    <Badge variant="outline" className="text-xs">
                                                        {partner.total_deliveries || 0} regular
                                                    </Badge>
                                                    {partner.custom_deliveries > 0 && (
                                                        <Badge variant="outline" className="text-xs bg-purple-500/10">
                                                            <Package size={10} className="mr-1" />
                                                            {partner.custom_deliveries} custom
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            {expandedPartner === partner._id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                        
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                                            <div className="p-3 bg-secondary/30 rounded-lg">
                                                <p className="text-xs text-muted-foreground">Total Earnings</p>
                                                <p className="text-lg font-bold text-green-500">₹{Math.round(partner.total_earnings || 0)}</p>
                                            </div>
                                            <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                                                <p className="text-xs text-yellow-500">Pending</p>
                                                <p className="text-lg font-bold text-yellow-500">₹{Math.round(partner.pending_settlement || 0)}</p>
                                                <p className="text-xs text-yellow-400">{partner.total_pending_count || 0} orders</p>
                                            </div>
                                            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                                                <p className="text-xs text-green-500">Cleared</p>
                                                <p className="text-lg font-bold text-green-500">₹{Math.round(partner.cleared_settlement || 0)}</p>
                                                <p className="text-xs text-green-400">{partner.total_cleared_count || 0} orders</p>
                                            </div>
                                            <div className="p-3 bg-secondary/30 rounded-lg">
                                                <p className="text-xs text-muted-foreground">COD Collected</p>
                                                <p className="text-lg font-bold">₹{Math.round(partner.total_cod_collected || 0)}</p>
                                            </div>
                                            <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
                                                <p className="text-xs text-orange-500">COD to Return</p>
                                                <p className="text-lg font-bold text-orange-500">₹{Math.round(partner.cod_to_return || 0)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {expandedPartner === partner._id && (
                                    <div className="border-t border-border">
                                        <div className="p-4 bg-secondary/20">
                                            <p className="text-sm font-medium text-muted-foreground mb-2">Order Details</p>
                                        </div>
                                        <div className="divide-y divide-border">
                                            {deliveryPayments.orders
                                                .filter(o => o.delivery_partner_id === partner._id)
                                                .map(order => {
                                                    const isCustom = order.order_type === 'custom';
                                                    const sharePercent = order.partner_share_percent || (isCustom ? 70 : 95);
                                                    const companyPercent = order.company_share_percent || (isCustom ? 30 : 5);
                                                    const deliveryFee = order.delivery_fee || 0;
                                                    const earning = order.calculated_earning || (deliveryFee * sharePercent / 100);
                                                    const companyShare = deliveryFee - earning;
                                                    const codFee = order.cod_fee || 0;
                                                    const codCollected = order.calculated_cod_collected || 0;
                                                    const toReturn = order.calculated_cod_to_return || 0;
                                                    const settlementStatus = order.delivery_partner_settlement_status || 'pending';
                                                    
                                                    return (
                                                        <div key={order.id} className="p-4 hover:bg-secondary/30">
                                                            <div className="flex flex-col gap-3">
                                                                {/* Order Header */}
                                                                <div className="flex items-center justify-between flex-wrap gap-2">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="font-mono text-sm">#{order.id}</span>
                                                                        {isCustom ? (
                                                                            <Badge className="bg-purple-500/20 text-purple-400 text-xs">
                                                                                <Package size={10} className="mr-1" /> Custom
                                                                            </Badge>
                                                                        ) : (
                                                                            <Badge variant="outline" className="text-xs">Regular</Badge>
                                                                        )}
                                                                        <Badge variant={order.payment_method === 'cod' ? 'outline' : 'default'} className="text-xs">
                                                                            {order.payment_method === 'cod' ? 'COD' : order.payment_method === 'online' ? 'Online' : 'Prepaid'}
                                                                        </Badge>
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {order.delivered_at ? format(new Date(order.delivered_at), 'MMM d, h:mm a') : '-'}
                                                                    </p>
                                                                </div>

                                                                {/* Custom Order - Shop/Restaurant Info */}
                                                                {isCustom && (
                                                                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 text-sm">
                                                                        <p className="font-medium text-purple-600 mb-1">Shop / Restaurant: {order.restaurant_name}</p>
                                                                        {order.shop_location && (
                                                                            <p className="text-xs text-muted-foreground mb-1">
                                                                                <span className="font-medium">Location:</span> {order.shop_location}
                                                                            </p>
                                                                        )}
                                                                        {order.food_items && (
                                                                            <p className="text-xs text-muted-foreground">
                                                                                <span className="font-medium">Items:</span> {order.food_items.substring(0, 100)}{order.food_items.length > 100 ? '...' : ''}
                                                                            </p>
                                                                        )}
                                                                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                                                            <span className="text-muted-foreground">
                                                                                Customer: {order.user_name} - {order.user_phone}
                                                                            </span>
                                                                            {order.alternate_phone && (
                                                                                <span className="text-orange-600 font-medium">
                                                                                    Alt: {order.alternate_phone}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Order Details */}
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">Delivery Fee</p>
                                                                        <p className="font-medium">₹{deliveryFee}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">Partner ({sharePercent}%)</p>
                                                                        <p className="font-medium text-green-500">₹{Math.round(earning)}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">Company ({companyPercent}%)</p>
                                                                        <p className="font-medium text-blue-500">₹{Math.round(companyShare)}</p>
                                                                    </div>
                                                                    {order.payment_method === 'cod' && (
                                                                        <div>
                                                                            <p className="text-xs text-muted-foreground">COD Fee (to company)</p>
                                                                            <p className="font-medium text-orange-500">₹{codFee}</p>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* COD Details */}
                                                                {order.payment_method === 'cod' && codCollected > 0 && (
                                                                    <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 text-sm">
                                                                        <div className="flex flex-wrap gap-4">
                                                                            <div>
                                                                                <p className="text-xs text-muted-foreground">COD Collected</p>
                                                                                <p className="font-medium">₹{Math.round(codCollected)}</p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs text-muted-foreground">Partner Keeps</p>
                                                                                <p className="font-medium text-green-500">₹{Math.round(earning)}</p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs text-muted-foreground">Return to Company</p>
                                                                                <p className="font-medium text-orange-500">₹{Math.round(toReturn)}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Status & Actions */}
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                                        {order.restaurant_name}
                                                                    </p>
                                                                    <div className="flex items-center gap-2">
                                                                        {settlementStatus === 'cleared' ? (
                                                                            <Badge className="bg-green-500/20 text-green-400 text-xs">
                                                                                <CheckCircle size={10} className="mr-1" /> Cleared
                                                                            </Badge>
                                                                        ) : (
                                                                            <>
                                                                                <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                                                                                    <Clock size={10} className="mr-1" /> Pending
                                                                                </Badge>
                                                                                <Button 
                                                                                    size="sm" 
                                                                                    variant="outline"
                                                                                    className="text-xs h-7"
                                                                                    onClick={() => openClearDialog('delivery', order.id, order)}
                                                                                    disabled={clearing === order.id}
                                                                                >
                                                                                    Clear (₹{Math.round(earning)})
                                                                                </Button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </TabsContent>
            </Tabs>

            {/* Clear Payment Dialog */}
            <Dialog open={clearDialog.open} onOpenChange={(open) => !open && setClearDialog({ open: false, type: null, id: null, item: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            Clear Payment
                        </DialogTitle>
                        <DialogDescription>
                            Mark this payment as cleared and add details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="cleared-date" className="flex items-center gap-2">
                                <Calendar size={14} />
                                Cleared Date
                            </Label>
                            <Input
                                id="cleared-date"
                                type="date"
                                value={clearDate}
                                onChange={(e) => setClearDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="comment" className="flex items-center gap-2">
                                <MessageSquare size={14} />
                                Comment (Optional)
                            </Label>
                            <Textarea
                                id="comment"
                                placeholder="Add any notes about this payment..."
                                value={clearComment}
                                onChange={(e) => setClearComment(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setClearDialog({ open: false, type: null, id: null, item: null })}>
                            Cancel
                        </Button>
                        <Button onClick={handleConfirmClear} disabled={clearing} className="bg-green-600 hover:bg-green-700">
                            {clearing ? 'Clearing...' : 'Confirm Clear'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
