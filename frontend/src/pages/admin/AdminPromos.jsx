import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
    Tag, Plus, Edit, Trash2, Search, Percent, IndianRupee, 
    Truck, Calendar, CheckCircle, XCircle, Copy
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { useAdmin } from '../../contexts/AdminContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AdminPromos() {
    const { API } = useAdmin();
    const [promos, setPromos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [editingPromo, setEditingPromo] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        code: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 10,
        min_order_amount: 0,
        max_discount: null,
        valid_from: '',
        valid_until: '',
        usage_limit: null,
        per_user_limit: 1,
        applicable_restaurants: [],
        is_active: true
    });

    const fetchPromos = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/admin/promos`);
            setPromos(response.data);
        } catch (error) {
            console.error('Failed to fetch promos:', error);
        } finally {
            setLoading(false);
        }
    }, [API]);

    useEffect(() => {
        fetchPromos();
    }, [fetchPromos]);

    const resetForm = () => {
        setFormData({
            code: '',
            description: '',
            discount_type: 'percentage',
            discount_value: 10,
            min_order_amount: 0,
            max_discount: null,
            valid_from: '',
            valid_until: '',
            usage_limit: null,
            per_user_limit: 1,
            applicable_restaurants: [],
            is_active: true
        });
        setEditingPromo(null);
    };

    const handleSubmit = async () => {
        if (!formData.code || !formData.description || !formData.discount_value) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            const payload = {
                ...formData,
                discount_value: parseFloat(formData.discount_value),
                min_order_amount: parseFloat(formData.min_order_amount) || 0,
                max_discount: formData.max_discount ? parseFloat(formData.max_discount) : null,
                usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
                per_user_limit: parseInt(formData.per_user_limit) || 1,
                valid_from: formData.valid_from || null,
                valid_until: formData.valid_until || null
            };

            if (editingPromo) {
                await axios.put(`${API}/admin/promos/${editingPromo.id}`, payload);
                toast.success('Promo updated successfully');
            } else {
                await axios.post(`${API}/admin/promos`, payload);
                toast.success('Promo created successfully');
            }

            setShowAddDialog(false);
            resetForm();
            fetchPromos();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save promo');
        }
    };

    const handleDelete = async (promoId) => {
        if (!confirm('Are you sure you want to delete this promo?')) return;
        
        try {
            await axios.delete(`${API}/admin/promos/${promoId}`);
            toast.success('Promo deleted');
            fetchPromos();
        } catch (error) {
            toast.error('Failed to delete promo');
        }
    };

    const handleEdit = (promo) => {
        setEditingPromo(promo);
        setFormData({
            code: promo.code,
            description: promo.description,
            discount_type: promo.discount_type,
            discount_value: promo.discount_value,
            min_order_amount: promo.min_order_amount || 0,
            max_discount: promo.max_discount || null,
            valid_from: promo.valid_from ? promo.valid_from.split('T')[0] : '',
            valid_until: promo.valid_until ? promo.valid_until.split('T')[0] : '',
            usage_limit: promo.usage_limit || null,
            per_user_limit: promo.per_user_limit || 1,
            applicable_restaurants: promo.applicable_restaurants || [],
            is_active: promo.is_active
        });
        setShowAddDialog(true);
    };

    const copyCode = (code) => {
        navigator.clipboard.writeText(code);
        toast.success('Promo code copied!');
    };

    const getDiscountIcon = (type) => {
        switch (type) {
            case 'percentage': return <Percent size={16} />;
            case 'flat': return <IndianRupee size={16} />;
            case 'free_delivery': return <Truck size={16} />;
            default: return <Tag size={16} />;
        }
    };

    const getDiscountDisplay = (promo) => {
        switch (promo.discount_type) {
            case 'percentage': return `${promo.discount_value}% OFF`;
            case 'flat': return `₹${promo.discount_value} OFF`;
            case 'free_delivery': return 'FREE DELIVERY';
            default: return promo.discount_value;
        }
    };

    const filteredPromos = promos.filter(p =>
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6" data-testid="admin-promos">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Promotional Offers</h1>
                    <p className="text-muted-foreground">Create and manage discount codes</p>
                </div>
                <Button className="btn-primary" onClick={() => { resetForm(); setShowAddDialog(true); }}>
                    <Plus size={16} className="mr-1" /> Create Promo
                </Button>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search promos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card">
                    <p className="text-2xl font-bold">{promos.length}</p>
                    <p className="text-sm text-muted-foreground">Total Promos</p>
                </div>
                <div className="stat-card">
                    <p className="text-2xl font-bold text-green-400">{promos.filter(p => p.is_active).length}</p>
                    <p className="text-sm text-muted-foreground">Active</p>
                </div>
                <div className="stat-card">
                    <p className="text-2xl font-bold text-yellow-400">{promos.filter(p => p.discount_type === 'percentage').length}</p>
                    <p className="text-sm text-muted-foreground">Percentage</p>
                </div>
                <div className="stat-card">
                    <p className="text-2xl font-bold text-cyan-400">{promos.reduce((sum, p) => sum + (p.usage_count || 0), 0)}</p>
                    <p className="text-sm text-muted-foreground">Total Uses</p>
                </div>
            </div>

            {/* Promos List */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
                </div>
            ) : filteredPromos.length === 0 ? (
                <div className="text-center py-12">
                    <Tag size={48} className="mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No promo codes found</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    {filteredPromos.map(promo => (
                        <div 
                            key={promo.id} 
                            className={`bg-card border rounded-xl p-4 ${promo.is_active ? 'border-green-500/30' : 'border-border opacity-60'}`}
                            data-testid={`promo-${promo.id}`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-primary/20">
                                        {getDiscountIcon(promo.discount_type)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-lg">{promo.code}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(promo.code)}>
                                                <Copy size={12} />
                                            </Button>
                                        </div>
                                        <Badge className={promo.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                                            {promo.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-bold text-primary">{getDiscountDisplay(promo)}</p>
                                    {promo.max_discount && <p className="text-xs text-muted-foreground">Max ₹{promo.max_discount}</p>}
                                </div>
                            </div>

                            <p className="text-sm text-muted-foreground mb-3">{promo.description}</p>

                            <div className="flex flex-wrap gap-2 text-xs mb-3">
                                {promo.min_order_amount > 0 && (
                                    <span className="bg-secondary px-2 py-1 rounded">Min order: ₹{promo.min_order_amount}</span>
                                )}
                                {promo.valid_until && (
                                    <span className="bg-secondary px-2 py-1 rounded flex items-center gap-1">
                                        <Calendar size={10} />
                                        Until {format(new Date(promo.valid_until), 'MMM d, yyyy')}
                                    </span>
                                )}
                                <span className="bg-secondary px-2 py-1 rounded">
                                    {promo.usage_count || 0} / {promo.usage_limit || '∞'} uses
                                </span>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEdit(promo)}>
                                    <Edit size={14} className="mr-1" /> Edit
                                </Button>
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(promo.id)}>
                                    <Trash2 size={14} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingPromo ? 'Edit Promo' : 'Create New Promo'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <Label>Promo Code *</Label>
                            <Input
                                value={formData.code}
                                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                placeholder="e.g., FLAT50, WELCOME20"
                                className="mt-1 font-mono"
                            />
                        </div>

                        <div>
                            <Label>Description *</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="e.g., Get 50% off on your first order"
                                className="mt-1"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Discount Type</Label>
                                <select
                                    value={formData.discount_type}
                                    onChange={(e) => setFormData(prev => ({ ...prev, discount_type: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background"
                                >
                                    <option value="percentage">Percentage (%)</option>
                                    <option value="flat">Flat Amount (₹)</option>
                                    <option value="free_delivery">Free Delivery</option>
                                </select>
                            </div>
                            <div>
                                <Label>Discount Value *</Label>
                                <Input
                                    type="number"
                                    value={formData.discount_value}
                                    onChange={(e) => setFormData(prev => ({ ...prev, discount_value: e.target.value }))}
                                    placeholder={formData.discount_type === 'percentage' ? '10' : '50'}
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Min Order Amount (₹)</Label>
                                <Input
                                    type="number"
                                    value={formData.min_order_amount}
                                    onChange={(e) => setFormData(prev => ({ ...prev, min_order_amount: e.target.value }))}
                                    placeholder="0"
                                    className="mt-1"
                                />
                            </div>
                            {formData.discount_type === 'percentage' && (
                                <div>
                                    <Label>Max Discount (₹)</Label>
                                    <Input
                                        type="number"
                                        value={formData.max_discount || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, max_discount: e.target.value }))}
                                        placeholder="100"
                                        className="mt-1"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Valid From</Label>
                                <Input
                                    type="date"
                                    value={formData.valid_from}
                                    onChange={(e) => setFormData(prev => ({ ...prev, valid_from: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Valid Until</Label>
                                <Input
                                    type="date"
                                    value={formData.valid_until}
                                    onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Usage Limit (Total)</Label>
                                <Input
                                    type="number"
                                    value={formData.usage_limit || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: e.target.value }))}
                                    placeholder="Unlimited"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Per User Limit</Label>
                                <Input
                                    type="number"
                                    value={formData.per_user_limit}
                                    onChange={(e) => setFormData(prev => ({ ...prev, per_user_limit: e.target.value }))}
                                    placeholder="1"
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                checked={formData.is_active}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                            />
                            <Label>Active</Label>
                        </div>

                        <Button onClick={handleSubmit} className="w-full btn-primary">
                            {editingPromo ? 'Update Promo' : 'Create Promo'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
