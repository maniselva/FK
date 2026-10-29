import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
    Star, MessageSquare, Check, X, Edit, Trash2, Filter, 
    TrendingUp, Search, Clock, CheckCircle, XCircle, User, Bike
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../../components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminReviews() {
    const [reviews, setReviews] = useState([]);
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [activeTab, setActiveTab] = useState('pending');
    
    // Filters
    const [restaurantFilter, setRestaurantFilter] = useState('all');
    const [ratingFilter, setRatingFilter] = useState('all');
    
    // Dialogs
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedReview, setSelectedReview] = useState(null);
    const [editData, setEditData] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const fetchRestaurants = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/restaurants`);
            setRestaurants(response.data);
        } catch (error) {
            console.error('Failed to fetch restaurants:', error);
        }
    }, []);

    const fetchReviews = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: page.toString(), limit: '20' });
            
            if (activeTab !== 'all') {
                params.append('status', activeTab);
            }
            if (restaurantFilter !== 'all') {
                params.append('restaurant_id', restaurantFilter);
            }
            if (ratingFilter !== 'all') {
                params.append('rating_filter', ratingFilter);
            }
            
            const response = await axios.get(`${API}/admin/reviews?${params.toString()}`);
            setReviews(response.data.reviews);
            setTotalPages(response.data.pages);
            setStats(response.data.stats);
        } catch (error) {
            console.error('Failed to fetch reviews:', error);
            toast.error('Failed to fetch reviews');
        } finally {
            setLoading(false);
        }
    }, [page, activeTab, restaurantFilter, ratingFilter]);

    useEffect(() => {
        fetchRestaurants();
    }, [fetchRestaurants]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    const handleApprove = async (review) => {
        try {
            const admin = JSON.parse(localStorage.getItem('foodkey_admin') || '{}');
            await axios.put(`${API}/admin/reviews/${review.id}?admin_phone=${admin.phone || ''}`, {
                status: 'approved'
            });
            toast.success('Review approved! Rating updated.');
            fetchReviews();
        } catch (error) {
            toast.error('Failed to approve review');
        }
    };

    const handleReject = async (review) => {
        try {
            const admin = JSON.parse(localStorage.getItem('foodkey_admin') || '{}');
            await axios.put(`${API}/admin/reviews/${review.id}?admin_phone=${admin.phone || ''}`, {
                status: 'rejected'
            });
            toast.success('Review rejected');
            fetchReviews();
        } catch (error) {
            toast.error('Failed to reject review');
        }
    };

    const openEditDialog = (review) => {
        setSelectedReview(review);
        setEditData({
            rating: review.rating || 5,
            comment: review.comment || '',
            delivery_rating: review.delivery_rating || null,
            delivery_comment: review.delivery_comment || '',
            admin_notes: review.admin_notes || '',
            status: review.status || 'pending'
        });
        setShowEditDialog(true);
    };

    const handleSaveEdit = async () => {
        if (!selectedReview) return;
        setSubmitting(true);
        try {
            const admin = JSON.parse(localStorage.getItem('foodkey_admin') || '{}');
            await axios.put(`${API}/admin/reviews/${selectedReview.id}?admin_phone=${admin.phone || ''}`, {
                rating: parseInt(editData.rating),
                comment: editData.comment || null,
                delivery_rating: editData.delivery_rating ? parseInt(editData.delivery_rating) : null,
                delivery_comment: editData.delivery_comment || null,
                admin_notes: editData.admin_notes || null,
                status: editData.status
            });
            toast.success('Review updated successfully');
            setShowEditDialog(false);
            fetchReviews();
        } catch (error) {
            toast.error('Failed to update review');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteReview = async () => {
        if (!selectedReview) return;
        try {
            await axios.delete(`${API}/admin/reviews/${selectedReview.id}`);
            toast.success('Review deleted');
            setShowDeleteDialog(false);
            fetchReviews();
        } catch (error) {
            toast.error('Failed to delete review');
        }
    };

    const renderStars = (rating) => {
        return (
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        size={16}
                        className={star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
                    />
                ))}
            </div>
        );
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
            approved: 'bg-green-500/20 text-green-400 border-green-500/50',
            rejected: 'bg-red-500/20 text-red-400 border-red-500/50'
        };
        return styles[status] || styles.pending;
    };

    return (
        <div className="space-y-6" data-testid="admin-reviews">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Customer Reviews</h1>
                    <p className="text-muted-foreground">Approve, edit, or reject customer reviews</p>
                </div>
                {stats && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400">
                            {stats.pending_count} Pending
                        </Badge>
                        <Badge variant="outline" className="bg-green-500/20 text-green-400">
                            {stats.approved_count} Approved
                        </Badge>
                        <Badge variant="outline" className="bg-red-500/20 text-red-400">
                            {stats.rejected_count} Rejected
                        </Badge>
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid md:grid-cols-4 gap-4">
                    <div className="bg-card border border-border rounded-xl p-4">
                        <p className="text-muted-foreground text-sm">Total Approved</p>
                        <p className="text-3xl font-bold">{stats.total_reviews}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                        <p className="text-muted-foreground text-sm">Average Rating</p>
                        <div className="flex items-center gap-2">
                            <p className="text-3xl font-bold">{stats.average_rating}</p>
                            <Star size={24} className="text-yellow-400 fill-yellow-400" />
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                        <p className="text-muted-foreground text-sm">5 Star Reviews</p>
                        <p className="text-3xl font-bold text-green-400">{stats.rating_distribution?.['5_star'] || 0}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                        <p className="text-muted-foreground text-sm">1-2 Star Reviews</p>
                        <p className="text-3xl font-bold text-red-400">
                            {(stats.rating_distribution?.['1_star'] || 0) + (stats.rating_distribution?.['2_star'] || 0)}
                        </p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
                <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="All Restaurants" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Restaurants</SelectItem>
                        {restaurants.map(r => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                
                <Select value={ratingFilter} onValueChange={setRatingFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="All Ratings" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Ratings</SelectItem>
                        <SelectItem value="high">4-5 Stars</SelectItem>
                        <SelectItem value="medium">3 Stars</SelectItem>
                        <SelectItem value="low">1-2 Stars</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); }}>
                <TabsList>
                    <TabsTrigger value="pending" className="gap-2">
                        <Clock size={16} /> Pending ({stats?.pending_count || 0})
                    </TabsTrigger>
                    <TabsTrigger value="approved" className="gap-2">
                        <CheckCircle size={16} /> Approved ({stats?.approved_count || 0})
                    </TabsTrigger>
                    <TabsTrigger value="rejected" className="gap-2">
                        <XCircle size={16} /> Rejected ({stats?.rejected_count || 0})
                    </TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-6">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}
                        </div>
                    ) : reviews.length === 0 ? (
                        <div className="text-center py-12">
                            <MessageSquare size={48} className="mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No reviews found</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {reviews.map(review => (
                                <div key={review.id} className="bg-card border border-border rounded-xl p-5">
                                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                        {/* Review Content */}
                                        <div className="flex-1 space-y-3">
                                            {/* Header */}
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <Badge className={`border ${getStatusBadge(review.status)}`}>
                                                    {review.status}
                                                </Badge>
                                                <span className="font-semibold">{review.restaurant_name}</span>
                                                <span className="text-muted-foreground text-sm">
                                                    Order: {review.order_id}...
                                                </span>
                                            </div>

                                            {/* Customer Info */}
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <User size={14} />
                                                <span>{review.user_name}</span>
                                                {review.user_phone && <span>• {review.user_phone}</span>}
                                            </div>

                                            {/* Restaurant Rating */}
                                            <div className="bg-secondary/30 rounded-lg p-3">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-medium">Restaurant Rating:</span>
                                                    {renderStars(review.rating)}
                                                    <span className="text-sm font-bold">({review.rating}/5)</span>
                                                </div>
                                                {review.comment && (
                                                    <p className="text-sm text-muted-foreground mt-1">"{review.comment}"</p>
                                                )}
                                            </div>

                                            {/* Delivery Partner Rating */}
                                            {review.delivery_partner_id && (
                                                <div className="bg-green-500/10 rounded-lg p-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Bike size={14} className="text-green-500" />
                                                        <span className="text-sm font-medium">
                                                            Delivery: {review.delivery_partner_name || 'Partner'}
                                                        </span>
                                                        {review.delivery_rating && (
                                                            <>
                                                                {renderStars(review.delivery_rating)}
                                                                <span className="text-sm font-bold">({review.delivery_rating}/5)</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    {review.delivery_comment && (
                                                        <p className="text-sm text-muted-foreground mt-1">"{review.delivery_comment}"</p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Admin Notes */}
                                            {review.admin_notes && (
                                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
                                                    <p className="text-xs text-blue-400 font-medium">Admin Notes:</p>
                                                    <p className="text-sm">{review.admin_notes}</p>
                                                </div>
                                            )}

                                            {/* Timestamp */}
                                            <p className="text-xs text-muted-foreground">
                                                Submitted: {review.created_at ? format(new Date(review.created_at), 'MMM d, yyyy h:mm a') : 'N/A'}
                                                {review.reviewed_at && (
                                                    <span> • Reviewed: {format(new Date(review.reviewed_at), 'MMM d, yyyy')}</span>
                                                )}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex lg:flex-col gap-2">
                                            {review.status === 'pending' && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700"
                                                        onClick={() => handleApprove(review)}
                                                        data-testid={`approve-review-${review.id}`}
                                                    >
                                                        <Check size={14} className="mr-1" /> Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleReject(review)}
                                                        data-testid={`reject-review-${review.id}`}
                                                    >
                                                        <X size={14} className="mr-1" /> Reject
                                                    </Button>
                                                </>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openEditDialog(review)}
                                                data-testid={`edit-review-${review.id}`}
                                            >
                                                <Edit size={14} className="mr-1" /> Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-red-400 hover:text-red-500"
                                                onClick={() => { setSelectedReview(review); setShowDeleteDialog(true); }}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-6">
                            <Button
                                variant="outline"
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                Previous
                            </Button>
                            <span className="flex items-center px-4">
                                Page {page} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                disabled={page === totalPages}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Edit Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Review</DialogTitle>
                    </DialogHeader>
                    {selectedReview && (
                        <div className="space-y-4 mt-4">
                            <div className="bg-secondary/50 rounded-lg p-3">
                                <p className="font-medium">{selectedReview.restaurant_name}</p>
                                <p className="text-sm text-muted-foreground">
                                    By: {selectedReview.user_name} • Order: {selectedReview.order_id}...
                                </p>
                            </div>

                            {/* Status */}
                            <div>
                                <Label>Status</Label>
                                <Select value={editData.status} onValueChange={(v) => setEditData(prev => ({ ...prev, status: v }))}>
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

                            {/* Restaurant Rating */}
                            <div>
                                <Label>Restaurant Rating (1-5)</Label>
                                <Select 
                                    value={String(editData.rating || 5)} 
                                    onValueChange={(v) => setEditData(prev => ({ ...prev, rating: parseInt(v) }))}
                                >
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Select rating" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[1, 2, 3, 4, 5].map(r => (
                                            <SelectItem key={r} value={String(r)}>
                                                {r} Star{r > 1 ? 's' : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Restaurant Review Comment</Label>
                                <Textarea
                                    value={editData.comment}
                                    onChange={(e) => setEditData(prev => ({ ...prev, comment: e.target.value }))}
                                    placeholder="Customer comment about restaurant"
                                    className="mt-1"
                                    rows={2}
                                />
                            </div>

                            {/* Delivery Rating (if applicable) */}
                            {selectedReview.delivery_partner_id && (
                                <>
                                    <div>
                                        <Label>Delivery Rating (1-5)</Label>
                                        <Select 
                                            value={editData.delivery_rating ? String(editData.delivery_rating) : 'none'} 
                                            onValueChange={(v) => setEditData(prev => ({ 
                                                ...prev, 
                                                delivery_rating: v === 'none' ? null : parseInt(v) 
                                            }))}
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="No rating" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No rating</SelectItem>
                                                {[1, 2, 3, 4, 5].map(r => (
                                                    <SelectItem key={r} value={String(r)}>
                                                        {r} Star{r > 1 ? 's' : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label>Delivery Review Comment</Label>
                                        <Textarea
                                            value={editData.delivery_comment || ''}
                                            onChange={(e) => setEditData(prev => ({ ...prev, delivery_comment: e.target.value }))}
                                            placeholder="Customer comment about delivery"
                                            className="mt-1"
                                            rows={2}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Admin Notes */}
                            <div>
                                <Label>Admin Notes</Label>
                                <Textarea
                                    value={editData.admin_notes}
                                    onChange={(e) => setEditData(prev => ({ ...prev, admin_notes: e.target.value }))}
                                    placeholder="Internal notes (not visible to customer)"
                                    className="mt-1"
                                    rows={2}
                                />
                            </div>

                            <Button 
                                onClick={handleSaveEdit} 
                                disabled={submitting}
                                className="w-full"
                            >
                                {submitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Review</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <p className="text-muted-foreground">
                            Are you sure you want to delete this review? This action cannot be undone.
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteDialog(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" className="flex-1" onClick={handleDeleteReview}>
                                <Trash2 size={14} className="mr-1" /> Delete
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
