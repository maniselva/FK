import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Search, Filter, Leaf, X, MapPin, AlertCircle, Navigation, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import RestaurantCard from '../components/RestaurantCard';
import { useApp } from '../contexts/AppContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const cuisineOptions = ['American', 'Japanese', 'Italian', 'Indian', 'Mexican', 'Healthy', 'Chinese', 'Thai'];

export default function RestaurantsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { location, detectLocation } = useApp();
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detectingLocation, setDetectingLocation] = useState(false);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [vegOnly, setVegOnly] = useState(false);
    const [selectedCuisines, setSelectedCuisines] = useState(() => {
        const cuisine = searchParams.get('cuisine');
        return cuisine ? [cuisine] : [];
    });

    useEffect(() => {
        fetchRestaurants();
    }, [location]);

    const fetchRestaurants = async () => {
        setLoading(true);
        try {
            const params = {};
            // Filter by location if available
            if (location?.lat && location?.lng) {
                params.lat = location.lat;
                params.lng = location.lng;
                params.radius_km = 15;
            }
            const response = await axios.get(`${API}/restaurants`, { params });
            setRestaurants(response.data);
        } catch (error) {
            console.error('Failed to fetch restaurants:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDetectLocation = async () => {
        setDetectingLocation(true);
        try {
            await detectLocation();
            toast.success('Location detected! Showing nearby restaurants.');
        } catch (error) {
            toast.error('Could not detect location. Please enable GPS or search manually.');
        } finally {
            setDetectingLocation(false);
        }
    };

    const toggleCuisine = (cuisine) => {
        setSelectedCuisines(prev => 
            prev.includes(cuisine) 
                ? prev.filter(c => c !== cuisine)
                : [...prev, cuisine]
        );
    };

    const clearFilters = () => {
        setSearchQuery('');
        setVegOnly(false);
        setSelectedCuisines([]);
        setSearchParams({});
    };

    const filteredRestaurants = restaurants.filter(r => {
        const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.cuisine?.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesVeg = !vegOnly || r.is_veg;
        const matchesCuisine = selectedCuisines.length === 0 || 
            r.cuisine?.some(c => selectedCuisines.some(sc => c.toLowerCase().includes(sc.toLowerCase())));
        return matchesSearch && matchesVeg && matchesCuisine;
    });

    const hasActiveFilters = vegOnly || selectedCuisines.length > 0;

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8" data-testid="restaurants-page">
            {/* Location Info Banner */}
            {location?.address ? (
                <div className="mb-6 p-4 bg-primary/10 rounded-xl border border-primary/20 flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-medium">Delivering to: <span className="text-primary">{location.address}</span></p>
                        <p className="text-xs text-muted-foreground">Showing restaurants within 15km sorted by distance</p>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleDetectLocation}
                        disabled={detectingLocation}
                        className="flex-shrink-0"
                        data-testid="change-location-btn"
                    >
                        {detectingLocation ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <Navigation className="h-4 w-4 mr-1" />
                                Update
                            </>
                        )}
                    </Button>
                </div>
            ) : (
                <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <MapPin className="h-6 w-6 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-orange-800">Enable location to see nearby restaurants</p>
                            <p className="text-xs text-orange-600">Get restaurants sorted by distance from you</p>
                        </div>
                    </div>
                    <Button 
                        onClick={handleDetectLocation}
                        disabled={detectingLocation}
                        className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto"
                        data-testid="detect-location-btn"
                    >
                        {detectingLocation ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Detecting...
                            </>
                        ) : (
                            <>
                                <Navigation className="h-4 w-4 mr-2" />
                                Detect My Location
                            </>
                        )}
                    </Button>
                </div>
            )}

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-2">All Restaurants</h1>
                <p className="text-muted-foreground">
                    {filteredRestaurants.length} restaurants available
                    {location?.lat && ' near you'}
                </p>
            </div>

            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                        type="text"
                        placeholder="Search restaurants..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-11"
                        data-testid="restaurant-search"
                    />
                </div>

                {/* Quick Filter - Veg Only */}
                <Button
                    variant={vegOnly ? 'default' : 'outline'}
                    onClick={() => setVegOnly(!vegOnly)}
                    className={vegOnly ? 'bg-green-600 hover:bg-green-700' : ''}
                    data-testid="veg-filter"
                >
                    <Leaf size={16} className="mr-2" />
                    Pure Veg
                </Button>

                {/* Filter Sheet - Mobile */}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" className="sm:hidden" data-testid="filter-trigger">
                            <Filter size={16} className="mr-2" />
                            Filters
                            {hasActiveFilters && (
                                <span className="ml-2 w-5 h-5 rounded-full bg-primary text-black text-xs flex items-center justify-center">
                                    {selectedCuisines.length + (vegOnly ? 1 : 0)}
                                </span>
                            )}
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[70vh]">
                        <SheetHeader>
                            <SheetTitle>Filters</SheetTitle>
                        </SheetHeader>
                        <div className="mt-6 space-y-6">
                            <div>
                                <h3 className="font-medium mb-3">Cuisines</h3>
                                <div className="flex flex-wrap gap-2">
                                    {cuisineOptions.map(cuisine => (
                                        <Button
                                            key={cuisine}
                                            variant={selectedCuisines.includes(cuisine) ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => toggleCuisine(cuisine)}
                                            className={selectedCuisines.includes(cuisine) ? 'bg-primary text-black' : ''}
                                        >
                                            {cuisine}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            {hasActiveFilters && (
                                <Button variant="ghost" onClick={clearFilters} className="w-full">
                                    Clear all filters
                                </Button>
                            )}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop Filters */}
            <div className="hidden sm:flex flex-wrap gap-2 mb-8">
                {cuisineOptions.map(cuisine => (
                    <Button
                        key={cuisine}
                        variant={selectedCuisines.includes(cuisine) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleCuisine(cuisine)}
                        className={selectedCuisines.includes(cuisine) ? 'bg-primary text-black' : ''}
                        data-testid={`cuisine-${cuisine.toLowerCase()}`}
                    >
                        {cuisine}
                    </Button>
                ))}
                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="clear-filters">
                        <X size={16} className="mr-1" />
                        Clear
                    </Button>
                )}
            </div>

            {/* Restaurant Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="rounded-2xl overflow-hidden">
                            <div className="skeleton h-48" />
                            <div className="p-4 space-y-3">
                                <div className="skeleton h-6 w-3/4" />
                                <div className="skeleton h-4 w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredRestaurants.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-6 bg-orange-100 rounded-full flex items-center justify-center">
                        <AlertCircle size={40} className="text-orange-500" />
                    </div>
                    <p className="text-muted-foreground mb-4">
                        {restaurants.length === 0 
                            ? "No restaurants available at the moment."
                            : "No restaurants match your filters"
                        }
                    </p>
                    {restaurants.length === 0 ? (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 max-w-md mx-auto">
                            <p className="text-orange-800 font-medium mb-2">
                                Unable to place an order?
                            </p>
                            <p className="text-orange-700">
                                Please call us on{' '}
                                <a 
                                    href="tel:9566722970" 
                                    className="font-bold text-orange-600 hover:text-orange-800 underline"
                                    data-testid="support-phone-link"
                                >
                                    9566722970
                                </a>
                            </p>
                        </div>
                    ) : (
                        <Button variant="outline" onClick={clearFilters}>
                            Clear filters
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRestaurants.map((restaurant, idx) => (
                        <div key={restaurant.id} className="animate-fade-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                            <RestaurantCard restaurant={restaurant} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
