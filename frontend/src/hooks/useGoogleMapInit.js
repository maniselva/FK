/**
 * useGoogleMapInit
 * ----------------
 * Loads the Google Maps JS SDK and initializes a Map + DirectionsRenderer + TrafficLayer.
 * Returns refs and ready-state. Initializes ONCE; never re-creates the map on prop changes.
 */
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

let _scriptPromise = null;

async function loadGoogleMapsScript() {
    if (typeof window !== 'undefined' && window.google?.maps) return window.google.maps;

    if (_scriptPromise) return _scriptPromise;

    _scriptPromise = new Promise(async (resolve, reject) => {
        try {
            // Reuse already-injected script
            const existing = document.getElementById('google-maps-script');
            if (existing) {
                if (window.google?.maps) {
                    resolve(window.google.maps);
                    return;
                }
                existing.addEventListener('load', () => resolve(window.google.maps));
                existing.addEventListener('error', () => reject(new Error('Maps script failed')));
                return;
            }

            // Resolve API key (camelCase preferred; legacy api_key fallback)
            let apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
            try {
                const r = await axios.get(`${API}/api/google-maps/config`);
                apiKey = r.data?.apiKey || r.data?.api_key || apiKey;
            } catch (_) { /* keep env fallback */ }

            if (!apiKey) {
                reject(new Error('Google Maps API key not available'));
                return;
            }

            const script = document.createElement('script');
            script.id = 'google-maps-script';
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=places,geometry`;
            script.async = true;
            script.defer = true;
            script.onload = () =>
                window.google?.maps
                    ? resolve(window.google.maps)
                    : reject(new Error('Google Maps failed to load'));
            script.onerror = () => reject(new Error('Failed to load Google Maps script'));
            document.head.appendChild(script);
        } catch (e) {
            reject(e);
        }
    });

    return _scriptPromise;
}

export function useGoogleMapInit({ initialCenter, polylineColor = '#3b82f6' }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const directionsRendererRef = useRef(null);
    const trafficLayerRef = useRef(null);

    const [mapsApi, setMapsApi] = useState(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapError, setMapError] = useState(null);

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        loadGoogleMapsScript()
            .then((googleMaps) => {
                setMapsApi(googleMaps);
                setMapError(null);

                const center = initialCenter || { lat: 13.0827, lng: 80.2707 };
                mapInstanceRef.current = new googleMaps.Map(mapRef.current, {
                    center,
                    zoom: 14,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: true,
                    zoomControl: true,
                    gestureHandling: 'greedy',
                    styles: [
                        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
                    ],
                });

                trafficLayerRef.current = new googleMaps.TrafficLayer();
                trafficLayerRef.current.setMap(mapInstanceRef.current);

                directionsRendererRef.current = new googleMaps.DirectionsRenderer({
                    map: mapInstanceRef.current,
                    suppressMarkers: true,
                    preserveViewport: true,
                    polylineOptions: {
                        strokeColor: polylineColor,
                        strokeWeight: 6,
                        strokeOpacity: 0.8,
                    },
                });

                setMapLoaded(true);
            })
            .catch((err) => {
                console.error('Failed to load Google Maps:', err);
                setMapError('Unable to load map. Please check your internet connection.');
            });

        // No re-init on prop changes — only run once
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleTraffic = (visible) => {
        if (!trafficLayerRef.current) return;
        trafficLayerRef.current.setMap(visible ? mapInstanceRef.current : null);
    };

    return {
        mapRef,
        mapInstanceRef,
        directionsRendererRef,
        trafficLayerRef,
        mapsApi,
        mapLoaded,
        mapError,
        toggleTraffic,
    };
}
