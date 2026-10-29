import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Eye, EyeOff, Gift, Truck, Percent, Star, Clock, Leaf, ArrowUp, ArrowDown } from 'lucide-react';

const iconOptions = [
    { value: 'gift', label: 'Gift', icon: Gift },
    { value: 'truck', label: 'Delivery Truck', icon: Truck },
    { value: 'percent', label: 'Percent', icon: Percent },
    { value: 'star', label: 'Star', icon: Star },
    { value: 'clock', label: 'Clock', icon: Clock },
    { value: 'leaf', label: 'Leaf', icon: Leaf }
];

const gradientOptions = [
    { value: 'from-orange-500 via-red-500 to-pink-500', label: 'Orange → Red → Pink', preview: 'bg-gradient-to-r from-orange-500 via-red-500 to-pink-500' },
    { value: 'from-emerald-500 via-teal-500 to-cyan-500', label: 'Emerald → Teal → Cyan', preview: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500' },
    { value: 'from-violet-500 via-purple-500 to-fuchsia-500', label: 'Violet → Purple → Fuchsia', preview: 'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500' },
    { value: 'from-blue-500 via-indigo-500 to-purple-500', label: 'Blue → Indigo → Purple', preview: 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500' },
    { value: 'from-yellow-500 via-orange-500 to-red-500', label: 'Yellow → Orange → Red', preview: 'bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500' },
    { value: 'from-pink-500 via-rose-500 to-red-500', label: 'Pink → Rose → Red', preview: 'bg-gradient-to-r from-pink-500 via-rose-500 to-red-500' }
];

export default function AdminSlides() {
    const { API } = useAdmin();
    const [slides, setSlides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [selectedSlide, setSelectedSlide] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        description: '',
        background_gradient: 'from-orange-500 via-red-500 to-pink-500',
        icon: 'gift',
        order: 0
    });

    const fetchSlides = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/slides?active_only=false`);
            setSlides(response.data);
        } catch (error) {
            console.error('Failed to fetch slides:', error);
        } finally {
            setLoading(false);
        }
    }, [API]);

    useEffect(() => {
        fetchSlides();
    }, [fetchSlides]);

    const handleCreate = async () => {
        if (!formData.title || !formData.subtitle || !formData.description) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            await axios.post(`${API}/admin/slides`, {
                ...formData,
                order: slides.length + 1
            });
            toast.success('Slide created successfully');
            setShowCreateDialog(false);
            setFormData({
                title: '', subtitle: '', description: '',
                background_gradient: 'from-orange-500 via-red-500 to-pink-500',
                icon: 'gift', order: 0
            });
            fetchSlides();
        } catch (error) {
            toast.error('Failed to create slide');
        }
    };

    const handleUpdate = async () => {
        if (!selectedSlide) return;

        try {
            await axios.put(`${API}/admin/slides/${selectedSlide.id}`, formData);
            toast.success('Slide updated');
            setShowEditDialog(false);
            setSelectedSlide(null);
            fetchSlides();
        } catch (error) {
            toast.error('Failed to update slide');
        }
    };

    const handleDelete = async (slideId) => {
        if (!window.confirm('Are you sure you want to delete this slide?')) return;

        try {
            await axios.delete(`${API}/admin/slides/${slideId}`);
            toast.success('Slide deleted');
            fetchSlides();
        } catch (error) {
            toast.error('Failed to delete slide');
        }
    };

    const handleToggle = async (slideId) => {
        try {
            await axios.put(`${API}/admin/slides/${slideId}/toggle`);
            fetchSlides();
        } catch (error) {
            toast.error('Failed to toggle slide');
        }
    };

    const openEditDialog = (slide) => {
        setSelectedSlide(slide);
        setFormData({
            title: slide.title,
            subtitle: slide.subtitle,
            description: slide.description,
            background_gradient: slide.background_gradient,
            icon: slide.icon,
            order: slide.order
        });
        setShowEditDialog(true);
    };

    const getIconComponent = (iconName) => {
        const iconObj = iconOptions.find(i => i.value === iconName);
        if (iconObj) {
            const IconComp = iconObj.icon;
            return <IconComp size={24} />;
        }
        return <Gift size={24} />;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Promotional Slides</h1>
                    <p className="text-muted-foreground">Manage homepage promotional banners</p>
                </div>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                        <Button className="btn-primary" data-testid="create-slide-btn">
                            <Plus size={16} className="mr-2" /> Create Slide
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create Promotional Slide</DialogTitle>
                            <DialogDescription>Create a new promotional banner for the homepage</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            <div>
                                <Label>Title *</Label>
                                <Input
                                    value={formData.title}
                                    onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                                    placeholder="e.g., ZERO DELIVERY FEE"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Subtitle *</Label>
                                <Input
                                    value={formData.subtitle}
                                    onChange={(e) => setFormData(p => ({ ...p, subtitle: e.target.value }))}
                                    placeholder="e.g., On Your First Order!"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Description *</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Detailed description..."
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Icon</Label>
                                <Select
                                    value={formData.icon}
                                    onValueChange={(v) => setFormData(p => ({ ...p, icon: v }))}
                                >
                                    <SelectTrigger className="mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {iconOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                <div className="flex items-center gap-2">
                                                    <opt.icon size={16} />
                                                    {opt.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Background Gradient</Label>
                                <Select
                                    value={formData.background_gradient}
                                    onValueChange={(v) => setFormData(p => ({ ...p, background_gradient: v }))}
                                >
                                    <SelectTrigger className="mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {gradientOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-20 h-4 rounded ${opt.preview}`}></div>
                                                    <span className="text-xs">{opt.label}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Preview */}
                            <div className={`rounded-lg p-4 bg-gradient-to-r ${formData.background_gradient}`}>
                                <div className="flex items-center gap-3 text-white">
                                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                        {getIconComponent(formData.icon)}
                                    </div>
                                    <div>
                                        <p className="text-xs opacity-80">{formData.subtitle || 'Subtitle'}</p>
                                        <p className="font-bold">{formData.title || 'Title'}</p>
                                    </div>
                                </div>
                            </div>
                            <Button onClick={handleCreate} className="w-full btn-primary">
                                Create Slide
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Slides List */}
            {slides.length === 0 ? (
                <div className="text-center py-16 bg-card rounded-xl border border-border">
                    <Gift size={48} className="mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No promotional slides yet</p>
                    <p className="text-sm text-muted-foreground">Create your first slide to attract customers!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {slides.map((slide, idx) => (
                        <div 
                            key={slide.id} 
                            className={`rounded-xl overflow-hidden border border-border ${!slide.is_active ? 'opacity-60' : ''}`}
                        >
                            {/* Slide Preview */}
                            <div className={`bg-gradient-to-r ${slide.background_gradient} p-4`}>
                                <div className="flex items-center gap-4 text-white">
                                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                                        {getIconComponent(slide.icon)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs opacity-80">{slide.subtitle}</p>
                                        <p className="font-bold text-lg truncate">{slide.title}</p>
                                        <p className="text-sm opacity-90 truncate">{slide.description}</p>
                                    </div>
                                    <Badge variant="outline" className="bg-white/20 text-white border-white/30">
                                        #{idx + 1}
                                    </Badge>
                                </div>
                            </div>
                            
                            {/* Actions */}
                            <div className="bg-card p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={slide.is_active}
                                        onCheckedChange={() => handleToggle(slide.id)}
                                    />
                                    <span className="text-sm text-muted-foreground">
                                        {slide.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openEditDialog(slide)}
                                        data-testid={`edit-slide-${slide.id}`}
                                    >
                                        <Edit size={14} className="mr-1" /> Edit
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDelete(slide.id)}
                                        data-testid={`delete-slide-${slide.id}`}
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Promotional Slide</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <Label>Title *</Label>
                            <Input
                                value={formData.title}
                                onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Subtitle *</Label>
                            <Input
                                value={formData.subtitle}
                                onChange={(e) => setFormData(p => ({ ...p, subtitle: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Description *</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Icon</Label>
                            <Select
                                value={formData.icon}
                                onValueChange={(v) => setFormData(p => ({ ...p, icon: v }))}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {iconOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <div className="flex items-center gap-2">
                                                <opt.icon size={16} />
                                                {opt.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Background Gradient</Label>
                            <Select
                                value={formData.background_gradient}
                                onValueChange={(v) => setFormData(p => ({ ...p, background_gradient: v }))}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {gradientOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-20 h-4 rounded ${opt.preview}`}></div>
                                                <span className="text-xs">{opt.label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Preview */}
                        <div className={`rounded-lg p-4 bg-gradient-to-r ${formData.background_gradient}`}>
                            <div className="flex items-center gap-3 text-white">
                                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                    {getIconComponent(formData.icon)}
                                </div>
                                <div>
                                    <p className="text-xs opacity-80">{formData.subtitle}</p>
                                    <p className="font-bold">{formData.title}</p>
                                </div>
                            </div>
                        </div>
                        <Button onClick={handleUpdate} className="w-full btn-primary">
                            Save Changes
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
