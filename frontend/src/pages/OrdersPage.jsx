import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Package, ChevronRight, Clock, Star, MessageSquare, Check, Store, RefreshCw, XCircle, AlertCircle, Banknote, CreditCard, Phone } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { useApp } from '../contexts/AppContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function OrdersPage() {
    const { user, isAuthenticated } = useApp();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [customOrders, setCustomOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reviewedOrders, setReviewedOrders] = useState(new Set());
    const [activeTab, setActiveTab] = useState('regular');
    const [processingPayment, setProcessingPayment] = useState(null);
    const [cancellingCustomOrder, setCancellingCustomOrder] = useState(null);
    
    // Review dialog state
    const [showReviewDialog, setShowReviewDialog] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [restaurantRating, setRestaurantRating] = useState(0);
    const [restaurantComment, setRestaurantComment] = useState('');
    const [deliveryRating, setDeliveryRating] = useState(0);
    const [deliveryComment, setDeliveryComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);
    
    // Reorder dialog state
    const [showReorderDialog, setShowReorderDialog] = useState(false);
    const [reorderOrder, setReorderOrder] = useState(null);
    const [selectedReorderItems, setSelectedReorderItems] = useState([]);
    const [processingReorder, setProcessingReorder] = useState(false);

    useEffect(() => {
        if (isAuthenticated && user?.id) {
            fetchOrders();
            fetchCustomOrders();
            fetchUserReviews();
        } else {
            setLoading(false);
        }
    }, [isAuthenticated, user?.id]);

    const fetchOrders = async () => {
        try {
            const response = await axios.get(`${API}/orders?user_id=${user.id}`);
            setOrders(response.data);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomOrders = async () => {
        try {
            const response = await axios.get(`${API}/custom-orders/user/${user.id}`);
            setCustomOrders(response.data.orders || []);
        } catch (error) {
            console.error('Failed to fetch custom orders:', error);
        }
    };

    const fetchUserReviews = async () => {
        try {
            const response = await axios.get(`${API}/reviews/user/${user.id}`);
            const reviewed = new Set(response.data.reviews.map(r => r.order_id));
            setReviewedOrders(reviewed);
        } catch (error) {
            console.error('Failed to fetch user reviews:', error);
        }
    };

    // Handle payment for custom orders
    const handleCustomOrderPayment = async (order) => {
        if (!order.estimated_amount) {
            toast.error('Amount not yet estimated by admin');
            return;
        }
        
        setProcessingPayment(order.id);
        toast.loading('Initializing payment...', { id: 'custom-payment' });
        
        try {
            // Calculate delivery fee (fixed rate for custom orders)
            const deliveryFee = 40;
            const totalAmount = order.estimated_amount + deliveryFee;
            
            const paymentResponse = await axios.post(`${API}/payments/cashfree/initiate`, {
                order_id: order.id,
                amount: totalAmount,
                user_phone: user.phone,
                user_id: user.id,
                user_email: user.email || 'customer@foodkey.in',
                user_name: user.name || 'Customer',
                origin_url: window.location.origin,
                is_custom_order: true
            });
            
            if (paymentResponse.data.success && paymentResponse.data.payment_session_id) {
                toast.dismiss('custom-payment');
                
                // Use Cashfree JS SDK
                const cashfree = window.Cashfree({
                    mode: "production"
                });
                
                const checkoutOptions = {
                    paymentSessionId: paymentResponse.data.payment_session_id,
                    redirectTarget: "_self"
                };
                
                cashfree.checkout(checkoutOptions);
            } else {
                toast.dismiss('custom-payment');
                toast.error('Failed to initiate payment. Please try again.');
            }
        } catch (error) {
            toast.dismiss('custom-payment');
            toast.error('Payment initiation failed');
            console.error('Payment error:', error);
        } finally {
            setProcessingPayment(null);
        }
    };

    // Cancel custom order (before payment)
    const handleCancelCustomOrder = async (orderId) => {
        if (!window.confirm('Are you sure you want to cancel this custom order?')) {
            return;
        }
        
        setCancellingCustomOrder(orderId);
        try {
            await axios.put(`${API}/custom-orders/${orderId}/cancel`, {
                cancelled_by: 'customer',
                reason: 'Cancelled by customer'
            });
            toast.success('Custom order cancelled');
            fetchCustomOrders();
        } catch (error) {
            toast.error('Failed to cancel order');
            console.error('Cancel error:', error);
        } finally {
            setCancellingCustomOrder(null);
        }
    };

    const openReviewDialog = (order, e) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedOrder(order);
        setRestaurantRating(0);
        setRestaurantComment('');
        setDeliveryRating(0);
        setDeliveryComment('');
        setShowReviewDialog(true);
    };

    const submitReview = async () => {
        if (restaurantRating === 0) {
            toast.error('Please rate the restaurant');
            return;
        }
        
        setSubmittingReview(true);
        try {
            await axios.post(`${API}/reviews`, {
                order_id: selectedOrder.id,
                restaurant_id: selectedOrder.restaurant_id,
                user_id: user.id,
                user_name: user.name || 'Customer',
                user_phone: user.phone,
                rating: restaurantRating,
                comment: restaurantComment || null,
                delivery_partner_id: selectedOrder.delivery_partner_id || null,
                delivery_rating: deliveryRating > 0 ? deliveryRating : null,
                delivery_comment: deliveryComment || null
            });
            
            toast.success('Thank you for your review! It will be visible after admin approval.');
            setShowReviewDialog(false);
            setReviewedOrders(prev => new Set([...prev, selectedOrder.id]));
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to submit review');
        } finally {
            setSubmittingReview(false);
        }
    };

    // Reorder Functions
    const openReorderDialog = (order) => {
        setReorderOrder(order);
        // Filter out unavailable items and pre-select available ones
        const availableItems = order.items.filter(
            item => !order.unavailable_items?.includes(item.name)
        );
        setSelectedReorderItems(availableItems.map(item => ({
            ...item,
            selected: true
        })));
        setShowReorderDialog(true);
    };

    const toggleReorderItem = (itemId) => {
        setSelectedReorderItems(prev => 
            prev.map(item => 
                item.menu_item_id === itemId 
                    ? { ...item, selected: !item.selected }
                    : item
            )
        );
    };

    const handleReorderWithSelected = async () => {
        const selectedItems = selectedReorderItems.filter(item => item.selected);
        if (selectedItems.length === 0) {
            toast.error('Please select at least one item to reorder');
            return;
        }

        setProcessingReorder(true);
        try {
            const response = await axios.post(`${API}/orders/${reorderOrder.id}/reorder`, {
                original_order_id: reorderOrder.id,
                action: 'reorder_modified',
                modified_items: selectedItems.map(item => ({
                    menu_item_id: item.menu_item_id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    image: item.image
                }))
            });

            toast.success(`New order placed! ${response.data.refund_amount > 0 ? `Refund of ₹${response.data.refund_amount} will be processed.` : ''}`);
            setShowReorderDialog(false);
            fetchOrders();
            // Navigate to track the new order
            if (response.data.new_order_id) {
                navigate(`/track/${response.data.new_order_id}`);
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to place reorder');
        } finally {
            setProcessingReorder(false);
        }
    };

    const handleGetRefund = async (orderId) => {
        if (!confirm('Are you sure you want to cancel and get a full refund?')) {
            return;
        }

        try {
            const response = await axios.post(`${API}/orders/${orderId}/reorder`, {
                original_order_id: orderId,
                action: 'cancel_refund'
            });
            
            toast.success(`Refund of ₹${response.data.refund_amount} has been processed.`);
            fetchOrders();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to process refund');
        }
    };

    const StarRating = ({ rating, setRating, label }) => (
        <div>
            <Label className="text-sm font-medium">{label}</Label>
            <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1 hover:scale-110 transition-transform"
                    >
                        <Star
                            size={28}
                            className={star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 hover:text-yellow-200'}
                        />
                    </button>
                ))}
                {rating > 0 && <span className="ml-2 text-sm font-medium">{rating}/5</span>}
            </div>
        </div>
    );

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

    if (!isAuthenticated) {
        return (
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-16 text-center">
                <Package size={64} className="mx-auto text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold mb-2">Login to view orders</h1>
                <p className="text-muted-foreground">Please login to see your order history</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-8">
                <div className="skeleton h-8 w-1/3 mb-8" />
                {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton h-32 rounded-2xl mb-4" />
                ))}
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-8" data-testid="orders-page">
            <h1 className="text-3xl font-bold mb-6">Your Orders</h1>

            {/* Tabs for Regular and Custom Orders */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
                <TabsList>
                    <TabsTrigger value="regular" className="gap-2">
                        <Package size={16} />
                        Orders ({orders.length})
                    </TabsTrigger>
                    <TabsTrigger value="custom" className="gap-2">
                        <Store size={16} />
                        Custom Orders ({customOrders.length})
                    </TabsTrigger>
                </TabsList>

                {/* Regular Orders Tab */}
                <TabsContent value="regular" className="mt-6">
                    {orders.length === 0 ? (
                        <div className="text-center py-16">
                            <Package size={64} className="mx-auto text-muted-foreground mb-4" />
                            <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
                            <p className="text-muted-foreground mb-6">
                                Looks like you haven't placed any orders yet
                            </p>
                            <Link to="/restaurants">
                                <button className="btn-primary px-6 py-3">
                                    Browse Restaurants
                                </button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {orders.map(order => (
                                <div key={order.id} className="order-card">
                                    <Link 
                                        to={`/track/${order.id}`}
                                        className="block hover:opacity-90"
                                        data-testid={`order-${order.id}`}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="font-semibold">{order.restaurant_name}</h3>
                                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy h:mm a') : 'Recent'}
                                                </p>
                                            </div>
                                            <span className={`status-badge ${getStatusColor(order.status)}`}>
                                                {order.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 mb-3">
                                            {order.items?.slice(0, 3).map((item, idx) => (
                                                <img
                                                    key={idx}
                                                    src={item.image}
                                                    alt={item.name}
                                                    className="w-12 h-12 rounded-lg object-cover"
                                                />
                                            ))}
                                            {order.items?.length > 3 && (
                                                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-sm text-muted-foreground">
                                                    +{order.items.length - 3}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">
                                                {order.items?.reduce((sum, item) => sum + item.quantity, 0)} items
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="price-tag font-semibold">₹{(order.total_amount || 0) + (order.delivery_fee || 0) + (order.cod_fee || 0)}</span>
                                                <ChevronRight size={16} className="text-muted-foreground" />
                                            </div>
                                        </div>
                                    </Link>
                                    
                                    {/* Review Button for Delivered Orders */}
                                    {order.status === 'delivered' && (
                                        <div className="mt-3 pt-3 border-t border-border">
                                            {reviewedOrders.has(order.id) ? (
                                                <div className="flex items-center gap-2 text-green-500 text-sm">
                                                    <Check size={16} />
                                                    <span>Review submitted</span>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full gap-2"
                                                    onClick={(e) => openReviewDialog(order, e)}
                                                    data-testid={`review-order-${order.id}`}
                                                >
                                                    <Star size={16} className="text-yellow-400" />
                                                    Rate this Order
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Cancellation Details and Reorder Options */}
                                    {order.status === 'cancelled' && (
                                        <div className="mt-3 pt-3 border-t border-border space-y-3">
                                            {/* Cancellation Reason */}
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                <div className="flex items-start gap-2">
                                                    <XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-red-800">
                                                            Order Cancelled by {order.cancelled_by || 'Restaurant'}
                                                        </p>
                                                        <p className="text-sm text-red-700 mt-1">
                                                            {order.cancellation_reason || 'No reason provided'}
                                                        </p>
                                                        {order.cancellation_comment && (
                                                            <p className="text-sm text-red-600 mt-1 italic">
                                                                "{order.cancellation_comment}"
                                                            </p>
                                                        )}
                                                        {order.unavailable_items && order.unavailable_items.length > 0 && (
                                                            <div className="mt-2">
                                                                <p className="text-xs text-red-700 font-medium">Unavailable items:</p>
                                                                <p className="text-xs text-red-600">
                                                                    {order.unavailable_items.join(', ')}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Refund Status */}
                                            {order.refund_amount > 0 && (
                                                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                                                    <Banknote size={16} className="text-green-600" />
                                                    <div>
                                                        <p className="text-sm text-green-800">
                                                            Refund: ₹{order.refund_amount.toFixed(0)} 
                                                            <span className="ml-2 text-xs">
                                                                ({order.refund_status === 'processed' ? '✓ Processed' : 'Pending'})
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Reorder Options */}
                                            {!order.is_reorder && (
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="flex-1 gap-2"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            openReorderDialog(order);
                                                        }}
                                                        data-testid={`reorder-${order.id}`}
                                                    >
                                                        <RefreshCw size={14} />
                                                        Reorder with Changes
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        className="flex-1 gap-2"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handleGetRefund(order.id);
                                                        }}
                                                        data-testid={`refund-${order.id}`}
                                                    >
                                                        <Banknote size={14} />
                                                        Get Full Refund
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Custom Orders Tab */}
                <TabsContent value="custom" className="mt-6">
                    {customOrders.length === 0 ? (
                        <div className="text-center py-16">
                            <Store size={64} className="mx-auto text-muted-foreground mb-4" />
                            <h2 className="text-xl font-semibold mb-2">No custom orders yet</h2>
                            <p className="text-muted-foreground mb-6">
                                Order from your favorite unlisted restaurants
                            </p>
                            <Link to="/write-order">
                                <button className="btn-primary px-6 py-3">
                                    Place Custom Order
                                </button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {customOrders.map(order => (
                                <div key={order.id} className="order-card">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Store size={16} className="text-orange-500" />
                                                <h3 className="font-semibold">{order.restaurant_name}</h3>
                                            </div>
                                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                <Clock size={12} />
                                                {order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy h:mm a') : 'Recent'}
                                            </p>
                                        </div>
                                        <Badge className={`border ${getStatusColor(order.status)}`}>
                                            {order.status.replace('_', ' ')}
                                        </Badge>
                                    </div>

                                    <div className="bg-secondary/30 rounded-lg p-3 mb-3">
                                        <p className="text-sm font-medium mb-1">Food Items:</p>
                                        <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-3">
                                            {order.food_items}
                                        </p>
                                    </div>

                                    <div className="text-sm text-muted-foreground mb-2">
                                        <span className="font-medium">Delivery:</span> {order.delivery_address}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        {order.estimated_amount ? (
                                            <div className="flex flex-col gap-1">
                                                <span className="price-tag font-semibold">Est. ₹{order.estimated_amount}</span>
                                                <span className="text-xs text-muted-foreground">+ ₹40 delivery</span>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">Amount pending</span>
                                        )}
                                        {order.delivery_partner_name && (
                                            <div className="flex flex-col items-end text-sm">
                                                <span className="text-green-500 font-medium">
                                                    Delivery: {order.delivery_partner_name}
                                                </span>
                                                {order.delivery_partner_phone && (
                                                    <a href={`tel:${order.delivery_partner_phone}`} className="text-muted-foreground hover:text-primary underline flex items-center gap-1">
                                                        <Phone size={12} />
                                                        {order.delivery_partner_phone}
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Payment Button for accepted orders - show until payment is successful */}
                                    {order.status === 'accepted' && order.estimated_amount && order.payment_status !== 'paid' && (
                                        <div className="mt-4 pt-4 border-t border-border">
                                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-3">
                                                <p className="text-sm text-green-600 font-medium">
                                                    {order.payment_status === 'pending' 
                                                        ? 'Payment pending. Click below to complete your payment.'
                                                        : 'Your order has been accepted! Please complete payment to proceed.'
                                                    }
                                                </p>
                                            </div>
                                            <Button
                                                onClick={() => handleCustomOrderPayment(order)}
                                                disabled={processingPayment === order.id}
                                                className="w-full btn-primary"
                                                data-testid={`pay-custom-order-${order.id}`}
                                            >
                                                <CreditCard size={16} className="mr-2" />
                                                {processingPayment === order.id ? 'Processing...' : `Pay ₹${order.estimated_amount + 40}`}
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {/* Payment completed indicator with transaction details */}
                                    {order.payment_status === 'paid' && (
                                        <div className="mt-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                                            <div className="flex items-center gap-2 text-green-600 font-medium">
                                                <Check size={16} />
                                                <span>Payment Successful</span>
                                            </div>
                                            {order.cf_order_id && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Transaction ID: {order.cf_order_id}
                                                </p>
                                            )}
                                            {order.paid_at && (
                                                <p className="text-xs text-muted-foreground">
                                                    Paid on: {new Date(order.paid_at).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Cancel button - show for pending/accepted orders before payment */}
                                    {order.status !== 'cancelled' && order.status !== 'delivered' && order.payment_status !== 'paid' && (
                                        <div className="mt-4 pt-4 border-t border-border">
                                            <Button
                                                variant="outline"
                                                onClick={() => handleCancelCustomOrder(order.id)}
                                                disabled={cancellingCustomOrder === order.id}
                                                className="w-full text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                                                data-testid={`cancel-custom-order-${order.id}`}
                                            >
                                                <XCircle size={16} className="mr-2" />
                                                {cancellingCustomOrder === order.id ? 'Cancelling...' : 'Cancel Order'}
                                            </Button>
                                        </div>
                                    )}

                                    {/* Cancelled status */}
                                    {order.status === 'cancelled' && (
                                        <div className="mt-3 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                                            <div className="flex items-center gap-2 text-red-600 font-medium">
                                                <XCircle size={16} />
                                                <span>Order Cancelled</span>
                                            </div>
                                            {order.cancellation_reason && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Reason: {order.cancellation_reason}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Review Dialog */}
            <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquare size={20} className="text-primary" />
                            Rate Your Order
                        </DialogTitle>
                    </DialogHeader>
                    {selectedOrder && (
                        <div className="space-y-6 mt-4">
                            {/* Order Info */}
                            <div className="bg-secondary/50 rounded-lg p-3">
                                <p className="font-semibold">{selectedOrder.restaurant_name}</p>
                                <p className="text-sm text-muted-foreground">
                                    Order #{selectedOrder.id}... • {selectedOrder.items?.length} items
                                </p>
                            </div>

                            {/* Restaurant Rating */}
                            <div className="space-y-3">
                                <StarRating
                                    rating={restaurantRating}
                                    setRating={setRestaurantRating}
                                    label="Rate the Restaurant *"
                                />
                                <div>
                                    <Label className="text-sm">Comment about food & restaurant</Label>
                                    <Textarea
                                        value={restaurantComment}
                                        onChange={(e) => setRestaurantComment(e.target.value)}
                                        placeholder="How was the food quality, taste, packaging?"
                                        className="mt-1"
                                        rows={2}
                                    />
                                </div>
                            </div>

                            {/* Delivery Partner Rating */}
                            {selectedOrder.delivery_partner_id && (
                                <div className="space-y-3 pt-3 border-t">
                                    <StarRating
                                        rating={deliveryRating}
                                        setRating={setDeliveryRating}
                                        label="Rate the Delivery (optional)"
                                    />
                                    {selectedOrder.delivery_partner_name && (
                                        <p className="text-sm text-muted-foreground">
                                            Delivered by: {selectedOrder.delivery_partner_name}
                                        </p>
                                    )}
                                    <div>
                                        <Label className="text-sm">Comment about delivery</Label>
                                        <Textarea
                                            value={deliveryComment}
                                            onChange={(e) => setDeliveryComment(e.target.value)}
                                            placeholder="How was the delivery experience?"
                                            className="mt-1"
                                            rows={2}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Note */}
                            <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded">
                                Your review will be visible after admin approval.
                            </p>

                            {/* Submit Button */}
                            <Button
                                onClick={submitReview}
                                disabled={submittingReview || restaurantRating === 0}
                                className="w-full"
                            >
                                {submittingReview ? 'Submitting...' : 'Submit Review'}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Reorder Dialog */}
            <Dialog open={showReorderDialog} onOpenChange={setShowReorderDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <RefreshCw size={20} />
                            Reorder from {reorderOrder?.restaurant_name}
                        </DialogTitle>
                        <DialogDescription>
                            Select items to include in your new order
                        </DialogDescription>
                    </DialogHeader>
                    
                    {reorderOrder && (
                        <div className="space-y-4 mt-4">
                            {/* Unavailable Items Notice */}
                            {reorderOrder.unavailable_items?.length > 0 && (
                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle size={16} className="text-orange-500 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-orange-800">
                                                The following items are not available:
                                            </p>
                                            <p className="text-sm text-orange-700 mt-1">
                                                {reorderOrder.unavailable_items.join(', ')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Available Items Selection */}
                            <div>
                                <Label className="mb-2 block">Select items to reorder:</Label>
                                <div className="border border-border rounded-lg divide-y max-h-64 overflow-y-auto">
                                    {selectedReorderItems.map((item, idx) => (
                                        <div key={idx} className="p-3 flex items-center gap-3">
                                            <Checkbox
                                                id={`reorder-item-${idx}`}
                                                checked={item.selected}
                                                onCheckedChange={() => toggleReorderItem(item.menu_item_id)}
                                            />
                                            <img
                                                src={item.image || 'https://via.placeholder.com/40'}
                                                alt={item.name}
                                                className="w-10 h-10 rounded object-cover"
                                            />
                                            <label 
                                                htmlFor={`reorder-item-${idx}`}
                                                className="flex-1 cursor-pointer"
                                            >
                                                <p className="text-sm font-medium">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    ₹{item.price} × {item.quantity}
                                                </p>
                                            </label>
                                            <span className="text-sm font-semibold">
                                                ₹{(item.price * item.quantity).toFixed(0)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* New Order Summary */}
                            <div className="bg-secondary/50 rounded-lg p-3">
                                <div className="flex justify-between text-sm">
                                    <span>Items selected:</span>
                                    <span>{selectedReorderItems.filter(i => i.selected).length}</span>
                                </div>
                                <div className="flex justify-between font-semibold mt-1">
                                    <span>New Order Total:</span>
                                    <span>
                                        ₹{selectedReorderItems
                                            .filter(i => i.selected)
                                            .reduce((sum, item) => sum + (item.price * item.quantity), 0)
                                            .toFixed(0)}
                                        {reorderOrder.delivery_fee > 0 && ` + ₹${reorderOrder.delivery_fee} delivery`}
                                    </span>
                                </div>
                                {/* Show refund if applicable */}
                                {(() => {
                                    const newTotal = selectedReorderItems
                                        .filter(i => i.selected)
                                        .reduce((sum, item) => sum + (item.price * item.quantity), 0);
                                    const originalTotal = reorderOrder.total_amount;
                                    const difference = originalTotal - newTotal;
                                    return difference > 0 ? (
                                        <div className="flex justify-between text-green-600 text-sm mt-1">
                                            <span>Refund amount:</span>
                                            <span>₹{difference.toFixed(0)}</span>
                                        </div>
                                    ) : null;
                                })()}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setShowReorderDialog(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleReorderWithSelected}
                                    disabled={processingReorder || selectedReorderItems.filter(i => i.selected).length === 0}
                                >
                                    {processingReorder ? 'Processing...' : 'Place New Order'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
