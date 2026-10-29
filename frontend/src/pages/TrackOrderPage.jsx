import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    MapPin, Bike, Store, Clock, ArrowLeft, Phone, 
    Package, CheckCircle, Navigation, RefreshCw, 
    Timer, User, Star, MessageCircle, ChevronRight,
    Utensils, Home, Route, Locate, ExternalLink, AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useApp } from '../contexts/AppContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Load Google Maps Script with better error handling
const loadGoogleMapsScript = async () => {
    // Check if already loaded
    if (window.google && window.google.maps) {
        return window.google.maps;
    }

    // Check for existing script
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
        return new Promise((resolve, reject) => {
            const checkLoaded = () => {
                if (window.google && window.google.maps) {
                    resolve(window.google.maps);
                }
            };
            existingScript.addEventListener('load', checkLoaded);
            existingScript.addEventListener('error', () => reject(new Error('Map failed to load')));
            // Also check immediately in case it loaded
            checkLoaded();
            // Timeout after 10 seconds
            setTimeout(() => reject(new Error('Map loading timeout')), 10000);
        });
    }

    // Fetch API key from backend
    let apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    try {
        const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/google-maps/config`);
        if (response.data?.api_key || response.data?.apiKey) {
            apiKey = response.data.api_key || response.data.apiKey;
        }
    } catch (e) {
        console.log('Using env API key:', e.message);
    }

    if (!apiKey) {
        throw new Error('Google Maps API key not available');
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.id = 'google-maps-script';
        // v=weekly keeps tiles/features current; libraries=places,geometry for search+math
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=places,geometry&callback=__googleMapsCallback`;
        script.async = true;
        script.defer = true;
        
        // Set up callback
        window.__googleMapsCallback = () => {
            if (window.google && window.google.maps) {
                resolve(window.google.maps);
            } else {
                reject(new Error('Google Maps failed to initialize'));
            }
        };
        
        script.onerror = () => {
            reject(new Error('Failed to load Google Maps script'));
        };
        
        document.head.appendChild(script);
        
        // Timeout after 15 seconds
        setTimeout(() => {
            if (!window.google || !window.google.maps) {
                reject(new Error('Google Maps loading timeout'));
            }
        }, 15000);
    });
};

// Format ETA to be user-friendly
const formatETA = (minutes) => {
    if (!minutes || minutes <= 0) return null;
    
    // Cap at 120 minutes (2 hours) for food delivery
    if (minutes > 120) {
        return { value: '2+', unit: 'hrs', isEstimate: true };
    }
    
    if (minutes < 60) {
        return { value: minutes, unit: 'min', isEstimate: false };
    }
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins > 0) {
        return { value: `${hours}h ${mins}m`, unit: '', isEstimate: false };
    }
    return { value: hours, unit: 'hr', isEstimate: false };
};

