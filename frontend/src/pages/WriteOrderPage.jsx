import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Store, ShoppingBag, Send, CheckCircle, Clock, MapPin, Phone, CreditCard, Info, Crosshair, Navigation } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { useApp } from '../contexts/AppContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function WriteOrderPage() {
    const navigate = useNavigate();
    const { user, isAuthenticated, setShowAuth, detectLocation, location } = useApp();
    const [shopName, setShopName] = useState('');
    const [shopLocation, setShopLocation] = useState('');
    const [productItems, setProductItems] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliveryLat, setDeliveryLat] = useState(null);
    const [deliveryLng, setDeliveryLng] = useState(null);
    const [alternatePhone, setAlternatePhone] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [detectingLocation, setDetectingLocation] = useState(false);
    const [orderSubmitted, setOrderSubmitted] = useState(false);
    const [submittedOrderId, setSubmittedOrderId] = useState(null);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isAuthenticated) {
            toast.info('Please login to place a custom order');
            sessionStorage.setItem('redirect_after_login', '/write-order');
            navigate('/');
            setTimeout(() => {
                setShowAuth(true);
            }, 100);
        }
    }, [isAuthenticated, navigate, setShowAuth]);

    // Auto-detect delivery address on mount (user can edit)
    const autoFillDeliveryAddress = useCallback(async () => {
        // Priority 1: Use existing detected location from AppContext if present
        if (location?.address && location?.lat && location?.lng) {
            setDeliveryAddress(prev => prev || location.address);
            setDeliveryLat(prev => prev ?? location.lat);
            setDeliveryLng(prev => prev ?? location.lng);
            return;
        }
        // Priority 2: Use user's first saved address
        if (user?.addresses?.length > 0) {
            const addr = user.addresses[0];
            setDeliveryAddress(prev => prev || addr.full_address || '');
            setDeliveryLat(prev => prev ?? (addr.lat || null));
            setDeliveryLng(prev => prev ?? (addr.lng || null));
            return;
        }
        // Priority 3: Try to detect location
        setDetectingLocation(true);
        try {
            const loc = await detectLocation();
            if (loc?.address) {
                setDeliveryAddress(prev => prev || loc.address);
                setDeliveryLat(prev => prev ?? (loc.lat || null));
                setDeliveryLng(prev => prev ?? (loc.lng || null));
            }
        } catch (err) {
            console.log('Location auto-detect skipped:', err?.message);
        } finally {
            setDetectingLocation(false);
        }
    }, [detectLocation, location, user]);

    useEffect(() => {
        if (isAuthenticated) {
            autoFillDeliveryAddress();
        }
    }, [isAuthenticated, autoFillDeliveryAddress]);

    const handleRedetectLocation = async () => {
        setDetectingLocation(true);
        try {
            const loc = await detectLocation();
            if (loc?.address) {
                setDeliveryAddress(loc.address);
                setDeliveryLat(loc.lat || null);
                setDeliveryLng(loc.lng || null);
                toast.success('📍 Location updated!');
            } else {
                toast.error('Could not detect location. Please enter manually.');
            }
        } catch (err) {
            toast.error('Could not detect location. Please enter manually.');
        } finally {
            setDetectingLocation(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!shopName.trim()) {
            toast.error('Please enter the shop/restaurant name');
            return;
        }
        if (!shopLocation.trim()) {
            toast.error('Please enter the shop location');
            return;
        }
        if (!productItems.trim()) {
            toast.error('Please describe the products/food items you need');
            return;
        }
        if (!deliveryAddress.trim()) {
            toast.error('Please enter your delivery address');
            return;
        }

        setSubmitting(true);
        try {
            const response = await axios.post(`${API}/custom-orders`, {
                user_id: user.id,
                user_name: user.name || 'Customer',
                user_phone: user.phone,
                restaurant_name: shopName.trim(),
                shop_location: shopLocation.trim(),
                food_items: productItems.trim(),
                delivery_address: deliveryAddress.trim(),
                delivery_lat: deliveryLat,
                delivery_lng: deliveryLng,
                alternate_phone: alternatePhone.trim() || null,
                payment_method: 'online'
            });
            
            setSubmittedOrderId(response.data.id);
            setOrderSubmitted(true);
            toast.success('Order placed successfully!');
            // Auto-redirect to track page after 2 seconds
            setTimeout(() => {
                navigate(`/track/${response.data.id}`);
            }, 2000);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to place order');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-muted-foreground">Redirecting to login...</p>
                </div>
            </div>
        );
    }

    // Success state after order submission
    if (orderSubmitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                        <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </div>
                        
                        <h1 className="text-2xl font-bold text-gray-800 mb-2">
                            Order Placed Successfully!
                        </h1>
                        
                        <p className="text-gray-600 mb-6">
                            Your order from <span className="font-semibold text-green-600">{shopName}</span> has been received.
                        </p>

                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                            <div className="flex items-center justify-center gap-2 text-green-700 font-medium mb-2">
                                <Clock size={18} />
                                Estimated Delivery: Within 1 Hour
                            </div>
                            <p className="text-sm text-green-600">
                                Our team will process your order and contact you for payment.
                            </p>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                            <div className="flex items-center justify-center gap-2 text-blue-700 font-medium">
                                <CreditCard size={18} />
                                Online Payment Required
                            </div>
                            <p className="text-sm text-blue-600 mt-1">
                                You will receive a payment link once the order is confirmed.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <Button
                                onClick={() => navigate(`/track/${submittedOrderId}`)}
                                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold h-12"
                                data-testid="track-custom-order-btn"
                            >
                                <MapPin size={18} className="mr-2" />
                                Track Order
                            </Button>
                            
                            <Button
                                onClick={() => navigate('/')}
                                variant="outline"
                                className="w-full h-12"
                            >
                                Back to Home
                            </Button>
                        </div>

                        <p className="text-xs text-gray-400 mt-6">
                            Order ID: {submittedOrderId}...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
                        <Store className="w-8 h-8 text-orange-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        Order from Unlisted Shop
                    </h1>
                    <p className="text-gray-600">
                        Can't find your shop? No worries! Tell us what you need and we'll get it for you.
                    </p>
                </div>

                {/* Form */}
                <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Shop / Restaurant Name */}
                        <div>
                            <Label className="text-gray-700 font-medium flex items-center gap-2">
                                <Store size={16} />
                                Shop / Restaurant Name *
                            </Label>
                            <Input
                                type="text"
                                placeholder="Enter the shop or restaurant name"
                                value={shopName}
                                onChange={(e) => setShopName(e.target.value)}
                                className="mt-2"
                                data-testid="custom-shop-name"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Enter the exact name of the shop/restaurant
                            </p>
                        </div>

                        {/* Shop Location */}
                        <div>
                            <Label className="text-gray-700 font-medium flex items-center gap-2">
                                <MapPin size={16} />
                                Shop Location *
                            </Label>
                            <Textarea
                                placeholder="Enter the shop's address with landmarks..."
                                value={shopLocation}
                                onChange={(e) => setShopLocation(e.target.value)}
                                className="mt-2 min-h-[80px]"
                                data-testid="custom-shop-location"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Provide complete address of the shop for our delivery partner
                            </p>
                        </div>

                        {/* Product / Food Items Needed */}
                        <div>
                            <Label className="text-gray-700 font-medium flex items-center gap-2">
                                <ShoppingBag size={16} />
                                Product / Food Items Needed *
                            </Label>
                            <Textarea
                                placeholder="Describe the items you want to order...&#10;&#10;Examples:&#10;- 2x Chicken Biryani (Full)&#10;- 1kg Rice, 500g Dal&#10;- Pickup parcel from address A to B&#10;- Medicine: Paracetamol 500mg"
                                value={productItems}
                                onChange={(e) => setProductItems(e.target.value)}
                                className="mt-2 min-h-[200px]"
                                data-testid="custom-product-items"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Be specific - include quantity, size, and any special instructions
                            </p>
                        </div>

                        {/* Delivery Address */}
                        <div>
                            <div className="flex items-center justify-between">
                                <Label className="text-gray-700 font-medium flex items-center gap-2">
                                    <MapPin size={16} />
                                    Delivery Address *
                                </Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRedetectLocation}
                                    disabled={detectingLocation}
                                    className="text-orange-600 hover:text-orange-700 h-7 px-2"
                                    data-testid="custom-redetect-location"
                                >
                                    {detectingLocation ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mr-1"></div>
                                            Detecting...
                                        </>
                                    ) : (
                                        <>
                                            <Crosshair size={14} className="mr-1" />
                                            Use Current Location
                                        </>
                                    )}
                                </Button>
                            </div>
                            <Textarea
                                placeholder="Enter your complete delivery address with landmarks..."
                                value={deliveryAddress}
                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                className="mt-2 min-h-[100px]"
                                data-testid="custom-delivery-address"
                            />
                            {deliveryLat && deliveryLng && (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                    <Navigation size={12} />
                                    Location detected — edit address if needed
                                </p>
                            )}
                        </div>

                        {/* Alternate Phone Number */}
                        <div>
                            <Label className="text-gray-700 font-medium flex items-center gap-2">
                                <Phone size={16} />
                                Alternate Phone Number
                            </Label>
                            <Input
                                type="tel"
                                placeholder="Enter alternate contact number (optional)"
                                value={alternatePhone}
                                onChange={(e) => setAlternatePhone(e.target.value)}
                                className="mt-2"
                                maxLength={10}
                                data-testid="custom-alternate-phone"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                In case we can't reach your primary number
                            </p>
                        </div>

                        {/* Payment Info */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
                                <CreditCard size={18} />
                                Online Payment Only
                            </div>
                            <p className="text-sm text-blue-600">
                                Payment will be collected online after order confirmation. You will receive a payment link.
                            </p>
                        </div>

                        {/* Services Info Box */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <div className="flex items-start gap-2">
                                <Info size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm text-amber-800 font-medium mb-2">
                                        What you can order:
                                    </p>
                                    <ul className="text-sm text-amber-700 space-y-1">
                                        <li>• Food items from any restaurant</li>
                                        <li>• Groceries from local stores</li>
                                        <li>• Courier/parcel pickup and drop within 10kms</li>
                                        <li>• Familiar or general medicines</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            disabled={submitting || !shopName.trim() || !shopLocation.trim() || !productItems.trim() || !deliveryAddress.trim()}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-14 text-lg"
                            data-testid="submit-custom-order"
                        >
                            {submitting ? (
                                'Placing Order...'
                            ) : (
                                <>
                                    <Send size={20} className="mr-2" />
                                    Place Order
                                </>
                            )}
                        </Button>
                    </form>
                </div>

                {/* Footer Info */}
                <div className="text-center mt-6">
                    <p className="text-gray-600 font-medium">
                        If any assistance needed call us on{' '}
                        <a href="tel:9566722970" className="text-orange-600 font-bold hover:underline">
                            9566722970
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
