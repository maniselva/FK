import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
    Store, Phone, Mail, MapPin, Clock, IndianRupee, 
    Edit, Save, X, ArrowLeft, ChefHat, Shield, Calendar, Image
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { format } from 'date-fns';

const API = process.env.REACT_APP_BACKEND_URL;

export default function RestaurantProfilePage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState(null);
    const [restaurant, setRestaurant] = useState(null);
    const [formData, setFormData] = useState({});

    useEffect(() => {
        const userStr = localStorage.getItem('foodkey_user');
        if (!userStr) {
            navigate('/partner/restaurant');
            return;
        }
        const userData = JSON.parse(userStr);
        setUser(userData);
        fetchRestaurantData(userData.id);
    }, [navigate]);

    const fetchRestaurantData = async (userId) => {
        setLoading(true);
        try {
            const response = await axios.get(`${API}/api/dashboard/restaurant/${userId}`);
            const data = response.data;
            setRestaurant(data.restaurant);
            setFormData({
                description: data.restaurant?.description || '',
                cuisine: data.restaurant?.cuisine?.join(', ') || '',
                opening_time: data.restaurant?.opening_time || '',
                closing_time: data.restaurant?.closing_time || '',
                price_for_two: data.restaurant?.price_for_two || '',
                delivery_time: data.restaurant?.delivery_time || '',
                is_veg: data.restaurant?.is_veg || false,
                image: data.restaurant?.image || '',
                address: data.restaurant?.address || '',
                state: data.restaurant?.state || '',
                pincode: data.restaurant?.pincode || '',
                city: data.restaurant?.city || ''
            });
        } catch (error) {
            console.error('Failed to fetch restaurant data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.put(`${API}/api/restaurants/${restaurant.id}`, {
                ...formData,
                cuisine: formData.cuisine.split(',').map(c => c.trim()).filter(c => c),
                price_for_two: parseInt(formData.price_for_two) || 0
            });
            toast.success('Profile updated successfully!');
            setEditing(false);
            fetchRestaurantData(user.id);
        } catch (error) {
            toast.error('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-gray-200 rounded-xl"></div>
                    <div className="h-48 bg-gray-200 rounded-xl"></div>
                </div>
            </div>
        );
    }

    if (!restaurant) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8 text-center">
                <Store size={64} className="mx-auto text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold mb-2">No Restaurant Found</h1>
                <p className="text-muted-foreground">You haven't registered a restaurant yet.</p>
                <Link to="/partner/restaurant">
                    <Button className="mt-4">Register Restaurant</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header with Orange Gradient */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 mb-8 text-white">
                <Link to="/partner/restaurant" className="text-white/80 hover:text-white text-sm flex items-center gap-1 mb-4">
                    <ArrowLeft size={16} /> Back to Dashboard
                </Link>
                <div className="flex items-center gap-4">
                    {restaurant.image ? (
                        <img src={restaurant.image} alt={restaurant.name} className="w-20 h-20 rounded-xl object-cover border-2 border-white/30" />
                    ) : (
                        <div className="w-20 h-20 rounded-xl bg-white/20 flex items-center justify-center">
                            <Store size={40} className="text-white" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold">{restaurant.name}</h1>
                        <p className="text-orange-100">Restaurant Profile</p>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge className={`${
                                restaurant.approval_status === 'approved' ? 'bg-green-500' :
                                restaurant.approval_status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                            } text-white border-0`}>
                                {restaurant.approval_status}
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Details Card */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 rounded-2xl border border-orange-200 dark:border-orange-800 p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Store size={20} className="text-orange-500" />
                        Restaurant Information
                    </h2>
                    {!editing ? (
                        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                            <Edit size={14} className="mr-1" /> Edit
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-green-500 hover:bg-green-600">
                                <Save size={14} className="mr-1" /> {saving ? 'Saving...' : 'Save'}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                                <X size={14} className="mr-1" /> Cancel
                            </Button>
                        </div>
                    )}
                </div>

                {/* Non-editable fields */}
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border">
                        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                            <Store size={20} className="text-orange-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Restaurant Name</p>
                            <p className="font-medium">{restaurant.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border">
                        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                            <Phone size={20} className="text-orange-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Phone Number</p>
                            <p className="font-medium">+91 {user?.phone}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border">
                        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                            <MapPin size={20} className="text-orange-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">State</p>
                            <p className="font-medium">{restaurant.state || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border">
                        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                            <Shield size={20} className="text-orange-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Pincode</p>
                            <p className="font-medium">{restaurant.pincode || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                {/* Editable fields */}
                {editing ? (
                    <div className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>Cuisine Types (comma separated)</Label>
                                <Input
                                    value={formData.cuisine}
                                    onChange={(e) => setFormData({ ...formData, cuisine: e.target.value })}
                                    placeholder="Indian, Chinese, Italian"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Price for Two (₹)</Label>
                                <Input
                                    type="number"
                                    value={formData.price_for_two}
                                    onChange={(e) => setFormData({ ...formData, price_for_two: e.target.value })}
                                    placeholder="400"
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>Opening Time</Label>
                                <Input
                                    type="time"
                                    value={formData.opening_time}
                                    onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Closing Time</Label>
                                <Input
                                    type="time"
                                    value={formData.closing_time}
                                    onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Delivery Time</Label>
                            <Input
                                value={formData.delivery_time}
                                onChange={(e) => setFormData({ ...formData, delivery_time: e.target.value })}
                                placeholder="30-40 mins"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Description</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Tell customers about your restaurant..."
                                className="mt-1"
                                rows={3}
                            />
                        </div>
                        <div>
                            <Label>Address</Label>
                            <Textarea
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                placeholder="Full restaurant address"
                                className="mt-1"
                                rows={2}
                            />
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <Label>State</Label>
                                <Input
                                    value={formData.state}
                                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                    placeholder="State"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Pincode</Label>
                                <Input
                                    value={formData.pincode}
                                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                                    placeholder="6-digit pincode"
                                    className="mt-1"
                                    maxLength={6}
                                />
                            </div>
                            <div>
                                <Label>City</Label>
                                <Input
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    placeholder="City"
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Restaurant Image URL</Label>
                            <Input
                                value={formData.image}
                                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                                placeholder="https://..."
                                className="mt-1"
                            />
                            {formData.image && (
                                <img src={formData.image} alt="Preview" className="mt-2 h-24 w-32 object-cover rounded" />
                            )}
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border">
                            <div>
                                <Label>Pure Vegetarian</Label>
                                <p className="text-xs text-muted-foreground">Toggle if your restaurant serves only vegetarian food</p>
                            </div>
                            <Switch
                                checked={formData.is_veg}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_veg: checked })}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border">
                            <p className="text-sm text-muted-foreground mb-1">Cuisine Types</p>
                            <p className="font-medium">{restaurant.cuisine?.join(', ') || 'Not specified'}</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border">
                            <p className="text-sm text-muted-foreground mb-1">Price for Two</p>
                            <p className="font-medium">₹{restaurant.price_for_two || 'N/A'}</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border">
                            <p className="text-sm text-muted-foreground mb-1">Operating Hours</p>
                            <p className="font-medium">{restaurant.opening_time} - {restaurant.closing_time}</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border">
                            <p className="text-sm text-muted-foreground mb-1">Delivery Time</p>
                            <p className="font-medium">{restaurant.delivery_time || 'N/A'}</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border col-span-2">
                            <p className="text-sm text-muted-foreground mb-1">Description</p>
                            <p className="font-medium">{restaurant.description || 'No description'}</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border col-span-2">
                            <p className="text-sm text-muted-foreground mb-1">Address</p>
                            <p className="font-medium">{restaurant.address}</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border">
                            <p className="text-sm text-muted-foreground mb-1">City</p>
                            <p className="font-medium">{restaurant.city || 'N/A'}</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border">
                            <p className="text-sm text-muted-foreground mb-1">Restaurant Image</p>
                            {restaurant.image ? (
                                <img src={restaurant.image} alt={restaurant.name} className="h-24 w-32 object-cover rounded" />
                            ) : (
                                <p className="text-sm text-yellow-600">Not uploaded</p>
                            )}
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border">
                            <p className="text-sm text-muted-foreground mb-1">Restaurant Type</p>
                            <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded-full ${restaurant.is_veg ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="font-medium">{restaurant.is_veg ? 'Pure Vegetarian' : 'Veg & Non-Veg'}</span>
                            </div>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border">
                            <p className="text-sm text-muted-foreground mb-1">Status</p>
                            <p className="font-medium">{restaurant.is_open ? '🟢 Open' : '🔴 Closed'}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Additional Info */}
            <div className="bg-gray-50 dark:bg-slate-900 rounded-2xl border p-6">
                <h3 className="font-bold mb-4">Account Information</h3>
                <div className="grid md:grid-cols-3 gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Rating</p>
                        <p className="font-medium">{restaurant.rating ? `${restaurant.rating} ⭐` : 'No ratings yet'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Total Orders</p>
                        <p className="font-medium">{restaurant.total_orders || 0}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Member Since</p>
                        <p className="font-medium">{restaurant.created_at ? format(new Date(restaurant.created_at), 'MMM d, yyyy') : 'N/A'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
