import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Star, User, ChevronDown, MessageSquare } from 'lucide-react';
import { Button } from './ui/button';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function RestaurantReviews({ restaurantId }) {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        fetchReviews();
    }, [restaurantId, page]);

    const fetchReviews = async () => {
        try {
            const response = await axios.get(`${API}/reviews/restaurant/${restaurantId}?page=${page}&limit=5`);
            if (page === 1) {
                setReviews(response.data.reviews);
            } else {
                setReviews(prev => [...prev, ...response.data.reviews]);
            }
            setTotalPages(response.data.pages);
            setTotal(response.data.total);
        } catch (error) {
            console.error('Failed to fetch reviews:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderStars = (rating) => {
        return (
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        size={14}
                        className={star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
                    />
                ))}
            </div>
        );
    };

    const formatDate = (dateString) => {
        try {
            return format(new Date(dateString), 'MMM d, yyyy');
        } catch {
            return dateString;
        }
    };

    if (loading && page === 1) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-secondary/50 rounded-xl p-4 animate-pulse">
                        <div className="h-4 bg-secondary rounded w-1/4 mb-2" />
                        <div className="h-3 bg-secondary rounded w-3/4" />
                    </div>
                ))}
            </div>
        );
    }

    if (reviews.length === 0) {
        return (
            <div className="text-center py-8 bg-secondary/30 rounded-xl">
                <MessageSquare size={40} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No reviews yet</p>
                <p className="text-sm text-muted-foreground mt-1">Be the first to review after your order!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4" data-testid="restaurant-reviews">
            {/* Reviews Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                    <Star className="text-yellow-400" size={18} />
                    Customer Reviews ({total})
                </h3>
            </div>

            {/* Reviews List */}
            <div className="space-y-4">
                {reviews.map((review) => (
                    <div 
                        key={review.id} 
                        className="bg-secondary/30 rounded-xl p-4"
                        data-testid={`review-${review.id}`}
                    >
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                    <User size={18} className="text-primary" />
                                </div>
                                <div>
                                    <p className="font-medium">{review.user_name}</p>
                                    <div className="flex items-center gap-2">
                                        {renderStars(review.rating)}
                                        <span className="text-xs text-muted-foreground">
                                            {formatDate(review.created_at)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {review.comment && (
                            <p className="text-sm text-muted-foreground mt-3 pl-13">
                                {review.comment}
                            </p>
                        )}

                        {/* Item Ratings */}
                        {review.item_ratings && review.item_ratings.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2 pl-13">
                                {review.item_ratings.map((item, idx) => (
                                    <span 
                                        key={idx}
                                        className="text-xs bg-secondary px-2 py-1 rounded-full flex items-center gap-1"
                                    >
                                        {item.label}: 
                                        <span className="flex items-center">
                                            {item.rating}
                                            <Star size={10} className="text-yellow-400 fill-yellow-400 ml-0.5" />
                                        </span>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Admin Response */}
                        {review.admin_response && (
                            <div className="mt-3 ml-13 bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border-l-2 border-blue-400">
                                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                                    Response from Restaurant
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    {review.admin_response}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Load More */}
            {page < totalPages && (
                <Button
                    variant="outline"
                    onClick={() => setPage(p => p + 1)}
                    className="w-full"
                    disabled={loading}
                >
                    <ChevronDown size={16} className="mr-2" />
                    Load More Reviews
                </Button>
            )}
        </div>
    );
}

export default RestaurantReviews;
