import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
    MapPin, Bike, Store, Clock, Package, CheckCircle, 
    RefreshCw, AlertTriangle, Timer, Share2, Eye, Home
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SharedTrackingPage() {
    const { shareToken } = useParams();
    const [tracking, setTracking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchTracking = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/orders/share/${shareToken}`);
            setTracking(response.data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch tracking:', err);
            if (err.response?.status === 404) {
                setError('This tracking link is not found or has been revoked.');
            } else if (err.response?.status === 410) {
                setError('This tracking link has expired.');
            } else {
                setError('Failed to load tracking information.');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [shareToken]);

    useEffect(() => {
        fetchTracking();
        // Auto-refresh every 30 seconds for active orders
        const interval = setInterval(() => {
            if (tracking && !['delivered', 'cancelled'].includes(tracking.status)) {
                fetchTracking();
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [fetchTracking, tracking?.status]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchTracking();
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
            heavy_traffic: "Delivery delayed due to heavy traffic.",
            restaurant_busy: "Restaurant is preparing the order due to high demand.",
            weather: "Delivery delayed due to weather conditions.",
            other: "Order is slightly delayed."
        };
        return messages[reason] || messages.other;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
                <div className="max-w-2xl mx-auto px-4 py-8">
                    <div className="bg-white rounded-2xl shadow-lg p-8">
                        <div className="animate-pulse">
                            <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto mb-6" />
                            <div className="h-48 bg-gray-200 rounded-xl mb-6" />
                            <div className="h-24 bg-gray-200 rounded-xl" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
                <div className="max-w-md mx-auto px-4 text-center">
                    <div className="bg-white rounded-2xl shadow-lg p-8">
                        <Share2 size={48} className="mx-auto text-gray-400 mb-4" />
                        <h1 className="text-xl font-bold text-gray-800 mb-2">Link Not Available</h1>
                        <p className="text-gray-600 mb-6">{error}</p>
                        <Link to="/">
                            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                                <Home size={16} className="mr-2" />
                                Go to FoodKey
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const currentStep = getStatusStep(tracking.status);
    const isDelivered = tracking.status === 'delivered';
    const isCancelled = tracking.status === 'cancelled';

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50" data-testid="shared-tracking-page">
            {/* Header */}
            <div className="bg-white shadow-sm">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">
                            <span className="text-gray-800">Food</span>
                            <span className="text-orange-500">Key</span>
                        </span>
                        <Badge variant="secondary" className="text-xs">
                            <Share2 size={10} className="mr-1" />
                            Shared
                        </Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    </Button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-6">
                {/* Order Info Card */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
                    {/* Status Banner */}
                    <div className={`py-4 px-6 ${
                        isDelivered ? 'bg-green-500' : isCancelled ? 'bg-red-500' : 'bg-orange-500'
                    }`}>
                        <div className="flex items-center justify-between text-white">
                            <div>
                                <p className="text-sm opacity-90">Order #{tracking.order_id}</p>
                                <p className="text-lg font-bold">
                                    {isDelivered ? 'Delivered!' : 
                                     isCancelled ? 'Cancelled' :
                                     tracking.status === 'picked_up' ? 'On the way!' :
                                     tracking.status === 'ready' ? 'Ready for pickup' :
                                     tracking.status === 'preparing' ? 'Being prepared' :
                                     tracking.status === 'confirmed' ? 'Order confirmed' :
                                     'Waiting for confirmation'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs opacity-75">from</p>
                                <p className="font-semibold">{tracking.restaurant?.name}</p>
                            </div>
                        </div>
                    </div>

                    {/* Map Visualization */}
                    <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200">
                        {/* Decorative grid */}
                        <div className="absolute inset-0 opacity-20">
                            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <pattern id="sharedGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                                    </pattern>
                                </defs>
                                <rect width="100%" height="100%" fill="url(#sharedGrid)" />
                            </svg>
                        </div>
                        
                        {/* Location markers */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex items-center gap-4">
                                {/* Restaurant */}
                                <div className="flex flex-col items-center">
                                    <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
                                        <Store size={20} className="text-white" />
                                    </div>
                                    <span className="text-xs mt-1 font-medium text-gray-600">Restaurant</span>
                                </div>

                                {/* Path */}
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4].map((_, i) => (
                                        <div 
                                            key={i} 
                                            className={`w-3 h-1 rounded ${i < currentStep - 2 ? 'bg-orange-500' : 'bg-gray-300'}`}
                                        />
                                    ))}
                                </div>

                                {/* Delivery Partner */}
                                {tracking.delivery_partner && !isDelivered && (
                                    <>
                                        <div className="flex flex-col items-center">
                                            <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg animate-pulse">
                                                <Bike size={20} className="text-white" />
                                            </div>
                                            <span className="text-xs mt-1 font-medium text-gray-600">{tracking.delivery_partner.partner_name?.split(' ')[0]}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {[1, 2].map((_, i) => (
                                                <div 
                                                    key={i} 
                                                    className={`w-3 h-1 rounded ${tracking.status === 'picked_up' ? 'bg-orange-500' : 'bg-gray-300'}`}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}

                                {/* Customer */}
                                <div className="flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full ${isDelivered ? 'bg-green-500' : 'bg-gray-400'} flex items-center justify-center shadow-lg`}>
                                        <MapPin size={20} className="text-white" />
                                    </div>
                                    <span className="text-xs mt-1 font-medium text-gray-600">Destination</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Estimated Time */}
                    {!isDelivered && !isCancelled && (tracking.estimated_delivery_time || tracking.estimated_prep_time) && (
                        <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
                            <div className="flex items-center gap-3">
                                <Timer className="h-5 w-5 text-blue-600" />
                                <div>
                                    <p className="text-sm font-medium text-blue-800">
                                        Estimated: ~{(tracking.estimated_prep_time || 0) + (tracking.estimated_delivery_time || 20)} mins
                                    </p>
                                    {tracking.is_delayed && (
                                        <p className="text-xs text-orange-600 mt-0.5 flex items-center gap-1">
                                            <AlertTriangle size={12} />
                                            {getDelayMessage(tracking.delay_reason)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Progress Steps */}
                    <div className="px-6 py-6">
                        <div className="flex justify-between items-start relative">
                            {/* Progress line */}
                            <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-200 -z-10">
                                <div 
                                    className="h-full bg-orange-500 transition-all duration-500"
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
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                            isActive ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-400'
                                        } ${isCurrent ? 'ring-2 ring-orange-300 scale-110' : ''}`}>
                                            <Icon size={12} />
                                        </div>
                                        <span className={`text-[10px] mt-1 ${isActive ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                                            {step.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Order Details */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <h3 className="font-semibold text-gray-800 mb-4">Order Details</h3>
                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <Store size={18} className="text-orange-500 mt-0.5" />
                            <div>
                                <p className="text-sm text-gray-500">From</p>
                                <p className="font-medium text-gray-800">{tracking.restaurant?.name}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <MapPin size={18} className="text-orange-500 mt-0.5" />
                            <div>
                                <p className="text-sm text-gray-500">Delivering to</p>
                                <p className="font-medium text-gray-800">
                                    {tracking.delivery_address?.label}
                                    {tracking.delivery_address?.city && `, ${tracking.delivery_address.city}`}
                                </p>
                            </div>
                        </div>
                        {tracking.delivery_partner && (
                            <div className="flex items-start gap-3">
                                <Bike size={18} className="text-cyan-500 mt-0.5" />
                                <div>
                                    <p className="text-sm text-gray-500">Delivery Partner</p>
                                    <p className="font-medium text-gray-800">
                                        {tracking.delivery_partner.partner_name}
                                        {tracking.delivery_partner.vehicle && ` • ${tracking.delivery_partner.vehicle}`}
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="flex items-start gap-3">
                            <Package size={18} className="text-orange-500 mt-0.5" />
                            <div>
                                <p className="text-sm text-gray-500">Items</p>
                                <p className="font-medium text-gray-800">{tracking.items_count} item(s)</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tracking History */}
                {tracking.tracking_history?.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                        <h3 className="font-semibold text-gray-800 mb-4">Tracking Updates</h3>
                        <div className="space-y-3 max-h-48 overflow-y-auto">
                            {tracking.tracking_history.map((update, idx) => (
                                <div key={idx} className="flex items-start gap-3 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5" />
                                    <div>
                                        <p className={`font-medium ${getStatusColor(update.status)}`}>
                                            {update.status?.replace('_', ' ')}
                                        </p>
                                        {update.message && <p className="text-gray-500">{update.message}</p>}
                                        {update.timestamp && (
                                            <p className="text-xs text-gray-400">
                                                {format(new Date(update.timestamp), 'h:mm a')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* View Count & CTA */}
                <div className="text-center space-y-4">
                    <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
                        <Eye size={14} />
                        <span>Viewed {tracking.share_view_count} time(s)</span>
                    </div>
                    <Link to="/">
                        <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                            Order from FoodKey
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Footer */}
            <div className="bg-white border-t mt-8 py-4">
                <p className="text-center text-sm text-gray-500">
                    Powered by <span className="font-semibold">FoodKey</span> - Unlock Delicious
                </p>
            </div>
        </div>
    );
}
