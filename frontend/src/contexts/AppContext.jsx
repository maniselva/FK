import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { searchPlacesClient, resolvePlaceDetails, reverseGeocodeClient } from '../utils/googlePlacesClient';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AppContext = createContext(null);

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within AppProvider');
    }
    return context;
};

export const AppProvider = ({ children }) => {
    // Auth State
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('foodkey_user');
        return saved ? JSON.parse(saved) : null;
    });
    const [isAuthenticated, setIsAuthenticated] = useState(!!user);

    // Cart State
    const [cart, setCart] = useState(() => {
        const saved = localStorage.getItem('foodkey_cart');
        return saved ? JSON.parse(saved) : { items: [], restaurantId: null, restaurantName: null };
    });

    // Location State
    const [location, setLocation] = useState(() => {
        const saved = localStorage.getItem('foodkey_location');
        return saved ? JSON.parse(saved) : null;
    });

    // Loading States
    const [loading, setLoading] = useState(false);
    
    // Auth Modal State
    const [showAuth, setShowAuth] = useState(false);

    // Persist user to localStorage
    useEffect(() => {
        if (user) {
            localStorage.setItem('foodkey_user', JSON.stringify(user));
            setIsAuthenticated(true);
        } else {
            localStorage.removeItem('foodkey_user');
            setIsAuthenticated(false);
        }
    }, [user]);

    // Persist cart to localStorage
    useEffect(() => {
        localStorage.setItem('foodkey_cart', JSON.stringify(cart));
    }, [cart]);

    // Persist location to localStorage
    useEffect(() => {
        if (location) {
            localStorage.setItem('foodkey_location', JSON.stringify(location));
        }
    }, [location]);

    // Auth Functions
    const sendOTP = async (phone) => {
        try {
            const response = await axios.post(`${API}/auth/send-otp`, { phone });
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    };

    const verifyOTP = async (phone, otp, role = 'customer', name = null) => {
        try {
            const response = await axios.post(`${API}/auth/verify-otp`, { phone, otp, role, name });
            // Ensure the user role is correctly set
            const userData = response.data.user;
            userData.role = role;
            setUser(userData);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    };

    const logout = () => {
        setUser(null);
        setCart({ items: [], restaurantId: null, restaurantName: null });
    };

    const updateProfile = async (data) => {
        if (!user) return;
        try {
            const response = await axios.put(`${API}/users/${user.id}`, data);
            setUser(response.data);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    };

    const addAddress = async (addressData) => {
        if (!user) return;
        try {
            const response = await axios.post(`${API}/users/${user.id}/addresses`, addressData);
            setUser(response.data);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    };

    // Cart Functions
    const addToCart = (item, restaurant) => {
        setCart(prev => {
            // If cart has items from different restaurant, clear it
            if (prev.restaurantId && prev.restaurantId !== restaurant.id) {
                return {
                    items: [{ ...item, quantity: 1 }],
                    restaurantId: restaurant.id,
                    restaurantName: restaurant.name
                };
            }

            const existingIndex = prev.items.findIndex(i => i.id === item.id);
            
            if (existingIndex >= 0) {
                const newItems = [...prev.items];
                newItems[existingIndex].quantity += 1;
                return { ...prev, items: newItems };
            }

            return {
                items: [...prev.items, { ...item, quantity: 1 }],
                restaurantId: restaurant.id,
                restaurantName: restaurant.name
            };
        });
    };

    const removeFromCart = (itemId) => {
        setCart(prev => {
            const newItems = prev.items.filter(i => i.id !== itemId);
            if (newItems.length === 0) {
                return { items: [], restaurantId: null, restaurantName: null };
            }
            return { ...prev, items: newItems };
        });
    };

    const updateCartItemQuantity = (itemId, quantity) => {
        if (quantity <= 0) {
            removeFromCart(itemId);
            return;
        }
        setCart(prev => ({
            ...prev,
            items: prev.items.map(i => i.id === itemId ? { ...i, quantity } : i)
        }));
    };

    const clearCart = () => {
        setCart({ items: [], restaurantId: null, restaurantName: null });
    };

    const getCartTotal = useCallback(() => {
        return cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    }, [cart.items]);

    const getCartItemCount = useCallback(() => {
        return cart.items.reduce((count, item) => count + item.quantity, 0);
    }, [cart.items]);

    // Location Functions
    const detectLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const locationData = {
                        lat: latitude,
                        lng: longitude,
                        // Human-readable address filled in below; keep coords as ultra-safe fallback
                        address: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`
                    };

                    // 1) Try CLIENT-SIDE reverse geocode (browser, referer-restricted key OK)
                    try {
                        const result = await reverseGeocodeClient(latitude, longitude);
                        if (result?.address) {
                            locationData.address = result.address;
                            locationData.placeId = result.placeId;
                        }
                    } catch (e) {
                        console.log('Client-side reverse geocoding failed, trying backend');
                    }

                    // 2) Backend fallback (OSM-based) if still coords-only
                    if (locationData.address.startsWith('Lat: ')) {
                        try {
                            const response = await axios.get(`${API}/google-maps/reverse-geocode`, {
                                params: { lat: latitude, lng: longitude }
                            });
                            if (response.data?.success && response.data?.data?.address) {
                                locationData.address = response.data.data.address;
                            }
                        } catch (e) {
                            console.log('Reverse geocoding failed, using coordinates');
                        }
                    }

                    setLocation(locationData);
                    resolve(locationData);
                },
                (error) => {
                    reject(error);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    };

    // Address Autocomplete using Google Places (client-side)
    // Runs in the browser so our referer-restricted key works correctly.
    // Returns landmarks, shop names, establishments AND addresses live as the user types.
    const searchAddresses = async (query) => {
        if (!query || query.length < 2) return [];

        try {
            const preds = await searchPlacesClient(query, {
                biasLocation: location?.lat && location?.lng
                    ? { lat: location.lat, lng: location.lng }
                    : null,
            });

            // Suggestions are returned without coordinates — AddressSearch resolves them
            // on select via resolveAddressDetails below. Expose existing shape for
            // backwards compatibility.
            return preds.map((p) => ({
                placeId: p.placeId,
                description: p.description,
                mainText: p.mainText,
                secondaryText: p.secondaryText,
                // lat/lng intentionally absent — fetched on select
            }));
        } catch (error) {
            console.error('Address search error:', error);
            // Fall back to backend search (OSM) if client-side Places fails
            try {
                const response = await axios.get(`${API}/google-maps/search`, {
                    params: { query, limit: 5 },
                });
                if (response.data?.results) {
                    return response.data.results.map((r) => ({
                        placeId: r.id,
                        description: r.place_name,
                        mainText: r.text,
                        lat: r.center?.[1],
                        lng: r.center?.[0],
                    }));
                }
            } catch (_) { /* ignore */ }
            return [];
        }
    };

    // Resolve a prediction's full details (lat/lng) on selection
    const resolveAddressDetails = async (placeId) => {
        if (!placeId) return null;
        try {
            return await resolvePlaceDetails(placeId);
        } catch (error) {
            console.error('Resolve place details error:', error);
            return null;
        }
    };

    // Get directions between two points using Google Maps
    const getDirections = async (originLat, originLng, destLat, destLng) => {
        try {
            const response = await axios.post(`${API}/google-maps/directions`, {
                waypoints: [
                    { lat: originLat, lng: originLng },
                    { lat: destLat, lng: destLng }
                ],
                mode: 'driving'
            });
            return response.data;
        } catch (error) {
            console.error('Failed to get directions:', error);
            return null;
        }
    };

    const value = {
        // Auth
        user,
        setUser,
        isAuthenticated,
        sendOTP,
        verifyOTP,
        logout,
        updateProfile,
        updateUserProfile: updateProfile, // alias for AuthModal
        addAddress,
        
        // Cart
        cart,
        addToCart,
        removeFromCart,
        updateCartItemQuantity,
        clearCart,
        getCartTotal,
        getCartItemCount,
        
        // Location
        location,
        setLocation,
        detectLocation,
        searchAddresses,
        resolveAddressDetails,
        getDirections,
        
        // Utils
        loading,
        setLoading,
        API,
        
        // UI State
        showAuth,
        setShowAuth
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export default AppContext;
