import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { MapPin, Search, Loader2, X } from 'lucide-react';
import { Input } from './ui/input';
import { useApp } from '../contexts/AppContext';

const AddressSearch = forwardRef(function AddressSearch({
    onSelect,
    placeholder = "Search for an address...",
    className = "",
    showCurrentLocation = true
}, ref) {
    const { searchAddresses, detectLocation, location, resolveAddressDetails } = useApp();
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [detectingLocation, setDetectingLocation] = useState(false);
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const debounceRef = useRef(null);

    // Expose focus() to parents (used by "Looks wrong?" chip link)
    useImperativeHandle(ref, () => ({
        focus: () => {
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }));

    // Handle click outside to close suggestions
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (query.length < 2) {
            setSuggestions([]);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            const results = await searchAddresses(query);
            setSuggestions(results);
            setLoading(false);
            setShowSuggestions(true);
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query, searchAddresses]);

    const handleSelect = async (address) => {
        const displayText = address.description || address.mainText;
        setQuery(displayText);
        setShowSuggestions(false);

        // If predictions are client-side (no lat/lng yet), resolve them now.
        let finalLat = address.lat;
        let finalLng = address.lng;
        if ((finalLat == null || finalLng == null) && address.placeId && resolveAddressDetails) {
            setLoading(true);
            try {
                const details = await resolveAddressDetails(address.placeId);
                if (details) {
                    finalLat = details.lat;
                    finalLng = details.lng;
                }
            } finally {
                setLoading(false);
            }
        }

        if (onSelect) {
            onSelect({
                address: displayText,
                lat: finalLat,
                lng: finalLng,
                placeId: address.placeId
            });
        }
    };

    const handleDetectLocation = async () => {
        setDetectingLocation(true);
        try {
            const loc = await detectLocation();
            setQuery(loc.address);
            if (onSelect) {
                onSelect({
                    address: loc.address,
                    lat: loc.lat,
                    lng: loc.lng
                });
            }
        } catch (error) {
            console.error('Failed to detect location:', error);
        } finally {
            setDetectingLocation(false);
        }
    };

    const clearSearch = () => {
        setQuery('');
        setSuggestions([]);
    };

    return (
        <div ref={containerRef} className={`relative ${className}`} data-testid="address-search">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder={placeholder}
                    className="pl-10 pr-10"
                    data-testid="address-search-input"
                />
                {query && (
                    <button
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
                {loading && (
                    <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && (suggestions.length > 0 || showCurrentLocation) && (
                <div 
                    className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto"
                    data-testid="address-suggestions"
                >
                    {/* Use Current Location Option */}
                    {showCurrentLocation && (
                        <button
                            onClick={handleDetectLocation}
                            disabled={detectingLocation}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary/50 border-b border-border transition-colors"
                            data-testid="use-current-location"
                        >
                            {detectingLocation ? (
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            ) : (
                                <MapPin className="h-5 w-5 text-primary" />
                            )}
                            <div className="text-left">
                                <p className="font-medium text-sm">Use current location</p>
                                {location?.address && (
                                    <p className="text-xs text-muted-foreground truncate max-w-xs">
                                        {location.address}
                                    </p>
                                )}
                            </div>
                        </button>
                    )}

                    {/* Search Results */}
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={suggestion.placeId || index}
                            onClick={() => handleSelect(suggestion)}
                            className="w-full px-4 py-3 flex items-start gap-3 hover:bg-secondary/50 transition-colors text-left"
                            data-testid={`address-suggestion-${index}`}
                        >
                            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{suggestion.mainText}</p>
                                {suggestion.secondaryText && (
                                    <p className="text-xs text-muted-foreground truncate">
                                        {suggestion.secondaryText}
                                    </p>
                                )}
                            </div>
                        </button>
                    ))}

                    {/* No Results */}
                    {suggestions.length === 0 && query.length >= 2 && !loading && (
                        <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                            No addresses found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export default AddressSearch;
