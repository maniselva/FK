import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bike, RefreshCw, MapPin, Phone, Navigation, Activity, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from './ui/button';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Load Google Maps script with dynamic API key
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

export default function FleetMapView({ partners = [], onRefresh }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef({});
    const infoWindowRef = useRef(null);
    const [mapsApi, setMapsApi] = useState(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState(null);

    // Initialize Google Map
    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        loadGoogleMapsScript()
            .then((googleMaps) => {
                setMapsApi(googleMaps);
                setMapError(null);

                // Default center (India)
                const defaultCenter = { lat: 20.5937, lng: 78.9629 };

                mapInstanceRef.current = new googleMaps.Map(mapRef.current, {
                    center: defaultCenter,
                    zoom: 5,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    zoomControl: true,
                    styles: [
                        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
                        { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] }
                    ]
                });

                infoWindowRef.current = new googleMaps.InfoWindow();
                setMapLoaded(true);
            })
            .catch(err => {
                console.error('Failed to load Google Maps:', err);
                setMapError('Unable to load map');
            });

        return () => {
            Object.values(markersRef.current).forEach(marker => marker?.setMap(null));
            markersRef.current = {};
        };
    }, []);

    // Update markers when partners change
    const updateMarkers = useCallback(() => {
        if (!mapsApi || !mapInstanceRef.current) return;

        // Remove old markers that are no longer in the list
        const currentPartnerIds = new Set(partners.map(p => p.id));
        Object.keys(markersRef.current).forEach(id => {
            if (!currentPartnerIds.has(id)) {
                markersRef.current[id].setMap(null);
                delete markersRef.current[id];
            }
        });

        // Update or create markers for each partner
        const bounds = new mapsApi.LatLngBounds();
        let hasValidLocations = false;

        partners.forEach(partner => {
            if (!partner.last_location?.lat || !partner.last_location?.lng) return;

            hasValidLocations = true;
            const position = {
                lat: partner.last_location.lat,
                lng: partner.last_location.lng
            };
            bounds.extend(position);

            if (markersRef.current[partner.id]) {
                // Update existing marker position
                markersRef.current[partner.id].setPosition(position);
            } else {
                // Create new marker with custom icon
                const marker = new mapsApi.Marker({
                    position,
                    map: mapInstanceRef.current,
                    title: partner.name,
                    icon: {
                        path: mapsApi.SymbolPath.CIRCLE,
                        scale: 12,
                        fillColor: partner.active_deliveries > 0 ? '#f97316' : '#22c55e',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 3,
                    },
                    animation: mapsApi.Animation.DROP
                });

                // Add click listener for info window
                marker.addListener('click', () => {
                    const content = `
                        <div style="padding: 8px; min-width: 180px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                <div style="width: 32px; height: 32px; background: ${partner.active_deliveries > 0 ? '#fed7aa' : '#bbf7d0'}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${partner.active_deliveries > 0 ? '#ea580c' : '#16a34a'}" stroke-width="2">
                                        <circle cx="18.5" cy="18.5" r="3.5"></circle>
                                        <circle cx="5.5" cy="18.5" r="3.5"></circle>
                                        <path d="M15 5l1 7h3.5a2 2 0 0 1 2 2 2 2 0 0 1-2 2H3"></path>
                                        <path d="M6 5h7l3 7"></path>
                                    </svg>
                                </div>
                                <div>
                                    <strong style="font-size: 14px;">${partner.name}</strong>
                                    <div style="font-size: 12px; color: #666;">${partner.phone || 'N/A'}</div>
                                </div>
                            </div>
                            <div style="display: flex; gap: 12px; font-size: 12px; color: #444;">
                                <div>
                                    <span style="color: #888;">Today:</span>
                                    <strong style="color: #ea580c;"> ${partner.today_km?.toFixed(1) || 0} km</strong>
                                </div>
                                ${partner.active_deliveries > 0 ? `
                                <div>
                                    <span style="background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">
                                        ${partner.active_deliveries} Active
                                    </span>
                                </div>
                                ` : ''}
                            </div>
                            <div style="margin-top: 8px;">
                                <a href="https://www.google.com/maps?q=${partner.last_location.lat},${partner.last_location.lng}" 
                                   target="_blank" 
                                   style="color: #2563eb; font-size: 12px; text-decoration: none;">
                                    Open in Google Maps →
                                </a>
                            </div>
                        </div>
                    `;
                    infoWindowRef.current.setContent(content);
                    infoWindowRef.current.open(mapInstanceRef.current, marker);
                    setSelectedPartner(partner);
                });

                markersRef.current[partner.id] = marker;
            }
        });

        // Fit bounds if we have valid locations
        if (hasValidLocations && partners.length > 0) {
            if (partners.length === 1) {
                mapInstanceRef.current.setCenter(bounds.getCenter());
                mapInstanceRef.current.setZoom(15);
            } else {
                mapInstanceRef.current.fitBounds(bounds, { padding: 50 });
            }
        }
    }, [mapsApi, partners]);

    useEffect(() => {
        updateMarkers();
    }, [updateMarkers]);

    // Render fallback if map error
    if (mapError) {
        return (
            <div className="bg-gray-100 rounded-xl p-8 text-center">
                <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">{mapError}</p>
                <p className="text-sm text-gray-500 mt-1">Partner locations are shown in the list below</p>
            </div>
        );
    }

    const onlineCount = partners.filter(p => p.last_location?.lat).length;
    const activeCount = partners.filter(p => p.active_deliveries > 0).length;

    return (
        <div className={`bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 ${isExpanded ? 'fixed inset-4 z-50' : ''}`}>
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Fleet Live View</h3>
                            <p className="text-sm text-white/80">
                                {onlineCount} partners on map • {activeCount} active
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-white hover:bg-white/20"
                            onClick={onRefresh}
                        >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Refresh
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-white hover:bg-white/20"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow"></div>
                    <span className="text-gray-600">Available</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white shadow"></div>
                    <span className="text-gray-600">On Delivery</span>
                </div>
            </div>

            {/* Map */}
            <div 
                ref={mapRef} 
                className={`w-full bg-gray-200 ${isExpanded ? 'h-[calc(100%-120px)]' : 'h-80'}`}
                data-testid="fleet-map-view"
            />

            {/* No partners message */}
            {partners.length === 0 && mapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 pointer-events-none" style={{ top: '120px' }}>
                    <div className="text-center">
                        <Bike className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No delivery partners online</p>
                        <p className="text-gray-400 text-sm">Partners will appear here when they go online</p>
                    </div>
                </div>
            )}

            {/* Selected Partner Quick Info */}
            {selectedPartner && (
                <div className="p-3 bg-gray-50 border-t flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedPartner.active_deliveries > 0 ? 'bg-orange-100' : 'bg-green-100'}`}>
                            <Bike className={`w-4 h-4 ${selectedPartner.active_deliveries > 0 ? 'text-orange-600' : 'text-green-600'}`} />
                        </div>
                        <div>
                            <p className="font-medium text-sm">{selectedPartner.name}</p>
                            <p className="text-xs text-gray-500">{selectedPartner.today_km?.toFixed(1) || 0} km today</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedPartner.phone && (
                            <a href={`tel:${selectedPartner.phone}`}>
                                <Button size="sm" variant="outline" className="h-8">
                                    <Phone className="w-3 h-3 mr-1" />
                                    Call
                                </Button>
                            </a>
                        )}
                        {selectedPartner.last_location && (
                            <a 
                                href={`https://www.google.com/maps?q=${selectedPartner.last_location.lat},${selectedPartner.last_location.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700">
                                    <Navigation className="w-3 h-3 mr-1" />
                                    Navigate
                                </Button>
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
