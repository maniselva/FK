import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

// Initialize Mapbox
mapboxgl.accessToken = MAPBOX_TOKEN;

export function MapboxMap({ 
    center = [79.8649, 11.9388], // Default: Salem, TN area
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
    const [mapLoaded, setMapLoaded] = useState(false);

    // Initialize map
    useEffect(() => {
        if (map.current) return;
        if (!mapContainer.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: center,
            zoom: zoom,
            interactive: interactive
        });

        map.current.on('load', () => {
            setMapLoaded(true);
            
            // Add navigation controls
            map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
            
            // Add geolocate control if showUserLocation is true
            if (showUserLocation) {
                const geolocate = new mapboxgl.GeolocateControl({
                    positionOptions: {
                        enableHighAccuracy: true
                    },
                    trackUserLocation: true,
                    showUserHeading: true
                });
                map.current.addControl(geolocate, 'top-right');
            }
        });

        // Handle map click
        if (onMapClick) {
            map.current.on('click', (e) => {
                onMapClick({
                    lng: e.lngLat.lng,
                    lat: e.lngLat.lat
                });
            });
        }

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []);

    // Update markers
    useEffect(() => {
        if (!map.current || !mapLoaded) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        // Add new markers
        markers.forEach(markerData => {
            const el = document.createElement('div');
            el.className = 'mapbox-marker';
            el.style.width = '32px';
            el.style.height = '32px';
            el.style.backgroundSize = 'contain';
            el.style.backgroundRepeat = 'no-repeat';
            el.style.cursor = 'pointer';

            // Set marker icon based on type
            if (markerData.type === 'restaurant') {
                el.innerHTML = `<div style="background: #f97316; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg>
                </div>`;
            } else if (markerData.type === 'customer') {
                el.innerHTML = `<div style="background: #22c55e; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                </div>`;
            } else if (markerData.type === 'delivery') {
                el.innerHTML = `<div style="background: #3b82f6; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); animation: pulse 2s infinite;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h2c0 1.66 1.34 3 3 3s3-1.34 3-3h4c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-6c0-1.66-1.34-3-3-3zM8 6h8v2H8V6zm-1 11c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm10 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
                </div>`;
            } else {
                el.innerHTML = `<div style="background: #6366f1; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`;
            }

            const marker = new mapboxgl.Marker(el)
                .setLngLat([markerData.lng, markerData.lat]);

            // Add popup if label exists
            if (markerData.label) {
                const popup = new mapboxgl.Popup({ offset: 25 })
                    .setHTML(`<div style="font-weight: 600; color: #333;">${markerData.label}</div>${markerData.address ? `<div style="font-size: 12px; color: #666; margin-top: 4px;">${markerData.address}</div>` : ''}`);
                marker.setPopup(popup);
            }

            marker.addTo(map.current);
            markersRef.current.push(marker);
        });

        // Fit bounds if multiple markers
        if (markers.length > 1) {
            const bounds = new mapboxgl.LngLatBounds();
            markers.forEach(m => bounds.extend([m.lng, m.lat]));
            map.current.fitBounds(bounds, { padding: 60 });
        } else if (markers.length === 1) {
            map.current.flyTo({
                center: [markers[0].lng, markers[0].lat],
                zoom: 15
            });
        }
    }, [markers, mapLoaded]);

    // Update route
    useEffect(() => {
        if (!map.current || !mapLoaded) return;

        // Remove existing route layer
        if (map.current.getSource('route')) {
            map.current.removeLayer('route');
            map.current.removeSource('route');
        }

        // Add new route if provided
        if (route && route.geometry) {
            map.current.addSource('route', {
                type: 'geojson',
                data: route.geometry
            });

            map.current.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#3b82f6',
                    'line-width': 5,
                    'line-opacity': 0.8
                }
            });
        }
    }, [route, mapLoaded]);

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

export default MapboxMap;
