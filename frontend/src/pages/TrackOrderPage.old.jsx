import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
    MapPin, Bike, Store, Clock, ArrowLeft, Phone, 
    Package, CheckCircle, Navigation, RefreshCw, Route,
    AlertTriangle, Timer, ExternalLink, Mail, Share2, Copy, Check, X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { useApp } from '../contexts/AppContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import CustomerReviewForm from '../components/CustomerReviewForm';
import LiveTrackingMap from '../components/LiveTrackingMap';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function TrackOrderPage() {
    const { orderId } = useParams();
    const { user } = useApp();
    const [tracking, setTracking] = useState(null);
    const [routeInfo, setRouteInfo] = useState(null);
    const [directions, setDirections] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [shareDialog, setShareDialog] = useState(false);
    const [shareLink, setShareLink] = useState(null);
    const [shareLoading, setShareLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const fetchTracking = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/orders/${orderId}/tracking`);
            setTracking(response.data);
        } catch (error) {
            console.error('Failed to fetch tracking:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [orderId]);

    const fetchRoute = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/maps/delivery-route/${orderId}`);
            if (response.data && response.data.route) {
                setRouteInfo(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch route:', error);
        }
    }, [orderId]);

    const fetchDirections = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/orders/${orderId}/directions`);
            setDirections(response.data);
        } catch (error) {
            console.error('Failed to fetch directions:', error);
        }
    }, [orderId]);

    useEffect(() => {
        fetchTracking();
        fetchRoute();
        fetchDirections();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchTracking, 30000);
        return () => clearInterval(interval);
    }, [fetchTracking, fetchRoute, fetchDirections]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchTracking();
    };

    const handleShare = async () => {
        setShareDialog(true);
        if (shareLink) return; // Already have a share link
        
        setShareLoading(true);
        try {
            const response = await axios.post(`${API}/orders/${orderId}/share?user_id=${user?.id}`);
            const fullUrl = `${window.location.origin}${response.data.share_url}`;
            setShareLink({
                ...response.data,
                full_url: fullUrl
            });
        } catch (error) {
            console.error('Failed to create share link:', error);
            toast.error('Failed to create share link');
        } finally {
            setShareLoading(false);
        }
    };

    const copyToClipboard = async () => {
        if (!shareLink?.full_url) return;
        
        try {
            await navigator.clipboard.writeText(shareLink.full_url);
            setCopied(true);
            toast.success('Link copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = shareLink.full_url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            toast.success('Link copied!');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const shareViaWhatsApp = () => {
        if (!shareLink?.full_url) return;
        const text = `Track my FoodKey order: ${shareLink.full_url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const revokeShareLink = async () => {
        try {
            await axios.delete(`${API}/orders/${orderId}/share?user_id=${user?.id}`);
            setShareLink(null);
            setShareDialog(false);
            toast.success('Share link revoked');
        } catch (error) {
            toast.error('Failed to revoke link');
        }
    };

    const getStatusStep = (status) => {
        const steps = ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivered'];
        return steps.indexOf(status) + 1;
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: 'text-yellow-400',
            confirmed: 'text-blue-400',
            preparing: 'text-orange-400',
            ready: 'text-purple-400',
            picked_up: 'text-cyan-400',
            delivered: 'text-green-400',
            cancelled: 'text-red-400',
        };
        return colors[status] || 'text-gray-400';
    };

    const getDelayMessage = (reason) => {
        const messages = {
            heavy_traffic: "Apologies! Your delivery is delayed due to heavy traffic.",
            restaurant_busy: "Sorry for the delay! The restaurant is preparing your order due to high demand.",
            weather: "Delivery delayed due to weather conditions. Thanks for your patience!",
            other: "Your order is slightly delayed. We're working to get it to you soon!"
        };
        return messages[reason] || messages.other;
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
                <div className="skeleton h-8 w-1/3 mb-8" />
                <div className="skeleton h-64 rounded-2xl mb-8" />
                <div className="skeleton h-32 rounded-2xl" />
            </div>
        );
    }

    if (!tracking) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-16 text-center">
                <Package size={64} className="mx-auto text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold mb-2">Order Not Found</h1>
                <p className="text-muted-foreground">The order you're looking for doesn't exist</p>
                <Link to="/">
                    <Button className="mt-4">Go Home</Button>
                </Link>
            </div>
        );
    }

    const currentStep = getStatusStep(tracking.status);
    const isDelivered = tracking.status === 'delivered';
    const isCancelled = tracking.status === 'cancelled';

    return (
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8" data-testid="track-order">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <Link to="/orders" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-2">
                        <ArrowLeft size={16} /> Back to Orders
                    </Link>
                    <h1 className="text-2xl font-bold">Track Order</h1>
                    <p className="font-mono text-muted-foreground">#{orderId}</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Share Button */}
                    {user && !isCancelled && (
                        <Button 
                            variant="outline" 
                            onClick={handleShare}
                            className="text-orange-600 border-orange-200 hover:bg-orange-50"
                            data-testid="share-order-btn"
                        >
                            <Share2 size={16} className="mr-2" />
                            Share
                        </Button>
                    )}
                    <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                        <RefreshCw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Share Dialog */}
            <Dialog open={shareDialog} onOpenChange={setShareDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Share2 className="h-5 w-5 text-orange-500" />
                            Share Order Tracking
                        </DialogTitle>
                        <DialogDescription>
                            Share this link with friends or family to let them track your delivery in real-time.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {shareLoading ? (
                        <div className="py-8 text-center">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-orange-500 mb-2" />
                            <p className="text-sm text-muted-foreground">Generating share link...</p>
                        </div>
                    ) : shareLink ? (
                        <div className="space-y-4">
                            {/* Share Link Display */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 p-3 bg-secondary rounded-lg font-mono text-sm truncate">
                                    {shareLink.full_url}
                                </div>
                                <Button 
                                    size="icon" 
                                    variant="outline"
                                    onClick={copyToClipboard}
                                    className={copied ? 'bg-green-50 border-green-500' : ''}
                                >
                                    {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                                </Button>
                            </div>

                            {/* Share Options */}
                            <div className="flex gap-2">
                                <Button 
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                    onClick={shareViaWhatsApp}
                                >
                                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                    WhatsApp
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="flex-1"
                                    onClick={copyToClipboard}
                                >
                                    <Copy size={16} className="mr-2" />
                                    Copy Link
                                </Button>
                            </div>

                            {/* Info */}
                            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                                <p>This link expires in 7 days. Anyone with this link can view your order's live tracking status.</p>
                            </div>

                            {/* Revoke Option */}
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={revokeShareLink}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full"
                            >
                                <X size={14} className="mr-1" />
                                Revoke Share Link
                            </Button>
                        </div>
                    ) : (
                        <div className="py-4 text-center text-muted-foreground">
                            <p>Failed to generate share link. Please try again.</p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Map Placeholder with Locations */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden mb-8">
                <div className="relative h-64 bg-gradient-to-br from-secondary to-background">
                    {/* Decorative map grid */}
                    <div className="absolute inset-0 opacity-10">
                        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)" />
                        </svg>
                    </div>
                    
                    {/* Location markers */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex items-center gap-8">
                            {/* Restaurant */}
                            <div className="flex flex-col items-center">
                                <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center shadow-lg animate-pulse">
                                    <Store size={24} className="text-white" />
                                </div>
                                <span className="text-xs mt-2 font-medium">Restaurant</span>
                            </div>

                            {/* Path line */}
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={`w-4 h-1 rounded ${i < currentStep - 2 ? 'bg-primary' : 'bg-secondary'}`}
                                    />
                                ))}
                            </div>

                            {/* Delivery Partner */}
                            {tracking.delivery_partner && tracking.status !== 'delivered' && (
                                <>
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg">
                                            <Bike size={24} className="text-white" />
                                        </div>
                                        <span className="text-xs mt-2 font-medium">{tracking.delivery_partner.partner_name}</span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3].map((_, i) => (
                                            <div 
                                                key={i} 
                                                className={`w-4 h-1 rounded ${tracking.status === 'picked_up' ? 'bg-primary' : 'bg-secondary'}`}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Customer */}
                            <div className="flex flex-col items-center">
                                <div className={`w-12 h-12 rounded-full ${isDelivered ? 'bg-green-500' : 'bg-primary'} flex items-center justify-center shadow-lg`}>
                                    <MapPin size={24} className="text-white" />
                                </div>
                                <span className="text-xs mt-2 font-medium">You</span>
                            </div>
                        </div>
                    </div>

                    {/* Status Banner */}
                    <div className={`absolute bottom-0 left-0 right-0 py-3 px-4 ${
                        isDelivered ? 'bg-green-500/90' : isCancelled ? 'bg-red-500/90' : 'bg-primary/90'
                    }`}>
                        <p className="text-center font-semibold text-white">
                            {isDelivered ? '🎉 Order Delivered!' : 
                             isCancelled ? '❌ Order Cancelled' :
                             tracking.status === 'picked_up' ? '🚴 On the way to you!' :
                             tracking.status === 'ready' ? '📦 Ready for pickup!' :
                             tracking.status === 'preparing' ? '👨‍🍳 Being prepared...' :
                             tracking.status === 'confirmed' ? '✅ Order confirmed!' :
                             '⏳ Waiting for confirmation...'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Estimated Time & Delay Alert */}
            {!isDelivered && !isCancelled && (
                <div className="space-y-4 mb-8">
                    {/* Estimated Time */}
                    {(tracking.estimated_delivery_time || tracking.estimated_prep_time) && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-center gap-3 mb-3">
                                <Timer className="h-6 w-6 text-blue-600 flex-shrink-0" />
                                <p className="font-semibold text-blue-800">
                                    Total Estimated Time: ~{(tracking.estimated_prep_time || 0) + (tracking.estimated_delivery_time || 20)} mins
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {tracking.estimated_prep_time && (
                                    <div className="bg-white rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-orange-600">{tracking.estimated_prep_time} mins</p>
                                        <p className="text-xs text-muted-foreground">Preparation</p>
                                    </div>
                                )}
                                {tracking.estimated_delivery_time && (
                                    <div className="bg-white rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-green-600">{tracking.estimated_delivery_time} mins</p>
                                        <p className="text-xs text-muted-foreground">Delivery</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Delay Alert */}
                    {tracking.is_delayed && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                            <AlertTriangle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium text-orange-800">Delivery Delayed</p>
                                <p className="text-sm text-orange-600">{getDelayMessage(tracking.delay_reason)}</p>
                                {tracking.delay_minutes > 0 && (
                                    <p className="text-sm text-orange-600 mt-1">
                                        Additional ~{tracking.delay_minutes} mins added to estimated time
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Live Tracking Map */}
                    {['confirmed', 'preparing', 'ready', 'picked_up'].includes(tracking.status) && (
                        <LiveTrackingMap
                            orderId={orderId}
                            userId={user?.id}
                            restaurantLocation={{
                                lat: tracking.restaurant_lat,
                                lng: tracking.restaurant_lng,
                                address: tracking.restaurant_address
                            }}
                            customerLocation={{
                                lat: tracking.delivery_address?.lat,
                                lng: tracking.delivery_address?.lng,
                                address: tracking.delivery_address?.full_address
                            }}
                            initialPartnerLocation={tracking.delivery_partner_location}
                            orderStatus={tracking.status}
                            className="mb-4"
                        />
                    )}

                    {/* Track Delivery Partner on Map */}
                    {tracking.status === 'picked_up' && directions?.directions_to_customer && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Navigation className="h-6 w-6 text-green-600" />
                                    <div>
                                        <p className="font-medium text-green-800">Your order is on the way!</p>
                                        {directions.distance_km && (
                                            <p className="text-sm text-green-600">
                                                {directions.distance_km}km away • ~{directions.estimated_travel_time} mins
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => window.open(directions.directions_to_customer, '_blank')}
                                    className="text-green-700 border-green-300 hover:bg-green-100"
                                >
                                    <ExternalLink size={14} className="mr-1" />
                                    View on Map
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Progress Steps */}
            <div className="bg-card rounded-2xl border border-border p-6 mb-8">
                <h3 className="font-semibold mb-6">Order Progress</h3>
                <div className="flex justify-between items-start relative">
                    {/* Progress line */}
                    <div className="absolute top-4 left-0 right-0 h-1 bg-secondary rounded -z-10">
                        <div 
                            className="h-full bg-primary rounded transition-all duration-500"
                            style={{ width: `${isCancelled ? 0 : (currentStep / 6) * 100}%` }}
                        />
                    </div>

                    {[
                        { status: 'pending', label: 'Placed', icon: Clock },
                        { status: 'confirmed', label: 'Confirmed', icon: CheckCircle },
                        { status: 'preparing', label: 'Preparing', icon: Store },
                        { status: 'ready', label: 'Ready', icon: Package },
                        { status: 'picked_up', label: 'Picked Up', icon: Bike },
                        { status: 'delivered', label: 'Delivered', icon: MapPin }
                    ].map((step, idx) => {
                        const isActive = getStatusStep(tracking.status) >= idx + 1;
                        const isCurrent = tracking.status === step.status;
                        const Icon = step.icon;
                        
                        return (
                            <div key={step.status} className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                    isActive ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
                                } ${isCurrent ? 'ring-4 ring-primary/30 scale-110' : ''}`}>
                                    <Icon size={16} />
                                </div>
                                <span className={`text-xs mt-2 ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Order Details */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Restaurant Info */}
                <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Store size={18} className="text-orange-400" />
                        Restaurant
                    </h3>
                    <p className="font-medium">{tracking.restaurant?.name}</p>
                    <p className="text-sm text-muted-foreground">{tracking.restaurant?.address}</p>
                </div>

                {/* Delivery Address */}
                <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <MapPin size={18} className="text-primary" />
                        Delivery Address
                    </h3>
                    <p className="font-medium">{tracking.delivery_address?.label}</p>
                    <p className="text-sm text-muted-foreground">{tracking.delivery_address?.full_address}</p>
                </div>

                {/* Delivery Partner */}
                {tracking.delivery_partner && (
                    <div className="bg-card rounded-2xl border border-border p-6">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <Bike size={18} className="text-cyan-400" />
                            Delivery Partner
                        </h3>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">{tracking.delivery_partner.partner_name}</p>
                                <p className="text-sm text-muted-foreground">{tracking.delivery_partner.vehicle}</p>
                            </div>
                            <a 
                                href={`tel:${tracking.delivery_partner.partner_phone}`}
                                className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center"
                            >
                                <Phone size={18} className="text-white" />
                            </a>
                        </div>
                    </div>
                )}

                {/* Tracking History */}
                {tracking.tracking_history?.length > 0 && (
                    <div className="bg-card rounded-2xl border border-border p-6">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <Navigation size={18} className="text-blue-400" />
                            Tracking Updates
                        </h3>
                        <div className="space-y-3 max-h-40 overflow-y-auto">
                            {tracking.tracking_history.map((update, idx) => (
                                <div key={idx} className="flex items-start gap-3 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                                    <div>
                                        <p className={getStatusColor(update.status)}>{update.status?.replace('_', ' ')}</p>
                                        {update.message && <p className="text-muted-foreground">{update.message}</p>}
                                        <p className="text-xs text-muted-foreground">
                                            {update.timestamp && format(new Date(update.timestamp), 'h:mm a')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Route Information */}
            {routeInfo && routeInfo.route && (
                <div className="mt-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 p-6" data-testid="route-info">
                    <h3 className="font-semibold mb-4 flex items-center gap-2 text-blue-700 dark:text-blue-400">
                        <Route size={18} />
                        Delivery Route
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-sm">
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{routeInfo.route.distance}</p>
                            <p className="text-xs text-muted-foreground">Distance</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-sm">
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{routeInfo.route.duration}</p>
                            <p className="text-xs text-muted-foreground">Est. Time</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                            <p className="text-xs text-muted-foreground mb-1">From</p>
                            <p className="text-sm font-medium truncate">{routeInfo.restaurant?.name}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                            <p className="text-xs text-muted-foreground mb-1">To</p>
                            <p className="text-sm font-medium truncate">{routeInfo.delivery_address?.address?.slice(0, 30)}...</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Help Section */}
            <div className="mt-8 p-6 bg-secondary/50 rounded-xl">
                <h3 className="font-semibold mb-3 text-center">Need help with your order?</h3>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <a href="tel:04292290970" className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                        <Phone size={16} />
                        04292 290970
                    </a>
                    <a href="tel:9566722970" className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                        <Phone size={16} />
                        9566722970
                    </a>
                    <a href="mailto:support@foodkey.in" className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
                        <Mail size={16} />
                        support@foodkey.in
                    </a>
                </div>
            </div>

            {/* Cancellation Reason - Show if order was cancelled */}
            {isCancelled && tracking.cancellation_reason && (
                <div className="mt-4 p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl" data-testid="cancellation-reason">
                    <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center text-sm">❌</span>
                        Order Cancelled
                    </h3>
                    <p className="text-red-600 dark:text-red-300 mb-2">
                        <span className="font-medium">Reason:</span> {tracking.cancellation_reason}
                    </p>
                    {tracking.cancelled_by && (
                        <p className="text-sm text-red-500 dark:text-red-400">
                            Cancelled by: {tracking.cancelled_by === 'restaurant' ? 'Restaurant' : tracking.cancelled_by === 'customer' ? 'You' : 'Admin'}
                        </p>
                    )}
                </div>
            )}

            {/* Customer Review Section - Show only when delivered */}
            {isDelivered && user && (
                <div className="mt-8" data-testid="review-section">
                    <CustomerReviewForm
                        orderId={orderId}
                        restaurantId={tracking.restaurant?.id}
                        restaurantName={tracking.restaurant?.name}
                        userId={user.id}
                        userName={user.name}
                        deliveryPartnerId={tracking.delivery_partner?.partner_id}
                        deliveryPartnerName={tracking.delivery_partner?.partner_name}
                        onReviewSubmitted={() => console.log('Review submitted')}
                    />
                </div>
            )}
        </div>
    );
}
