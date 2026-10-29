import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, MapPin, Menu, X, ChefHat, Bike, LogOut, Search, Loader2, Navigation } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Logo } from './Logo';
import { Button } from './ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { toast } from 'sonner';

export const Navbar = ({ onAuthClick }) => {
    const { user, isAuthenticated, logout, location, setLocation, detectLocation, getCartItemCount, searchAddresses } = useApp();
    const [isOpen, setIsOpen] = useState(false);
    const [locating, setLocating] = useState(false);
    const [showLocationSearch, setShowLocationSearch] = useState(false);
    const [locationQuery, setLocationQuery] = useState('');
    const [locationSuggestions, setLocationSuggestions] = useState([]);
    const [searchingLocation, setSearchingLocation] = useState(false);
    const pathname = useLocation().pathname;
    const navigate = useNavigate();
    const cartCount = getCartItemCount();
    const debounceRef = useRef(null);

    // Debounced location search
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (locationQuery.length < 2) {
            setLocationSuggestions([]);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setSearchingLocation(true);
            const results = await searchAddresses(locationQuery);
            setLocationSuggestions(results);
            setSearchingLocation(false);
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [locationQuery, searchAddresses]);

    const handleDetectLocation = async () => {
        setLocating(true);
        try {
            const loc = await detectLocation();
            setShowLocationSearch(false);
            toast.success('Location detected successfully!');
            return loc;
        } catch (error) {
            console.error('Location detection failed:', error);
            // Provide user-friendly error messages
            if (error.code === 1) {
                toast.error('Location permission denied. Please enable GPS in your browser settings.');
            } else if (error.code === 2) {
                toast.error('Unable to detect location. Please check your GPS or try again.');
            } else if (error.code === 3) {
                toast.error('Location detection timed out. Please try again.');
            } else {
                toast.error('Could not detect location. Please search manually or try again.');
            }
            // Don't re-throw - just return null to indicate failure
            return null;
        } finally {
            setLocating(false);
        }
    };

    // Mobile-specific location handler with menu close
    const handleMobileDetectLocation = async () => {
        const result = await handleDetectLocation();
        if (result) {
            setIsOpen(false); // Close mobile menu on success
        }
    };

    const handleSelectLocation = (suggestion) => {
        setLocation({
            lat: suggestion.lat,
            lng: suggestion.lng,
            address: suggestion.description || suggestion.mainText
        });
        setShowLocationSearch(false);
        setLocationQuery('');
        setLocationSuggestions([]);
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const navLinks = [
        { href: '/', label: 'Home' },
        { href: '/restaurants', label: 'Restaurants' },
    ];

    const dashboardLink = user?.role === 'restaurant' 
        ? { href: '/dashboard/restaurant', label: 'Dashboard', icon: ChefHat }
        : user?.role === 'delivery'
        ? { href: '/dashboard/delivery', label: 'Dashboard', icon: Bike }
        : null;

    return (
        <nav className="sticky top-0 z-50 nav-glass" data-testid="navbar">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link to="/" className="flex-shrink-0">
                        <Logo size="default" />
                    </Link>

                    {/* Location Selector - Desktop */}
                    <div className="hidden md:flex items-center gap-2 flex-1 max-w-md mx-4">
                        <Popover open={showLocationSearch} onOpenChange={setShowLocationSearch}>
                            <PopoverTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground w-full justify-start border-primary/30 hover:border-primary"
                                    data-testid="location-selector-btn"
                                >
                                    <MapPin size={18} className="text-primary flex-shrink-0" />
                                    <span className="truncate text-sm">
                                        {location?.address || 'Select delivery location'}
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0 z-[200]" align="start" sideOffset={8}>
                                <div className="p-3 border-b border-border bg-card">
                                    <p className="text-sm font-medium mb-2">Deliver to</p>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="text"
                                            placeholder="Search for area, street name..."
                                            value={locationQuery}
                                            onChange={(e) => setLocationQuery(e.target.value)}
                                            className="pl-9 pr-8"
                                            data-testid="location-search-input"
                                        />
                                        {searchingLocation && (
                                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                        )}
                                    </div>
                                </div>
                                <div className="max-h-64 overflow-y-auto bg-card">
                                    {/* Detect Location Option */}
                                    <button
                                        onClick={handleDetectLocation}
                                        disabled={locating}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary/50 border-b border-border transition-colors"
                                        data-testid="detect-location-option"
                                    >
                                        {locating ? (
                                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        ) : (
                                            <MapPin className="h-5 w-5 text-primary" />
                                        )}
                                        <div className="text-left">
                                            <p className="font-medium text-sm">Use current location</p>
                                            <p className="text-xs text-muted-foreground">Using GPS</p>
                                        </div>
                                    </button>

                                    {/* Search Results */}
                                    {locationSuggestions.map((suggestion, index) => (
                                        <button
                                            key={suggestion.placeId || index}
                                            onClick={() => handleSelectLocation(suggestion)}
                                            className="w-full px-4 py-3 flex items-start gap-3 hover:bg-secondary/50 transition-colors text-left"
                                            data-testid={`location-suggestion-${index}`}
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
                                    {locationQuery.length >= 2 && locationSuggestions.length === 0 && !searchingLocation && (
                                        <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                                            No locations found
                                        </div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-6">
                        {navLinks.map(link => (
                            <Link 
                                key={link.href}
                                to={link.href} 
                                className={`nav-link ${pathname === link.href ? 'active text-foreground' : ''}`}
                            >
                                {link.label}
                            </Link>
                        ))}
                        
                        {dashboardLink && (
                            <Link 
                                to={dashboardLink.href} 
                                className={`nav-link flex items-center gap-1 ${pathname.includes('dashboard') ? 'active text-foreground' : ''}`}
                            >
                                <dashboardLink.icon size={16} />
                                {dashboardLink.label}
                            </Link>
                        )}

                        {/* Cart */}
                        <Link to="/cart" className="relative" data-testid="cart-link">
                            <Button variant="ghost" size="icon">
                                <ShoppingCart size={20} />
                            </Button>
                            {cartCount > 0 && (
                                <span className="cart-badge" data-testid="cart-count">{cartCount}</span>
                            )}
                        </Link>

                        {/* User Menu */}
                        {isAuthenticated ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" data-testid="user-menu-trigger">
                                        <User size={20} />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <div className="px-2 py-1.5">
                                        <p className="text-sm font-medium">{user?.name || 'User'}</p>
                                        <p className="text-xs text-muted-foreground">{user?.phone}</p>
                                        <p className="text-xs text-muted-foreground capitalize">{user?.role || 'customer'}</p>
                                    </div>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <Link to={user?.role === 'restaurant' ? '/restaurant-profile' : '/profile'}>Profile</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link to="/orders">My Orders</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                                        <LogOut size={16} className="mr-2" />
                                        Logout
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Button 
                                onClick={onAuthClick} 
                                className="btn-primary"
                                data-testid="login-btn"
                            >
                                Login
                            </Button>
                        )}
                    </div>

                    {/* Mobile Menu */}
                    <div className="flex md:hidden items-center gap-1">
                        {/* Location Button - Mobile Header */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="flex items-center gap-1 max-w-[140px] px-2 h-9"
                                    data-testid="mobile-location-btn"
                                >
                                    {locating ? (
                                        <Loader2 size={16} className="text-primary animate-spin flex-shrink-0" />
                                    ) : (
                                        <MapPin size={16} className="text-primary flex-shrink-0" />
                                    )}
                                    <span className="text-xs truncate">
                                        {locating ? 'Detecting...' : location?.address?.split(',')[0] || 'Location'}
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0 z-[200]" align="center" sideOffset={8}>
                                <div className="p-3 border-b border-border">
                                    <p className="text-sm font-medium mb-2">Delivery Location</p>
                                    
                                    {/* Detect Location Button */}
                                    <Button 
                                        variant="outline"
                                        className="w-full justify-start gap-2 mb-2 h-10"
                                        onClick={handleDetectLocation}
                                        disabled={locating}
                                        data-testid="mobile-detect-gps-btn"
                                    >
                                        {locating ? (
                                            <Loader2 size={16} className="animate-spin text-primary" />
                                        ) : (
                                            <Navigation size={16} className="text-primary" />
                                        )}
                                        <span className="text-sm">
                                            {locating ? 'Detecting...' : 'Use GPS Location'}
                                        </span>
                                    </Button>
                                    
                                    {/* Search Input */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="text"
                                            placeholder="Search area, street..."
                                            value={locationQuery}
                                            onChange={(e) => setLocationQuery(e.target.value)}
                                            className="pl-9 pr-8 h-10"
                                            data-testid="mobile-location-search-input"
                                        />
                                        {searchingLocation && (
                                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                        )}
                                    </div>
                                </div>
                                
                                {/* Search Results */}
                                {locationSuggestions.length > 0 && (
                                    <div className="max-h-48 overflow-y-auto">
                                        {locationSuggestions.map((suggestion, idx) => (
                                            <button
                                                key={idx}
                                                className="w-full text-left px-3 py-2 hover:bg-secondary text-sm border-b border-border last:border-0"
                                                onClick={() => handleSelectLocation(suggestion)}
                                            >
                                                <p className="font-medium truncate">{suggestion.mainText}</p>
                                                <p className="text-xs text-muted-foreground truncate">{suggestion.secondaryText}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Current Location Display */}
                                {location?.address && (
                                    <div className="p-3 bg-green-50 border-t border-green-100">
                                        <div className="flex items-start gap-2">
                                            <MapPin size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-xs text-green-700 font-medium">Current location</p>
                                                <p className="text-xs text-green-600 truncate">{location.address}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>

                        {/* Login Button - Mobile */}
                        {!isAuthenticated && (
                            <Button 
                                onClick={onAuthClick} 
                                className="btn-primary text-sm px-3 py-1 h-8"
                                data-testid="login-btn-mobile"
                            >
                                Login
                            </Button>
                        )}

                        {/* Cart - Mobile */}
                        <Link to="/cart" className="relative" data-testid="cart-link-mobile">
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                                <ShoppingCart size={20} />
                            </Button>
                            {cartCount > 0 && (
                                <span className="cart-badge">{cartCount}</span>
                            )}
                        </Link>

                        {/* Menu Button - Mobile */}
                        <Sheet open={isOpen} onOpenChange={setIsOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9" data-testid="mobile-menu-trigger">
                                    <Menu size={22} />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[300px] bg-background">
                                <div className="flex flex-col gap-6 mt-8">
                                    {/* Nav Links */}
                                    <div className="flex flex-col gap-2">
                                        {navLinks.map(link => (
                                            <Link 
                                                key={link.href}
                                                to={link.href} 
                                                className="px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-800 font-medium"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                {link.label}
                                            </Link>
                                        ))}
                                        {dashboardLink && (
                                            <Link 
                                                to={dashboardLink.href} 
                                                className="px-4 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-2 text-gray-800 font-medium"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                <dashboardLink.icon size={16} />
                                                {dashboardLink.label}
                                            </Link>
                                        )}
                                    </div>

                                    {/* Auth - Only show for logged in users */}
                                    {isAuthenticated && (
                                        <div className="flex flex-col gap-2 border-t border-border pt-4">
                                            <div className="px-4 py-2">
                                                <p className="font-medium">{user?.name}</p>
                                                <p className="text-sm text-muted-foreground">{user?.phone}</p>
                                                <p className="text-xs text-muted-foreground capitalize">{user?.role || 'customer'}</p>
                                            </div>
                                            <Link 
                                                to={user?.role === 'restaurant' ? '/restaurant-profile' : '/profile'}
                                                className="px-4 py-2 rounded-lg hover:bg-secondary"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                Profile
                                            </Link>
                                            <Link 
                                                to="/orders" 
                                                className="px-4 py-2 rounded-lg hover:bg-secondary"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                My Orders
                                            </Link>
                                            <Button 
                                                variant="destructive" 
                                                onClick={() => { handleLogout(); setIsOpen(false); }}
                                                className="mt-2"
                                            >
                                                <LogOut size={16} className="mr-2" />
                                                Logout
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
