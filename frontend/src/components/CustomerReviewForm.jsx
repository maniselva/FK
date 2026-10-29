import React, { useState } from 'react';
import { Star, Send, Utensils, Store, Bike } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Star Rating Component
const StarRating = ({ rating, setRating, label, icon: Icon }) => {
    const [hover, setHover] = useState(0);
    
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                {Icon && <Icon size={18} className="text-muted-foreground" />}
                <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        className="p-1 transition-transform hover:scale-110"
                    >
                        <Star 
                            size={28} 
                            className={`transition-colors ${
                                star <= (hover || rating) 
                                    ? 'text-yellow-400 fill-yellow-400' 
                                    : 'text-gray-300'
                            }`}
                        />
                    </button>
                ))}
                {rating > 0 && (
                    <span className="ml-2 text-sm text-muted-foreground self-center">
                        {rating === 5 ? 'Excellent!' : rating === 4 ? 'Great!' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
                    </span>
                )}
            </div>
        </div>
    );
};

export function CustomerReviewForm({ 
    orderId, 
    restaurantId, 
    restaurantName,
    userId, 
    userName,
    deliveryPartnerId,
    deliveryPartnerName,
    onReviewSubmitted 
}) {
    const [restaurantRating, setRestaurantRating] = useState(0);
    const [foodRating, setFoodRating] = useState(0);
    const [deliveryRating, setDeliveryRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async () => {
        if (restaurantRating === 0 && foodRating === 0 && deliveryRating === 0) {
            toast.error('Please rate at least one category');
            return;
        }

        setSubmitting(true);
        try {
            // Calculate overall rating (average of non-zero ratings)
            const ratings = [restaurantRating, foodRating, deliveryRating].filter(r => r > 0);
            const overallRating = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);

            await axios.post(`${API}/reviews`, {
                order_id: orderId,
                restaurant_id: restaurantId,
                user_id: userId,
                user_name: userName || 'Customer',
                rating: overallRating,
                comment: comment.trim() || null,
                // Include delivery partner info if they provided a delivery rating
                delivery_partner_id: deliveryRating > 0 ? deliveryPartnerId : null,
                delivery_rating: deliveryRating > 0 ? deliveryRating : null,
                delivery_comment: null
            });

            setSubmitted(true);
            toast.success('Thank you for your review!');
            if (onReviewSubmitted) onReviewSubmitted();
        } catch (error) {
            if (error.response?.status === 400) {
                toast.info('You have already reviewed this order');
                setSubmitted(true);
            } else {
                console.error('Review submission error:', error);
                toast.error('Failed to submit review. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-8 text-center" data-testid="review-submitted">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <Star className="text-green-600 fill-green-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-2">Thank You!</h3>
                <p className="text-green-600">Your feedback helps us serve you better.</p>
            </div>
        );
    }

    return (
        <div className="bg-card rounded-2xl border border-border p-6" data-testid="customer-review-form">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Star className="text-yellow-600" size={20} />
                </div>
                <div>
                    <h3 className="font-semibold">Rate Your Experience</h3>
                    <p className="text-sm text-muted-foreground">Your feedback helps improve our service</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Restaurant Rating */}
                <StarRating 
                    rating={restaurantRating} 
                    setRating={setRestaurantRating} 
                    label="Restaurant Service"
                    icon={Store}
                />

                {/* Food Rating */}
                <StarRating 
                    rating={foodRating} 
                    setRating={setFoodRating} 
                    label="Food Quality"
                    icon={Utensils}
                />

                {/* Delivery Rating - Always show */}
                <StarRating 
                    rating={deliveryRating} 
                    setRating={setDeliveryRating} 
                    label={deliveryPartnerName ? `Delivery by ${deliveryPartnerName}` : 'Delivery Service'}
                    icon={Bike}
                />

                {/* Comment */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Comments (Optional)</label>
                    <Textarea
                        placeholder="Share your experience with us..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                        className="resize-none"
                        data-testid="review-comment-input"
                    />
                </div>

                {/* Submit Button */}
                <Button 
                    onClick={handleSubmit} 
                    disabled={submitting || (restaurantRating === 0 && foodRating === 0 && deliveryRating === 0)}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                    data-testid="submit-review-btn"
                >
                    {submitting ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Submitting...
                        </>
                    ) : (
                        <>
                            <Send size={16} className="mr-2" />
                            Submit Review
                        </>
                    )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                    Your review will be visible to the restaurant and helps other customers
                </p>
            </div>
        </div>
    );
}

export default CustomerReviewForm;
