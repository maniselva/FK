/**
 * usePartnerLiveTracking
 * ----------------------
 * Encapsulates browser geolocation + server location updates for delivery partners.
 *
 * - Exposes start/stop tracking actions and currentLocation state.
 * - Uses navigator.geolocation.watchPosition for high-frequency local UI updates.
 * - Pushes location to /api/tracking/update-partner-location every 10s (battery-friendly).
 * - Cleans up watchers + intervals on stop / unmount.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export function usePartnerLiveTracking({ orderId, partnerId }) {
    const watchIdRef = useRef(null);
    const updateIntervalRef = useRef(null);

    const [currentLocation, setCurrentLocation] = useState(null);
    const [isTracking, setIsTracking] = useState(false);
    const [error, setError] = useState(null);

    const getCurrentLocation = useCallback(() => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        heading: position.coords.heading,
                        accuracy: position.coords.accuracy,
                        speed: position.coords.speed,
                    });
                },
                reject,
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
            );
        });
    }, []);

    const updateLocationToServer = useCallback(
        async (location) => {
            if (!orderId || !partnerId) return;
            try {
                await axios.post(`${API}/api/tracking/update-partner-location`, {
                    order_id: orderId,
                    partner_id: partnerId,
                    lat: location.lat,
                    lng: location.lng,
                    heading: location.heading || 0,
                    speed: location.speed || 0,
                });
            } catch (err) {
                console.error('Failed to update location:', err);
            }
        },
        [orderId, partnerId]
    );

    const stopTracking = useCallback(() => {
        setIsTracking(false);
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        if (updateIntervalRef.current) {
            clearInterval(updateIntervalRef.current);
            updateIntervalRef.current = null;
        }
    }, []);

    const startTracking = useCallback(async () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            toast.error('Geolocation not supported');
            return;
        }

        setIsTracking(true);
        setError(null);
        toast.success('Live tracking started');

        try {
            const location = await getCurrentLocation();
            setCurrentLocation(location);
            await updateLocationToServer(location);
        } catch (err) {
            console.error('Initial location error:', err);
            toast.error('Could not get your location');
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    heading: position.coords.heading,
                    accuracy: position.coords.accuracy,
                    speed: position.coords.speed,
                };
                setCurrentLocation(location);
            },
            (err) => {
                console.error('Watch position error:', err);
                setError('Unable to track location');
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
        );

        updateIntervalRef.current = setInterval(async () => {
            try {
                const location = await getCurrentLocation();
                setCurrentLocation(location);
                await updateLocationToServer(location);
            } catch (err) {
                console.error('Update interval error:', err);
            }
        }, 10000);
    }, [getCurrentLocation, updateLocationToServer]);

    // Cleanup on unmount
    useEffect(() => {
        return () => stopTracking();
    }, [stopTracking]);

    return { currentLocation, isTracking, error, startTracking, stopTracking };
}
