import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
    MessageSquare, Search, CheckCircle, Trash2, Phone, User, 
    Calendar, Clock, AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useAdmin } from '../../contexts/AdminContext';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

export default function AdminFeedback() {
    const { API } = useAdmin();
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFeedback, setSelectedFeedback] = useState(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [activeTab, setActiveTab] = useState('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({ pending: 0, resolved: 0, complaint: 0, suggestion: 0 });
    const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'complaint' | 'suggestion'

    const fetchFeedback = useCallback(async () => {
        try {
            const params = typeFilter !== 'all' ? { type: typeFilter } : {};
            const response = await axios.get(`${API}/admin/feedback`, { params });
            setFeedback(response.data.feedback || []);
            setStats({
                pending: response.data.pending_count || 0,
                resolved: response.data.resolved_count || 0,
                complaint: response.data.complaint_count || 0,
                suggestion: response.data.suggestion_count || 0,
            });
        } catch (error) {
            console.error('Failed to fetch feedback:', error);
        } finally {
            setLoading(false);
        }
    }, [API, typeFilter]);

    useEffect(() => {
        fetchFeedback();
    }, [fetchFeedback]);

    const handleResolve = async (feedbackId) => {
        try {
            await axios.put(`${API}/admin/feedback/${feedbackId}/resolve`);
            toast.success('Feedback marked as resolved');
            fetchFeedback();
        } catch (error) {
            toast.error('Failed to update feedback');
        }
    };

    const handleDelete = async () => {
        if (!selectedFeedback) return;
        
        try {
            await axios.delete(`${API}/admin/feedback/${selectedFeedback.id}`);
            toast.success('Feedback deleted');
            setShowDeleteDialog(false);
            setSelectedFeedback(null);
            fetchFeedback();
        } catch (error) {
            toast.error('Failed to delete feedback');
        }
    };

    const openDetailDialog = (item) => {
        setSelectedFeedback(item);
        setShowDetailDialog(true);
    };

    const openDeleteDialog = (item) => {
        setSelectedFeedback(item);
        setShowDeleteDialog(true);
    };

    const filteredFeedback = feedback.filter(f => {
        const matchesSearch = f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.phone?.includes(searchQuery) ||
            f.message?.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (activeTab === 'pending') return matchesSearch && f.status === 'pending';
        if (activeTab === 'resolved') return matchesSearch && f.status === 'resolved';
        return matchesSearch;
    });

    return (
        <div className="space-y-6" data-testid="admin-feedback">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Complaints & Suggestions</h1>
                    <p className="text-muted-foreground">Manage customer feedback (auto-deleted after 30 days)</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-yellow-500/20 text-yellow-600">
                        {stats.pending} Pending
                    </Badge>
                    <Badge variant="outline" className="bg-green-500/20 text-green-600">
                        {stats.resolved} Resolved
                    </Badge>
                </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, phone, or message..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Type filter (Complaints / Suggestions / All) */}
            <div className="flex flex-wrap items-center gap-2" data-testid="feedback-type-filter">
                <span className="text-sm text-muted-foreground">Show:</span>
                {[
                    { value: 'all', label: `All (${stats.complaint + stats.suggestion})` },
                    { value: 'complaint', label: `Complaints (${stats.complaint})`, badge: 'bg-red-100 text-red-700' },
                    { value: 'suggestion', label: `Suggestions (${stats.suggestion})`, badge: 'bg-blue-100 text-blue-700' },
                ].map(opt => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTypeFilter(opt.value)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            typeFilter === opt.value
                                ? 'bg-foreground text-background border-foreground'
                                : 'bg-card text-foreground border-border hover:border-foreground/40'
                        }`}
                        data-testid={`type-filter-${opt.value}`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
                    <TabsTrigger value="resolved">Resolved ({stats.resolved})</TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-6">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
                        </div>
                    ) : filteredFeedback.length === 0 ? (
                        <div className="text-center py-12">
                            <MessageSquare size={48} className="mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No feedback found</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredFeedback.map(item => (
                                <div 
                                    key={item.id} 
                                    className={`bg-card border rounded-xl p-4 ${
                                        item.status === 'pending' ? 'border-yellow-500/30' : 'border-border'
                                    }`}
                                    data-testid={`feedback-${item.id}`}
                                >
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <h3 className="font-semibold">{item.name}</h3>
                                                <Badge className={item.status === 'pending' 
                                                    ? 'bg-yellow-500/20 text-yellow-600 border-yellow-500/50' 
                                                    : 'bg-green-500/20 text-green-600 border-green-500/50'
                                                }>
                                                    {item.status}
                                                </Badge>
                                                {item.type && (
                                                    <Badge className={
                                                        item.type === 'suggestion'
                                                            ? 'bg-blue-100 text-blue-700 border-blue-300'
                                                            : 'bg-red-100 text-red-700 border-red-300'
                                                    } data-testid={`feedback-type-${item.type}`}>
                                                        {item.type === 'suggestion' ? '💡 Suggestion' : '⚠️ Complaint'}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                                                <Phone size={12} /> {item.phone}
                                            </p>
                                            <p className="text-sm text-gray-700 line-clamp-2">
                                                {item.message}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                                <Clock size={12} />
                                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => openDetailDialog(item)}
                                            >
                                                View
                                            </Button>
                                            {item.status === 'pending' && (
                                                <Button 
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700"
                                                    onClick={() => handleResolve(item.id)}
                                                >
                                                    <CheckCircle size={14} className="mr-1" /> Resolve
                                                </Button>
                                            )}
                                            <Button 
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => openDeleteDialog(item)}
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

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Feedback Details</DialogTitle>
                    </DialogHeader>
                    {selectedFeedback && (
                        <div className="space-y-4 mt-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                                    <User size={24} className="text-orange-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">{selectedFeedback.name}</h3>
                                    <p className="text-sm text-muted-foreground">{selectedFeedback.phone}</p>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {selectedFeedback.message}
                                </p>
                            </div>

                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Calendar size={14} />
                                    {format(new Date(selectedFeedback.created_at), 'MMM d, yyyy h:mm a')}
                                </span>
                                <Badge className={selectedFeedback.status === 'pending' 
                                    ? 'bg-yellow-500/20 text-yellow-600' 
                                    : 'bg-green-500/20 text-green-600'
                                }>
                                    {selectedFeedback.status}
                                </Badge>
                            </div>

                            {selectedFeedback.status === 'pending' && (
                                <Button 
                                    className="w-full bg-green-600 hover:bg-green-700"
                                    onClick={() => {
                                        handleResolve(selectedFeedback.id);
                                        setShowDetailDialog(false);
                                    }}
                                >
                                    <CheckCircle size={16} className="mr-1" /> Mark as Resolved
                                </Button>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Feedback</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <p className="text-muted-foreground">
                            Are you sure you want to delete this feedback from <strong>{selectedFeedback?.name}</strong>? This action cannot be undone.
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
                                onClick={handleDelete}
                            >
                                <Trash2 size={14} className="mr-1" /> Delete
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
