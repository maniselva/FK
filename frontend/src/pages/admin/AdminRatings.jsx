import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Star, MessageSquare, Eye, EyeOff, Trash2, Send, Filter, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
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
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../../components/ui/dialog';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminRatings() {
    const [reviews, setReviews] = useState([]);
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    // Filters
    const [restaurantFilter, setRestaurantFilter] = useState('all');
    const [ratingFilter, setRatingFilter] = useState('all');
    const [visibilityFilter, setVisibilityFilter] = useState('all');
    
    // Response dialog
    const [respondDialog, setRespondDialog] = useState({ open: false, review: null });
    const [responseText, setResponseText] = useState('');
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
            
            if (restaurantFilter !== 'all') {
                params.append('restaurant_id', restaurantFilter);
            }
            if (ratingFilter !== 'all') {
                params.append('rating_filter', ratingFilter);
            }
            if (visibilityFilter !== 'all') {
                params.append('is_visible', visibilityFilter === 'visible' ? 'true' : 'false');
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
    }, [page, restaurantFilter, ratingFilter, visibilityFilter]);

    useEffect(() => {
        fetchRestaurants();
    }, [fetchRestaurants]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    const handleToggleVisibility = async (review) => {
        try {
            await axios.put(`${API}/admin/reviews/${review.id}`, null, {
                params: { is_visible: !review.is_visible }
            });
            toast.success(review.is_visible ? 'Review hidden' : 'Review visible');
            fetchReviews();
        } catch (error) {
            toast.error('Failed to update review');
        }
    };

    const handleDeleteReview = async (reviewId) => {
        if (!window.confirm('Are you sure you want to delete this review?')) return;
        
        try {
            await axios.delete(`${API}/admin/reviews/${reviewId}`);
            toast.success('Review deleted');
            fetchReviews();
        } catch (error) {
            toast.error('Failed to delete review');
        }
    };

    const handleSubmitResponse = async () => {
        if (!responseText.trim()) {
            toast.error('Please enter a response');
            return;
        }
        
        setSubmitting(true);
        try {
            await axios.put(`${API}/admin/reviews/${respondDialog.review.id}`, null, {
                params: { admin_response: responseText }
            });
            toast.success('Response added');
            setRespondDialog({ open: false, review: null });
            setResponseText('');
            fetchReviews();
        } catch (error) {
            toast.error('Failed to add response');
        } finally {
            setSubmitting(false);
        }
    };

    const renderStars = (rating) => {
        return (
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        size={14}
                        className={star <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}
                    />
                ))}
                <span className="ml-1 text-sm font-medium">{rating.toFixed(1)}</span>
            </div>
        );
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6" data-testid="admin-ratings-page">
            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-card rounded-xl p-4 border border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <MessageSquare className="text-blue-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.total_reviews}</p>
                                <p className="text-sm text-muted-foreground">Total Reviews</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-card rounded-xl p-4 border border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                                <Star className="text-yellow-600 fill-yellow-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.average_rating}</p>
                                <p className="text-sm text-muted-foreground">Average Rating</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-card rounded-xl p-4 border border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                <TrendingUp className="text-green-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.rating_distribution['5_star'] + stats.rating_distribution['4_star']}</p>
                                <p className="text-sm text-muted-foreground">Positive (4-5★)</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-card rounded-xl p-4 border border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                <TrendingDown className="text-red-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.rating_distribution['1_star'] + stats.rating_distribution['2_star']}</p>
                                <p className="text-sm text-muted-foreground">Negative (1-2★)</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rating Distribution */}
            {stats && (
                <div className="bg-card rounded-xl p-6 border border-border">
                    <h3 className="font-semibold mb-4">Rating Distribution</h3>
                    <div className="space-y-2">
                        {[5, 4, 3, 2, 1].map((star) => {
                            const count = stats.rating_distribution[`${star}_star`];
                            const percentage = stats.total_reviews > 0 ? (count / stats.total_reviews) * 100 : 0;
                            return (
                                <div key={star} className="flex items-center gap-3">
                                    <span className="w-8 text-sm font-medium">{star}★</span>
                                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full ${star >= 4 ? 'bg-green-500' : star === 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    <span className="w-12 text-sm text-muted-foreground text-right">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium">Filters:</span>
                </div>
                
                <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="All Restaurants" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Restaurants</SelectItem>
                        {restaurants.map((restaurant) => (
                            <SelectItem key={restaurant.id} value={restaurant.id}>
                                {restaurant.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                
                <Select value={ratingFilter} onValueChange={setRatingFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="All Ratings" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Ratings</SelectItem>
                        <SelectItem value="high">High (4-5★)</SelectItem>
                        <SelectItem value="medium">Medium (3★)</SelectItem>
                        <SelectItem value="low">Low (1-2★)</SelectItem>
                    </SelectContent>
                </Select>
                
                <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="visible">Visible</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Reviews List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-muted-foreground">Loading reviews...</p>
                    </div>
                ) : reviews.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-xl border border-border">
                        <MessageSquare size={48} className="mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No reviews found</p>
                        <p className="text-sm text-muted-foreground mt-1">Reviews will appear here when customers submit them</p>
                    </div>
                ) : (
                    reviews.map((review) => (
                        <div 
                            key={review.id} 
                            className={`bg-card rounded-xl p-6 border ${review.is_visible ? 'border-border' : 'border-red-200 bg-red-50/50'}`}
                            data-testid={`review-${review.id}`}
                        >
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        {renderStars(review.rating)}
                                        {!review.is_visible && (
                                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">Hidden</span>
                                        )}
                                    </div>
                                    
                                    <p className="font-medium text-gray-800">{review.user_name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {review.restaurant_name} • {formatDate(review.created_at)}
                                    </p>
                                    
                                    {review.comment && (
                                        <p className="mt-3 text-gray-700">{review.comment}</p>
                                    )}
                                    
                                    {review.admin_response && (
                                        <div className="mt-3 bg-blue-50 rounded-lg p-3 border border-blue-100">
                                            <p className="text-xs font-medium text-blue-600 mb-1">Admin Response:</p>
                                            <p className="text-sm text-gray-700">{review.admin_response}</p>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setRespondDialog({ open: true, review });
                                            setResponseText(review.admin_response || '');
                                        }}
                                        data-testid={`respond-btn-${review.id}`}
                                    >
                                        <Send size={14} className="mr-1" />
                                        {review.admin_response ? 'Edit Response' : 'Respond'}
                                    </Button>
                                    
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleToggleVisibility(review)}
                                        data-testid={`toggle-visibility-btn-${review.id}`}
                                    >
                                        {review.is_visible ? (
                                            <>
                                                <EyeOff size={14} className="mr-1" />
                                                Hide
                                            </>
                                        ) : (
                                            <>
                                                <Eye size={14} className="mr-1" />
                                                Show
                                            </>
                                        )}
                                    </Button>
                                    
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => handleDeleteReview(review.id)}
                                        data-testid={`delete-review-btn-${review.id}`}
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        Previous
                    </Button>
                    <span className="flex items-center px-4 text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        Next
                    </Button>
                </div>
            )}

            {/* Response Dialog */}
            <Dialog open={respondDialog.open} onOpenChange={(open) => setRespondDialog({ open, review: respondDialog.review })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Respond to Review</DialogTitle>
                        <DialogDescription>
                            Add or edit your response to this customer review
                        </DialogDescription>
                    </DialogHeader>
                    
                    {respondDialog.review && (
                        <div className="space-y-4">
                            <div className="bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    {renderStars(respondDialog.review.rating)}
                                </div>
                                <p className="font-medium">{respondDialog.review.user_name}</p>
                                {respondDialog.review.comment && (
                                    <p className="text-sm text-gray-600 mt-1">{respondDialog.review.comment}</p>
                                )}
                            </div>
                            
                            <Textarea
                                placeholder="Enter your response to this review..."
                                value={responseText}
                                onChange={(e) => setResponseText(e.target.value)}
                                rows={4}
                            />
                            
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setRespondDialog({ open: false, review: null })}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSubmitResponse} disabled={submitting}>
                                    {submitting ? 'Saving...' : 'Save Response'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
