import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, ArrowRight, Leaf, MapPin, ChevronRight, ChefHat, Bike, X, Phone, MessageCircle, Star, Clock, Gift, Truck, Percent, ChevronLeft, Navigation, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import RestaurantCard from '../components/RestaurantCard';
import { useApp } from '../contexts/AppContext';
import { toast } from 'sonner';
import debounce from 'lodash.debounce';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const categories = [
    { id: 'biryani', name: 'Biryani', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600', span: 'span-2' },
    { id: 'meals', name: 'South Indian Meals', image: 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=600', span: '' },
    { id: 'dosa', name: 'Dosa & Idli', image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=600', span: '' },
    { id: 'grill', name: 'Grill & Tandoor', image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600', span: '' },
    { id: 'sandwich', name: 'Sandwiches', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600', span: '' },
    { id: 'juices', name: 'Fresh Juices', image: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=600', span: 'span-2' },
];

export default function HomePage() {
    const navigate = useNavigate();
    const { isAuthenticated, setShowAuth, location, detectLocation } = useApp();
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detectingLocation, setDetectingLocation] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchResults, setSearchResults] = useState(null);
    const searchRef = useRef(null);
    // Promotional slides
    const [promoSlides, setPromoSlides] = useState([]);
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        fetchRestaurants();
        fetchPromoSlides();
    }, [location]);

    // Auto-advance slides
    useEffect(() => {
        if (promoSlides.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % promoSlides.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [promoSlides.length]);

    const fetchPromoSlides = async () => {
        try {
            const response = await axios.get(`${API}/slides`);
            if (response.data.length === 0) {
                // Seed default slides if none exist
                await axios.post(`${API}/seed-slides`);
                const seededResponse = await axios.get(`${API}/slides`);
                setPromoSlides(seededResponse.data);
            } else {
                setPromoSlides(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch promo slides:', error);
        }
    };

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % promoSlides.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + promoSlides.length) % promoSlides.length);

    const getSlideIcon = (iconName) => {
        const icons = {
            gift: Gift,
            truck: Truck,
            percent: Percent,
            star: Star,
            clock: Clock,
            leaf: Leaf
        };
        const IconComponent = icons[iconName] || Gift;
        return <IconComponent size={32} className="text-white" />;
    };

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search suggestions
    const fetchSuggestions = useCallback(
        debounce(async (query) => {
            if (query.length < 2) {
                setSuggestions([]);
                return;
            }
            try {
                const response = await axios.get(`${API}/search/suggestions?q=${encodeURIComponent(query)}`);
                setSuggestions(response.data);
                setShowSuggestions(true);
            } catch (error) {
                console.error('Failed to fetch suggestions:', error);
            }
        }, 300),
        []
    );

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        fetchSuggestions(value);
    };

    const handleSearch = async () => {
        if (searchQuery.length < 2) return;
        setShowSuggestions(false);
        try {
            const response = await axios.get(`${API}/search?q=${encodeURIComponent(searchQuery)}`);
            setSearchResults(response.data);
        } catch (error) {
            console.error('Search failed:', error);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        setSearchQuery(suggestion.text);
        setShowSuggestions(false);
        if (suggestion.type === 'restaurant') {
            // Find restaurant and navigate
            const restaurant = restaurants.find(r => r.name === suggestion.text);
            if (restaurant) {
                navigate(`/restaurant/${restaurant.id}`);
            }
        } else {
            handleSearch();
        }
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults(null);
        setSuggestions([]);
    };

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

    const handlePartnerClick = (role) => {
        if (isAuthenticated) {
            if (role === 'restaurant') {
                navigate('/dashboard/restaurant');
            } else {
                navigate('/dashboard/delivery');
            }
        } else {
            // Navigate to dedicated partner login pages
            if (role === 'restaurant') {
                navigate('/partner/restaurant');
            } else {
                navigate('/partner/delivery');
            }
        }
    };

    const filteredRestaurants = restaurants.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.cuisine?.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-background" data-testid="home-page">
            {/* Hero Section */}
            <section className="relative overflow-hidden">
                {/* Attractive Background with Food Image */}
                <div className="absolute inset-0">
                    <div 
                        className="absolute inset-0"
                        style={{
                            backgroundImage: 'url(https://images.unsplash.com/photo-1567337710282-00832b415979?w=1920)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                        }}
                    />
                    {/* Gradient Overlay for text readability */}
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-50/95 via-orange-50/90 to-yellow-50/80" />
                    {/* Decorative elements */}
                    <div className="absolute top-20 right-10 w-72 h-72 bg-orange-300/20 rounded-full blur-3xl" />
                    <div className="absolute bottom-10 left-20 w-96 h-96 bg-yellow-300/20 rounded-full blur-3xl" />
                </div>

                <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
                    <div className="max-w-2xl">
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight animate-slide-up">
                            <span className="text-orange-500">Authentic</span> <span className="text-gray-800">South Indian</span>
                            <br />
                            <span className="text-gray-800">Flavors at Your Door</span>
                        </h1>
                        
                        <p className="mt-4 text-lg text-gray-600 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                            From aromatic Biryani to crispy Dosas, steaming hot Idlis to refreshing fresh juices - 
                            experience the rich taste of South India.
                        </p>

                        {/* Search Bar */}
                            <div className="mt-6 flex gap-2 animate-fade-in relative" style={{ animationDelay: '0.4s' }} ref={searchRef}>
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                                    <Input
                                        type="text"
                                        placeholder="Search for biryani, dosa, meals..."
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                        className="pl-12 pr-10 h-14 bg-card border-border text-lg shadow-sm"
                                        data-testid="search-input"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={clearSearch}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            <X size={18} />
                                        </button>
                                    )}
                                    
                                    {/* Autocomplete Suggestions */}
                                    {showSuggestions && suggestions.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-[200] overflow-hidden">
                                            {suggestions.map((suggestion, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleSuggestionClick(suggestion)}
                                                    className="w-full px-4 py-3 text-left hover:bg-secondary flex items-center gap-3 transition-colors"
                                                >
                                                    <Search size={16} className="text-muted-foreground" />
                                                    <span className="flex-1">{suggestion.text}</span>
                                                    <span className="text-xs text-muted-foreground capitalize bg-secondary px-2 py-1 rounded">
                                                        {suggestion.type}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            <Button onClick={handleSearch} className="btn-primary h-14 px-8 shadow-lg" data-testid="search-btn">
                                Search
                            </Button>
                        </div>

                        {/* Custom Order Button */}
                        <div className="mt-6 animate-fade-in" style={{ animationDelay: '0.5s' }}>
                            {isAuthenticated ? (
                                <Link 
                                    to="/write-order" 
                                    className="inline-block"
                                    data-testid="write-order-link"
                                >
                                    <Button 
                                        className="h-14 px-8 bg-gradient-to-r from-gray-900 to-gray-700 hover:from-gray-800 hover:to-gray-600 text-white font-bold text-lg shadow-xl"
                                        style={{
                                            boxShadow: '0 0 20px rgba(0, 0, 0, 0.4), 0 0 40px rgba(0, 0, 0, 0.2)',
                                            animation: 'buttonGlow 2s ease-in-out infinite alternate'
                                        }}
                                    >
                                        Click Here
                                    </Button>
                                </Link>
                            ) : (
                                <Button 
                                    onClick={() => setShowAuth(true)}
                                    className="h-14 px-8 bg-gradient-to-r from-gray-900 to-gray-700 hover:from-gray-800 hover:to-gray-600 text-white font-bold text-lg shadow-xl"
                                    style={{
                                        boxShadow: '0 0 20px rgba(0, 0, 0, 0.4), 0 0 40px rgba(0, 0, 0, 0.2)',
                                        animation: 'buttonGlow 2s ease-in-out infinite alternate'
                                    }}
                                    data-testid="write-order-login-btn"
                                >
                                    Click Here
                                </Button>
                            )}
                            <p className="mt-3 text-gray-800 font-semibold text-lg"
                               style={{
                                   textShadow: '0 0 10px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 0, 0, 0.1)'
                               }}>
                                To order your food or urgent needs from unlisted shops.
                            </p>
                        </div>

                        {/* Glow Animation Style */}
                        <style>{`
                            @keyframes buttonGlow {
                                from {
                                    box-shadow: 0 0 20px rgba(0, 0, 0, 0.4), 0 0 40px rgba(0, 0, 0, 0.2);
                                }
                                to {
                                    box-shadow: 0 0 30px rgba(0, 0, 0, 0.6), 0 0 60px rgba(0, 0, 0, 0.3);
                                }
                            }
                        `}</style>

                        {/* Search Results */}
                        {searchResults && (
                            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-gray-800">Search Results for "{searchQuery}"</h3>
                                    <button onClick={clearSearch} className="text-sm text-orange-500 hover:underline">
                                        Clear search
                                    </button>
                                </div>
                                {searchResults.restaurants.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-sm text-gray-500 mb-2">Restaurants ({searchResults.restaurants.length})</p>
                                        <div className="flex flex-wrap gap-2">
                                            {searchResults.restaurants.map(r => (
                                                <Link
                                                    key={r.id}
                                                    to={`/restaurant/${r.id}`}
                                                    className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200"
                                                >
                                                    <img src={r.image} alt={r.name} className="w-8 h-8 rounded-full object-cover" />
                                                    <span className="font-medium text-gray-800">{r.name}</span>
                                                    <span className="text-xs text-gray-500">⭐ {r.rating}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {searchResults.items.length > 0 && (
                                    <div>
                                        <p className="text-sm text-gray-500 mb-2">Menu Items ({searchResults.items.length})</p>
                                        <div className="flex flex-wrap gap-2">
                                            {searchResults.items.slice(0, 8).map((item, idx) => (
                                                <Link
                                                    key={idx}
                                                    to={`/restaurant/${item.restaurant_id}`}
                                                    className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200"
                                                >
                                                    <span className="font-medium text-gray-800">{item.item.name}</span>
                                                    <span className="text-xs text-gray-500">at {item.restaurant_name}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {searchResults.restaurants.length === 0 && searchResults.items.length === 0 && (
                                    <p className="text-center text-gray-500 py-4">No results found</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Bulk Order Contact Banner */}
            <section className="bg-gradient-to-r from-orange-500 to-orange-600 py-4">
                <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-center gap-4 text-white">
                    <div className="flex items-center gap-2">
                        <Phone size={20} />
                        <span className="font-semibold">For bulk orders Call or Whatsapp to</span>
                    </div>
                    <a 
                        href="tel:9566722970" 
                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full transition-colors font-bold"
                    >
                        <MessageCircle size={18} />
                        9566722970
                    </a>
                </div>
            </section>

            {/* Promotional Slides Carousel */}
            {promoSlides.length > 0 && (
                <section className="max-w-7xl mx-auto px-4 md:px-8 py-8" data-testid="promo-slider">
                    <div className="relative overflow-hidden rounded-2xl shadow-xl">
                        {/* Slides Container */}
                        <div 
                            className="flex transition-transform duration-500 ease-out"
                            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                        >
                            {promoSlides.map((slide) => (
                                <div 
                                    key={slide.id}
                                    className={`min-w-full bg-gradient-to-r ${slide.background_gradient} p-6 md:p-10`}
                                >
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                        {/* Icon */}
                                        <div className="flex-shrink-0 w-20 h-20 md:w-24 md:h-24 bg-white/20 rounded-full flex items-center justify-center animate-bounce-slow">
                                            {getSlideIcon(slide.icon)}
                                        </div>
                                        
                                        {/* Content */}
                                        <div className="flex-1 text-center md:text-left">
                                            <p className="text-white/80 text-sm md:text-base font-medium uppercase tracking-wider mb-1">
                                                {slide.subtitle}
                                            </p>
                                            <h3 className="text-white text-2xl md:text-4xl font-bold mb-2">
                                                {slide.title}
                                            </h3>
                                            <p className="text-white/90 text-sm md:text-base max-w-lg">
                                                {slide.description}
                                            </p>
                                        </div>
                                        
                                        {/* CTA */}
                                        <div className="flex-shrink-0">
                                            <Button 
                                                className="bg-white text-gray-800 hover:bg-gray-100 font-bold px-6 py-3 rounded-full shadow-lg"
                                                onClick={() => !isAuthenticated && setShowAuth(true)}
                                            >
                                                Order Now <ArrowRight size={18} className="ml-2" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Navigation Arrows */}
                        {promoSlides.length > 1 && (
                            <>
                                <button
                                    onClick={prevSlide}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 p-2 rounded-full transition-colors"
                                    data-testid="promo-prev"
                                >
                                    <ChevronLeft size={24} className="text-white" />
                                </button>
                                <button
                                    onClick={nextSlide}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 p-2 rounded-full transition-colors"
                                    data-testid="promo-next"
                                >
                                    <ChevronRight size={24} className="text-white" />
                                </button>
                            </>
                        )}

                        {/* Dots Indicator */}
                        {promoSlides.length > 1 && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                {promoSlides.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentSlide(idx)}
                                        className={`w-2.5 h-2.5 rounded-full transition-all ${
                                            idx === currentSlide ? 'bg-white w-8' : 'bg-white/50'
                                        }`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Categories - Circular Grid */}
            <section className="max-w-7xl mx-auto px-4 md:px-8 py-10">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold">What's on your mind?</h2>
                </div>

                <div className="flex flex-wrap justify-center gap-6 md:gap-8">
                    {categories.map((cat, idx) => (
                        <Link
                            key={cat.id}
                            to={`/restaurants?cuisine=${cat.name}`}
                            className="flex flex-col items-center group animate-fade-in"
                            style={{ animationDelay: `${idx * 0.1}s` }}
                            data-testid={`category-${cat.id}`}
                        >
                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 border-orange-200 group-hover:border-orange-400 transition-all duration-300 shadow-lg group-hover:shadow-xl group-hover:scale-110">
                                <img
                                    src={cat.image}
                                    alt={cat.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <p className="mt-2 text-sm md:text-base font-medium text-gray-700 group-hover:text-orange-500 transition-colors text-center">
                                {cat.name}
                            </p>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Featured Restaurants */}
            <section className="max-w-7xl mx-auto px-4 md:px-8 py-10">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold">Featured Restaurants</h2>
                    <Link to="/restaurants" className="text-primary hover:underline flex items-center gap-1 font-medium">
                        View all <ChevronRight size={16} />
                    </Link>
                </div>

                {/* Location Detection Banner */}
                {!location?.lat && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex items-center gap-3 flex-1">
                            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <MapPin className="h-6 w-6 text-orange-500" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-orange-800">See restaurants near you</p>
                                <p className="text-xs text-orange-600">Enable location for personalized results sorted by distance</p>
                            </div>
                        </div>
                        <Button 
                            onClick={handleDetectLocation}
                            disabled={detectingLocation}
                            className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto"
                            data-testid="home-detect-location-btn"
                        >
                            {detectingLocation ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Detecting...
                                </>
                            ) : (
                                <>
                                    <Navigation className="h-4 w-4 mr-2" />
                                    Detect Location
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {/* Location Active Banner */}
                {location?.lat && location?.address && (
                    <div className="mb-6 p-3 bg-green-50 rounded-xl border border-green-200 flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-green-600 flex-shrink-0" />
                        <p className="text-sm text-green-700">
                            <span className="font-medium">Showing restaurants near:</span> {location.address}
                        </p>
                    </div>
                )}

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="rounded-2xl overflow-hidden bg-card shadow-sm">
                                <div className="skeleton h-48" />
                                <div className="p-4 space-y-3">
                                    <div className="skeleton h-6 w-3/4" />
                                    <div className="skeleton h-4 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredRestaurants.length === 0 ? (
                    <div className="text-center py-16 bg-card rounded-2xl shadow-sm">
                        <p className="text-muted-foreground mb-4">No restaurants available at the moment.</p>
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 max-w-md mx-auto mb-4">
                            <p className="text-orange-800 font-medium mb-2">
                                Unable to place an order?
                            </p>
                            <p className="text-orange-700">
                                Please call us on{' '}
                                <a 
                                    href="tel:9566722970" 
                                    className="font-bold text-orange-600 hover:text-orange-800 underline"
                                    data-testid="home-support-phone-link"
                                >
                                    9566722970
                                </a>
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredRestaurants.slice(0, 6).map((restaurant, idx) => (
                            <div key={restaurant.id} className="animate-fade-in" style={{ animationDelay: `${idx * 0.1}s` }}>
                                <RestaurantCard restaurant={restaurant} />
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* CTA Section */}
            <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-yellow-50 border-y border-border">
                <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-16">
                    <div className="text-center">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Partner with <span className="text-gradient">Food Key</span>
                        </h2>
                        <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                            Join thousands of restaurants and delivery partners. Grow your business with us and reach more customers.
                        </p>
                        <div className="flex flex-wrap justify-center gap-4">
                            <Button 
                                className="btn-primary shadow-lg" 
                                onClick={() => handlePartnerClick('restaurant')}
                                data-testid="partner-restaurant-btn"
                            >
                                <ChefHat size={18} className="mr-2" />
                                Register Your Restaurant
                            </Button>
                            <Button 
                                variant="outline" 
                                className="border-primary text-primary hover:bg-primary hover:text-white shadow-sm"
                                onClick={() => handlePartnerClick('delivery')}
                                data-testid="partner-delivery-btn"
                            >
                                <Bike size={18} className="mr-2" />
                                Become a Delivery Partner
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why Choose Us */}
            <section className="max-w-7xl mx-auto px-4 md:px-8 py-16">
                <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Why Choose Food Key?</h2>
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="text-center p-6 rounded-2xl shadow-lg bg-gradient-to-br from-orange-500 to-red-500 text-white">
                        <div className="w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center mb-4">
                            <Leaf className="text-white" size={28} />
                        </div>
                        <h3 className="font-bold text-lg mb-2">Fresh & Authentic</h3>
                        <p className="text-white/90 text-sm">
                            We partner with the best South Indian restaurants to bring you authentic, freshly prepared meals.
                        </p>
                    </div>
                    <div className="text-center p-6 rounded-2xl shadow-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                        <div className="w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center mb-4">
                            <Clock className="text-white" size={28} />
                        </div>
                        <h3 className="font-bold text-lg mb-2">Lightning Fast</h3>
                        <p className="text-white/90 text-sm">
                            Our dedicated delivery partners ensure your food arrives hot and fresh within 30 minutes.
                        </p>
                    </div>
                    <div className="text-center p-6 rounded-2xl shadow-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                        <div className="w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center mb-4">
                            <MapPin className="text-white" size={28} />
                        </div>
                        <h3 className="font-bold text-lg mb-2">Live Tracking</h3>
                        <p className="text-white/90 text-sm">
                            Track your order in real-time from the kitchen to your doorstep with our live tracking system.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
