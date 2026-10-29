import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
    Store, Search, Plus, Check, X, MapPin, Clock, Star, 
    Phone, Edit, Eye, ChevronDown, FileEdit, Timer, Trash2
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Switch } from '../../components/ui/switch';
import { useAdmin } from '../../contexts/AdminContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import AddressSearch from '../../components/AddressSearch';

export default function AdminRestaurants() {
    const { API } = useAdmin();
    const [restaurants, setRestaurants] = useState([]);
    const [pendingApproval, setPendingApproval] = useState([]);
    const [pendingChanges, setPendingChanges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);
    const [showApprovalDialog, setShowApprovalDialog] = useState(false);
    const [showChangesDialog, setShowChangesDialog] = useState(false);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showMenuDialog, setShowMenuDialog] = useState(false);
    const [showAddMenuItemDialog, setShowAddMenuItemDialog] = useState(false);
    const [showEditMenuItemDialog, setShowEditMenuItemDialog] = useState(false);
    const [selectedMenuItem, setSelectedMenuItem] = useState(null);
    const [approvalNotes, setApprovalNotes] = useState('');
    const [activeTab, setActiveTab] = useState('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [editData, setEditData] = useState({});
    const [newMenuItem, setNewMenuItem] = useState({
        name: '',
        description: '',
        price: '',
        image: '',
        category: '',
        is_veg: true
    });
    const [editMenuItem, setEditMenuItem] = useState({});
    const [newRestaurant, setNewRestaurant] = useState({
        name: '',
        description: '',
        cuisine: '',
        image: '',
        cover_image: '',
        address: '',
        lat: null,
        lng: null,
        price_for_two: 300,
        is_veg: false,
        rating: 4.0,
        delivery_time: '30-40 min',
        opening_time: '09:00',
        closing_time: '22:00'
    });
    const [detectingLocation, setDetectingLocation] = useState(false);

    const fetchRestaurants = useCallback(async () => {
        try {
            const [allRes, pendingRes] = await Promise.all([
                axios.get(`${API}/restaurants`),
                axios.get(`${API}/admin/restaurants/pending`)
            ]);
            setRestaurants(allRes.data);
            setPendingApproval(pendingRes.data.pending_approval || []);
            setPendingChanges(pendingRes.data.pending_changes || []);
        } catch (error) {
            console.error('Failed to fetch restaurants:', error);
        } finally {
            setLoading(false);
        }
    }, [API]);

    useEffect(() => {
        fetchRestaurants();
    }, [fetchRestaurants]);

    const handleApproval = async (action) => {
        if (!selectedRestaurant) return;
        
        try {
            await axios.post(`${API}/admin/restaurants/${selectedRestaurant.id}/approve`, {
                action: action,
                notes: approvalNotes
            });
            toast.success(`Restaurant ${action}d successfully`);
            setShowApprovalDialog(false);
            setApprovalNotes('');
            setSelectedRestaurant(null);
            fetchRestaurants();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const handleChangesApproval = async (approve) => {
        if (!selectedRestaurant) return;
        
        try {
            await axios.post(`${API}/admin/restaurants/${selectedRestaurant.id}/approve-changes`, {
                approve,
                notes: approvalNotes
            });
            toast.success(approve ? 'Changes approved and applied' : 'Changes rejected');
            setShowChangesDialog(false);
            setApprovalNotes('');
            setSelectedRestaurant(null);
            fetchRestaurants();
        } catch (error) {
            toast.error('Failed to update');
        }
    };

    const handleAddRestaurant = async () => {
        if (!newRestaurant.name || !newRestaurant.address) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            // Admin-created restaurants are auto-approved
            const restaurantData = {
                ...newRestaurant,
                cuisine: newRestaurant.cuisine.split(',').map(c => c.trim()).filter(Boolean)
            };
            
            const response = await axios.post(`${API}/admin/restaurants`, restaurantData);
            toast.success('Restaurant added successfully');
            setShowAddDialog(false);
            setNewRestaurant({
                name: '',
                description: '',
                cuisine: '',
                image: '',
                cover_image: '',
                address: '',
                lat: null,
                lng: null,
                price_for_two: 300,
                is_veg: false,
                rating: 4.0,
                delivery_time: '30-40 min',
                opening_time: '09:00',
                closing_time: '22:00'
            });
            fetchRestaurants();
        } catch (error) {
            toast.error('Failed to add restaurant');
        }
    };

    const handleToggleRestaurantOpen = async (restaurantId, currentStatus) => {
        try {
            await axios.put(`${API}/admin/restaurants/${restaurantId}`, {
                is_open: !currentStatus
            });
            toast.success('Restaurant status updated');
            fetchRestaurants();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const openEditDialog = (restaurant) => {
        setSelectedRestaurant(restaurant);
        setEditData({
            name: restaurant.name || '',
            description: restaurant.description || '',
            cuisine: restaurant.cuisine?.join(', ') || '',
            address: restaurant.address || '',
            image: restaurant.image || '',
            cover_image: restaurant.cover_image || '',
            price_for_two: restaurant.price_for_two || 300,
            rating: restaurant.rating || 4.0,
            delivery_time: restaurant.delivery_time || '30-40 min',
            opening_time: restaurant.opening_time || '09:00',
            closing_time: restaurant.closing_time || '22:00',
            is_veg: restaurant.is_veg || false,
            is_open: restaurant.is_open !== false,
            // New fields
            owned_by: restaurant.owned_by || '',
            owner_email: restaurant.owner_email || '',
            phone: restaurant.phone || '',
            state: restaurant.state || '',
            pincode: restaurant.pincode || '',
            city: restaurant.city || '',
            fssai_number: restaurant.fssai_number || '',
            // Location coordinates
            lat: restaurant.lat || null,
            lng: restaurant.lng || null
        });
        setShowEditDialog(true);
    };

    const handleEditRestaurant = async () => {
        if (!selectedRestaurant) return;
        
        try {
            const updateData = {
                ...editData,
                cuisine: editData.cuisine.split(',').map(c => c.trim()).filter(Boolean)
            };
            
            await axios.put(`${API}/admin/restaurants/${selectedRestaurant.id}`, updateData);
            toast.success('Restaurant updated successfully');
            setShowEditDialog(false);
            setSelectedRestaurant(null);
            fetchRestaurants();
        } catch (error) {
            toast.error('Failed to update restaurant');
        }
    };

    const openDeleteDialog = (restaurant) => {
        setSelectedRestaurant(restaurant);
        setShowDeleteDialog(true);
    };

    const handleDeleteRestaurant = async () => {
        if (!selectedRestaurant) return;
        
        try {
            await axios.delete(`${API}/admin/restaurants/${selectedRestaurant.id}`);
            toast.success('Restaurant deleted successfully');
            setShowDeleteDialog(false);
            setSelectedRestaurant(null);
            fetchRestaurants();
        } catch (error) {
            toast.error('Failed to delete restaurant');
        }
    };

    const openApprovalDialog = (restaurant) => {
        setSelectedRestaurant(restaurant);
        setApprovalNotes('');
        setShowApprovalDialog(true);
    };

    const openChangesDialog = (restaurant) => {
        setSelectedRestaurant(restaurant);
        setApprovalNotes('');
        setShowChangesDialog(true);
    };

    const openDetailDialog = (restaurant) => {
        setSelectedRestaurant(restaurant);
        setShowDetailDialog(true);
    };

    // Menu Management Functions
    const openMenuDialog = (restaurant) => {
        setSelectedRestaurant(restaurant);
        setShowMenuDialog(true);
    };

    const openAddMenuItemDialog = () => {
        setNewMenuItem({
            name: '',
            description: '',
            price: '',
            image: '',
            category: '',
            is_veg: true
        });
        setShowAddMenuItemDialog(true);
    };

    const openEditMenuItemDialog = (item) => {
        setSelectedMenuItem(item);
        setEditMenuItem({
            name: item.name || '',
            description: item.description || '',
            price: item.price || '',
            image: item.image || '',
            category: item.category || '',
            is_veg: item.is_veg !== false
        });
        setShowEditMenuItemDialog(true);
    };

    const handleAddMenuItem = async () => {
        if (!selectedRestaurant || !newMenuItem.name || !newMenuItem.price || !newMenuItem.category) {
            toast.error('Please fill in required fields (Name, Price, Category)');
            return;
        }

        try {
            await axios.post(`${API}/admin/restaurants/${selectedRestaurant.id}/menu`, {
                ...newMenuItem,
                price: parseFloat(newMenuItem.price)
            });
            toast.success('Menu item added successfully');
            setShowAddMenuItemDialog(false);
            // Refresh restaurant data
            const response = await axios.get(`${API}/restaurants/${selectedRestaurant.id}`);
            setSelectedRestaurant(response.data);
            fetchRestaurants();
        } catch (error) {
            toast.error('Failed to add menu item');
        }
    };

    const handleEditMenuItem = async () => {
        if (!selectedRestaurant || !selectedMenuItem) return;
        
        if (!editMenuItem.name || !editMenuItem.price || !editMenuItem.category) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            await axios.put(`${API}/admin/restaurants/${selectedRestaurant.id}/menu/${selectedMenuItem.id}`, {
                ...editMenuItem,
                price: parseFloat(editMenuItem.price)
            });
            toast.success('Menu item updated successfully');
            setShowEditMenuItemDialog(false);
            setSelectedMenuItem(null);
            // Refresh restaurant data
            const response = await axios.get(`${API}/restaurants/${selectedRestaurant.id}`);
            setSelectedRestaurant(response.data);
            fetchRestaurants();
        } catch (error) {
            toast.error('Failed to update menu item');
        }
    };

    const handleDeleteMenuItem = async (itemId) => {
        if (!selectedRestaurant) return;
        
        if (!window.confirm('Are you sure you want to delete this menu item?')) return;

        try {
            await axios.delete(`${API}/admin/restaurants/${selectedRestaurant.id}/menu/${itemId}`);
            toast.success('Menu item deleted');
            // Refresh restaurant data
            const response = await axios.get(`${API}/restaurants/${selectedRestaurant.id}`);
            setSelectedRestaurant(response.data);
            fetchRestaurants();
        } catch (error) {
            toast.error('Failed to delete menu item');
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
            approved: 'bg-green-500/20 text-green-400 border-green-500/50',
            rejected: 'bg-red-500/20 text-red-400 border-red-500/50'
        };
        return styles[status] || styles.pending;
    };

    const filteredRestaurants = restaurants.filter(r => 
        r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.address?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const approvedRestaurants = filteredRestaurants.filter(r => r.approval_status === 'approved');

    return (
        <div className="space-y-6" data-testid="admin-restaurants">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Restaurants</h1>
                    <p className="text-muted-foreground">Manage restaurants and approve registrations</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400">
                        {pendingApproval.length} Pending
                    </Badge>
                    {pendingChanges.length > 0 && (
                        <Badge variant="outline" className="bg-blue-500/20 text-blue-400">
                            {pendingChanges.length} Changes
                        </Badge>
                    )}
                    <Button className="btn-primary" onClick={() => setShowAddDialog(true)}>
                        <Plus size={16} className="mr-1" /> Add Restaurant
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search restaurants..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="pending">
                        Pending Approval ({pendingApproval.length})
                    </TabsTrigger>
                    <TabsTrigger value="changes">
                        Pending Changes ({pendingChanges.length})
                    </TabsTrigger>
                    <TabsTrigger value="all">
                        All Restaurants ({approvedRestaurants.length})
                    </TabsTrigger>
                </TabsList>

                {/* Pending Approval Tab */}
                <TabsContent value="pending" className="mt-6">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
                        </div>
                    ) : pendingApproval.length === 0 ? (
                        <div className="text-center py-12">
                            <Store size={48} className="mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No pending registrations</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pendingApproval.map(restaurant => (
                                <div 
                                    key={restaurant.id} 
                                    className="bg-card border border-yellow-500/30 rounded-xl p-4"
                                    data-testid={`pending-${restaurant.id}`}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <img
                                                src={restaurant.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100'}
                                                alt={restaurant.name}
                                                className="w-16 h-16 rounded-xl object-cover"
                                            />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold">{restaurant.name}</h3>
                                                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                                                        Pending
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <MapPin size={12} /> {restaurant.address}
                                                </p>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {restaurant.cuisine?.map((c, i) => (
                                                        <span key={i} className="text-xs bg-secondary px-2 py-0.5 rounded">{c}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => openDetailDialog(restaurant)}
                                            >
                                                <Eye size={14} className="mr-1" /> View
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                className="bg-green-600 hover:bg-green-700"
                                                onClick={() => openApprovalDialog(restaurant)}
                                            >
                                                <Check size={14} className="mr-1" /> Approve
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Pending Changes Tab */}
                <TabsContent value="changes" className="mt-6">
                    {pendingChanges.length === 0 ? (
                        <div className="text-center py-12">
                            <FileEdit size={48} className="mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No pending changes to review</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pendingChanges.map(restaurant => (
                                <div 
                                    key={restaurant.id} 
                                    className="bg-card border border-blue-500/30 rounded-xl p-4"
                                    data-testid={`changes-${restaurant.id}`}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <img
                                                src={restaurant.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100'}
                                                alt={restaurant.name}
                                                className="w-16 h-16 rounded-xl object-cover"
                                            />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold">{restaurant.name}</h3>
                                                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                                                        Changes Pending
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {Object.keys(restaurant.pending_changes || {}).length} changes submitted
                                                </p>
                                            </div>
                                        </div>

                                        <Button 
                                            size="sm" 
                                            onClick={() => openChangesDialog(restaurant)}
                                        >
                                            <FileEdit size={14} className="mr-1" /> Review Changes
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* All Restaurants Tab */}
                <TabsContent value="all" className="mt-6">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
                        </div>
                    ) : approvedRestaurants.length === 0 ? (
                        <div className="text-center py-12">
                            <Store size={48} className="mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No approved restaurants</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {approvedRestaurants.map(restaurant => (
                                <div 
                                    key={restaurant.id} 
                                    className="bg-card border border-border rounded-xl p-4"
                                    data-testid={`restaurant-${restaurant.id}`}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <img
                                                src={restaurant.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100'}
                                                alt={restaurant.name}
                                                className="w-16 h-16 rounded-xl object-cover"
                                            />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold">{restaurant.name}</h3>
                                                    <Badge variant={restaurant.is_open ? 'default' : 'secondary'}>
                                                        {restaurant.is_open ? 'Open' : 'Closed'}
                                                    </Badge>
                                                    {restaurant.has_pending_changes && (
                                                        <Badge className="bg-blue-500/20 text-blue-400">
                                                            Changes Pending
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <MapPin size={12} /> {restaurant.address}
                                                </p>
                                                <div className="flex items-center gap-3 text-sm mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Star size={12} className="text-yellow-400" /> {restaurant.rating}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Timer size={12} /> {restaurant.opening_time} - {restaurant.closing_time}
                                                    </span>
                                                    <span>{restaurant.total_orders || 0} orders</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => openMenuDialog(restaurant)}
                                                data-testid={`manage-menu-${restaurant.id}`}
                                            >
                                                <Store size={14} className="mr-1" /> Menu ({restaurant.menu?.length || 0})
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => openDetailDialog(restaurant)}
                                            >
                                                <Eye size={14} className="mr-1" /> View
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => openEditDialog(restaurant)}
                                            >
                                                <Edit size={14} className="mr-1" /> Edit
                                            </Button>
                                            <Button 
                                                variant={restaurant.is_open ? 'destructive' : 'default'}
                                                size="sm"
                                                onClick={() => handleToggleRestaurantOpen(restaurant.id, restaurant.is_open)}
                                            >
                                                {restaurant.is_open ? 'Close' : 'Open'}
                                            </Button>
                                            <Button 
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => openDeleteDialog(restaurant)}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Approval Dialog */}
            <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Review Restaurant Registration</DialogTitle>
                    </DialogHeader>
                    {selectedRestaurant && (
                        <div className="space-y-4 mt-4">
                            <div className="flex items-center gap-4">
                                <img
                                    src={selectedRestaurant.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100'}
                                    alt={selectedRestaurant.name}
                                    className="w-20 h-20 rounded-xl object-cover"
                                />
                                <div>
                                    <h3 className="font-semibold text-lg">{selectedRestaurant.name}</h3>
                                    <p className="text-sm text-muted-foreground">{selectedRestaurant.address}</p>
                                </div>
                            </div>

                            <div className="bg-secondary/50 rounded-lg p-4 space-y-2 text-sm">
                                {selectedRestaurant.owned_by && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Owned By</span>
                                        <span>{selectedRestaurant.owned_by}</span>
                                    </div>
                                )}
                                {selectedRestaurant.owner_email && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Email</span>
                                        <span>{selectedRestaurant.owner_email}</span>
                                    </div>
                                )}
                                {selectedRestaurant.phone && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Phone</span>
                                        <span>{selectedRestaurant.phone}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cuisines</span>
                                    <span>{selectedRestaurant.cuisine?.join(', ') || 'Not specified'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Price for Two</span>
                                    <span>₹{selectedRestaurant.price_for_two}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Type</span>
                                    <span>{selectedRestaurant.is_veg ? 'Pure Veg' : 'Veg & Non-Veg'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Timing</span>
                                    <span>{selectedRestaurant.opening_time} - {selectedRestaurant.closing_time}</span>
                                </div>
                                {(selectedRestaurant.city || selectedRestaurant.state || selectedRestaurant.pincode) && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Location</span>
                                        <span>{[selectedRestaurant.city, selectedRestaurant.state, selectedRestaurant.pincode].filter(Boolean).join(', ')}</span>
                                    </div>
                                )}
                                {(selectedRestaurant.lat && selectedRestaurant.lng) && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">GPS Coordinates</span>
                                        <span className="text-xs font-mono">{selectedRestaurant.lat?.toFixed(6)}, {selectedRestaurant.lng?.toFixed(6)}</span>
                                    </div>
                                )}
                                {selectedRestaurant.fssai_number && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">FSSAI No.</span>
                                        <span>{selectedRestaurant.fssai_number}</span>
                                    </div>
                                )}
                            </div>

                            {selectedRestaurant.description && (
                                <div className="bg-secondary/50 rounded-lg p-3">
                                    <p className="text-sm text-muted-foreground">Description:</p>
                                    <p className="text-sm">{selectedRestaurant.description}</p>
                                </div>
                            )}

                            <div>
                                <Label>Admin Notes (optional)</Label>
                                <Textarea
                                    value={approvalNotes}
                                    onChange={(e) => setApprovalNotes(e.target.value)}
                                    placeholder="Add any notes for the restaurant owner..."
                                    className="mt-1"
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button 
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                    onClick={() => handleApproval('approve')}
                                >
                                    <Check size={16} className="mr-1" /> Approve
                                </Button>
                                <Button 
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={() => handleApproval('reject')}
                                >
                                    <X size={16} className="mr-1" /> Reject
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Changes Review Dialog */}
            <Dialog open={showChangesDialog} onOpenChange={setShowChangesDialog}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Review Pending Changes</DialogTitle>
                    </DialogHeader>
                    {selectedRestaurant && (
                        <div className="space-y-4 mt-4">
                            <div className="flex items-center gap-4">
                                <img
                                    src={selectedRestaurant.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100'}
                                    alt={selectedRestaurant.name}
                                    className="w-16 h-16 rounded-xl object-cover"
                                />
                                <div>
                                    <h3 className="font-semibold">{selectedRestaurant.name}</h3>
                                    <p className="text-sm text-muted-foreground">{selectedRestaurant.address}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="font-medium">Requested Changes:</h4>
                                {selectedRestaurant.pending_changes && Object.entries(selectedRestaurant.pending_changes).map(([key, value]) => {
                                    if (key === 'menu_changes' && Array.isArray(value)) {
                                        return (
                                            <div key={key} className="bg-secondary/50 rounded-lg p-3">
                                                <p className="text-sm font-medium">Menu Changes ({value.length}):</p>
                                                {value.map((change, idx) => (
                                                    <div key={idx} className="mt-2 p-2 bg-background rounded text-sm">
                                                        <Badge className="mb-1" variant={change.action === 'add' ? 'default' : change.action === 'delete' ? 'destructive' : 'outline'}>
                                                            {change.action}
                                                        </Badge>
                                                        <p>{change.item?.name || change.item_id}</p>
                                                        {change.item?.price && <p className="text-muted-foreground">₹{change.item.price}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={key} className="flex justify-between bg-secondary/50 rounded-lg p-3">
                                            <span className="text-muted-foreground capitalize">{key.replace('_', ' ')}</span>
                                            <span className="font-medium">{Array.isArray(value) ? value.join(', ') : String(value)}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div>
                                <Label>Admin Notes (optional)</Label>
                                <Textarea
                                    value={approvalNotes}
                                    onChange={(e) => setApprovalNotes(e.target.value)}
                                    placeholder="Add any feedback..."
                                    className="mt-1"
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button 
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                    onClick={() => handleChangesApproval(true)}
                                >
                                    <Check size={16} className="mr-1" /> Approve Changes
                                </Button>
                                <Button 
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={() => handleChangesApproval(false)}
                                >
                                    <X size={16} className="mr-1" /> Reject
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Restaurant Details</DialogTitle>
                    </DialogHeader>
                    {selectedRestaurant && (
                        <div className="space-y-4 mt-4">
                            <img
                                src={selectedRestaurant.cover_image || selectedRestaurant.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'}
                                alt={selectedRestaurant.name}
                                className="w-full h-40 rounded-xl object-cover"
                            />
                            
                            <div className="flex items-center gap-3">
                                <h3 className="font-semibold text-lg">{selectedRestaurant.name}</h3>
                                <Badge className={`border ${getStatusBadge(selectedRestaurant.approval_status)}`}>
                                    {selectedRestaurant.approval_status}
                                </Badge>
                            </div>

                            <div className="space-y-3 text-sm">
                                {selectedRestaurant.owned_by && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Owned By</span>
                                        <span>{selectedRestaurant.owned_by}</span>
                                    </div>
                                )}
                                {selectedRestaurant.owner_email && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Email</span>
                                        <span>{selectedRestaurant.owner_email}</span>
                                    </div>
                                )}
                                {selectedRestaurant.phone && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Phone</span>
                                        <span>{selectedRestaurant.phone}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Address</span>
                                    <span className="text-right max-w-[60%]">{selectedRestaurant.address}</span>
                                </div>
                                {selectedRestaurant.city && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">City</span>
                                        <span>{selectedRestaurant.city}</span>
                                    </div>
                                )}
                                {selectedRestaurant.state && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">State</span>
                                        <span>{selectedRestaurant.state}</span>
                                    </div>
                                )}
                                {selectedRestaurant.pincode && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Pincode</span>
                                        <span>{selectedRestaurant.pincode}</span>
                                    </div>
                                )}
                                {(selectedRestaurant.lat && selectedRestaurant.lng) && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">GPS Coordinates</span>
                                        <span className="text-xs font-mono">{selectedRestaurant.lat?.toFixed(6)}, {selectedRestaurant.lng?.toFixed(6)}</span>
                                    </div>
                                )}
                                {selectedRestaurant.fssai_number && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">FSSAI No.</span>
                                        <span>{selectedRestaurant.fssai_number}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cuisines</span>
                                    <span>{selectedRestaurant.cuisine?.join(', ')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Price for Two</span>
                                    <span>₹{selectedRestaurant.price_for_two}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Rating</span>
                                    <span className="flex items-center gap-1">
                                        <Star size={14} className="text-yellow-400 fill-yellow-400" />
                                        {selectedRestaurant.rating}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Timing</span>
                                    <span>{selectedRestaurant.opening_time} - {selectedRestaurant.closing_time}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Delivery Time</span>
                                    <span>{selectedRestaurant.delivery_time}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Orders</span>
                                    <span>{selectedRestaurant.total_orders || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Revenue</span>
                                    <span className="price-tag">₹{selectedRestaurant.total_revenue || 0}</span>
                                </div>
                            </div>

                            {selectedRestaurant.menu?.length > 0 && (
                                <div>
                                    <h4 className="font-medium mb-2">Menu ({selectedRestaurant.menu.length} items)</h4>
                                    <div className="max-h-40 overflow-y-auto space-y-2">
                                        {selectedRestaurant.menu.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-secondary/50 rounded-lg p-2 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className={`veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}`} />
                                                    <span>{item.name}</span>
                                                </div>
                                                <span className="price-tag">₹{item.price}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Add Restaurant Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add New Restaurant</DialogTitle>
                        <DialogDescription>
                            Fill in the restaurant details below. Search for the address or detect current location.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <Label>Restaurant Name *</Label>
                            <Input
                                value={newRestaurant.name}
                                onChange={(e) => setNewRestaurant(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g., Burger Kingdom"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Description</Label>
                            <Textarea
                                value={newRestaurant.description}
                                onChange={(e) => setNewRestaurant(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Tell customers about the restaurant"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Cuisines (comma separated) *</Label>
                            <Input
                                value={newRestaurant.cuisine}
                                onChange={(e) => setNewRestaurant(prev => ({ ...prev, cuisine: e.target.value }))}
                                placeholder="e.g., Italian, Pizza, Pasta"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Search Address</Label>
                            <AddressSearch
                                placeholder="Search for restaurant location..."
                                className="mt-1"
                                onSelect={(addr) => {
                                    setNewRestaurant(prev => ({ 
                                        ...prev, 
                                        address: addr.address,
                                        lat: addr.lat,
                                        lng: addr.lng
                                    }));
                                    toast.success('Location selected!');
                                }}
                            />
                        </div>
                        <div>
                            <Label>Address *</Label>
                            <Input
                                value={newRestaurant.address}
                                onChange={(e) => setNewRestaurant(prev => ({ ...prev, address: e.target.value }))}
                                placeholder="Full restaurant address"
                                className="mt-1"
                            />
                            {newRestaurant.lat && newRestaurant.lng && (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                    <MapPin size={12} />
                                    Location: {newRestaurant.lat.toFixed(4)}, {newRestaurant.lng.toFixed(4)}
                                </p>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Opening Time</Label>
                                <Input
                                    type="time"
                                    value={newRestaurant.opening_time}
                                    onChange={(e) => setNewRestaurant(prev => ({ ...prev, opening_time: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Closing Time</Label>
                                <Input
                                    type="time"
                                    value={newRestaurant.closing_time}
                                    onChange={(e) => setNewRestaurant(prev => ({ ...prev, closing_time: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Image URL</Label>
                            <Input
                                value={newRestaurant.image}
                                onChange={(e) => setNewRestaurant(prev => ({ ...prev, image: e.target.value }))}
                                placeholder="https://..."
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Cover Image URL</Label>
                            <Input
                                value={newRestaurant.cover_image}
                                onChange={(e) => setNewRestaurant(prev => ({ ...prev, cover_image: e.target.value }))}
                                placeholder="https://..."
                                className="mt-1"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Price for Two (₹)</Label>
                                <Input
                                    type="number"
                                    value={newRestaurant.price_for_two}
                                    onChange={(e) => setNewRestaurant(prev => ({ ...prev, price_for_two: parseInt(e.target.value) }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Rating</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="1"
                                    max="5"
                                    value={newRestaurant.rating}
                                    onChange={(e) => setNewRestaurant(prev => ({ ...prev, rating: parseFloat(e.target.value) }))}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Delivery Time</Label>
                            <Input
                                value={newRestaurant.delivery_time}
                                onChange={(e) => setNewRestaurant(prev => ({ ...prev, delivery_time: e.target.value }))}
                                placeholder="e.g., 30-40 min"
                                className="mt-1"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={newRestaurant.is_veg}
                                onCheckedChange={(checked) => setNewRestaurant(prev => ({ ...prev, is_veg: checked }))}
                            />
                            <Label>Pure Vegetarian Restaurant</Label>
                        </div>
                        <Button onClick={handleAddRestaurant} className="w-full btn-primary">
                            Add Restaurant
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Restaurant Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Restaurant</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <Label>Restaurant Name *</Label>
                            <Input
                                value={editData.name}
                                onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Description</Label>
                            <Textarea
                                value={editData.description}
                                onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Cuisines (comma separated)</Label>
                            <Input
                                value={editData.cuisine}
                                onChange={(e) => setEditData(prev => ({ ...prev, cuisine: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Address *</Label>
                            <Input
                                value={editData.address}
                                onChange={(e) => setEditData(prev => ({ ...prev, address: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        {/* Owner & Location Details */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Owned By</Label>
                                <Input
                                    value={editData.owned_by}
                                    onChange={(e) => setEditData(prev => ({ ...prev, owned_by: e.target.value }))}
                                    placeholder="Owner/Proprietor name"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Phone</Label>
                                <Input
                                    value={editData.phone}
                                    onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                                    placeholder="Contact number"
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Owner Email</Label>
                            <Input
                                type="email"
                                value={editData.owner_email}
                                onChange={(e) => setEditData(prev => ({ ...prev, owner_email: e.target.value }))}
                                placeholder="Email address"
                                className="mt-1"
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>City</Label>
                                <Input
                                    value={editData.city}
                                    onChange={(e) => setEditData(prev => ({ ...prev, city: e.target.value }))}
                                    placeholder="City"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>State</Label>
                                <Input
                                    value={editData.state}
                                    onChange={(e) => setEditData(prev => ({ ...prev, state: e.target.value }))}
                                    placeholder="State"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Pincode</Label>
                                <Input
                                    value={editData.pincode}
                                    onChange={(e) => setEditData(prev => ({ ...prev, pincode: e.target.value }))}
                                    placeholder="Pincode"
                                    className="mt-1"
                                    maxLength={6}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>FSSAI Number</Label>
                            <Input
                                value={editData.fssai_number}
                                onChange={(e) => setEditData(prev => ({ ...prev, fssai_number: e.target.value }))}
                                placeholder="14-digit FSSAI licence"
                                className="mt-1"
                                maxLength={14}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Latitude</Label>
                                <Input
                                    type="number"
                                    step="any"
                                    value={editData.lat || ''}
                                    onChange={(e) => setEditData(prev => ({ ...prev, lat: e.target.value ? parseFloat(e.target.value) : null }))}
                                    placeholder="e.g., 13.0827"
                                    className="mt-1"
                                    data-testid="edit-lat-input"
                                />
                            </div>
                            <div>
                                <Label>Longitude</Label>
                                <Input
                                    type="number"
                                    step="any"
                                    value={editData.lng || ''}
                                    onChange={(e) => setEditData(prev => ({ ...prev, lng: e.target.value ? parseFloat(e.target.value) : null }))}
                                    placeholder="e.g., 80.2707"
                                    className="mt-1"
                                    data-testid="edit-lng-input"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Opening Time</Label>
                                <Input
                                    type="time"
                                    value={editData.opening_time}
                                    onChange={(e) => setEditData(prev => ({ ...prev, opening_time: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Closing Time</Label>
                                <Input
                                    type="time"
                                    value={editData.closing_time}
                                    onChange={(e) => setEditData(prev => ({ ...prev, closing_time: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Image URL</Label>
                            <Input
                                value={editData.image}
                                onChange={(e) => setEditData(prev => ({ ...prev, image: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Cover Image URL</Label>
                            <Input
                                value={editData.cover_image}
                                onChange={(e) => setEditData(prev => ({ ...prev, cover_image: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Price for Two (₹)</Label>
                                <Input
                                    type="number"
                                    value={editData.price_for_two}
                                    onChange={(e) => setEditData(prev => ({ ...prev, price_for_two: parseInt(e.target.value) }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Rating</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="1"
                                    max="5"
                                    value={editData.rating}
                                    onChange={(e) => setEditData(prev => ({ ...prev, rating: parseFloat(e.target.value) }))}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Delivery Time</Label>
                            <Input
                                value={editData.delivery_time}
                                onChange={(e) => setEditData(prev => ({ ...prev, delivery_time: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={editData.is_veg}
                                onCheckedChange={(checked) => setEditData(prev => ({ ...prev, is_veg: checked }))}
                            />
                            <Label>Pure Vegetarian Restaurant</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={editData.is_open}
                                onCheckedChange={(checked) => setEditData(prev => ({ ...prev, is_open: checked }))}
                            />
                            <Label>Restaurant Open</Label>
                        </div>
                        <Button onClick={handleEditRestaurant} className="w-full btn-primary">
                            Save Changes
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Restaurant</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <p className="text-muted-foreground">
                            Are you sure you want to delete <strong>{selectedRestaurant?.name}</strong>? This action cannot be undone.
                        </p>
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                className="flex-1"
                                onClick={() => setShowDeleteDialog(false)}
                            >
                                Cancel
                            </Button>
                            <Button 
                                variant="destructive"
                                className="flex-1"
                                onClick={handleDeleteRestaurant}
                            >
                                <Trash2 size={14} className="mr-1" /> Delete
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Menu Management Dialog */}
            <Dialog open={showMenuDialog} onOpenChange={setShowMenuDialog}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Manage Menu - {selectedRestaurant?.name}</DialogTitle>
                        <DialogDescription>
                            Add, edit, or delete menu items for this restaurant.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-muted-foreground">
                                {selectedRestaurant?.menu?.length || 0} items in menu
                            </p>
                            <Button 
                                className="btn-primary" 
                                onClick={openAddMenuItemDialog}
                                data-testid="add-menu-item-admin"
                            >
                                <Plus size={14} className="mr-1" /> Add Item
                            </Button>
                        </div>
                        
                        {selectedRestaurant?.menu?.length === 0 ? (
                            <div className="text-center py-8 bg-secondary/30 rounded-xl">
                                <Store size={40} className="mx-auto text-muted-foreground mb-2" />
                                <p className="text-muted-foreground">No menu items yet</p>
                                <p className="text-sm text-muted-foreground">Add items to build the menu</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {selectedRestaurant?.menu?.map((item) => (
                                    <div 
                                        key={item.id} 
                                        className="flex items-center gap-4 bg-secondary/30 rounded-xl p-3"
                                        data-testid={`menu-item-${item.id}`}
                                    >
                                        <img
                                            src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=80'}
                                            alt={item.name}
                                            className="w-16 h-16 rounded-lg object-cover"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <div className={`veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}`} />
                                                <h4 className="font-medium truncate">{item.name}</h4>
                                                {item.is_visible === false && (
                                                    <Badge variant="outline" className="text-xs">Hidden</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="price-tag font-medium">₹{item.price}</span>
                                                <Badge variant="outline" className="text-xs">{item.category}</Badge>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => openEditMenuItemDialog(item)}
                                                data-testid={`edit-menu-${item.id}`}
                                            >
                                                <Edit size={14} />
                                            </Button>
                                            <Button 
                                                variant="destructive" 
                                                size="sm"
                                                onClick={() => handleDeleteMenuItem(item.id)}
                                                data-testid={`delete-menu-${item.id}`}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Menu Item Dialog */}
            <Dialog open={showAddMenuItemDialog} onOpenChange={setShowAddMenuItemDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Menu Item</DialogTitle>
                        <DialogDescription>
                            Add a new item to {selectedRestaurant?.name}'s menu.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <Label>Item Name *</Label>
                            <Input
                                value={newMenuItem.name}
                                onChange={(e) => setNewMenuItem(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g., Chicken Biryani"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Description</Label>
                            <Textarea
                                value={newMenuItem.description}
                                onChange={(e) => setNewMenuItem(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Describe the dish..."
                                className="mt-1"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Price (₹) *</Label>
                                <Input
                                    type="number"
                                    value={newMenuItem.price}
                                    onChange={(e) => setNewMenuItem(prev => ({ ...prev, price: e.target.value }))}
                                    placeholder="199"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Category *</Label>
                                <Input
                                    value={newMenuItem.category}
                                    onChange={(e) => setNewMenuItem(prev => ({ ...prev, category: e.target.value }))}
                                    placeholder="e.g., Main Course"
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Image URL</Label>
                            <Input
                                value={newMenuItem.image}
                                onChange={(e) => setNewMenuItem(prev => ({ ...prev, image: e.target.value }))}
                                placeholder="https://..."
                                className="mt-1"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={newMenuItem.is_veg}
                                onCheckedChange={(checked) => setNewMenuItem(prev => ({ ...prev, is_veg: checked }))}
                            />
                            <Label>Vegetarian</Label>
                        </div>
                        <Button onClick={handleAddMenuItem} className="w-full btn-primary">
                            Add Item
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Menu Item Dialog */}
            <Dialog open={showEditMenuItemDialog} onOpenChange={setShowEditMenuItemDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Menu Item</DialogTitle>
                        <DialogDescription>
                            Update the menu item details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <Label>Item Name *</Label>
                            <Input
                                value={editMenuItem.name}
                                onChange={(e) => setEditMenuItem(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g., Chicken Biryani"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Description</Label>
                            <Textarea
                                value={editMenuItem.description}
                                onChange={(e) => setEditMenuItem(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Describe the dish..."
                                className="mt-1"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Price (₹) *</Label>
                                <Input
                                    type="number"
                                    value={editMenuItem.price}
                                    onChange={(e) => setEditMenuItem(prev => ({ ...prev, price: e.target.value }))}
                                    placeholder="199"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Category *</Label>
                                <Input
                                    value={editMenuItem.category}
                                    onChange={(e) => setEditMenuItem(prev => ({ ...prev, category: e.target.value }))}
                                    placeholder="e.g., Main Course"
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Image URL</Label>
                            <Input
                                value={editMenuItem.image}
                                onChange={(e) => setEditMenuItem(prev => ({ ...prev, image: e.target.value }))}
                                placeholder="https://..."
                                className="mt-1"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={editMenuItem.is_veg}
                                onCheckedChange={(checked) => setEditMenuItem(prev => ({ ...prev, is_veg: checked }))}
                            />
                            <Label>Vegetarian</Label>
                        </div>
                        <Button onClick={handleEditMenuItem} className="w-full btn-primary">
                            Save Changes
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
