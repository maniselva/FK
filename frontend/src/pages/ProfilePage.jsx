import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Phone, Mail, Trash2, Plus, LogOut, Calendar, Shield, CreditCard, Bike, Car, FileText, Building } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { useApp } from '../contexts/AppContext';
import { toast } from 'sonner';
import axios from 'axios';
import NotificationSettings from '../components/NotificationSettings';
import AddressSearch from '../components/AddressSearch';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ProfilePage() {
    const navigate = useNavigate();
    const { user, isAuthenticated, updateProfile, addAddress, logout, detectLocation } = useApp();
    const [editing, setEditing] = useState(false);
    const [showAddressDialog, setShowAddressDialog] = useState(false);
    const [deliveryPartner, setDeliveryPartner] = useState(null);
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || ''
    });
    const [newAddress, setNewAddress] = useState({
        label: 'Home',
        full_address: '',
        lat: null,
        lng: null
    });
    const [saving, setSaving] = useState(false);
    const [locating, setLocating] = useState(false);

    // Fetch delivery partner details if user is a delivery partner
    useEffect(() => {
        const fetchDeliveryPartner = async () => {
            if (user?.role === 'delivery' && user?.id) {
                try {
                    const response = await axios.get(`${API}/delivery-partners/user/${user.id}`);
                    setDeliveryPartner(response.data);
                } catch (error) {
                    console.log('Not a delivery partner or error fetching:', error);
                }
            }
        };
        fetchDeliveryPartner();
    }, [user]);

    if (!isAuthenticated) {
        return (
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-16 text-center">
                <User size={64} className="mx-auto text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold mb-2">Login to view profile</h1>
                <p className="text-muted-foreground">Please login to manage your profile</p>
            </div>
        );
    }

    // Determine account type and colors
    const isDeliveryPartner = user?.role === 'delivery';
    const isRestaurant = user?.role === 'restaurant';
    const accountTypeLabel = isDeliveryPartner ? 'Delivery Partner Account' : isRestaurant ? 'Restaurant Partner Account' : 'Customer Account';
    const headerGradient = isDeliveryPartner 
        ? 'from-green-500 to-emerald-500' 
        : isRestaurant 
        ? 'from-orange-500 to-amber-500'
        : 'from-blue-500 to-cyan-500';
    const accentColor = isDeliveryPartner ? 'green' : isRestaurant ? 'orange' : 'blue';

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateProfile(formData);
            setEditing(false);
            toast.success('Profile updated!');
        } catch (error) {
            toast.error('Failed to update profile');
        } finally {
            setSaving(false);
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
            toast.error('Failed to detect location');
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

    const handleDeleteAddress = async (addressId) => {
        if (!addressId) {
            toast.error('Invalid address');
            return;
        }
        try {
            await axios.delete(`${API}/users/${user.id}/addresses/${addressId}`);
            toast.success('Address deleted');
            window.location.reload();
        } catch (error) {
            toast.error('Failed to delete address');
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/');
        toast.success('Logged out successfully');
    };

    return (
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-8" data-testid="profile-page">
            {/* Profile Header with dynamic gradient based on account type */}
            <div className={`bg-gradient-to-r ${headerGradient} rounded-2xl p-6 mb-8 text-white`}>
                <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                        {isDeliveryPartner ? <Bike size={40} className="text-white" /> : <User size={40} className="text-white" />}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">{deliveryPartner?.name || user?.name || 'User'}</h1>
                        <p className={`text-${accentColor}-100`}>{accountTypeLabel}</p>
                        <div className={`flex items-center gap-2 mt-1 text-sm text-${accentColor}-100`}>
                            <Calendar size={14} />
                            Member since {user?.created_at ? format(new Date(user.created_at), 'MMM yyyy') : 'N/A'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Details Card */}
            <div className={`bg-gradient-to-br from-${accentColor}-50 to-${accentColor === 'blue' ? 'cyan' : accentColor === 'green' ? 'emerald' : 'amber'}-50 dark:from-${accentColor}-950/30 dark:to-${accentColor === 'blue' ? 'cyan' : accentColor === 'green' ? 'emerald' : 'amber'}-950/30 rounded-2xl border border-${accentColor}-200 dark:border-${accentColor}-800 p-6 mb-8`}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <User size={20} className={`text-${accentColor}-500`} />
                        Personal Information
                    </h2>
                    {!editing && (
                        <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="edit-profile-btn">
                            Edit
                        </Button>
                    )}
                </div>

                {editing ? (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                className="mt-1"
                                data-testid="name-input"
                            />
                        </div>
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                className="mt-1"
                                data-testid="email-input"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleSave} disabled={saving} className="btn-primary" data-testid="save-profile-btn">
                                {saving ? 'Saving...' : 'Save'}
                            </Button>
                            <Button variant="outline" onClick={() => setEditing(false)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border">
                            <div className={`w-10 h-10 rounded-full bg-${accentColor}-100 dark:bg-${accentColor}-900 flex items-center justify-center`}>
                                <User size={20} className={`text-${accentColor}-500`} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Full Name</p>
                                <p className="font-medium">{deliveryPartner?.name || user?.name || 'Not set'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border">
                            <div className={`w-10 h-10 rounded-full bg-${accentColor}-100 dark:bg-${accentColor}-900 flex items-center justify-center`}>
                                <Phone size={20} className={`text-${accentColor}-500`} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Phone Number</p>
                                <p className="font-medium">+91 {deliveryPartner?.phone || user?.phone}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border">
                            <div className={`w-10 h-10 rounded-full bg-${accentColor}-100 dark:bg-${accentColor}-900 flex items-center justify-center`}>
                                <Mail size={20} className={`text-${accentColor}-500`} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Email Address</p>
                                <p className="font-medium">{deliveryPartner?.email || user?.email || 'Not set'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border">
                            <div className={`w-10 h-10 rounded-full bg-${accentColor}-100 dark:bg-${accentColor}-900 flex items-center justify-center`}>
                                <Shield size={20} className={`text-${accentColor}-500`} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Account Type</p>
                                <p className="font-medium capitalize">{isDeliveryPartner ? 'Delivery Partner' : isRestaurant ? 'Restaurant Partner' : 'Customer'}</p>
                            </div>
                        </div>
                        
                        {/* Delivery Partner Specific Fields */}
                        {isDeliveryPartner && deliveryPartner && (
                            <>
                                <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border">
                                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                                        <Bike size={20} className="text-green-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Vehicle Type</p>
                                        <p className="font-medium capitalize">{deliveryPartner.vehicle_type || 'Not set'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border">
                                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                                        <Car size={20} className="text-green-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Vehicle Number</p>
                                        <p className="font-medium font-mono">{deliveryPartner.vehicle_number || 'Not set'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border">
                                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                                        <FileText size={20} className="text-green-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">License Number</p>
                                        <p className="font-medium font-mono">{deliveryPartner.license_number || 'Not set'}</p>
                                    </div>
                                </div>
                                {deliveryPartner.address && (
                                    <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border md:col-span-2">
                                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                                            <MapPin size={20} className="text-green-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm text-muted-foreground">Address</p>
                                            <p className="font-medium truncate">{deliveryPartner.address}</p>
                                        </div>
                                    </div>
                                )}
                                {(deliveryPartner.city || deliveryPartner.state || deliveryPartner.pincode) && (
                                    <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border md:col-span-2">
                                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                                            <Building size={20} className="text-green-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">City / State / Pincode</p>
                                            <p className="font-medium">
                                                {[deliveryPartner.city, deliveryPartner.state, deliveryPartner.pincode].filter(Boolean).join(', ') || 'Not set'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        
                        <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border">
                            <div className={`w-10 h-10 rounded-full bg-${accentColor}-100 dark:bg-${accentColor}-900 flex items-center justify-center`}>
                                <CreditCard size={20} className={`text-${accentColor}-500`} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Password Status</p>
                                <p className="font-medium">{user?.is_password_set ? 'Set' : 'Not Set'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border">
                            <div className={`w-10 h-10 rounded-full bg-${accentColor}-100 dark:bg-${accentColor}-900 flex items-center justify-center`}>
                                <Calendar size={20} className={`text-${accentColor}-500`} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Last Login</p>
                                <p className="font-medium">{user?.last_login ? format(new Date(user.last_login), 'MMM d, yyyy h:mm a') : 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Addresses */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <MapPin size={20} className="text-blue-500" />
                        Saved Addresses
                    </h2>
                    <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" data-testid="add-address-btn">
                                <Plus size={16} className="mr-1" />
                                Add
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Address</DialogTitle>
                                <DialogDescription>
                                    Search for your address or use your current location.
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
                                        placeholder="Search for area, street, landmark..."
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
                                        placeholder="Your address will appear here"
                                        className="mt-1"
                                    />
                                    {newAddress.lat && newAddress.lng && (
                                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                            <MapPin size={12} />
                                            Location: {newAddress.lat.toFixed(4)}, {newAddress.lng.toFixed(4)}
                                        </p>
                                    )}
                                </div>
                                <Button onClick={handleAddAddress} className="w-full btn-primary">
                                    Save Address
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {user?.addresses?.length === 0 ? (
                    <div className="text-center py-8 bg-white dark:bg-slate-900 rounded-xl border">
                        <MapPin size={40} className="mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No addresses saved</p>
                        <p className="text-sm text-muted-foreground">Add an address for faster checkout</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {user?.addresses?.map((addr, idx) => (
                            <div 
                                key={addr.id || idx} 
                                className="flex items-start justify-between p-4 rounded-xl bg-white dark:bg-slate-900 border"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                        <MapPin size={20} className="text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{addr.label}</p>
                                        <p className="text-sm text-muted-foreground">{addr.full_address}</p>
                                        {addr.lat && addr.lng && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                📍 {addr.lat.toFixed(4)}, {addr.lng.toFixed(4)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteAddress(addr.id)}
                                    className="text-muted-foreground hover:text-destructive"
                                    data-testid={`delete-address-${idx}`}
                                >
                                    <Trash2 size={18} />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Push Notifications */}
            <div className="mb-8">
                <NotificationSettings userId={user?.id} />
            </div>

            {/* Logout */}
            <Button 
                variant="destructive" 
                onClick={handleLogout}
                className="w-full"
                data-testid="logout-btn"
            >
                <LogOut size={18} className="mr-2" />
                Logout
            </Button>
        </div>
    );
}
