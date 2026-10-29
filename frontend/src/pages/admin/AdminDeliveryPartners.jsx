import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
    Bike, Search, Filter, Check, X, MapPin, Clock, Star, 
    Phone, CreditCard, Eye, ChevronDown, Edit, Trash2, Wallet,
    Navigation, Activity, TrendingUp, Timer, Map
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAdmin } from '../../contexts/AdminContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import FleetMapView from '../../components/FleetMapView';

export default function AdminDeliveryPartners() {
    const { API } = useAdmin();
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [showApprovalDialog, setShowApprovalDialog] = useState(false);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [approvalNotes, setApprovalNotes] = useState('');
    const [activeTab, setActiveTab] = useState('pending');
    const [stats, setStats] = useState({ pending: 0, approved: 0 });
    const [searchQuery, setSearchQuery] = useState('');
    const [editData, setEditData] = useState({});
    // COD settlements state
    const [codSettlements, setCodSettlements] = useState([]);
    const [showCodApprovalDialog, setShowCodApprovalDialog] = useState(false);
    const [selectedCodSettlement, setSelectedCodSettlement] = useState(null);
    const [codApprovalComment, setCodApprovalComment] = useState('');
    // Online partners tracking
    const [onlinePartners, setOnlinePartners] = useState([]);
    const [selectedPartnerKm, setSelectedPartnerKm] = useState(null);
    const [kmHistory, setKmHistory] = useState(null);
    const [showKmDialog, setShowKmDialog] = useState(false);

    const fetchPartners = useCallback(async (status = null) => {
        try {
            let url = `${API}/admin/delivery-partners?limit=100`;
            if (status) url += `&status=${status}`;
            
            const response = await axios.get(url);
            setPartners(response.data.partners);
            setStats({
                pending: response.data.pending_count || 0,
                approved: response.data.approved_count || 0
            });
        } catch (error) {
            console.error('Failed to fetch partners:', error);
        } finally {
            setLoading(false);
        }
    }, [API]);

    useEffect(() => {
        fetchPartners(activeTab === 'all' ? null : activeTab);
    }, [fetchPartners, activeTab]);

    const fetchCodSettlements = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/admin/cod-settlements`);
            setCodSettlements(response.data);
        } catch (error) {
            console.error('Failed to fetch COD settlements:', error);
        }
    }, [API]);

    const fetchOnlinePartners = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/admin/delivery-partners/online`);
            setOnlinePartners(response.data.partners || []);
        } catch (error) {
            console.error('Failed to fetch online partners:', error);
        }
    }, [API]);

    const fetchPartnerKmHistory = async (partnerId, partnerName) => {
        try {
            const response = await axios.get(`${API}/admin/delivery-partners/${partnerId}/km-history?days=7`);
            setKmHistory({ ...response.data, name: partnerName });
            setShowKmDialog(true);
        } catch (error) {
            toast.error('Failed to fetch KM history');
        }
    };

    useEffect(() => {
        fetchCodSettlements();
        fetchOnlinePartners();
        // Refresh online partners every 30 seconds
        const interval = setInterval(fetchOnlinePartners, 30000);
        return () => clearInterval(interval);
    }, [fetchCodSettlements, fetchOnlinePartners]);

    const handleCodApproval = async (action) => {
        if (!selectedCodSettlement) return;
        
        try {
            // Get admin phone from localStorage
            const admin = JSON.parse(localStorage.getItem('foodkey_admin') || '{}');
            
            await axios.post(`${API}/admin/cod-settlements/${selectedCodSettlement.id}/approve?admin_phone=${admin.phone || ''}`, {
                action,
                comment: codApprovalComment || null
            });
            
            toast.success(`COD settlement ${action}d`);
            setShowCodApprovalDialog(false);
            setSelectedCodSettlement(null);
            setCodApprovalComment('');
            fetchCodSettlements();
        } catch (error) {
            toast.error(`Failed to ${action} settlement`);
        }
    };

    const handleApproval = async (action) => {
        if (!selectedPartner) return;
        
        try {
            await axios.post(`${API}/admin/delivery-partners/${selectedPartner.id}/approve`, {
                action: action, // 'approve' or 'reject'
                notes: approvalNotes
            });
            toast.success(`Delivery partner ${action}d successfully`);
            setShowApprovalDialog(false);
            setApprovalNotes('');
            setSelectedPartner(null);
            fetchPartners(activeTab === 'all' ? null : activeTab);
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const openEditDialog = (partner) => {
        setSelectedPartner(partner);
        setEditData({
            name: partner.name || '',
            phone: partner.phone || '',
            email: partner.email || '',
            address: partner.address || '',
            state: partner.state || '',
            pincode: partner.pincode || '',
            city: partner.city || '',
            vehicle_type: partner.vehicle_type || 'bike',
            vehicle_number: partner.vehicle_number || '',
            license_number: partner.license_number || '',
            license_image: partner.license_image || '',
            approval_status: partner.approval_status || 'pending',
            is_available: partner.is_available !== false,
            is_online: partner.is_online !== false
        });
        setShowEditDialog(true);
    };

    const handleEditPartner = async () => {
        if (!selectedPartner) return;
        
        try {
            await axios.put(`${API}/admin/delivery-partners/${selectedPartner.id}`, editData);
            toast.success('Delivery partner updated successfully');
            setShowEditDialog(false);
            setSelectedPartner(null);
            fetchPartners(activeTab === 'all' ? null : activeTab);
        } catch (error) {
            toast.error('Failed to update delivery partner');
        }
    };

    const openDeleteDialog = (partner) => {
        setSelectedPartner(partner);
        setShowDeleteDialog(true);
    };

    const handleDeletePartner = async () => {
        if (!selectedPartner) return;
        
        try {
            await axios.delete(`${API}/admin/delivery-partners/${selectedPartner.id}`);
            toast.success('Delivery partner deleted successfully');
            setShowDeleteDialog(false);
            setSelectedPartner(null);
            fetchPartners(activeTab === 'all' ? null : activeTab);
        } catch (error) {
            toast.error('Failed to delete delivery partner');
        }
    };

    const openApprovalDialog = (partner) => {
        setSelectedPartner(partner);
        setApprovalNotes('');
        setShowApprovalDialog(true);
    };

    const openDetailDialog = (partner) => {
        setSelectedPartner(partner);
        setShowDetailDialog(true);
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
            approved: 'bg-green-500/20 text-green-400 border-green-500/50',
            rejected: 'bg-red-500/20 text-red-400 border-red-500/50'
        };
        return styles[status] || styles.pending;
    };

    const filteredPartners = partners.filter(p => 
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.vehicle_number?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6" data-testid="admin-delivery-partners">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Delivery Partners</h1>
                    <p className="text-muted-foreground">Manage and approve delivery partner registrations</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400">
                        {stats.pending} Pending
                    </Badge>
                    <Badge variant="outline" className="bg-green-500/20 text-green-400">
                        {stats.approved} Approved
                    </Badge>
                </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, phone, or vehicle..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="flex-wrap">
                    <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
                    <TabsTrigger value="approved">Approved ({stats.approved})</TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="live" data-testid="live-tracking-tab">
                        <Activity className="w-4 h-4 mr-1" />
                        Live ({onlinePartners.length})
                    </TabsTrigger>
                    <TabsTrigger value="cod" data-testid="cod-settlements-admin">
                        COD Settlements ({codSettlements?.pending_count || 0})
                    </TabsTrigger>
                </TabsList>

                {/* Live Tracking Tab */}
                <TabsContent value="live" className="mt-6 space-y-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Activity className="w-5 h-5 text-green-500" />
                                <span className="text-sm text-green-400">Online Now</span>
                            </div>
                            <p className="text-3xl font-bold text-green-400">{onlinePartners.length}</p>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Bike className="w-5 h-5 text-blue-500" />
                                <span className="text-sm text-blue-400">Active Deliveries</span>
                            </div>
                            <p className="text-3xl font-bold text-blue-400">
                                {onlinePartners.reduce((sum, p) => sum + (p.active_deliveries || 0), 0)}
                            </p>
                        </div>
                        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Navigation className="w-5 h-5 text-orange-500" />
                                <span className="text-sm text-orange-400">Total KM Today</span>
                            </div>
                            <p className="text-3xl font-bold text-orange-400">
                                {onlinePartners.reduce((sum, p) => sum + (p.today_km || 0), 0).toFixed(1)}
                            </p>
                        </div>
                        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Timer className="w-5 h-5 text-purple-500" />
                                <span className="text-sm text-purple-400">Location Updates</span>
                            </div>
                            <p className="text-3xl font-bold text-purple-400">
                                {onlinePartners.reduce((sum, p) => sum + (p.location_updates || 0), 0)}
                            </p>
                        </div>
                    </div>

                    {/* Fleet Map View */}
                    <FleetMapView 
                        partners={onlinePartners} 
                        onRefresh={fetchOnlinePartners}
                    />

                    {/* Online Partners List */}
                    {onlinePartners.length === 0 ? (
                        <div className="text-center py-12">
                            <Activity size={48} className="mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No delivery partners online</p>
                            <p className="text-sm text-muted-foreground mt-1">Partners will appear here when they go online</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <h4 className="font-semibold text-lg flex items-center gap-2">
                                <Bike className="w-5 h-5" />
                                Partner List ({onlinePartners.length})
                            </h4>
                            {onlinePartners.map(partner => (
                                <div key={partner.id} className="bg-card border border-border rounded-xl p-4 hover:bg-accent/50 transition-colors">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="relative">
                                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                                    <Bike className="w-6 h-6 text-green-600" />
                                                </div>
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-lg">{partner.name}</p>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Phone className="w-3 h-3" />
                                                    <a href={`tel:${partner.phone}`} className="hover:text-primary">{partner.phone}</a>
                                                </div>
                                                {partner.last_location_time && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Last seen: {format(new Date(partner.last_location_time), 'h:mm a')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-3">
                                            {/* Stats Badges */}
                                            <div className="flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm">
                                                <Navigation className="w-3 h-3" />
                                                <span>{partner.today_km?.toFixed(1) || 0} km today</span>
                                            </div>
                                            {partner.active_deliveries > 0 && (
                                                <Badge className="bg-blue-500">
                                                    {partner.active_deliveries} Active
                                                </Badge>
                                            )}
                                            <Badge variant="outline" className="capitalize">
                                                {partner.vehicle_type || 'bike'}
                                            </Badge>
                                            
                                            {/* Action Buttons */}
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => fetchPartnerKmHistory(partner.id, partner.name)}
                                                    data-testid={`view-km-${partner.id}`}
                                                >
                                                    <TrendingUp className="w-4 h-4 mr-1" />
                                                    KM History
                                                </Button>
                                                {partner.last_location && (
                                                    <a
                                                        href={`https://www.google.com/maps?q=${partner.last_location.lat},${partner.last_location.lng}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                                            <MapPin className="w-4 h-4 mr-1" />
                                                            View Location
                                                        </Button>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Refresh Button */}
                    <div className="flex justify-center">
                        <Button variant="outline" onClick={fetchOnlinePartners}>
                            <Activity className="w-4 h-4 mr-2" />
                            Refresh Online Status
                        </Button>
                    </div>
                </TabsContent>

                {/* COD Settlements Tab */}
                <TabsContent value="cod" className="mt-6 space-y-4">
                    {/* COD Summary */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                            <p className="text-sm text-yellow-400">Pending Approval</p>
                            <p className="text-3xl font-bold text-yellow-400">
                                ₹{codSettlements?.pending_amount?.toLocaleString() || 0}
                            </p>
                            <p className="text-xs text-muted-foreground">{codSettlements?.pending_count || 0} requests</p>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                            <p className="text-sm text-green-400">Approved Today</p>
                            <p className="text-3xl font-bold text-green-400">
                                ₹{codSettlements?.settlements?.filter(s => s.status === 'approved' && 
                                    new Date(s.approved_at).toDateString() === new Date().toDateString()
                                ).reduce((sum, s) => sum + s.amount, 0).toLocaleString() || 0}
                            </p>
                        </div>
                    </div>

                    {/* COD Settlement List */}
                    {codSettlements?.settlements?.filter(s => activeTab === 'cod' || s.status === 'pending').length === 0 ? (
                        <div className="text-center py-12">
                            <CreditCard size={48} className="mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No pending COD settlements</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {codSettlements?.settlements?.map(settlement => (
                                <div key={settlement.id} className="bg-card border border-border rounded-xl p-4">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-lg">₹{settlement.amount}</span>
                                                <Badge variant={
                                                    settlement.status === 'approved' ? 'default' :
                                                    settlement.status === 'rejected' ? 'destructive' : 'secondary'
                                                }>
                                                    {settlement.status}
                                                </Badge>
                                            </div>
                                            <p className="text-sm font-medium">{settlement.delivery_partner_name}</p>
                                            <p className="text-xs text-muted-foreground">{settlement.delivery_partner_phone}</p>
                                            {settlement.comment && (
                                                <p className="text-sm text-muted-foreground mt-1">Note: {settlement.comment}</p>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {settlement.created_at ? format(new Date(settlement.created_at), 'MMM d, yyyy h:mm a') : ''}
                                            </p>
                                        </div>
                                        {settlement.status === 'pending' && (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700"
                                                    onClick={() => {
                                                        setSelectedCodSettlement(settlement);
                                                        setShowCodApprovalDialog(true);
                                                    }}
                                                    data-testid={`approve-cod-${settlement.id}`}
                                                >
                                                    <Check size={14} className="mr-1" /> Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => {
                                                        setSelectedCodSettlement(settlement);
                                                        setShowCodApprovalDialog(true);
                                                    }}
                                                >
                                                    <X size={14} className="mr-1" /> Reject
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value={activeTab} className="mt-6">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
                        </div>
                    ) : filteredPartners.length === 0 ? (
                        <div className="text-center py-12">
                            <Bike size={48} className="mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No delivery partners found</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredPartners.map(partner => (
                                <div 
                                    key={partner.id} 
                                    className="bg-card border border-border rounded-xl p-4"
                                    data-testid={`partner-${partner.id}`}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                                                <Bike size={24} className="text-primary" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold">{partner.name}</h3>
                                                    <Badge className={`border ${getStatusBadge(partner.approval_status)}`}>
                                                        {partner.approval_status}
                                                    </Badge>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Phone size={12} /> {partner.phone}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <CreditCard size={12} /> {partner.vehicle_number}
                                                    </span>
                                                    <span className="capitalize">{partner.vehicle_type}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {partner.approval_status === 'approved' && (
                                                <div className="text-right text-sm">
                                                    <p className="text-muted-foreground">Total Deliveries</p>
                                                    <p className="font-semibold">{partner.total_deliveries || 0}</p>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => openDetailDialog(partner)}
                                                >
                                                    <Eye size={14} className="mr-1" /> View
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => openEditDialog(partner)}
                                                >
                                                    <Edit size={14} className="mr-1" /> Edit
                                                </Button>
                                                {partner.approval_status === 'pending' && (
                                                    <Button 
                                                        size="sm" 
                                                        className="bg-green-600 hover:bg-green-700"
                                                        onClick={() => openApprovalDialog(partner)}
                                                        data-testid={`approve-${partner.id}`}
                                                    >
                                                        <Check size={14} className="mr-1" /> Approve
                                                    </Button>
                                                )}
                                                <Button 
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => openDeleteDialog(partner)}
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {partner.created_at && (
                                        <p className="text-xs text-muted-foreground mt-3">
                                            Registered: {format(new Date(partner.created_at), 'MMM d, yyyy h:mm a')}
                                        </p>
                                    )}
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
                        <DialogTitle>Review Delivery Partner</DialogTitle>
                    </DialogHeader>
                    {selectedPartner && (
                        <div className="space-y-4 mt-4">
                            <div className="bg-secondary/50 rounded-lg p-4">
                                <h3 className="font-semibold text-lg">{selectedPartner.name}</h3>
                                <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                                    <div>
                                        <p className="text-muted-foreground">Phone</p>
                                        <p>{selectedPartner.phone}</p>
                                    </div>
                                    {selectedPartner.email && (
                                        <div>
                                            <p className="text-muted-foreground">Email</p>
                                            <p>{selectedPartner.email}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-muted-foreground">Vehicle</p>
                                        <p>{selectedPartner.vehicle_number}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Vehicle Type</p>
                                        <p className="capitalize">{selectedPartner.vehicle_type}</p>
                                    </div>
                                    {selectedPartner.license_number && (
                                        <div className="col-span-2">
                                            <p className="text-muted-foreground">License Number</p>
                                            <p className="font-mono">{selectedPartner.license_number}</p>
                                        </div>
                                    )}
                                    {selectedPartner.address && (
                                        <div className="col-span-2">
                                            <p className="text-muted-foreground">Address</p>
                                            <p>{selectedPartner.address}</p>
                                        </div>
                                    )}
                                    {(selectedPartner.city || selectedPartner.state || selectedPartner.pincode) && (
                                        <div className="col-span-2">
                                            <p className="text-muted-foreground">Location</p>
                                            <p>{[selectedPartner.city, selectedPartner.state, selectedPartner.pincode].filter(Boolean).join(', ')}</p>
                                        </div>
                                    )}
                                </div>
                                {/* License Image Preview */}
                                {selectedPartner.license_image && (
                                    <div className="mt-4">
                                        <p className="text-muted-foreground text-sm mb-2">Driving License Document</p>
                                        <a 
                                            href={selectedPartner.license_image} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                                        >
                                            <Eye size={14} /> View License Document
                                        </a>
                                    </div>
                                )}
                            </div>

                            <div>
                                <Label>Notes (optional)</Label>
                                <Textarea
                                    value={approvalNotes}
                                    onChange={(e) => setApprovalNotes(e.target.value)}
                                    placeholder="Add any notes for the delivery partner..."
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

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Delivery Partner Details</DialogTitle>
                    </DialogHeader>
                    {selectedPartner && (
                        <div className="space-y-4 mt-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                                    <Bike size={32} className="text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">{selectedPartner.name}</h3>
                                    <Badge className={`border ${getStatusBadge(selectedPartner.approval_status)}`}>
                                        {selectedPartner.approval_status}
                                    </Badge>
                                </div>
                            </div>

                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Phone</span>
                                    <span>{selectedPartner.phone}</span>
                                </div>
                                {selectedPartner.email && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Email</span>
                                        <span>{selectedPartner.email}</span>
                                    </div>
                                )}
                                {selectedPartner.address && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Address</span>
                                        <span className="text-right max-w-[60%]">{selectedPartner.address}</span>
                                    </div>
                                )}
                                {selectedPartner.city && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">City</span>
                                        <span>{selectedPartner.city}</span>
                                    </div>
                                )}
                                {selectedPartner.state && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">State</span>
                                        <span>{selectedPartner.state}</span>
                                    </div>
                                )}
                                {selectedPartner.pincode && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Pincode</span>
                                        <span>{selectedPartner.pincode}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Vehicle Number</span>
                                    <span>{selectedPartner.vehicle_number}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Vehicle Type</span>
                                    <span className="capitalize">{selectedPartner.vehicle_type}</span>
                                </div>
                                {selectedPartner.license_number && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">License Number</span>
                                        <span className="font-mono">{selectedPartner.license_number}</span>
                                    </div>
                                )}
                                {selectedPartner.license_image && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">License Document</span>
                                        <a 
                                            href={selectedPartner.license_image} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline flex items-center gap-1"
                                        >
                                            <Eye size={14} /> View
                                        </a>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Deliveries</span>
                                    <span>{selectedPartner.total_deliveries || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Earnings</span>
                                    <span className="price-tag">₹{Math.round(selectedPartner.total_earnings || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Rating</span>
                                    <span className="flex items-center gap-1">
                                        <Star size={14} className="text-yellow-400 fill-yellow-400" />
                                        {selectedPartner.rating || 5.0}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Status</span>
                                    <span>{selectedPartner.is_online ? 'Online' : 'Offline'}</span>
                                </div>
                            </div>

                            {selectedPartner.approval_notes && (
                                <div className="bg-secondary/50 rounded-lg p-3">
                                    <p className="text-sm text-muted-foreground">Admin Notes:</p>
                                    <p className="text-sm">{selectedPartner.approval_notes}</p>
                                </div>
                            )}

                            {selectedPartner.approval_status === 'pending' && (
                                <div className="flex gap-2 pt-2">
                                    <Button 
                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                        onClick={() => {
                                            setShowDetailDialog(false);
                                            openApprovalDialog(selectedPartner);
                                        }}
                                    >
                                        Review & Approve
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit Delivery Partner Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Delivery Partner</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <Label>Name *</Label>
                            <Input
                                value={editData.name}
                                onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Phone *</Label>
                            <Input
                                value={editData.phone}
                                onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Email</Label>
                            <Input
                                type="email"
                                value={editData.email}
                                onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="Email address"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Address</Label>
                            <Input
                                value={editData.address}
                                onChange={(e) => setEditData(prev => ({ ...prev, address: e.target.value }))}
                                placeholder="Full address"
                                className="mt-1"
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
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
                            <Label>Vehicle Type</Label>
                            <Select 
                                value={editData.vehicle_type} 
                                onValueChange={(value) => setEditData(prev => ({ ...prev, vehicle_type: value }))}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="bike">Bike</SelectItem>
                                    <SelectItem value="scooter">Scooter</SelectItem>
                                    <SelectItem value="bicycle">Bicycle</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Vehicle Number *</Label>
                            <Input
                                value={editData.vehicle_number}
                                onChange={(e) => setEditData(prev => ({ ...prev, vehicle_number: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>License Number</Label>
                            <Input
                                value={editData.license_number}
                                onChange={(e) => setEditData(prev => ({ ...prev, license_number: e.target.value }))}
                                placeholder="15-character driving licence"
                                className="mt-1 font-mono"
                                maxLength={15}
                            />
                        </div>
                        <div>
                            <Label>License Image URL</Label>
                            <Input
                                value={editData.license_image}
                                onChange={(e) => setEditData(prev => ({ ...prev, license_image: e.target.value }))}
                                placeholder="URL to licence document"
                                className="mt-1"
                            />
                            {editData.license_image && (
                                <a 
                                    href={editData.license_image} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline mt-1 inline-block"
                                >
                                    View current document
                                </a>
                            )}
                        </div>
                        <div>
                            <Label>Approval Status</Label>
                            <Select 
                                value={editData.approval_status} 
                                onValueChange={(value) => setEditData(prev => ({ ...prev, approval_status: value }))}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={editData.is_available}
                                onCheckedChange={(checked) => setEditData(prev => ({ ...prev, is_available: checked }))}
                            />
                            <Label>Available for Deliveries</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={editData.is_online}
                                onCheckedChange={(checked) => setEditData(prev => ({ ...prev, is_online: checked }))}
                            />
                            <Label>Online</Label>
                        </div>
                        <Button onClick={handleEditPartner} className="w-full btn-primary">
                            Save Changes
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Delivery Partner</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <p className="text-muted-foreground">
                            Are you sure you want to delete <strong>{selectedPartner?.name}</strong>? This action cannot be undone and will also delete the associated user account.
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
                                onClick={handleDeletePartner}
                            >
                                <Trash2 size={14} className="mr-1" /> Delete
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* COD Approval Dialog */}
            <Dialog open={showCodApprovalDialog} onOpenChange={setShowCodApprovalDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>COD Settlement Approval</DialogTitle>
                    </DialogHeader>
                    {selectedCodSettlement && (
                        <div className="space-y-4 mt-4">
                            <div className="bg-secondary/50 rounded-lg p-4">
                                <p className="text-2xl font-bold">₹{selectedCodSettlement.amount}</p>
                                <p className="text-sm text-muted-foreground">{selectedCodSettlement.delivery_partner_name}</p>
                                {selectedCodSettlement.comment && (
                                    <p className="text-sm mt-2">Partner note: {selectedCodSettlement.comment}</p>
                                )}
                            </div>
                            <div>
                                <Label>Admin Comment (Optional)</Label>
                                <Input
                                    value={codApprovalComment}
                                    onChange={(e) => setCodApprovalComment(e.target.value)}
                                    placeholder="Add a note..."
                                    className="mt-1"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                    onClick={() => handleCodApproval('approve')}
                                >
                                    <Check size={14} className="mr-1" /> Approve
                                </Button>
                                <Button 
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={() => handleCodApproval('reject')}
                                >
                                    <X size={14} className="mr-1" /> Reject
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* KM History Dialog */}
            <Dialog open={showKmDialog} onOpenChange={setShowKmDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-orange-500" />
                            KM History - {kmHistory?.name}
                        </DialogTitle>
                    </DialogHeader>
                    {kmHistory && (
                        <div className="space-y-4">
                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-orange-50 rounded-lg p-3 text-center">
                                    <p className="text-xs text-orange-600">Total (7 days)</p>
                                    <p className="text-xl font-bold text-orange-700">{kmHistory.summary?.total_km} km</p>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-3 text-center">
                                    <p className="text-xs text-blue-600">Days Active</p>
                                    <p className="text-xl font-bold text-blue-700">{kmHistory.summary?.days_active}</p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-3 text-center">
                                    <p className="text-xs text-green-600">Avg Daily</p>
                                    <p className="text-xl font-bold text-green-700">{kmHistory.summary?.avg_daily_km} km</p>
                                </div>
                            </div>

                            {/* Daily Breakdown */}
                            <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                                {kmHistory.history?.length > 0 ? (
                                    kmHistory.history.map((day, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 hover:bg-gray-50">
                                            <div>
                                                <p className="font-medium">{day.date}</p>
                                                <p className="text-xs text-muted-foreground">{day.location_updates || 0} updates</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-orange-600">{day.total_km?.toFixed(2)} km</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-muted-foreground">
                                        No KM data available for this period
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
