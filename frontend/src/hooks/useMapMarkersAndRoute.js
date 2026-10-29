/**
 * useMapMarkersAndRoute
 * ---------------------
 * Manages restaurant / customer / partner markers and the driving route.
 * - Uses primitive lat/lng deps (not object refs) → no flicker on parent rerender.
 * - fitBounds is called ONLY ONCE per route (subsequent updates preserve user pan/zoom).
 * - Route requests are deduped via 4-decimal route key.
 *
 * Returns ETA and route info for display.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export function useMapMarkersAndRoute({
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
}) {
    const markersRef = useRef({});
    const hasFitBoundsRef = useRef(false);
    const lastRouteKeyRef = useRef(null);

    const [eta, setEta] = useState({ toRestaurant: null, toCustomer: null });
    const [routeInfo, setRouteInfo] = useState(null);

    // Primitive deps prevent flicker
    const restLat = restaurantLocation?.lat;
    const restLng = restaurantLocation?.lng;
    const custLat = customerLocation?.lat;
    const custLng = customerLocation?.lng;
    const partLat = currentLocation?.lat;
    const partLng = currentLocation?.lng;

    const buildMarkerIcon = useCallback(
        (label, fill) => ({
            url:
                'data:image/svg+xml;charset=UTF-8,' +
                encodeURIComponent(
                    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
                        <circle cx="22" cy="22" r="20" fill="${fill}" stroke="white" stroke-width="3"/>
                        <text x="22" y="28" text-anchor="middle" fill="white" font-size="18" font-family="Arial">${label}</text>
                    </svg>`
                ),
            scaledSize: mapsApi ? new mapsApi.Size(44, 44) : null,
            anchor: mapsApi ? new mapsApi.Point(22, 22) : null,
        }),
        [mapsApi]
    );

    const updateMarkers = useCallback(() => {
        if (!mapInstanceRef.current || !mapsApi) return;

        // Restaurant marker
        if (restLat && restLng) {
            if (markersRef.current.restaurant) {
                markersRef.current.restaurant.setPosition({ lat: restLat, lng: restLng });
            } else {
                markersRef.current.restaurant = new mapsApi.Marker({
                    position: { lat: restLat, lng: restLng },
                    map: mapInstanceRef.current,
                    icon: buildMarkerIcon('🍽️', '#f97316'),
                    title: restaurantInfo?.name || 'Restaurant',
                    zIndex: 100,
                });
            }
        }

        // Customer marker
        if (custLat && custLng) {
            if (markersRef.current.customer) {
                markersRef.current.customer.setPosition({ lat: custLat, lng: custLng });
            } else {
                markersRef.current.customer = new mapsApi.Marker({
                    position: { lat: custLat, lng: custLng },
                    map: mapInstanceRef.current,
                    icon: buildMarkerIcon('🏠', '#22c55e'),
                    title: customerInfo?.name || 'Customer',
                    zIndex: 100,
                });
            }
        }

        // Partner marker — smooth tracking via setPosition on tiny diffs
        if (partLat && partLng) {
            if (markersRef.current.partner) {
                const cur = markersRef.current.partner.getPosition();
                if (
                    cur &&
                    (Math.abs(cur.lat() - partLat) > 1e-7 || Math.abs(cur.lng() - partLng) > 1e-7)
                ) {
                    markersRef.current.partner.setPosition({ lat: partLat, lng: partLng });
                }
            } else {
                markersRef.current.partner = new mapsApi.Marker({
                    position: { lat: partLat, lng: partLng },
                    map: mapInstanceRef.current,
                    icon: {
                        url:
                            'data:image/svg+xml;charset=UTF-8,' +
                            encodeURIComponent(
                                `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
                                    <circle cx="26" cy="26" r="24" fill="#3b82f6" stroke="white" stroke-width="4"/>
                                    <text x="26" y="32" text-anchor="middle" fill="white" font-size="22" font-family="Arial">🛵</text>
                                </svg>`
                            ),
                        scaledSize: new mapsApi.Size(52, 52),
                        anchor: new mapsApi.Point(26, 26),
                    },
                    title: 'Your Location',
                    zIndex: 200,
                });
            }
        }
    }, [
        mapsApi,
        mapInstanceRef,
        restLat,
        restLng,
        custLat,
        custLng,
        partLat,
        partLng,
        restaurantInfo?.name,
        customerInfo?.name,
        buildMarkerIcon,
    ]);

    const updateRoute = useCallback(async () => {
        if (!mapInstanceRef.current || !mapsApi || !directionsRendererRef.current) return;
        if (!partLat || !custLat) return;

        // Dedupe: only re-route if coordinates / status change at 4-decimal precision
        const routeKey =
            `${partLat?.toFixed(4)},${partLng?.toFixed(4)}` +
            `|${restLat?.toFixed(4) || '-'},${restLng?.toFixed(4) || '-'}` +
            `|${custLat?.toFixed(4)},${custLng?.toFixed(4)}|${orderStatus}`;
        if (lastRouteKeyRef.current === routeKey) return;
        lastRouteKeyRef.current = routeKey;

        const directionsService = new mapsApi.DirectionsService();
        const destination = { lat: custLat, lng: custLng };
        const waypoints =
            ['confirmed', 'preparing', 'ready'].includes(orderStatus) && restLat && restLng
                ? [{ location: { lat: restLat, lng: restLng }, stopover: true }]
                : [];

        try {
            const result = await directionsService.route({
                origin: { lat: partLat, lng: partLng },
                destination,
                waypoints,
                optimizeWaypoints: true,
                travelMode: mapsApi.TravelMode.DRIVING,
                drivingOptions: { departureTime: new Date(), trafficModel: 'bestguess' },
            });

            directionsRendererRef.current.setDirections(result);

            const legs = result.routes[0]?.legs || [];
            if (legs.length === 2) {
                const toRestaurant = Math.round(
                    (legs[0].duration_in_traffic?.value || legs[0].duration.value) / 60
                );
                const toCustomer = Math.round(
                    (legs[1].duration_in_traffic?.value || legs[1].duration.value) / 60
                );
                setEta({ toRestaurant, toCustomer: toRestaurant + toCustomer });
                setRouteInfo({
                    toRestaurant: {
                        distance: (legs[0].distance.value / 1000).toFixed(1),
                        duration: toRestaurant,
                    },
                    toCustomer: {
                        distance: (legs[1].distance.value / 1000).toFixed(1),
                        duration: toCustomer,
                    },
                    total: {
                        distance: ((legs[0].distance.value + legs[1].distance.value) / 1000).toFixed(
                            1
                        ),
                        duration: toRestaurant + toCustomer,
                    },
                });
            } else if (legs.length === 1) {
                const duration = Math.round(
                    (legs[0].duration_in_traffic?.value || legs[0].duration.value) / 60
                );
                setEta({ toRestaurant: null, toCustomer: duration });
                setRouteInfo({
                    toCustomer: { distance: (legs[0].distance.value / 1000).toFixed(1), duration },
                    total: { distance: (legs[0].distance.value / 1000).toFixed(1), duration },
                });
            }

            // Fit bounds ONLY once
            if (!hasFitBoundsRef.current) {
                const bounds = new mapsApi.LatLngBounds();
                bounds.extend({ lat: partLat, lng: partLng });
                if (restLat && restLng) bounds.extend({ lat: restLat, lng: restLng });
                bounds.extend({ lat: custLat, lng: custLng });
                mapInstanceRef.current.fitBounds(bounds, { padding: 80 });
                hasFitBoundsRef.current = true;
            }
        } catch (error) {
            console.error('Directions request failed:', error);
            // Fall back to backend
            try {
                const r = await axios.post(`${API}/api/google-maps/delivery-route`, {
                    partner_location: { lat: partLat, lng: partLng },
                    restaurant_location: restLat ? { lat: restLat, lng: restLng } : null,
                    customer_location: { lat: custLat, lng: custLng },
                });
                if (r.data?.success) {
                    const route = r.data.route;
                    setRouteInfo({
                        toRestaurant: route.partner_to_restaurant,
                        toCustomer: route.restaurant_to_customer,
                        total: {
                            distance: route.total_distance_km,
                            duration: route.total_duration_minutes,
                        },
                    });
                    setEta({
                        toRestaurant: Math.round(route.partner_to_restaurant?.duration_minutes || 0),
                        toCustomer: Math.round(route.total_duration_minutes || 0),
                    });
                }
            } catch (_) { /* ignore */ }
        }
    }, [
        mapsApi,
        mapInstanceRef,
        directionsRendererRef,
        partLat,
        partLng,
        restLat,
        restLng,
        custLat,
        custLng,
        orderStatus,
    ]);

    // Apply marker / route updates whenever primitives change
    useEffect(() => {
        if (!mapLoaded) return;
        updateMarkers();
        if (partLat && partLng) updateRoute();
    }, [mapLoaded, updateMarkers, updateRoute, partLat, partLng]);

    // Cleanup markers on unmount
    useEffect(() => {
        return () => {
            Object.values(markersRef.current).forEach((m) => m?.setMap?.(null));
            markersRef.current = {};
        };
    }, []);

    return { eta, routeInfo };
}