export default function OrderTrackingPage() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const { user } = useApp();
    
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef({});
    const directionsRendererRef = useRef(null);
    const partnerMarkerRef = useRef(null);
    const trafficLayerRef = useRef(null);
    const animationRef = useRef(null);
    
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mapsApi, setMapsApi] = useState(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [partnerLocation, setPartnerLocation] = useState(null);
    const [eta, setEta] = useState(null);
    const [distance, setDistance] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // Fetch order details
    const fetchOrder = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/orders/${orderId}/tracking`);
            const orderData = response.data;
            setOrder(orderData);
            
            // If partner location exists in response
            if (orderData.delivery_partner_location) {
                setPartnerLocation(orderData.delivery_partner_location);
            }
            
            // Calculate ETA from estimated_delivery_time or from response
            if (orderData.estimated_delivery_time) {
                setEta(orderData.estimated_delivery_time);
            }
        } catch (error) {
            console.error('Failed to fetch order:', error);
            toast.error('Failed to load order details');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [orderId]);

    // Fetch live tracking data
    const fetchLiveTracking = useCallback(async () => {
        if (!order?.delivery_partner) return;
        
        try {
            const response = await axios.get(`${API}/tracking/live/${orderId}`);
            if (response.data?.partner?.location) {
                setPartnerLocation(response.data.partner.location);
                if (response.data.eta) {
                    setEta(response.data.eta.minutes);
                    setDistance(response.data.eta.distance_km);
                }
            }
        } catch (error) {
            console.error('Failed to fetch live tracking:', error);
        }
    }, [orderId, order?.delivery_partner]);

    // Initialize map
    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        loadGoogleMapsScript()
            .then((googleMaps) => {
                setMapsApi(googleMaps);
                setMapError(null);

                // Default center (will be updated when order loads)
                const defaultCenter = { lat: 12.9716, lng: 77.5946 };

                mapInstanceRef.current = new googleMaps.Map(mapRef.current, {
                    center: defaultCenter,
                    zoom: 14,
                    mapTypeControl: true,
                    mapTypeControlOptions: {
                        style: googleMaps.MapTypeControlStyle.HORIZONTAL_BAR,
                        position: googleMaps.ControlPosition.TOP_RIGHT,
                        mapTypeIds: ['roadmap', 'satellite', 'hybrid']
                    },
                    streetViewControl: false,
                    fullscreenControl: true,
                    zoomControl: true,
                    gestureHandling: 'greedy',
                    clickableIcons: false,
                    styles: [
                        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
                        { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] }
                    ]
                });

                // Live traffic layer — shows real-time traffic conditions
                trafficLayerRef.current = new googleMaps.TrafficLayer();
                trafficLayerRef.current.setMap(mapInstanceRef.current);

                directionsRendererRef.current = new googleMaps.DirectionsRenderer({
                    map: mapInstanceRef.current,
                    suppressMarkers: true,
                    polylineOptions: {
                        strokeColor: '#FF6B00',
                        strokeWeight: 5,
                        strokeOpacity: 0.85
                    }
                });

                setMapLoaded(true);
            })
            .catch(err => {
                console.error('Failed to load Google Maps:', err);
                setMapError('Map unavailable - tap to view route');
            });
    }, [loading]);

    // Update map markers when order/partner location changes
    useEffect(() => {
        if (!mapsApi || !mapInstanceRef.current || !order) return;

        const bounds = new mapsApi.LatLngBounds();

        // Restaurant marker
        const restaurantLat = order.restaurant_lat || order.restaurant?.lat;
        const restaurantLng = order.restaurant_lng || order.restaurant?.lng;
        
        if (restaurantLat && restaurantLng) {
            const restaurantPos = { lat: restaurantLat, lng: restaurantLng };
            bounds.extend(restaurantPos);

            if (markersRef.current.restaurant) {
                markersRef.current.restaurant.setPosition(restaurantPos);
            } else {
                markersRef.current.restaurant = new mapsApi.Marker({
                    position: restaurantPos,
                    map: mapInstanceRef.current,
                    icon: {
                        url: 'data:image/svg+xml,' + encodeURIComponent(`
                            <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 0C8.954 0 0 8.954 0 20c0 14 20 28 20 28s20-14 20-28C40 8.954 31.046 0 20 0z" fill="#FF6B00"/>
                                <circle cx="20" cy="18" r="10" fill="white"/>
                                <text x="20" y="22" text-anchor="middle" font-size="12" fill="#FF6B00">🍽️</text>
                            </svg>
                        `),
                        scaledSize: new mapsApi.Size(40, 48),
                        anchor: new mapsApi.Point(20, 48)
                    },
                    title: order.restaurant?.name || 'Restaurant'
                });
            }
        }

        // Customer marker
        if (order.delivery_address?.lat && order.delivery_address?.lng) {
            const customerPos = { lat: order.delivery_address.lat, lng: order.delivery_address.lng };
            bounds.extend(customerPos);

            if (markersRef.current.customer) {
                markersRef.current.customer.setPosition(customerPos);
            } else {
                markersRef.current.customer = new mapsApi.Marker({
                    position: customerPos,
                    map: mapInstanceRef.current,
                    icon: {
                        url: 'data:image/svg+xml,' + encodeURIComponent(`
                            <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 0C8.954 0 0 8.954 0 20c0 14 20 28 20 28s20-14 20-28C40 8.954 31.046 0 20 0z" fill="#22C55E"/>
                                <circle cx="20" cy="18" r="10" fill="white"/>
                                <text x="20" y="22" text-anchor="middle" font-size="12" fill="#22C55E">🏠</text>
                            </svg>
                        `),
                        scaledSize: new mapsApi.Size(40, 48),
                        anchor: new mapsApi.Point(20, 48)
                    },
                    title: 'Delivery Location'
                });
            }
        }

        // Fit bounds
        if (!bounds.isEmpty()) {
            mapInstanceRef.current.fitBounds(bounds, { padding: 60 });
        }

        // Draw route
        if (restaurantLat && restaurantLng && order.delivery_address?.lat) {
            const directionsService = new mapsApi.DirectionsService();
            
            // Determine route based on status
            let origin, destination, waypoints = [];
            
            if (partnerLocation?.lat && ['picked_up', 'out_for_delivery'].includes(order.status)) {
                // Partner to customer
                origin = { lat: partnerLocation.lat, lng: partnerLocation.lng };
                destination = { lat: order.delivery_address.lat, lng: order.delivery_address.lng };
            } else if (partnerLocation?.lat && ['assigned', 'confirmed', 'preparing', 'ready'].includes(order.status)) {
                // Partner to restaurant to customer
                origin = { lat: partnerLocation.lat, lng: partnerLocation.lng };
                waypoints = [{ location: { lat: restaurantLat, lng: restaurantLng }, stopover: true }];
                destination = { lat: order.delivery_address.lat, lng: order.delivery_address.lng };
            } else {
                // Restaurant to customer
                origin = { lat: restaurantLat, lng: restaurantLng };
                destination = { lat: order.delivery_address.lat, lng: order.delivery_address.lng };
            }

            directionsService.route({
                origin,
                destination,
                waypoints,
                travelMode: mapsApi.TravelMode.DRIVING,
                optimizeWaypoints: true
            }, (result, status) => {
                if (status === 'OK' && directionsRendererRef.current) {
                    directionsRendererRef.current.setDirections(result);
                    
                    // Update ETA from directions
                    if (result.routes[0]?.legs) {
                        const totalDuration = result.routes[0].legs.reduce((sum, leg) => sum + leg.duration.value, 0);
                        const totalDistance = result.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0);
                        setEta(Math.round(totalDuration / 60));
                        setDistance((totalDistance / 1000).toFixed(1));
                    }
                }
            });
        }
    }, [mapsApi, order, partnerLocation]);

    // Update delivery partner marker with smooth live-movement animation
    useEffect(() => {
        if (!mapsApi || !mapInstanceRef.current || !partnerLocation?.lat) return;

        try {
            const targetPos = { lat: partnerLocation.lat, lng: partnerLocation.lng };
            const heading = partnerLocation.heading || 0;

            // Create marker with arrow icon (rotates with heading)
            const makeIcon = (rot) => ({
                path: 'M12 0 L24 20 L12 15 L0 20 Z', // arrow pointing up
                fillColor: '#0EA5E9',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
                scale: 1.2,
                rotation: rot,
                anchor: new mapsApi.Point(12, 10)
            });

            if (!partnerMarkerRef.current) {
                // First placement — no animation
                partnerMarkerRef.current = new mapsApi.Marker({
                    position: targetPos,
                    map: mapInstanceRef.current,
                    icon: makeIcon(heading),
                    title: order?.delivery_partner?.partner_name || 'Delivery Partner',
                    zIndex: 1000,
                    optimized: false
                });
                return;
            }

            // Smooth animate from current position to new position (over ~1s)
            const startPos = partnerMarkerRef.current.getPosition();
            // Guard: getPosition() can return undefined if marker wasn't rendered
            // (e.g. map tiles blocked by API key restriction). Fall back to snap.
            if (!startPos || typeof startPos.lat !== 'function') {
                partnerMarkerRef.current.setPosition(targetPos);
                partnerMarkerRef.current.setIcon(makeIcon(heading));
                return;
            }

            const startLat = startPos.lat();
            const startLng = startPos.lng();
            const dLat = targetPos.lat - startLat;
            const dLng = targetPos.lng - startLng;

            // Skip tiny jumps
            if (Math.abs(dLat) < 1e-7 && Math.abs(dLng) < 1e-7) {
                partnerMarkerRef.current.setIcon(makeIcon(heading));
                return;
            }

            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            const duration = 1000;
            const startTime = performance.now();

            const step = (now) => {
                try {
                    const elapsed = now - startTime;
                    const t = Math.min(elapsed / duration, 1);
                    // ease-out
                    const ease = 1 - Math.pow(1 - t, 3);
                    const curLat = startLat + dLat * ease;
                    const curLng = startLng + dLng * ease;
                    if (partnerMarkerRef.current) {
                        partnerMarkerRef.current.setPosition({ lat: curLat, lng: curLng });
                        partnerMarkerRef.current.setIcon(makeIcon(heading));
                    }
                    if (t < 1) {
                        animationRef.current = requestAnimationFrame(step);
                    }
                } catch (err) {
                    console.warn('Partner marker animation step skipped:', err?.message);
                }
            };
            animationRef.current = requestAnimationFrame(step);
        } catch (err) {
            console.warn('Partner marker effect skipped:', err?.message);
        }
    }, [mapsApi, partnerLocation, order?.delivery_partner]);

    // Cleanup animation on unmount
    useEffect(() => {
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, []);

    // Recenter map on partner
    const handleRecenterOnPartner = useCallback(() => {
        if (!mapInstanceRef.current || !partnerLocation?.lat) return;
        mapInstanceRef.current.panTo({ lat: partnerLocation.lat, lng: partnerLocation.lng });
        mapInstanceRef.current.setZoom(16);
    }, [partnerLocation]);

    // Initial fetch and polling
    useEffect(() => {
        fetchOrder();
    }, [fetchOrder]);

    useEffect(() => {
        if (!order) return;
        
        // Poll for updates every 5 seconds for responsive live movement
        const interval = setInterval(() => {
            fetchOrder();
            fetchLiveTracking();
        }, 5000);

        return () => clearInterval(interval);
    }, [order, fetchOrder, fetchLiveTracking]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchOrder();
        fetchLiveTracking();
    };

    const getStatusInfo = (status) => {
        const statuses = {
            pending: { label: 'Order Placed', color: 'bg-yellow-500', icon: Clock, step: 1 },
            confirmed: { label: 'Order Confirmed', color: 'bg-blue-500', icon: CheckCircle, step: 2 },
            preparing: { label: 'Preparing', color: 'bg-orange-500', icon: Utensils, step: 3 },
            ready: { label: 'Ready for Pickup', color: 'bg-purple-500', icon: Package, step: 4 },
            picked_up: { label: 'Out for Delivery', color: 'bg-cyan-500', icon: Bike, step: 5 },
            out_for_delivery: { label: 'Out for Delivery', color: 'bg-cyan-500', icon: Bike, step: 5 },
            delivered: { label: 'Delivered', color: 'bg-green-500', icon: CheckCircle, step: 6 },
            cancelled: { label: 'Cancelled', color: 'bg-red-500', icon: Clock, step: 0 }
        };
        return statuses[status] || statuses.pending;
    };

    // Generate Google Maps URL for fallback
    const getGoogleMapsUrl = () => {
        const restaurantLat = order?.restaurant_lat || order?.restaurant?.lat;
        const restaurantLng = order?.restaurant_lng || order?.restaurant?.lng;
        const customerLat = order?.delivery_address?.lat;
        const customerLng = order?.delivery_address?.lng;
        
        if (partnerLocation?.lat && customerLat) {
            return `https://www.google.com/maps/dir/${partnerLocation.lat},${partnerLocation.lng}/${customerLat},${customerLng}`;
        }
        if (restaurantLat && customerLat) {
            return `https://www.google.com/maps/dir/${restaurantLat},${restaurantLng}/${customerLat},${customerLng}`;
        }
        return null;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading order details...</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Package size={64} className="mx-auto text-gray-400 mb-4" />
                    <h2 className="text-xl font-bold mb-2">Order Not Found</h2>
                    <p className="text-gray-600 mb-4">The order you're looking for doesn't exist</p>
                    <Link to="/orders">
                        <Button>View All Orders</Button>
                    </Link>
                </div>
            </div>
        );
    }

    const statusInfo = getStatusInfo(order.status);
    const isDelivered = order.status === 'delivered';
    const isCancelled = order.status === 'cancelled';
    const hasPartner = order.delivery_partner && ['assigned', 'picked_up', 'out_for_delivery'].includes(order.status);
    const isPickedUp = ['picked_up', 'out_for_delivery'].includes(order.status);
    
    // Calculate remaining prep time (only before pickup)
    const prepTime = order.estimated_prep_time ?? 20; // default 20 mins
    let remainingPrepMinutes = 0;
    if (!isPickedUp && !isDelivered && !isCancelled) {
        if (order.confirmed_at) {
            const elapsedMs = Date.now() - new Date(order.confirmed_at).getTime();
            const elapsedMins = Math.floor(elapsedMs / 60000);
            remainingPrepMinutes = Math.max(0, prepTime - elapsedMins);
        } else {
            // Not yet confirmed — show full prep time
            remainingPrepMinutes = prepTime;
        }
    }
    
    // Combined "Arriving in" time
    // - If picked up: just live partner→customer ETA (from state `eta`)
    // - Otherwise: remaining prep + delivery leg ETA (live `eta` if available, else 20 min default)
    const deliveryLegEta = eta ?? 20; // from Google Maps directions or default
    const totalEtaMinutes = isPickedUp 
        ? (eta ?? order.estimated_delivery_time)
        : (remainingPrepMinutes + deliveryLegEta);
    const etaFormatted = formatETA(totalEtaMinutes);
    const mapsUrl = getGoogleMapsUrl();

    return (
        <div className="min-h-screen bg-gray-50" data-testid="order-tracking-page">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
                            <ArrowLeft size={20} />
                        </Button>
                        <div>
                            <h1 className="font-semibold">Track Order</h1>
                            <p className="text-xs text-gray-500">#{orderId}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing}>
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    </Button>
                </div>
            </div>

            {/* Map Section - Full width like Swiggy */}
            <div className="relative">
                {mapError ? (
                    <a 
                        href={mapsUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block h-[35vh] bg-gradient-to-br from-orange-100 to-orange-50 flex flex-col items-center justify-center cursor-pointer hover:from-orange-200 hover:to-orange-100 transition-colors"
                    >
                        <div className="w-16 h-16 bg-orange-200 rounded-full flex items-center justify-center mb-3">
                            <MapPin size={32} className="text-orange-600" />
                        </div>
                        <p className="text-gray-700 font-medium mb-1">Map temporarily unavailable</p>
                        <p className="text-orange-600 flex items-center gap-1 text-sm">
                            <ExternalLink size={14} /> Tap to view route in Google Maps
                        </p>
                    </a>
                ) : (
                    <div ref={mapRef} className="h-[35vh] w-full bg-gray-200" data-testid="tracking-map" />
                )}

                {/* ETA Overlay */}
                {!isDelivered && !isCancelled && etaFormatted && (
                    <div className="absolute top-4 left-4 bg-white rounded-xl shadow-lg p-3 max-w-[200px]" data-testid="eta-overlay">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Arriving in</p>
                        <p className="text-2xl font-bold text-orange-600">
                            {etaFormatted.value} <span className="text-lg">{etaFormatted.unit}</span>
                        </p>
                        {!isPickedUp && remainingPrepMinutes > 0 && (
                            <p className="text-[10px] text-gray-500 mt-0.5" data-testid="eta-breakdown">
                                Prep {remainingPrepMinutes}m + Delivery ~{deliveryLegEta}m
                            </p>
                        )}
                        {etaFormatted.isEstimate && (
                            <p className="text-xs text-gray-400">Estimated</p>
                        )}
                        {distance && isPickedUp && (
                            <p className="text-xs text-gray-500">{distance} km away</p>
                        )}
                    </div>
                )}

                {/* Map action buttons - top right */}
                {!mapError && (
                    <div className="absolute top-4 right-4 flex flex-col gap-2">
                        {/* Recenter on partner (only when partner is live) */}
                        {partnerLocation?.lat && (
                            <button
                                onClick={handleRecenterOnPartner}
                                className="bg-white rounded-lg shadow-lg p-2 hover:bg-gray-50 transition-colors"
                                title="Recenter on delivery partner"
                                data-testid="recenter-partner-btn"
                            >
                                <Locate size={20} className="text-sky-600" />
                            </button>
                        )}
                        {/* Open in external Google Maps */}
                        {mapsUrl && (
                            <a 
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-white rounded-lg shadow-lg p-2 hover:bg-gray-50 transition-colors"
                                title="Open in Google Maps"
                                data-testid="open-in-maps-btn"
                            >
                                <ExternalLink size={20} className="text-gray-600" />
                            </a>
                        )}
                    </div>
                )}

                {/* Live indicator when partner is moving */}
                {partnerLocation?.lat && isPickedUp && (
                    <div className="absolute top-4 right-20 bg-white rounded-full shadow-lg px-3 py-1.5 flex items-center gap-2" data-testid="live-indicator">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        <span className="text-xs font-semibold text-gray-700">LIVE</span>
                    </div>
                )}

                {/* Status Badge Overlay */}
                <div className="absolute bottom-4 left-4 right-4">
                    <div className={`${statusInfo.color} text-white rounded-xl p-4 shadow-lg`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                <statusInfo.icon size={20} />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold">{statusInfo.label}</p>
                                <p className="text-sm text-white/80">
                                    {order.status === 'preparing' && 'Your food is being prepared with love'}
                                    {order.status === 'ready' && 'Waiting for delivery partner to pick up'}
                                    {(order.status === 'picked_up' || order.status === 'out_for_delivery') && `${order.delivery_partner?.partner_name || 'Driver'} is on the way`}
                                    {order.status === 'delivered' && 'Enjoy your meal!'}
                                    {order.status === 'confirmed' && 'Restaurant has accepted your order'}
                                    {order.status === 'pending' && 'Waiting for restaurant confirmation'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Order Progress Timeline */}
            <div className="bg-white border-b">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <div className="flex justify-between relative">
                        {/* Progress Line */}
                        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200">
                            <div 
                                className="h-full bg-orange-500 transition-all duration-500"
                                style={{ width: `${Math.max(0, (statusInfo.step - 1) / 5) * 100}%` }}
                            />
                        </div>

                        {[
                            { status: 'pending', label: 'Placed', icon: Clock },
                            { status: 'confirmed', label: 'Confirmed', icon: CheckCircle },
                            { status: 'preparing', label: 'Preparing', icon: Utensils },
                            { status: 'ready', label: 'Ready', icon: Package },
                            { status: 'picked_up', label: 'On Way', icon: Bike },
                            { status: 'delivered', label: 'Delivered', icon: Home }
                        ].map((step, idx) => {
                            const isActive = statusInfo.step > idx;
                            const isCurrent = statusInfo.step === idx + 1;
                            const Icon = step.icon;
                            
                            return (
                                <div key={step.status} className="flex flex-col items-center relative z-10">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                        isActive ? 'bg-orange-500 text-white' : 
                                        isCurrent ? 'bg-orange-500 text-white ring-4 ring-orange-200' : 
                                        'bg-gray-200 text-gray-400'
                                    }`}>
                                        <Icon size={14} />
                                    </div>
                                    <span className={`text-xs mt-2 text-center ${isActive || isCurrent ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>
                                        {step.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Delivery Partner Card */}
            {hasPartner && (
                <div className="bg-white border-b">
                    <div className="max-w-4xl mx-auto px-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-cyan-100 rounded-full flex items-center justify-center">
                                    <Bike size={28} className="text-cyan-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-lg">{order.delivery_partner.partner_name || 'Driver'}</p>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Badge variant="outline" className="text-xs">
                                            {order.delivery_partner.vehicle || 'Bike'}
                                        </Badge>
                                        {partnerLocation && (
                                            <span className="flex items-center gap-1 text-green-600">
                                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                                Live
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {order.delivery_partner.partner_phone && (
                                    <a href={`tel:${order.delivery_partner.partner_phone}`}>
                                        <Button size="icon" className="rounded-full bg-green-500 hover:bg-green-600 h-12 w-12">
                                            <Phone size={20} />
                                        </Button>
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Details */}
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
                {/* Restaurant Info */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Store size={24} className="text-orange-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold">{order.restaurant?.name || 'Restaurant'}</p>
                            <p className="text-sm text-gray-500 truncate">{order.restaurant?.address}</p>
                        </div>
                        <ChevronRight size={20} className="text-gray-400 flex-shrink-0" />
                    </div>
                </div>

                {/* Delivery Address */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <MapPin size={24} className="text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold">{order.delivery_address?.label || 'Delivery Address'}</p>
                            <p className="text-sm text-gray-500">{order.delivery_address?.full_address}</p>
                        </div>
                    </div>
                </div>

                {/* Order Items */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <h3 className="font-semibold mb-3">
                        {order.is_custom_order ? 'Your Order Request' : 'Order Items'}
                    </h3>
                    {order.is_custom_order && order.food_items_description ? (
                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 whitespace-pre-wrap text-sm text-gray-700" data-testid="custom-order-items-description">
                            {order.food_items_description}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {order.items?.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 bg-gray-100 rounded text-xs flex items-center justify-center font-medium">
                                            {item.quantity}x
                                        </span>
                                        <span className="text-sm">{item.name}</span>
                                    </div>
                                    <span className="text-sm font-medium">₹{item.price * item.quantity}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {order.total_amount ? (
                        <div className="border-t mt-4 pt-4 flex justify-between font-semibold">
                            <span>{order.is_custom_order ? 'Estimated Total' : 'Total'}</span>
                            <span className="text-orange-600">₹{order.total_amount}</span>
                        </div>
                    ) : order.is_custom_order && (
                        <p className="text-xs text-gray-500 mt-3">Total will be confirmed once the shop accepts your order.</p>
                    )}
                </div>

                {/* Order Time Info */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Order placed at</span>
                        <span className="font-medium">
                            {order.created_at && format(new Date(order.created_at), 'h:mm a, MMM d')}
                        </span>
                    </div>
                    {order.delivered_at && (
                        <div className="flex items-center justify-between text-sm mt-2">
                            <span className="text-gray-500">Delivered at</span>
                            <span className="font-medium text-green-600">
                                {format(new Date(order.delivered_at), 'h:mm a')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Help Section */}
                <div className="bg-orange-50 rounded-xl p-4">
                    <p className="text-sm text-orange-800 font-medium mb-2">Need help with your order?</p>
                    <div className="flex gap-2">
                        <a href="tel:9566722970" className="flex-1">
                            <Button variant="outline" className="w-full text-orange-600 border-orange-200">
                                <Phone size={16} className="mr-2" />
                                Call Support
                            </Button>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
