import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Clock, Leaf, MapPin, Tag } from 'lucide-react';

export const RestaurantCard = ({ restaurant, discountMessage }) => {
    return (
        <Link 
            to={`/restaurant/${restaurant.id}`}
            className="restaurant-card block rounded-2xl overflow-hidden bg-card border border-border group shadow-sm hover:shadow-lg transition-shadow"
            data-testid={`restaurant-card-${restaurant.id}`}
        >
            {/* Image */}
            <div className="relative h-48 overflow-hidden">
                <img
                    src={restaurant.image}
                    alt={restaurant.name}
                    className="restaurant-image w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {restaurant.is_veg && (
                    <div className="absolute top-3 left-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-md">
                        <Leaf size={12} />
                        Pure Veg
                    </div>
                )}
                {restaurant.distance_km !== undefined && restaurant.distance_km !== null && (
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-gray-700 text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-md">
                        <MapPin size={12} />
                        {restaurant.distance_km}km
                    </div>
                )}
                {!restaurant.is_open && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white font-semibold">Currently Closed</span>
                    </div>
                )}
            </div>

            {/* Discount Message Banner */}
            {(discountMessage || restaurant.discount_message) && (
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1.5 flex items-center gap-2">
                    <Tag size={14} className="flex-shrink-0" />
                    <span className="text-xs font-medium truncate">{discountMessage || restaurant.discount_message}</span>
                </div>
            )}

            {/* Content */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors line-clamp-1">
                        {restaurant.name}
                    </h3>
                    <div className="flex items-center gap-1 bg-green-600 text-white px-2 py-0.5 rounded text-sm flex-shrink-0 shadow-sm">
                        <Star size={12} fill="currentColor" />
                        <span className="font-medium">{restaurant.rating}</span>
                    </div>
                </div>

                <p className="text-muted-foreground text-sm mt-1 line-clamp-1">
                    {restaurant.cuisine?.join(', ')}
                </p>

                <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{restaurant.delivery_time}</span>
                    </div>
                    <span className="price-tag">₹{restaurant.price_for_two} for two</span>
                </div>
            </div>
        </Link>
    );
};

export default RestaurantCard;
