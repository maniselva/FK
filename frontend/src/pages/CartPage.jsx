import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ArrowLeft, MapPin, ShoppingBag, Tag, X, CreditCard, Wallet, LogIn, Gift, Truck, Shirt, AlertTriangle, Sparkles, Crosshair, Navigation, Home, Briefcase, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { useApp } from '../contexts/AppContext';
import { toast } from 'sonner';
import axios from 'axios';
import AddressSearch from '../components/AddressSearch';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CartPage() {
    const navigate = useNavigate();
    const { 
        user, 
        isAuthenticated, 
        cart, 
        updateCartItemQuantity, 
        removeFromCart, 
        clearCart, 
        getCartTotal,
        location,
        detectLocation,
        addAddress,
        setShowAuth
    } = useApp();
    
    const [placing, setPlacing] = useState(false);
    const [showAddressDialog, setShowAddressDialog] = useState(false);
    const [notes, setNotes] = useState('');
    const [newAddress, setNewAddress] = useState({
        label: 'Home',
        full_address: '',
        lat: null,
        lng: null
    });
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [locating, setLocating] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('online');
    const [promoCode, setPromoCode] = useState('');
    const [appliedPromo, setAppliedPromo] = useState(null);
    const [availablePromos, setAvailablePromos] = useState([]);
    const [applyingPromo, setApplyingPromo] = useState(false);
    
    // Address selection mode: 'detected' or 'saved'
    const [addressMode, setAddressMode] = useState('detected');
    const [detectedAddress, setDetectedAddress] = useState(null);
    const [detectingLocation, setDetectingLocation] = useState(true);
    
    // Special offers
    const [freeDeliveryApplied, setFreeDeliveryApplied] = useState(false);
    const [tshirtEligible, setTshirtEligible] = useState(false);
    const [tshirtApplied, setTshirtApplied] = useState(false);
    
    // Dynamic delivery fee
    const [deliveryFeeInfo, setDeliveryFeeInfo] = useState({ 
        fee: 10, 
        serviceable: true, 
        message: '', 
        distance_km: null,
        is_first_order: false,
        cod_fee: 5
    });
    const [loadingFee, setLoadingFee] = useState(false);

    // Auto-detect location on page load (FIRST PRIORITY)
    useEffect(() => {
        const autoDetectLocation = async () => {
            setDetectingLocation(true);
            try {
                const loc = await detectLocation();
                if (loc && loc.lat && loc.lng) {
                    setDetectedAddress({
                        label: 'Current Location',
                        full_address: loc.address || 'Detected Location',
                        lat: loc.lat,
                        lng: loc.lng,
                        isDetected: true
                    });
                    setAddressMode('detected');
                    toast.success('📍 Location detected! You can also choose from saved addresses.');
                }
            } catch (error) {
                console.log('Auto location detection failed:', error);
                // Fall back to saved addresses if detection fails
                if (user?.addresses?.length > 0) {
                    setAddressMode('saved');
                    setSelectedAddress(user.addresses[0]);
                }
            } finally {
                setDetectingLocation(false);
            }
        };
        
        if (isAuthenticated && cart.items.length > 0) {
            autoDetectLocation();
        }
    }, [isAuthenticated, cart.items.length]);

    // Get the effective delivery address based on selection mode
    const getEffectiveAddress = () => {
        if (addressMode === 'detected' && detectedAddress) {
            return detectedAddress;
        }
        return selectedAddress || user?.addresses?.[0];
    };

    const effectiveAddress = getEffectiveAddress();

    const cartTotal = getCartTotal();
    const deliveryFee = (freeDeliveryApplied || appliedPromo?.discount_type === 'free_delivery') ? 0 : (cartTotal > 0 ? deliveryFeeInfo.fee : 0);
    const codFee = paymentMethod === 'cod' && !deliveryFeeInfo.is_first_order ? deliveryFeeInfo.cod_fee : 0;
    const discount = appliedPromo ? appliedPromo.discount : 0;
    const freeDeliveryCharge = freeDeliveryApplied ? 50 : 0;
    const grandTotal = Math.max(0, cartTotal - discount) + deliveryFee + codFee + freeDeliveryCharge;

    // Fetch delivery fee when address or restaurant changes
    const fetchDeliveryFee = useCallback(async () => {
        const address = getEffectiveAddress();
        if (!cart.restaurantId || !address?.lat || !address?.lng) {
            return;
        }
        
        setLoadingFee(true);
        try {
            const response = await axios.get(`${API}/delivery-fee`, {
                params: {
                    restaurant_id: cart.restaurantId,
                    customer_lat: address.lat,
                    customer_lng: address.lng,
                    user_id: user?.id || null
                }
            });
            setDeliveryFeeInfo(response.data);
            
            if (!response.data.serviceable) {
                toast.error(response.data.message);
            } else if (response.data.is_first_order) {
                toast.success('🎉 First order! FREE delivery for you!');
            } else if (response.data.fee === 0) {
                toast.success('Free delivery applied!');
            }
        } catch (error) {
            console.error('Failed to fetch delivery fee:', error);
            setDeliveryFeeInfo({ fee: 10, serviceable: true, message: 'Standard delivery fee', distance_km: null, is_first_order: false, cod_fee: 5 });
        } finally {
            setLoadingFee(false);
        }
    }, [cart.restaurantId, addressMode, detectedAddress, selectedAddress, user?.id]);

    useEffect(() => {
        fetchDeliveryFee();
    }, [fetchDeliveryFee]);

    // Check t-shirt eligibility
    useEffect(() => {
        setTshirtEligible(cartTotal >= 999);
    }, [cartTotal]);

    useEffect(() => {
        if (cart.restaurantId) {
            fetchAvailablePromos();
        }
    }, [cart.restaurantId]);

    const fetchAvailablePromos = async () => {
        try {
            const response = await axios.get(`${API}/promos/available?restaurant_id=${cart.restaurantId}`);
            setAvailablePromos(response.data);
        } catch (error) {
            console.error('Failed to fetch promos:', error);
        }
    };

    const handleApplyPromo = async () => {
        if (!promoCode.trim()) {
            toast.error('Please enter a promo code');
            return;
        }

        if (!isAuthenticated) {
            toast.error('Please login to apply promo code');
            return;
        }

        setApplyingPromo(true);
        try {
            const response = await axios.post(`${API}/promos/apply`, {
                code: promoCode.toUpperCase(),
                order_amount: cartTotal,
                restaurant_id: cart.restaurantId,
                user_id: user.id
            });

            setAppliedPromo(response.data);
            toast.success(response.data.message);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Invalid promo code');
        } finally {
            setApplyingPromo(false);
        }
    };

    const removePromo = () => {
        setAppliedPromo(null);
        setPromoCode('');
        toast.success('Promo removed');
    };

    const handleRedetectLocation = async () => {
        setLocating(true);
        try {
            const loc = await detectLocation();
            if (loc && loc.lat && loc.lng) {
                setDetectedAddress({
                    label: 'Current Location',
                    full_address: loc.address || 'Detected Location',
                    lat: loc.lat,
                    lng: loc.lng,
                    isDetected: true
                });
                setAddressMode('detected');
                toast.success('📍 Location updated!');
            }
        } catch (error) {
            toast.error('Failed to detect location. Please try again or use a saved address.');
        } finally {
            setLocating(false);
        }
    };

    const handleDetectLocation = async () => {
        setLocating(true);
        try {
            const loc = await detectLocation();
            setNewAddress(prev => ({
                ...prev,
                full_address: loc.address,
                lat: loc.lat,
                lng: loc.lng
            }));
            toast.success('Location detected!');
        } catch (error) {
            toast.error('Failed to detect location. Please enter manually.');
        } finally {
            setLocating(false);
        }
    };

    const handleAddAddress = async () => {
        if (!newAddress.full_address) {
            toast.error('Please enter an address');
            return;
        }
        
        try {
            await addAddress(newAddress);
            setShowAddressDialog(false);
            setNewAddress({ label: 'Home', full_address: '', lat: null, lng: null });
            toast.success('Address added!');
        } catch (error) {
            toast.error('Failed to add address');
        }
    };

    const handlePlaceOrder = async () => {
        if (!isAuthenticated) {
            toast.error('Please login to place order');
            return;
        }

        const deliveryAddress = getEffectiveAddress();
        if (!deliveryAddress) {
            toast.error('Please select a delivery address');
            setShowAddressDialog(true);
            return;
        }

        if (!deliveryAddress.lat || !deliveryAddress.lng) {
            toast.error('Please select a valid address with location');
            return;
        }

        setPlacing(true);
        try {
            const orderData = {
                restaurant_id: cart.restaurantId,
                items: cart.items.map(item => ({
                    menu_item_id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    image: item.image
                })),
                delivery_address: deliveryAddress,
                payment_method: paymentMethod,
                promo_code: appliedPromo?.code || null,
                notes: notes || null,
                free_delivery_applied: freeDeliveryApplied,
                tshirt_reward: tshirtApplied,
                delivery_fee: deliveryFee,
                cod_fee: codFee,
                is_first_order: deliveryFeeInfo.is_first_order
            };

            const response = await axios.post(`${API}/orders?user_id=${user.id}`, orderData);
            const orderId = response.data.id;
            
            // If t-shirt is applied, send notification to admin
            if (tshirtApplied) {
                await axios.post(`${API}/admin/tshirt-orders`, {
                    order_id: orderId,
                    user_id: user.id,
                    user_phone: user.phone,
                    user_name: user.name || 'Customer',
                    order_amount: cartTotal
                });
            }
            
            // Handle online payment via Cashfree
            if (paymentMethod === 'online') {
                toast.loading('Initializing payment...', { id: 'payment' });
                
                try {
                    const paymentResponse = await axios.post(`${API}/payments/cashfree/initiate`, {
                        order_id: orderId,
                        amount: grandTotal,
                        user_phone: user.phone,
                        user_id: user.id,
                        user_email: user.email || 'customer@foodkey.in',
                        user_name: user.name || 'Customer',
                        origin_url: window.location.origin
                    });
                    
                    if (paymentResponse.data.success && paymentResponse.data.payment_session_id) {
                        toast.dismiss('payment');
                        
                        // Use Cashfree JS SDK to open checkout
                        const cashfree = window.Cashfree({
                            mode: "production"
                        });
                        
                        const checkoutOptions = {
                            paymentSessionId: paymentResponse.data.payment_session_id,
                            redirectTarget: "_self"
                        };
                        
                        cashfree.checkout(checkoutOptions);
                        return;
                    } else {
                        toast.dismiss('payment');
                        toast.error('Failed to initiate payment. Please try again.');
                        // Delete the order if payment initiation failed
                        await axios.delete(`${API}/orders/${orderId}`).catch(() => {});
                        return;
                    }
                } catch (paymentError) {
                    toast.dismiss('payment');
                    toast.error('Payment initiation failed. Order cancelled.');
                    await axios.delete(`${API}/orders/${orderId}`).catch(() => {});
                    return;
                }
            }
            
            // For COD orders, proceed directly
            clearCart();
            toast.success('Order placed successfully!');
            navigate(`/track/${orderId}`);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to place order');
            console.error(error);
        } finally {
            setPlacing(false);
        }
    };

    if (cart.items.length === 0) {
        return (
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 text-center" data-testid="empty-cart">
                <ShoppingBag size={64} className="mx-auto text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
                <p className="text-muted-foreground mb-6">Add some delicious items to get started!</p>
                <Link to="/restaurants">
                    <Button className="btn-primary" data-testid="browse-restaurants-btn">
                        Browse Restaurants
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8" data-testid="cart-page">
            {/* Back Button */}
            <Link 
                to={`/restaurant/${cart.restaurantId}`} 
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
                data-testid="back-to-restaurant"
            >
                <ArrowLeft size={20} />
                Back to {cart.restaurantName}
            </Link>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Cart Items */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-card rounded-2xl border border-border p-6">
                        <h2 className="text-xl font-bold mb-4">Your Order from {cart.restaurantName}</h2>
                        
                        <div className="space-y-4">
                            {cart.items.map(item => (
                                <div 
                                    key={item.id} 
                                    className="flex gap-4 p-4 rounded-xl border border-border"
                                    data-testid={`cart-item-${item.id}`}
                                >
                                    <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-20 h-20 rounded-lg object-cover"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="font-medium">{item.name}</h3>
                                                <p className="price-tag">₹{item.price}</p>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.id)}
                                                className="text-muted-foreground hover:text-destructive transition-colors"
                                                data-testid={`remove-${item.id}`}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                        
                                        <div className="mt-2 flex items-center justify-between">
                                            <div className="qty-selector px-1 py-1">
                                                <button
                                                    onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                                                    className="qty-btn"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span className="w-8 text-center text-sm">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                                                    className="qty-btn"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                            <span className="font-semibold price-tag">
                                                ₹{item.price * item.quantity}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Notes */}
                        <div className="mt-6">
                            <Label htmlFor="notes">Special Instructions (Optional)</Label>
                            <Textarea
                                id="notes"
                                placeholder="Any special requests for your order..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="mt-2"
                                data-testid="order-notes"
                            />
                        </div>
                    </div>

                    {/* Delivery Address - Radio Selection */}
                    {isAuthenticated && (
                        <div className="bg-card rounded-2xl border border-border p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold">Delivery Address</h2>
                                <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" data-testid="add-address-btn">
                                            <Plus size={16} className="mr-1" />
                                            Add New
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Add Delivery Address</DialogTitle>
                                            <DialogDescription>
                                                Search for your address or enter it manually below.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 mt-4">
                                            <div>
                                                <Label>Label</Label>
                                                <Input
                                                    value={newAddress.label}
                                                    onChange={(e) => setNewAddress(prev => ({ ...prev, label: e.target.value }))}
                                                    placeholder="e.g., Home, Office"
                                                    className="mt-1"
                                                />
                                            </div>
                                            <div>
                                                <Label>Search Address</Label>
                                                <AddressSearch
                                                    placeholder="Search for your address..."
                                                    className="mt-1"
                                                    onSelect={(addr) => {
                                                        setNewAddress(prev => ({ 
                                                            ...prev, 
                                                            full_address: addr.address,
                                                            lat: addr.lat,
                                                            lng: addr.lng
                                                        }));
                                                        toast.success('Address selected!');
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <Label>Full Address</Label>
                                                <Textarea
                                                    value={newAddress.full_address}
                                                    onChange={(e) => setNewAddress(prev => ({ ...prev, full_address: e.target.value }))}
                                                    placeholder="Your complete address will appear here"
                                                    className="mt-1"
                                                    data-testid="new-address-input"
                                                />
                                            </div>
                                            <Button
                                                onClick={handleAddAddress}
                                                className="w-full btn-primary"
                                                data-testid="save-address-btn"
                                            >
                                                Save Address
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            {/* Location Detection Status */}
                            {detectingLocation && (
                                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        <div>
                                            <p className="font-medium text-blue-700">Detecting your location...</p>
                                            <p className="text-sm text-blue-600">Please allow location access</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Address Selection with Radio Buttons */}
                            {!detectingLocation && (
                                <div className="space-y-3">
                                    {/* Current Location Option */}
                                    <div 
                                        onClick={() => {
                                            if (detectedAddress) {
                                                setAddressMode('detected');
                                            } else {
                                                handleRedetectLocation();
                                            }
                                        }}
                                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                                            addressMode === 'detected' && detectedAddress
                                                ? 'border-green-500 bg-green-50'
                                                : 'border-border hover:border-green-300'
                                        }`}
                                        data-testid="use-current-location"
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Radio Button */}
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                addressMode === 'detected' && detectedAddress
                                                    ? 'border-green-500 bg-green-500'
                                                    : 'border-gray-300'
                                            }`}>
                                                {addressMode === 'detected' && detectedAddress && (
                                                    <Check size={12} className="text-white" />
                                                )}
                                            </div>
                                            
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <Crosshair size={18} className="text-green-600" />
                                                    <span className="font-semibold text-green-700">Use Current Location</span>
                                                    <Badge className="bg-green-100 text-green-700 text-xs">Recommended</Badge>
                                                </div>
                                                
                                                {detectedAddress ? (
                                                    <div className="mt-2">
                                                        <p className="text-sm text-gray-600">{detectedAddress.full_address}</p>
                                                        <Button
                                                            variant="link"
                                                            size="sm"
                                                            className="p-0 h-auto text-green-600 text-xs mt-1"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRedetectLocation();
                                                            }}
                                                            disabled={locating}
                                                        >
                                                            {locating ? (
                                                                <>
                                                                    <div className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin mr-1"></div>
                                                                    Detecting...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Navigation size={12} className="mr-1" />
                                                                    Re-detect Location
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-500 mt-1">
                                                        {locating ? 'Detecting location...' : 'Click to detect your current location'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    {user?.addresses?.length > 0 && (
                                        <div className="flex items-center gap-3 py-2">
                                            <div className="flex-1 border-t border-gray-200"></div>
                                            <span className="text-xs text-gray-400 uppercase">or choose from</span>
                                            <div className="flex-1 border-t border-gray-200"></div>
                                        </div>
                                    )}

                                    {/* Saved Addresses */}
                                    {user?.addresses?.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-gray-600">Saved Addresses</p>
                                            {user.addresses.map((addr, idx) => (
                                                <div
                                                    key={addr.id || idx}
                                                    onClick={() => {
                                                        setAddressMode('saved');
                                                        setSelectedAddress(addr);
                                                    }}
                                                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                                                        addressMode === 'saved' && (selectedAddress?.id === addr.id || (!selectedAddress && idx === 0))
                                                            ? 'border-primary bg-primary/5'
                                                            : 'border-border hover:border-primary/50'
                                                    }`}
                                                    data-testid={`address-${idx}`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        {/* Radio Button */}
                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                            addressMode === 'saved' && (selectedAddress?.id === addr.id || (!selectedAddress && idx === 0))
                                                                ? 'border-primary bg-primary'
                                                                : 'border-gray-300'
                                                        }`}>
                                                            {addressMode === 'saved' && (selectedAddress?.id === addr.id || (!selectedAddress && idx === 0)) && (
                                                                <Check size={12} className="text-white" />
                                                            )}
                                                        </div>
                                                        
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                {addr.label?.toLowerCase() === 'home' ? (
                                                                    <Home size={16} className="text-primary" />
                                                                ) : addr.label?.toLowerCase() === 'work' || addr.label?.toLowerCase() === 'office' ? (
                                                                    <Briefcase size={16} className="text-primary" />
                                                                ) : (
                                                                    <MapPin size={16} className="text-primary" />
                                                                )}
                                                                <span className="font-medium">{addr.label}</span>
                                                            </div>
                                                            <p className="text-sm text-gray-500 mt-1">{addr.full_address}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* No addresses message */}
                                    {!detectedAddress && user?.addresses?.length === 0 && (
                                        <div className="text-center py-4">
                                            <MapPin size={32} className="mx-auto text-gray-400 mb-2" />
                                            <p className="text-gray-500">No addresses available</p>
                                            <p className="text-sm text-gray-400">Detect your location or add a new address</p>
                                        </div>
                                    )}

                                    {/* Selected Address Summary */}
                                    {effectiveAddress && (
                                        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Delivering to</p>
                                            <div className="flex items-center gap-2">
                                                {addressMode === 'detected' ? (
                                                    <Crosshair size={14} className="text-green-600" />
                                                ) : (
                                                    <MapPin size={14} className="text-primary" />
                                                )}
                                                <p className="font-medium text-sm truncate">
                                                    {effectiveAddress.label || 'Selected Location'}: {effectiveAddress.full_address?.substring(0, 50)}...
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Order Summary */}
                <div className="lg:col-span-1">
                    <div className="sticky top-24 space-y-4">
                        {/* Special Offers Section */}
                        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-2xl border border-orange-200 p-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                                <Gift size={18} className="text-orange-500" />
                                Special Offers
                            </h3>
                            
                            {/* Free Delivery Offer */}
                            <div className={`p-3 rounded-lg border mb-3 ${freeDeliveryApplied ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
                                <div className="flex items-start gap-3">
                                    <Truck size={20} className={freeDeliveryApplied ? 'text-green-500' : 'text-orange-500'} />
                                    <div className="flex-1">
                                        <p className="font-medium text-sm text-gray-800">
                                            Pay ₹50 & Get Unlimited Free Delivery
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Free delivery on all orders for 1 month
                                        </p>
                                    </div>
                                    {!freeDeliveryApplied ? (
                                        <Button 
                                            size="sm" 
                                            className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-7 px-3"
                                            onClick={() => {
                                                setFreeDeliveryApplied(true);
                                                toast.success('Free delivery membership applied! ₹50 added to your order.');
                                            }}
                                            data-testid="apply-free-delivery"
                                        >
                                            Apply
                                        </Button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-green-500 text-white text-xs">Applied ✓</Badge>
                                            <button 
                                                onClick={() => {
                                                    setFreeDeliveryApplied(false);
                                                    toast.success('Free delivery offer removed');
                                                }}
                                                className="text-xs text-red-500 hover:text-red-700 underline"
                                                data-testid="remove-free-delivery"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* T-Shirt Offer */}
                            <div className={`p-3 rounded-lg border ${tshirtApplied ? 'bg-green-50 border-green-300' : tshirtEligible ? 'bg-white border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="flex items-start gap-3">
                                    <Shirt size={20} className={tshirtApplied ? 'text-green-500' : tshirtEligible ? 'text-green-600' : 'text-gray-400'} />
                                    <div className="flex-1">
                                        <p className={`font-medium text-sm ${tshirtEligible ? 'text-gray-800' : 'text-gray-500'}`}>
                                            Order ₹999+ & Get FoodKey T-Shirt FREE!
                                        </p>
                                        {tshirtApplied ? (
                                            <p className="text-xs text-green-600 font-semibold mt-1">
                                                🎉 Yay! You'll get your T-shirt with this order!
                                            </p>
                                        ) : tshirtEligible ? (
                                            <p className="text-xs text-green-600 mt-0.5">
                                                You're eligible! Click Apply to claim.
                                            </p>
                                        ) : (
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                Add ₹{999 - cartTotal} more to unlock this offer
                                            </p>
                                        )}
                                    </div>
                                    {!tshirtApplied && tshirtEligible && (
                                        <Button 
                                            size="sm" 
                                            className="bg-green-500 hover:bg-green-600 text-white text-xs h-7 px-3"
                                            onClick={() => {
                                                setTshirtApplied(true);
                                                toast.success('🎉 Yay! You\'ll get a FREE FoodKey T-shirt with this order!');
                                            }}
                                            data-testid="apply-tshirt"
                                        >
                                            Apply
                                        </Button>
                                    )}
                                    {tshirtApplied && (
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-green-500 text-white text-xs">Claimed ✓</Badge>
                                            <button 
                                                onClick={() => {
                                                    setTshirtApplied(false);
                                                    toast.success('T-Shirt offer removed');
                                                }}
                                                className="text-xs text-red-500 hover:text-red-700 underline"
                                                data-testid="remove-tshirt"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Order Summary Card */}
                        <div className="bg-card rounded-2xl border border-border p-6">
                            <h2 className="text-xl font-bold mb-4">Order Summary</h2>
                        
                        {/* Promo Code Section */}
                        <div className="mb-6">
                            {appliedPromo ? (
                                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Tag size={16} className="text-green-600" />
                                            <span className="font-mono font-medium text-green-600">{appliedPromo.code}</span>
                                        </div>
                                        <button onClick={removePromo} className="text-muted-foreground hover:text-destructive">
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <p className="text-sm text-green-600 mt-1">-₹{appliedPromo.discount} applied!</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Promo code"
                                            value={promoCode}
                                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                                            className="font-mono"
                                            data-testid="promo-input"
                                        />
                                        <Button 
                                            variant="outline" 
                                            onClick={handleApplyPromo}
                                            disabled={applyingPromo}
                                        >
                                            {applyingPromo ? '...' : 'Apply'}
                                        </Button>
                                    </div>
                                    {availablePromos.length > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground">Available offers:</p>
                                            {availablePromos.slice(0, 3).map((promo, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setPromoCode(promo.code)}
                                                    className="w-full text-left p-2 rounded-lg bg-secondary/50 hover:bg-secondary text-xs"
                                                >
                                                    <span className="font-mono font-bold text-primary">{promo.code}</span>
                                                    <span className="text-muted-foreground ml-2">{promo.description}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Payment Method */}
                        <div className="mb-6">
                            <p className="text-sm font-medium mb-2">Payment Method</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setPaymentMethod('cod')}
                                    className={`p-3 rounded-lg border text-sm flex items-center gap-2 transition-colors ${
                                        paymentMethod === 'cod' 
                                            ? 'border-primary bg-primary/10 text-primary' 
                                            : 'border-border hover:border-primary/50'
                                    }`}
                                    data-testid="payment-cod"
                                >
                                    <Wallet size={16} />
                                    Cash on Delivery
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('online')}
                                    className={`p-3 rounded-lg border text-sm flex items-center gap-2 transition-colors ${
                                        paymentMethod === 'online' 
                                            ? 'border-green-500 bg-green-500/10 text-green-500' 
                                            : 'border-border hover:border-green-500/50'
                                    }`}
                                    data-testid="payment-online"
                                >
                                    <CreditCard size={16} />
                                    <span className="flex items-center gap-1">
                                        Pay Online <span className="font-semibold text-green-600">(Cashfree)</span>
                                    </span>
                                </button>
                            </div>
                            {paymentMethod === 'online' && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    You'll be redirected to Cashfree to complete payment securely.
                                </p>
                            )}
                        </div>
                        
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>₹{cartTotal}</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Discount</span>
                                    <span>-₹{discount}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground">Delivery Fee</span>
                                    {deliveryFeeInfo.distance_km && (
                                        <span className="text-xs text-muted-foreground">
                                            {deliveryFeeInfo.distance_km}km away
                                        </span>
                                    )}
                                </div>
                                {(freeDeliveryApplied || appliedPromo?.discount_type === 'free_delivery') ? (
                                    <span className="text-green-600 font-medium">FREE</span>
                                ) : deliveryFeeInfo.is_first_order ? (
                                    <span className="text-green-600 font-medium animate-pulse">FREE (1st Order!)</span>
                                ) : loadingFee ? (
                                    <span className="text-muted-foreground">Calculating...</span>
                                ) : (
                                    <span>₹{deliveryFee}</span>
                                )}
                            </div>
                            {/* COD Fee */}
                            {paymentMethod === 'cod' && codFee > 0 && (
                                <div className="flex justify-between text-amber-600">
                                    <span>COD Convenience Fee</span>
                                    <span>₹{codFee}</span>
                                </div>
                            )}
                            {freeDeliveryApplied && (
                                <div className="flex justify-between text-orange-600">
                                    <span>Free Delivery Membership</span>
                                    <span>₹50</span>
                                </div>
                            )}
                            {tshirtApplied && (
                                <div className="flex justify-between text-green-600">
                                    <span className="flex items-center gap-1">
                                        <Shirt size={14} />
                                        Free T-Shirt
                                    </span>
                                    <span>FREE 🎁</span>
                                </div>
                            )}
                            <div className="border-t border-border pt-3">
                                <div className="flex justify-between font-bold text-lg">
                                    <span>Total</span>
                                    <span className="price-tag">₹{grandTotal}</span>
                                </div>
                            </div>
                        </div>

                        {/* First Order Free Delivery Banner */}
                        {deliveryFeeInfo.is_first_order && cartTotal > 0 && (
                            <div className="mt-4 p-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg shadow-lg animate-pulse">
                                <div className="flex items-center gap-3 text-white">
                                    <Sparkles className="w-6 h-6" />
                                    <div>
                                        <p className="font-bold text-lg">🎉 First Order Special!</p>
                                        <p className="text-sm opacity-90">FREE delivery on your first order!</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Delivery Fee Info Banner for non-first orders */}
                        {!deliveryFeeInfo.is_first_order && cartTotal > 0 && !loadingFee && (
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-xs text-blue-700">
                                    <strong>Delivery Charges:</strong> ₹20 (1km) | ₹30 (2km) | ₹40 (5km) | ₹70 (10km)
                                    {paymentMethod === 'cod' && <span className="block mt-1">COD convenience fee: ₹5</span>}
                                </p>
                            </div>
                        )}

                        {/* Not Serviceable Warning */}
                        {!deliveryFeeInfo.serviceable && selectedAddress && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-red-700">Delivery not available</p>
                                    <p className="text-xs text-red-600">{deliveryFeeInfo.message}</p>
                                </div>
                            </div>
                        )}

                        {isAuthenticated ? (
                            <Button
                                onClick={handlePlaceOrder}
                                disabled={placing || !deliveryFeeInfo.serviceable}
                                className="w-full btn-primary mt-6"
                                data-testid="place-order-btn"
                            >
                                {placing ? 'Placing Order...' : `Place Order • ₹${grandTotal}`}
                            </Button>
                        ) : (
                            <Button
                                onClick={() => setShowAuth(true)}
                                className="w-full btn-primary mt-6 flex items-center justify-center gap-2"
                                data-testid="login-to-order-btn"
                            >
                                <LogIn size={20} />
                                Login to Order
                            </Button>
                        )}

                        {!isAuthenticated && (
                            <p className="text-center text-sm text-gray-500 mt-2">
                                Please login to place your order
                            </p>
                        )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
