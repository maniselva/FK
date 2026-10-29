import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { MapPin } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Load Google Maps script dynamically with API key from backend
const loadGoogleMapsScript = async () => {
    if (window.google && window.google.maps) {
        return window.google.maps;
    }

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

    // Fetch API key from backend or use env
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

export function GoogleMap({ 
    center = { lat: 11.9388, lng: 79.8649 }, // Default: Salem, TN area
    zoom = 13,
    markers = [],
    route = null,
    onMapClick = null,
    className = '',
    showUserLocation = false,
    interactive = true
}) {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markersRef = useRef([]);
    const directionsRenderer = useRef(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [mapsApi, setMapsApi] = useState(null);

    // Initialize map
    useEffect(() => {
        if (map.current) return;
        if (!mapContainer.current) return;

        loadGoogleMapsScript()
            .then((googleMaps) => {
                setMapsApi(googleMaps);
                setMapError(null);
                
                map.current = new googleMaps.Map(mapContainer.current, {
                    center: center,
                    zoom: zoom,
                    disableDefaultUI: !interactive,
                    zoomControl: interactive,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: interactive,
                    styles: [
                        {
                            featureType: "poi",
                            elementType: "labels",
                            stylers: [{ visibility: "off" }]
                        }
                    ]
                });

                // Initialize directions renderer
                directionsRenderer.current = new googleMaps.DirectionsRenderer({
                    suppressMarkers: true,
                    polylineOptions: {
                        strokeColor: '#3b82f6',
                        strokeWeight: 5,
                        strokeOpacity: 0.8
                    }
                });
                directionsRenderer.current.setMap(map.current);

                // Handle map click
                if (onMapClick) {
                    map.current.addListener('click', (e) => {
                        onMapClick({
                            lat: e.latLng.lat(),
                            lng: e.latLng.lng()
                        });
                    });
                }

                // Show user location if enabled
                if (showUserLocation && navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const userPos = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude
                            };
                            
                            new googleMaps.Marker({
                                position: userPos,
                                map: map.current,
                                icon: {
                                    path: googleMaps.SymbolPath.CIRCLE,
                                    scale: 10,
                                    fillColor: '#4285F4',
                                    fillOpacity: 1,
                                    strokeColor: '#ffffff',
                                    strokeWeight: 3
                                },
                                title: 'Your Location'
                            });
                        },
                        () => {
                            console.log('Geolocation failed');
                        }
                    );
                }

                setMapLoaded(true);
            })
            .catch((error) => {
                console.error('Failed to load Google Maps:', error);
                setMapError('Unable to load map');
            });

        return () => {
            if (map.current) {
                // Cleanup markers
                markersRef.current.forEach(marker => marker.setMap(null));
                markersRef.current = [];
            }
        };
    }, [center, zoom]);

    // Render fallback if map error
    if (mapError) {
        return (
            <div className={`relative ${className}`}>
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center gap-3 p-6">
                    <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-gray-500" />
                    </div>
                    <p className="text-gray-500 text-sm text-center">{mapError}</p>
                    {markers.length > 0 && (
                        <a
                            href={`https://www.google.com/maps?q=${markers[0].lat},${markers[0].lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 text-sm hover:underline"
                        >
                            Open in Google Maps
                        </a>
                    )}
                </div>
            </div>
        );
    }

    // Update markers
    useEffect(() => {
        if (!map.current || !mapLoaded || !mapsApi) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];

        // Add new markers
        const bounds = new mapsApi.LatLngBounds();
        
        markers.forEach(markerData => {
            let icon;
            
            // Set marker icon based on type
            if (markerData.type === 'restaurant') {
                icon = {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                            <circle cx="16" cy="16" r="14" fill="#f97316" stroke="white" stroke-width="3"/>
                            <path d="M14 12H12V6H10v6H8V6H6v6c0 1.7 1.3 3.1 3 3.2V22h2v-6.8c1.7-.1 3-1.5 3-3.2V6h-2v6zm4-2.4v6.4h2v6.4h2V4c-2.2 0-4 1.8-4 4z" fill="white" transform="translate(4, 4) scale(0.7)"/>
                        </svg>
                    `),
                    scaledSize: new mapsApi.Size(32, 32),
                    anchor: new mapsApi.Point(16, 16)
                };
            } else if (markerData.type === 'customer') {
                icon = {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                            <circle cx="16" cy="16" r="14" fill="#22c55e" stroke="white" stroke-width="3"/>
                            <path d="M16 4C11.6 4 8 7.6 8 12c0 4.2 5.6 10.4 5.6 10.4L16 26l2.4-3.6S24 16.2 24 12c0-4.4-3.6-8-8-8zm0 10.8c-1.5 0-2.8-1.2-2.8-2.8S14.5 9.2 16 9.2s2.8 1.2 2.8 2.8-1.3 2.8-2.8 2.8z" fill="white" transform="translate(0, 0) scale(0.8)"/>
                        </svg>
                    `),
                    scaledSize: new mapsApi.Size(32, 32),
                    anchor: new mapsApi.Point(16, 32)
                };
            } else if (markerData.type === 'delivery') {
                icon = {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="16" fill="#3b82f6" stroke="white" stroke-width="3"/>
                            <path d="M26 11h-1.5V5H11v6H9.5c-1.9 0-3.5 1.6-3.5 3.5v7h2.3c0 1.9 1.6 3.5 3.5 3.5s3.5-1.6 3.5-3.5h4.7c0 1.9 1.6 3.5 3.5 3.5s3.5-1.6 3.5-3.5h2.3v-7c0-1.9-1.6-3.5-3.5-3.5zM13.5 8.5h9v2.5h-9V8.5zm-1.8 14c-.7 0-1.2-.5-1.2-1.2s.5-1.2 1.2-1.2 1.2.5 1.2 1.2-.5 1.2-1.2 1.2zm12.6 0c-.7 0-1.2-.5-1.2-1.2s.5-1.2 1.2-1.2 1.2.5 1.2 1.2-.5 1.2-1.2 1.2z" fill="white" transform="translate(0, 0) scale(0.65)"/>
                        </svg>
                    `),
                    scaledSize: new mapsApi.Size(36, 36),
                    anchor: new mapsApi.Point(18, 18)
                };
            } else {
                icon = {
                    path: mapsApi.SymbolPath.CIRCLE,
                    scale: 12,
                    fillColor: '#6366f1',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 3
                };
            }

            const marker = new mapsApi.Marker({
                position: { lat: markerData.lat, lng: markerData.lng },
                map: map.current,
                icon: icon,
                title: markerData.label || ''
            });

            // Add info window if label exists
            if (markerData.label) {
                const infoWindow = new mapsApi.InfoWindow({
                    content: `
                        <div style="padding: 8px;">
                            <strong style="color: #333;">${markerData.label}</strong>
                            ${markerData.address ? `<p style="color: #666; margin-top: 4px; font-size: 12px;">${markerData.address}</p>` : ''}
                        </div>
                    `
                });

                marker.addListener('click', () => {
                    infoWindow.open(map.current, marker);
                });
            }

            markersRef.current.push(marker);
            bounds.extend({ lat: markerData.lat, lng: markerData.lng });
        });

        // Fit bounds if multiple markers
        if (markers.length > 1) {
            map.current.fitBounds(bounds, { padding: 60 });
        } else if (markers.length === 1) {
            map.current.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
            map.current.setZoom(15);
        }
    }, [markers, mapLoaded, mapsApi]);

    // Update route
    useEffect(() => {
        if (!map.current || !mapLoaded || !mapsApi || !directionsRenderer.current) return;

        // Clear existing route
        directionsRenderer.current.setDirections({ routes: [] });

        // Add new route if provided and has polyline
        if (route && route.polyline) {
            try {
                const decodedPath = mapsApi.geometry.encoding.decodePath(route.polyline);
                
                const routePath = new mapsApi.Polyline({
                    path: decodedPath,
                    strokeColor: '#3b82f6',
                    strokeWeight: 5,
                    strokeOpacity: 0.8
                });
                
                routePath.setMap(map.current);
                
                // Fit bounds to route
                const bounds = new mapsApi.LatLngBounds();
                decodedPath.forEach(point => bounds.extend(point));
                map.current.fitBounds(bounds, { padding: 60 });
            } catch (e) {
                console.error('Failed to decode polyline:', e);
            }
        }
    }, [route, mapLoaded, mapsApi]);

    return (
        <div className={`relative ${className}`}>
            <div ref={mapContainer} className="w-full h-full rounded-xl" />
            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
            `}</style>
        </div>
    );
}

export default GoogleMap;
