import React from 'react';
import { Plus, Minus, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { useApp } from '../contexts/AppContext';

export const MenuItemCard = ({ item, restaurant }) => {
    const { cart, addToCart, updateCartItemQuantity } = useApp();
    
    const cartItem = cart.items.find(i => i.id === item.id);
    const quantity = cartItem?.quantity || 0;

    // Check if item is available based on time
    const isTimeAvailable = () => {
        if (!item.available_after) return true;
        
        const now = new Date();
        const [hours, minutes] = item.available_after.split(':').map(Number);
        const availableTime = new Date();
        availableTime.setHours(hours, minutes, 0, 0);
        
        return now >= availableTime;
    };

    const timeAvailable = isTimeAvailable();
    const canOrder = item.is_available && timeAvailable;

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const handleAdd = () => {
        if (!canOrder) return;
        addToCart(item, restaurant);
    };

    const handleUpdateQuantity = (newQty) => {
        updateCartItemQuantity(item.id, newQty);
    };

    return (
        <div 
            className={`menu-item-card flex gap-4 p-4 rounded-xl border ${!canOrder ? 'border-dashed border-muted-foreground/30 opacity-75' : 'border-border'}`}
            data-testid={`menu-item-${item.id}`}
        >
            {/* Image */}
            <div className="relative w-28 h-28 flex-shrink-0 rounded-lg overflow-hidden">
                <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                />
                {!item.is_available && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white text-xs">Unavailable</span>
                    </div>
                )}
                {item.is_available && !timeAvailable && (
                    <div className="absolute inset-0 bg-orange-900/60 flex items-center justify-center">
                        <span className="text-white text-xs text-center px-1">
                            Available after {formatTime(item.available_after)}
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col">
                <div className="flex items-start gap-2">
                    {/* Veg/Non-veg indicator */}
                    <div className={`veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}`} />
                    <div className="flex-1">
                        <h4 className="font-medium line-clamp-1">{item.name}</h4>
                        <p className="price-tag text-lg mt-1">₹{item.price}</p>
                        {item.available_after && !timeAvailable && (
                            <p className="text-xs text-orange-400 flex items-center gap-1 mt-1">
                                <Clock size={12} />
                                Available after {formatTime(item.available_after)}
                            </p>
                        )}
                    </div>
                </div>

                <p className="text-muted-foreground text-sm mt-2 line-clamp-2 flex-1">
                    {item.description}
                </p>

                {/* Add to Cart */}
                <div className="mt-3 flex justify-end">
                    {quantity === 0 ? (
                        <Button
                            onClick={handleAdd}
                            disabled={!canOrder}
                            variant="outline"
                            className={canOrder ? "border-primary text-primary hover:bg-primary hover:text-black" : "border-muted-foreground/50 text-muted-foreground cursor-not-allowed"}
                            data-testid={`add-to-cart-${item.id}`}
                        >
                            <Plus size={16} className="mr-1" />
                            {!canOrder ? (timeAvailable ? 'Unavailable' : 'Not Yet') : 'ADD'}
                        </Button>
                    ) : (
                        <div className="qty-selector px-1 py-1">
                            <button
                                onClick={() => handleUpdateQuantity(quantity - 1)}
                                className="qty-btn"
                                data-testid={`decrease-qty-${item.id}`}
                            >
                                <Minus size={16} />
                            </button>
                            <span className="w-8 text-center font-medium" data-testid={`qty-${item.id}`}>
                                {quantity}
                            </span>
                            <button
                                onClick={() => handleUpdateQuantity(quantity + 1)}
                                className="qty-btn"
                                data-testid={`increase-qty-${item.id}`}
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MenuItemCard;
