import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Loader2, Navigation, X } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import axios from 'axios';
import debounce from 'lodash/debounce';

const API = process.env.REACT_APP_BACKEND_URL;

export function MapboxLocationSearch({
    onSelect,
    placeholder = "Search for a location...",
    defaultValue = "",
    showCurrentLocation = true,
    className = ""
}) {
    const [query, setQuery] = useState(defaultValue);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [gettingLocation, setGettingLocation] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    // Debounced search function
    const searchLocations = useCallback(
        debounce(async (searchQuery) => {
            if (!searchQuery || searchQuery.length < 3) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                const response = await axios.get(`${API}/api/mapbox/search`, {
                    params: {
                        query: searchQuery,
                        limit: 5
                    }
                });
                setResults(response.data.results || []);
                setShowResults(true);
            } catch (error) {
                console.error('Location search error:', error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300),
        []
    );

    // Search when query changes
    useEffect(() => {
        searchLocations(query);
    }, [query, searchLocations]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle result selection
    const handleSelect = (result) => {
        const locationData = {
            address: result.place_name,
            lat: result.center[1], // Mapbox returns [lng, lat]
            lng: result.center[0],
            text: result.text
        };
        setQuery(result.place_name);
        setShowResults(false);
        if (onSelect) {
            onSelect(locationData);
        }
    };

    // Get current location
    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                
                try {
                    // Reverse geocode to get address
                    const response = await axios.get(`${API}/api/mapbox/reverse-geocode`, {
                        params: { lat: latitude, lng: longitude }
                    });
                    
                    if (response.data.success && response.data.data) {
                        const locationData = {
                            address: response.data.data.address,
                            lat: latitude,
                            lng: longitude,
                            text: response.data.data.text
                        };
                        setQuery(response.data.data.address);
                        if (onSelect) {
                            onSelect(locationData);
                        }
                    } else {
                        // If reverse geocode fails, still return coordinates
                        const locationData = {
                            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                            lat: latitude,
                            lng: longitude,
                            text: 'Current Location'
                        };
                        setQuery(locationData.address);
                        if (onSelect) {
                            onSelect(locationData);
                        }
                    }
                } catch (error) {
                    console.error('Reverse geocode error:', error);
                    // Still return coordinates even if reverse geocode fails
                    const locationData = {
                        address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                        lat: latitude,
                        lng: longitude,
                        text: 'Current Location'
                    };
                    setQuery(locationData.address);
                    if (onSelect) {
                        onSelect(locationData);
                    }
                } finally {
                    setGettingLocation(false);
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                alert('Unable to get your location. Please search manually.');
                setGettingLocation(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    // Clear input
    const clearInput = () => {
        setQuery('');
        setResults([]);
        setShowResults(false);
        if (onSelect) {
            onSelect(null);
        }
        inputRef.current?.focus();
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div className="relative flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                        ref={inputRef}
                        type="text"
                        placeholder={placeholder}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => results.length > 0 && setShowResults(true)}
                        className="pl-10 pr-10"
                        data-testid="mapbox-location-search"
                    />
                    {query && (
                        <button
                            onClick={clearInput}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X size={16} />
                        </button>
                    )}
                    {loading && (
                        <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" size={16} />
                    )}
                </div>
                
                {showCurrentLocation && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={getCurrentLocation}
                        disabled={gettingLocation}
                        className="flex-shrink-0"
                        data-testid="get-current-location"
                    >
                        {gettingLocation ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Navigation size={18} />
                        )}
                    </Button>
                )}
            </div>

            {/* Results dropdown */}
            {showResults && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {results.map((result, index) => (
                        <button
                            key={result.id || index}
                            onClick={() => handleSelect(result)}
                            className="w-full px-4 py-3 text-left hover:bg-secondary/50 transition-colors flex items-start gap-3 border-b border-border last:border-0"
                            data-testid={`location-result-${index}`}
                        >
                            <MapPin size={18} className="text-primary mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-medium text-sm">{result.text}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {result.place_name}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* No results message */}
            {showResults && query.length >= 3 && results.length === 0 && !loading && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg p-4 text-center text-muted-foreground text-sm">
                    No locations found
                </div>
            )}
        </div>
    );
}

export default MapboxLocationSearch;
