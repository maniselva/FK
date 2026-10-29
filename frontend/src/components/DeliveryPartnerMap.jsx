/**
 * DeliveryPartnerMap
 * ------------------
 * Slim orchestrator component. All Google-Maps + tracking complexity lives in
 * three focused hooks under /hooks:
 *   - useGoogleMapInit         → loads SDK, builds Map / DirectionsRenderer / Traffic layer
 *   - useMapMarkersAndRoute    → markers + route + ETA (flicker-safe primitive deps)
 *   - usePartnerLiveTracking   → geolocation + server location push
 */
import React from 'react';
import {
    MapPin,
    Store,
    Navigation,
    Phone,
    RefreshCw,
    Route,
    Play,
    Pause,
    AlertCircle,
    Map as MapIcon,
} from 'lucide-react';
import { Button } from './ui/button';
import { useGoogleMapInit } from '../hooks/useGoogleMapInit';
import { useMapMarkersAndRoute } from '../hooks/useMapMarkersAndRoute';
import { usePartnerLiveTracking } from '../hooks/usePartnerLiveTracking';

const openNavigation = (destination) => {
    if (!destination?.lat || !destination?.lng) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`;
    window.open(url, '_blank');
};

export default function DeliveryPartnerMap({
    orderId,
    partnerId,
    restaurantLocation,
    customerLocation,
    restaurantInfo,
    customerInfo,
    orderStatus,
    className = '',
}) {
    const initialCenter = restaurantLocation?.lat && restaurantLocation?.lng
        ? { lat: restaurantLocation.lat, lng: restaurantLocation.lng }
        : customerLocation?.lat && customerLocation?.lng
            ? { lat: customerLocation.lat, lng: customerLocation.lng }
            : null;

    const {
        mapRef,
        mapInstanceRef,
        directionsRendererRef,
        mapsApi,
        mapLoaded,
        mapError,
        toggleTraffic,
    } = useGoogleMapInit({ initialCenter, polylineColor: '#3b82f6' });

    const { currentLocation, isTracking, error, startTracking, stopTracking } =
        usePartnerLiveTracking({ orderId, partnerId });

    const { eta, routeInfo } = useMapMarkersAndRoute({
        mapsApi,
        mapInstanceRef,
        directionsRendererRef,
        mapLoaded,
        restaurantLocation,
        customerLocation,
        currentLocation,
        restaurantInfo,
        customerInfo,
        orderStatus,
    });

    const [showTraffic, setShowTraffic] = React.useState(true);
    const handleTrafficToggle = () => {
        const next = !showTraffic;
        setShowTraffic(next);
        toggleTraffic(next);
    };

    return (
        <div
            className={`bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg ${className}`}
            data-testid="delivery-partner-map"
        >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Navigation className="w-5 h-5" />
                        <span className="font-semibold text-lg">Delivery Navigation</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {isTracking && (
                            <>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></div>
                                <span className="text-sm">Tracking Active</span>
                            </>
                        )}
                    </div>
                </div>

                {/* ETA Cards */}
                {routeInfo && (
                    <div className="grid grid-cols-3 gap-2 text-sm">
                        {eta.toRestaurant && (
                            <div className="bg-white/20 backdrop-blur rounded-xl p-2.5">
                                <div className="flex items-center gap-1 text-white/80 text-xs mb-1">
                                    <Store className="w-3 h-3" />
                                    <span>To Pickup</span>
                                </div>
                                <p className="text-lg font-bold">{eta.toRestaurant} min</p>
                                <p className="text-xs text-white/70">{routeInfo.toRestaurant?.distance} km</p>
                            </div>
                        )}
                        <div className="bg-white/20 backdrop-blur rounded-xl p-2.5">
                            <div className="flex items-center gap-1 text-white/80 text-xs mb-1">
                                <MapPin className="w-3 h-3" />
                                <span>To Drop</span>
                            </div>
                            <p className="text-lg font-bold">{eta.toCustomer || '--'} min</p>
                            <p className="text-xs text-white/70">{routeInfo.toCustomer?.distance || '--'} km</p>
                        </div>
                        <div className="bg-white/20 backdrop-blur rounded-xl p-2.5">
                            <div className="flex items-center gap-1 text-white/80 text-xs mb-1">
                                <Route className="w-3 h-3" />
                                <span>Total</span>
                            </div>
                            <p className="text-lg font-bold">{routeInfo.total?.duration || '--'} min</p>
                            <p className="text-xs text-white/70">{routeInfo.total?.distance || '--'} km</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Map / Error fallback */}
            {mapError ? (
                <div className="w-full h-72 bg-gray-100 flex flex-col items-center justify-center gap-4 p-6">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <MapIcon className="w-8 h-8 text-blue-500" />
                    </div>
                    <p className="text-gray-600 text-center text-sm">{mapError}</p>
                    <div className="flex gap-2">
                        {customerLocation?.lat && (
                            <Button
                                size="sm"
                                className="bg-green-500 hover:bg-green-600"
                                onClick={() => openNavigation(customerLocation)}
                            >
                                <Navigation className="w-4 h-4 mr-1" />
                                Navigate to Customer
                            </Button>
                        )}
                        {restaurantLocation?.lat && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openNavigation(restaurantLocation)}
                            >
                                <Navigation className="w-4 h-4 mr-1" />
                                Navigate to Pickup
                            </Button>
                        )}
                    </div>
                </div>
            ) : (
                <div ref={mapRef} className="w-full h-72 bg-gray-100" />
            )}

            {/* Controls */}
            <div className="p-4 space-y-4">
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {/* Tracking Controls */}
                <div className="flex gap-2">
                    {!isTracking ? (
                        <Button
                            onClick={startTracking}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                            data-testid="start-tracking-btn"
                        >
                            <Play className="w-4 h-4 mr-2" />
                            Start Tracking
                        </Button>
                    ) : (
                        <Button
                            onClick={stopTracking}
                            variant="outline"
                            className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                            data-testid="stop-tracking-btn"
                        >
                            <Pause className="w-4 h-4 mr-2" />
                            Pause Tracking
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                            // Soft refresh: stop+start so tracking re-syncs to server
                            if (isTracking) {
                                stopTracking();
                                setTimeout(() => startTracking(), 200);
                            }
                        }}
                        title="Refresh tracking"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                        variant={showTraffic ? 'default' : 'outline'}
                        size="sm"
                        onClick={handleTrafficToggle}
                        className={showTraffic ? 'bg-amber-500 hover:bg-amber-600' : ''}
                    >
                        🚦 Traffic
                    </Button>
                </div>

                {/* Destination Cards */}
                <div className="space-y-3">
                    {restaurantInfo && (
                        <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-xl">
                                    🍽️
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-800">{restaurantInfo.name}</p>
                                    <p className="text-xs text-gray-500 truncate max-w-[180px]">{restaurantInfo.address}</p>
                                    {eta.toRestaurant && (
                                        <p className="text-xs text-orange-600 font-medium mt-1">
                                            ETA: {eta.toRestaurant} mins
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {restaurantInfo.phone && (
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-9 w-9"
                                        onClick={() => window.open(`tel:${restaurantInfo.phone}`)}
                                    >
                                        <Phone className="w-4 h-4" />
                                    </Button>
                                )}
                                <Button
                                    size="icon"
                                    className="h-9 w-9 bg-orange-500 hover:bg-orange-600"
                                    onClick={() => openNavigation(restaurantLocation)}
                                >
                                    <Navigation className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {customerInfo && (
                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-xl">
                                    🏠
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-800">{customerInfo.name}</p>
                                    <p className="text-xs text-gray-500 truncate max-w-[180px]">{customerInfo.address}</p>
                                    {eta.toCustomer && (
                                        <p className="text-xs text-green-600 font-medium mt-1">
                                            ETA: {eta.toCustomer} mins
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {customerInfo.phone && (
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-9 w-9"
                                        onClick={() => window.open(`tel:${customerInfo.phone}`)}
                                    >
                                        <Phone className="w-4 h-4" />
                                    </Button>
                                )}
                                <Button
                                    size="icon"
                                    className="h-9 w-9 bg-green-500 hover:bg-green-600"
                                    onClick={() => openNavigation(customerLocation)}
                                >
                                    <Navigation className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 text-xs text-gray-500 pt-2 border-t">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span>You</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        <span>Pickup</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>Drop</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-1 bg-blue-500"></div>
                        <span>Route</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
