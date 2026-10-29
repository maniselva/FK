import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Star, Clock, MapPin, ArrowLeft, Search, Leaf, ShoppingCart } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useApp } from '../contexts/AppContext';
import MenuItemCard from '../components/MenuItemCard';
import RestaurantReviews from '../components/RestaurantReviews';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RestaurantPage() {
    const { id } = useParams();
    const { cart, getCartTotal, getCartItemCount } = useApp();
    const [restaurant, setRestaurant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');

    useEffect(() => {
        fetchRestaurant();
    }, [id]);

    const fetchRestaurant = async () => {
        try {
            const response = await axios.get(`${API}/restaurants/${id}`);
            setRestaurant(response.data);
        } catch (error) {
            console.error('Failed to fetch restaurant:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                <div className="skeleton h-64 rounded-2xl mb-8" />
                <div className="skeleton h-8 w-1/3 mb-4" />
                <div className="skeleton h-4 w-1/2 mb-8" />
                <div className="grid gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton h-32 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (!restaurant) {
        return (
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 text-center">
                <h1 className="text-2xl font-bold mb-4">Restaurant not found</h1>
                <Link to="/restaurants" className="text-primary hover:underline">
                    Browse all restaurants
                </Link>
            </div>
        );
    }

    // Get unique categories from menu (only from visible items)
    const visibleMenu = restaurant.menu?.filter(item => item.is_visible !== false) || [];
    const categories = ['all', ...new Set(visibleMenu.map(item => item.category))];

    // Check if an item is available based on time
    const isItemAvailableNow = (item) => {
        if (!item.available_after) return true;
        
        const now = new Date();
        const [hours, minutes] = item.available_after.split(':').map(Number);
        const availableTime = new Date();
        availableTime.setHours(hours, minutes, 0, 0);
        
        return now >= availableTime;
    };

    // Filter menu items (only visible ones)
    const filteredMenu = visibleMenu.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    const cartTotal = getCartTotal();
    const cartCount = getCartItemCount();
    const isCurrentRestaurant = cart.restaurantId === restaurant.id;

    return (
        <div className="min-h-screen" data-testid="restaurant-page">
            {/* Cover Image */}
            <div className="relative h-64 md:h-80">
                <img
                    src={restaurant.cover_image || restaurant.image}
                    alt={restaurant.name}
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                
                {/* Back Button */}
                <Link 
                    to="/restaurants" 
                    className="absolute top-4 left-4 glass rounded-full p-2 hover:bg-white/20 transition-colors"
                    data-testid="back-btn"
                >
                    <ArrowLeft size={24} />
                </Link>
            </div>

            {/* Restaurant Info */}
            <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-20 relative">
                <div className="bg-card rounded-2xl border border-border p-6 mb-8">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-2xl md:text-3xl font-bold">{restaurant.name}</h1>
                                {restaurant.is_veg && (
                                    <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                        <Leaf size={12} />
                                        Pure Veg
                                    </span>
                                )}
                            </div>
                            <p className="text-muted-foreground">{restaurant.cuisine?.join(', ')}</p>
                            <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1">
                                <MapPin size={14} />
                                {restaurant.address}
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <div className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded-lg">
                                    <Star size={16} fill="currentColor" />
                                    <span className="font-bold">{restaurant.rating}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Rating</p>
                            </div>
                            <div className="text-center">
                                <div className="flex items-center gap-1 text-foreground">
                                    <Clock size={16} />
                                    <span className="font-medium">{restaurant.delivery_time}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Delivery</p>
                            </div>
                            <div className="text-center">
                                <div className="price-tag font-bold">₹{restaurant.price_for_two}</div>
                                <p className="text-xs text-muted-foreground mt-1">for two</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Menu Section */}
                <div className="grid lg:grid-cols-4 gap-8">
                    {/* Menu List */}
                    <div className="lg:col-span-3">
                        {/* Search */}
                        <div className="relative mb-6">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input
                                type="text"
                                placeholder="Search menu..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-11"
                                data-testid="menu-search"
                            />
                        </div>

                        {/* Categories */}
                        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-6">
                            <TabsList className="flex-wrap h-auto gap-2 bg-transparent p-0">
                                {categories.map(cat => (
                                    <TabsTrigger
                                        key={cat}
                                        value={cat}
                                        className="capitalize data-[state=active]:bg-primary data-[state=active]:text-black"
                                        data-testid={`category-tab-${cat}`}
                                    >
                                        {cat}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>

                        {/* Menu Items */}
                        {filteredMenu.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                No items found
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredMenu.map(item => (
                                    <MenuItemCard key={item.id} item={item} restaurant={restaurant} />
                                ))}
                            </div>
                        )}

                        {/* Customer Reviews Section */}
                        <div className="mt-12 pt-8 border-t border-border">
                            <RestaurantReviews restaurantId={restaurant.id} />
                        </div>
                    </div>

                    {/* Cart Summary - Desktop */}
                    <div className="hidden lg:block">
                        <div className="sticky top-24 bg-card rounded-2xl border border-border p-6">
                            <h3 className="font-semibold text-lg mb-4">Your Cart</h3>
                            
                            {cartCount === 0 ? (
                                <p className="text-muted-foreground text-sm">Your cart is empty</p>
                            ) : !isCurrentRestaurant ? (
                                <div className="text-sm text-muted-foreground">
                                    <p>You have items from <span className="text-foreground font-medium">{cart.restaurantName}</span></p>
                                    <p className="mt-2">Adding items from this restaurant will clear your cart.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3 mb-4">
                                        {cart.items.map(item => (
                                            <div key={item.id} className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">
                                                    {item.name} x {item.quantity}
                                                </span>
                                                <span className="price-tag">₹{item.price * item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border-t border-border pt-4 mb-4">
                                        <div className="flex justify-between font-semibold">
                                            <span>Total</span>
                                            <span className="price-tag">₹{cartTotal}</span>
                                        </div>
                                    </div>
                                    <Link to="/cart">
                                        <Button className="w-full btn-primary" data-testid="view-cart-btn">
                                            View Cart ({cartCount} items)
                                        </Button>
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Cart Bar */}
            {cartCount > 0 && isCurrentRestaurant && (
                <div className="lg:hidden fixed bottom-0 left-0 right-0 glass p-4 border-t border-white/10">
                    <Link to="/cart">
                        <Button className="w-full btn-primary flex items-center justify-between" data-testid="mobile-cart-btn">
                            <span className="flex items-center gap-2">
                                <ShoppingCart size={20} />
                                {cartCount} items
                            </span>
                            <span className="price-tag">₹{cartTotal}</span>
                        </Button>
                    </Link>
                </div>
            )}
        </div>
    );
}
