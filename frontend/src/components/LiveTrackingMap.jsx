import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Bike, Store, Navigation, RefreshCw, Clock, Route, Map, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Load Google Maps script with dynamic API key
const loadGoogleMapsScript = async () => {
    // If already loaded, return
    if (window.google && window.google.maps) {
        return window.google.maps;
    }

    // Check for existing script
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
        return new Promise((resolve) => {
            if (window.google && window.google.maps) {
                resolve(window.google.maps);
            } else {
                existingScript.addEventListener('load', () => resolve(window.google.maps));
            }
        });
    }

    // Fetch API key from backend
    let apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    try {
        const response = await axios.get(`${API}/api/google-maps/config`);
        if (response.data?.api_key) {
            apiKey = response.data.api_key;
        }
    } catch (e) {
        console.log('Using env API key');
    }

    if (!apiKey) {
        throw new Error('Google Maps API key not available');
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            if (window.google && window.google.maps) {
                resolve(window.google.maps);
            } else {
                reject(new Error('Google Maps failed to load'));
            }
        };
        script.onerror = () => reject(new Error('Failed to load Google Maps script'));
        document.head.appendChild(script);
    });
};

export default function LiveTrackingMap({ 
    orderId, 
    userId,
    restaurantLocation,
    customerLocation,
    initialPartnerLocation,
    orderStatus,
    className = ""
}) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const directionsRendererRef = useRef(null);
    const markersRef = useRef({});
    const [mapsApi, setMapsApi] = useState(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    
    const [partnerLocation, setPartnerLocation] = useState(initialPartnerLocation);
    const [eta, setEta] = useState(null);
    const [distance, setDistance] = useState(null);
    const [wsConnected, setWsConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [mapError, setMapError] = useState(null);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const updateIntervalRef = useRef(null);

    // Initialize Google Map
    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        loadGoogleMapsScript()
            .then((googleMaps) => {
                setMapsApi(googleMaps);
                setMapError(null);

                // Calculate initial center
                const centerLat = customerLocation?.lat || restaurantLocation?.lat || 13.0827;
                const centerLng = customerLocation?.lng || restaurantLocation?.lng || 80.2707;

                mapInstanceRef.current = new googleMaps.Map(mapRef.current, {
                    center: { lat: centerLat, lng: centerLng },
                    zoom: 14,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: true,
                    zoomControl: true,
                    styles: [
                        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
                    ]
                });

                // Add traffic layer
                const trafficLayer = new googleMaps.TrafficLayer();
                trafficLayer.setMap(mapInstanceRef.current);

                // Initialize directions renderer
                directionsRendererRef.current = new googleMaps.DirectionsRenderer({
                    map: mapInstanceRef.current,
                    suppressMarkers: true,
                    polylineOptions: {
                        strokeColor: '#3b82f6',
                        strokeWeight: 5,
                        strokeOpacity: 0.8
                    }
                });

                setMapLoaded(true);
            })
            .catch(err => {
                console.error('Failed to load Google Maps:', err);
                setMapError('Unable to load map. Fetching route info from server...');
                // Fetch distance/ETA from backend as fallback
                fetchLocation();
            });

        return () => {
            // Cleanup markers
            Object.values(markersRef.current).forEach(marker => marker?.setMap(null));
            markersRef.current = {};
        };
    }, [customerLocation, restaurantLocation]);

    // Create or update markers
    const updateMarkers = useCallback(() => {
        if (!mapInstanceRef.current || !mapsApi) return;

        // Restaurant marker
        if (restaurantLocation?.lat && restaurantLocation?.lng) {
            if (markersRef.current.restaurant) {
                markersRef.current.restaurant.setPosition({
                    lat: restaurantLocation.lat,
                    lng: restaurantLocation.lng
                });
            } else {
                markersRef.current.restaurant = new mapsApi.Marker({
                    position: { lat: restaurantLocation.lat, lng: restaurantLocation.lng },
                    map: mapInstanceRef.current,
                    icon: {
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                                <circle cx="20" cy="20" r="18" fill="#f97316" stroke="white" stroke-width="3"/>
                                <text x="20" y="26" text-anchor="middle" fill="white" font-size="18" font-family="Arial">🍽️</text>
                            </svg>
                        `),
                        scaledSize: new mapsApi.Size(40, 40),
                        anchor: new mapsApi.Point(20, 20)
                    },
                    title: 'Restaurant',
                    zIndex: 100
                });

                const infoWindow = new mapsApi.InfoWindow({
                    content: '<div style="padding:8px;font-weight:bold;">Restaurant</div>'
                });
                markersRef.current.restaurant.addListener('click', () => {
                    infoWindow.open(mapInstanceRef.current, markersRef.current.restaurant);
                });
            }
        }

        // Customer marker
        if (customerLocation?.lat && customerLocation?.lng) {
            if (markersRef.current.customer) {
                markersRef.current.customer.setPosition({
                    lat: customerLocation.lat,
                    lng: customerLocation.lng
                });
            } else {
                markersRef.current.customer = new mapsApi.Marker({
                    position: { lat: customerLocation.lat, lng: customerLocation.lng },
                    map: mapInstanceRef.current,
                    icon: {
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                                <circle cx="20" cy="20" r="18" fill="#22c55e" stroke="white" stroke-width="3"/>
                                <text x="20" y="26" text-anchor="middle" fill="white" font-size="18" font-family="Arial">📍</text>
                            </svg>
                        `),
                        scaledSize: new mapsApi.Size(40, 40),
                        anchor: new mapsApi.Point(20, 20)
                    },
                    title: 'Delivery Location',
                    zIndex: 100
                });

                const infoWindow = new mapsApi.InfoWindow({
                    content: '<div style="padding:8px;font-weight:bold;">Your Location</div>'
                });
                markersRef.current.customer.addListener('click', () => {
                    infoWindow.open(mapInstanceRef.current, markersRef.current.customer);
                });
            }
        }

        // Delivery partner marker (animated)
        if (partnerLocation?.lat && partnerLocation?.lng) {
            if (markersRef.current.partner) {
                // Animate marker movement
                const currentPos = markersRef.current.partner.getPosition();
                const newPos = new mapsApi.LatLng(partnerLocation.lat, partnerLocation.lng);
                
                if (currentPos) {
                    // Smooth animation
                    let step = 0;
                    const numSteps = 20;
                    const stepLat = (newPos.lat() - currentPos.lat()) / numSteps;
                    const stepLng = (newPos.lng() - currentPos.lng()) / numSteps;
                    
                    const animateMarker = () => {
                        step++;
                        if (step <= numSteps) {
                            const lat = currentPos.lat() + stepLat * step;
                            const lng = currentPos.lng() + stepLng * step;
                            markersRef.current.partner.setPosition({ lat, lng });
                            requestAnimationFrame(animateMarker);
                        }
                    };
                    animateMarker();
                } else {
                    markersRef.current.partner.setPosition(newPos);
                }
            } else {
                markersRef.current.partner = new mapsApi.Marker({
                    position: { lat: partnerLocation.lat, lng: partnerLocation.lng },
                    map: mapInstanceRef.current,
                    icon: {
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
                                <circle cx="24" cy="24" r="20" fill="#3b82f6" stroke="white" stroke-width="4"/>
                                <text x="24" y="30" text-anchor="middle" fill="white" font-size="20" font-family="Arial">🛵</text>
                            </svg>
                        `),
                        scaledSize: new mapsApi.Size(48, 48),
                        anchor: new mapsApi.Point(24, 24)
                    },
                    title: 'Delivery Partner',
                    zIndex: 200,
                    animation: mapsApi.Animation.DROP
                });

                const infoWindow = new mapsApi.InfoWindow({
                    content: '<div style="padding:8px;font-weight:bold;">Delivery Partner</div>'
                });
                markersRef.current.partner.addListener('click', () => {
                    infoWindow.open(mapInstanceRef.current, markersRef.current.partner);
                });
            }
        }
    }, [mapsApi, restaurantLocation, customerLocation, partnerLocation]);

    // Update route and directions
    const updateRoute = useCallback(async () => {
        if (!mapInstanceRef.current || !mapsApi || !directionsRendererRef.current) return;

        // Determine route based on order status
        let origin, destination, waypoints = [];
        
        if (partnerLocation?.lat && customerLocation?.lat) {
            // If partner is active, show partner -> customer route
            origin = { lat: partnerLocation.lat, lng: partnerLocation.lng };
            destination = { lat: customerLocation.lat, lng: customerLocation.lng };
        } else if (restaurantLocation?.lat && customerLocation?.lat) {
            // Otherwise show restaurant -> customer route
            origin = { lat: restaurantLocation.lat, lng: restaurantLocation.lng };
            destination = { lat: customerLocation.lat, lng: customerLocation.lng };
        } else {
            return;
        }

        const directionsService = new mapsApi.DirectionsService();
        
        try {
            const result = await directionsService.route({
                origin,
                destination,
                waypoints,
                travelMode: mapsApi.TravelMode.DRIVING,
                drivingOptions: {
                    departureTime: new Date(),
                    trafficModel: 'bestguess'
                }
            });

            directionsRendererRef.current.setDirections(result);

            // Extract ETA and distance
            if (result.routes[0]?.legs[0]) {
                const leg = result.routes[0].legs[0];
                setEta(Math.round(leg.duration_in_traffic?.value / 60) || Math.round(leg.duration.value / 60));
                setDistance((leg.distance.value / 1000).toFixed(1));
            }

            // Fit bounds to show entire route
            const bounds = new mapsApi.LatLngBounds();
            if (restaurantLocation?.lat) bounds.extend({ lat: restaurantLocation.lat, lng: restaurantLocation.lng });
            if (customerLocation?.lat) bounds.extend({ lat: customerLocation.lat, lng: customerLocation.lng });
            if (partnerLocation?.lat) bounds.extend({ lat: partnerLocation.lat, lng: partnerLocation.lng });
            mapInstanceRef.current.fitBounds(bounds, { padding: 60 });

        } catch (error) {
            console.error('Directions request failed:', error);
            // Fallback: fetch from backend
            try {
                const response = await axios.get(`${API}/api/google-maps/distance`, {
                    params: {
                        origin_lat: origin.lat,
                        origin_lng: origin.lng,
                        dest_lat: destination.lat,
                        dest_lng: destination.lng
                    }
                });
                if (response.data) {
                    setEta(Math.round(response.data.duration_minutes || 0));
                    setDistance(response.data.distance_km);
                }
            } catch (e) {
                console.error('Backend distance request failed:', e);
            }
        }
    }, [mapsApi, restaurantLocation, customerLocation, partnerLocation]);

    // Update markers and route when locations change
    useEffect(() => {
        if (mapLoaded) {
            updateMarkers();
            updateRoute();
        }
    }, [mapLoaded, updateMarkers, updateRoute, partnerLocation]);

    // Connect to WebSocket for real-time updates
    const connectWebSocket = useCallback(() => {
        if (!userId || !orderId) return;

        const wsProtocol = API.startsWith('https') ? 'wss' : 'ws';
        const wsHost = API.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}://${wsHost}/api/ws/${userId}?user_type=customer`;
        
        try {
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                console.log('WebSocket connected for live tracking');
                setWsConnected(true);
                if (wsRef.current) wsRef.current.send('ping');
            };

            wsRef.current.onmessage = (event) => {
                try {
                    if (event.data === 'pong') return;
                    
                    const data = JSON.parse(event.data);
                    if (data.type === 'location_update' && data.order_id === orderId) {
                        setPartnerLocation({
                            lat: data.payload.lat,
                            lng: data.payload.lng,
                            heading: data.payload.heading
                        });
                        if (data.payload.eta_minutes) {
                            setEta(data.payload.eta_minutes);
                        }
                        setLastUpdate(new Date());
                    }
                } catch (e) {
                    console.log('WebSocket message:', event.data);
                }
            };

            wsRef.current.onclose = () => {
                console.log('WebSocket disconnected');
                setWsConnected(false);
                reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('WebSocket connection error:', error);
        }
    }, [userId, orderId]);

    // Fetch location periodically as fallback
    const fetchLocation = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/api/tracking/live/${orderId}`);
            if (response.data?.partner?.location) {
                setPartnerLocation(response.data.partner.location);
                if (response.data.eta?.minutes) {
                    setEta(response.data.eta.minutes);
                }
                setLastUpdate(new Date());
            }
        } catch (error) {
            console.error('Failed to fetch location:', error);
        }
    }, [orderId]);

    useEffect(() => {
        connectWebSocket();
        fetchLocation(); // Initial fetch
        
        // Poll every 15 seconds as fallback
        updateIntervalRef.current = setInterval(fetchLocation, 15000);
        
        // Heartbeat ping every 25 seconds
        const heartbeatInterval = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send('ping');
            }
        }, 25000);

        return () => {
            if (wsRef.current) wsRef.current.close();
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
            clearInterval(heartbeatInterval);
        };
    }, [connectWebSocket, fetchLocation]);

    // Show preparing state if order is not yet picked up
    const shouldShowMap = ['picked_up', 'out_for_delivery', 'ready'].includes(orderStatus) || partnerLocation?.lat;

    if (!shouldShowMap) {
        return (
            <div className={`bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-8 text-center ${className}`}>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center animate-pulse">
                        <Store className="w-10 h-10 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800">Preparing Your Order</h3>
                    <p className="text-gray-600 max-w-sm">Your order is being prepared at the restaurant. Live tracking will start once the delivery partner picks up your order.</p>
                    <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-100 px-4 py-2 rounded-full">
                        <Clock className="w-4 h-4" />
                        <span>Estimated pickup: 10-15 mins</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg ${className}`}>
            {/* Header with ETA */}
            <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Navigation className="w-5 h-5" />
                        <span className="font-semibold text-lg">Live Tracking</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`}></div>
                        <span className="text-sm">{wsConnected ? 'Live' : 'Connecting...'}</span>
                    </div>
                </div>
                
                {/* ETA and Distance Info */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/20 backdrop-blur rounded-xl p-3">
                        <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
                            <Clock className="w-4 h-4" />
                            <span>ETA</span>
                        </div>
                        <p className="text-2xl font-bold">{eta ? `${eta} mins` : '--'}</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur rounded-xl p-3">
                        <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
                            <Route className="w-4 h-4" />
                            <span>Distance</span>
                        </div>
                        <p className="text-2xl font-bold">{distance ? `${distance} km` : '--'}</p>
                    </div>
                </div>
            </div>

            {/* Google Map or Fallback */}
            {mapError ? (
                <div className="w-full h-80 bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center justify-center gap-4 p-6">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center animate-pulse">
                        <Bike className="w-10 h-10 text-blue-500" />
                    </div>
                    <div className="text-center">
                        <h3 className="font-semibold text-gray-800 mb-1">Delivery Partner on the way!</h3>
                        <p className="text-gray-500 text-sm mb-4">Map loading issue - tracking via server</p>
                        {(eta || distance) && (
                            <div className="flex gap-4 justify-center">
                                {eta && (
                                    <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
                                        <p className="text-xs text-gray-500">ETA</p>
                                        <p className="text-lg font-bold text-blue-600">{eta} mins</p>
                                    </div>
                                )}
                                {distance && (
                                    <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
                                        <p className="text-xs text-gray-500">Distance</p>
                                        <p className="text-lg font-bold text-green-600">{distance} km</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    {partnerLocation?.lat && (
                        <a 
                            href={`https://www.google.com/maps?q=${partnerLocation.lat},${partnerLocation.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                        >
                            <ExternalLink className="w-4 h-4" />
                            View Partner Location
                        </a>
                    )}
                </div>
            ) : (
                <div ref={mapRef} className="w-full h-80 bg-gray-100" />
            )}

            {/* Legend and Controls */}
            <div className="p-4 border-t border-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Legend */}
                    <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-1.5 text-sm">
                            <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs">🍽️</div>
                            <span className="text-gray-600">Restaurant</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">🛵</div>
                            <span className="text-gray-600">Partner</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">📍</div>
                            <span className="text-gray-600">You</span>
                        </div>
                    </div>

                    {/* Refresh Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            fetchLocation();
                            updateRoute();
                        }}
                        className="flex items-center gap-1.5"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </Button>
                </div>

                {/* Last Update */}
                {lastUpdate && (
                    <p className="text-xs text-gray-400 mt-2">
                        Last updated: {lastUpdate.toLocaleTimeString()}
                    </p>
                )}
            </div>
        </div>
    );
}
