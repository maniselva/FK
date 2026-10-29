"""
Food Key Restaurant Routes
==========================
Restaurant management, menu, and public restaurant endpoints.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from typing import Optional
import math

from database import db
from config import PLATFORM_COMMISSION_RATE
from models import Restaurant, MenuItem, CreateRestaurantRequest, AddMenuItemRequest

router = APIRouter(tags=["Restaurants"])


def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates using Haversine formula"""
    R = 6371  # Earth's radius in km
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


# ============== PUBLIC RESTAURANT ENDPOINTS ==============

@router.get("/restaurants")
async def get_restaurants(
    cuisine: Optional[str] = None,
    is_veg: Optional[bool] = None,
    search: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 10.0
):
    """Get all approved restaurants with optional filters"""
    query = {"approval_status": "approved"}
    
    if cuisine:
        query["cuisine_type"] = {"$regex": cuisine, "$options": "i"}
    if is_veg is not None:
        query["is_veg"] = is_veg
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"cuisine_type": {"$regex": search, "$options": "i"}}
        ]
    
    restaurants = await db.restaurants.find(query, {"_id": 0}).to_list(100)
    
    # Filter by distance if coordinates provided
    if lat is not None and lng is not None:
        filtered = []
        for r in restaurants:
            if r.get("lat") and r.get("lng"):
                distance = calculate_distance_km(lat, lng, r["lat"], r["lng"])
                if distance <= radius_km:
                    r["distance_km"] = round(distance, 2)
                    filtered.append(r)
        # Sort by distance
        restaurants = sorted(filtered, key=lambda x: x.get("distance_km", 999))
    
    return restaurants


@router.get("/search")
async def search_restaurants(
    q: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None
):
    """Search restaurants and menu items"""
    if not q or len(q) < 2:
        return {"restaurants": [], "menu_items": []}
    
    # Search restaurants
    restaurant_query = {
        "approval_status": "approved",
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"cuisine_type": {"$regex": q, "$options": "i"}}
        ]
    }
    restaurants = await db.restaurants.find(restaurant_query, {"_id": 0}).to_list(20)
    
    # Search menu items
    menu_items = []
    all_restaurants = await db.restaurants.find({"approval_status": "approved"}, {"_id": 0}).to_list(100)
    for restaurant in all_restaurants:
        for item in restaurant.get("menu", []):
            if q.lower() in item.get("name", "").lower() or q.lower() in item.get("description", "").lower():
                menu_items.append({
                    "item": item,
                    "restaurant_id": restaurant["id"],
                    "restaurant_name": restaurant["name"]
                })
    
    # Add distance if coordinates provided
    if lat is not None and lng is not None:
        for r in restaurants:
            if r.get("lat") and r.get("lng"):
                r["distance_km"] = round(calculate_distance_km(lat, lng, r["lat"], r["lng"]), 2)
    
    return {
        "restaurants": restaurants[:10],
        "menu_items": menu_items[:20]
    }


@router.get("/search/suggestions")
async def get_search_suggestions(q: str):
    """Get search suggestions for autocomplete"""
    if not q or len(q) < 2:
        return {"suggestions": []}
    
    suggestions = set()
    
    # Get restaurant names
    restaurants = await db.restaurants.find(
        {"name": {"$regex": q, "$options": "i"}, "approval_status": "approved"},
        {"_id": 0, "name": 1}
    ).to_list(10)
    
    for r in restaurants:
        suggestions.add(r["name"])
    
    # Get cuisine types
    cuisines = await db.restaurants.distinct("cuisine_type", {"approval_status": "approved"})
    for cuisine in cuisines:
        if q.lower() in cuisine.lower():
            suggestions.add(cuisine)
    
    # Get menu item names
    all_restaurants = await db.restaurants.find({"approval_status": "approved"}, {"_id": 0, "menu": 1}).to_list(50)
    for restaurant in all_restaurants:
        for item in restaurant.get("menu", []):
            if q.lower() in item.get("name", "").lower():
                suggestions.add(item["name"])
    
    return {"suggestions": list(suggestions)[:15]}


@router.get("/restaurants/{restaurant_id}")
async def get_restaurant(restaurant_id: str):
    """Get restaurant details by ID"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant


# ============== RESTAURANT REGISTRATION & MANAGEMENT ==============

@router.post("/restaurants")
async def register_restaurant(request: CreateRestaurantRequest):
    """Register a new restaurant (pending approval)"""
    restaurant = Restaurant(
        name=request.name,
        address=request.address,
        cuisine_type=request.cuisine_type,
        phone=request.phone,
        image=request.image,
        is_veg=request.is_veg,
        delivery_time=request.delivery_time,
        rating=request.rating,
        approval_status="pending",
        is_open=False,
        fssai_number=request.fssai_number,
        fssai_certificate=request.fssai_certificate,
        state=request.state,
        pincode=request.pincode,
        city=request.city,
        lat=request.lat,
        lng=request.lng,
        owner_id=request.owner_id
    )
    
    restaurant_dict = restaurant.model_dump()
    restaurant_dict["created_at"] = restaurant_dict["created_at"].isoformat()
    
    await db.restaurants.insert_one(restaurant_dict)
    restaurant_dict.pop("_id", None)
    
    return {"message": "Restaurant registered, pending approval", "restaurant": restaurant_dict}


@router.put("/restaurants/{restaurant_id}")
async def update_restaurant(restaurant_id: str, request: dict):
    """Update restaurant details"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    update_data = {k: v for k, v in request.items() if v is not None and k not in ["id", "_id"]}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.restaurants.update_one({"id": restaurant_id}, {"$set": update_data})
    
    updated = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return {"message": "Restaurant updated", "restaurant": updated}


@router.put("/restaurants/{restaurant_id}/profile")
async def update_restaurant_profile(restaurant_id: str, request: dict):
    """Update restaurant profile (image, FSSAI)"""
    update_data = {}
    
    if request.get("image"):
        update_data["image"] = request["image"]
    if request.get("fssai_certificate"):
        update_data["fssai_certificate"] = request["fssai_certificate"]
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.restaurants.update_one({"id": restaurant_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return {"message": "Profile updated", "restaurant": restaurant}


@router.put("/restaurants/{restaurant_id}/toggle-status")
async def toggle_restaurant_status(restaurant_id: str):
    """Toggle restaurant open/closed status"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    new_status = not restaurant.get("is_open", False)
    await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$set": {"is_open": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Restaurant {'opened' if new_status else 'closed'}", "is_open": new_status}


# ============== MENU MANAGEMENT ==============

@router.post("/restaurants/{restaurant_id}/menu")
async def add_menu_item(restaurant_id: str, request: AddMenuItemRequest):
    """Add item to restaurant menu"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    new_item = MenuItem(
        name=request.name,
        description=request.description,
        price=request.price,
        image=request.image,
        category=request.category,
        is_veg=request.is_veg,
        is_available=True,
        is_visible=True
    )
    
    item_dict = new_item.model_dump()
    
    await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$push": {"menu": item_dict}}
    )
    
    return {"message": "Menu item added", "item": item_dict}


@router.put("/restaurants/{restaurant_id}/menu/{item_id}")
async def update_menu_item(restaurant_id: str, item_id: str, request: dict):
    """Update a menu item"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    menu = restaurant.get("menu", [])
    item_index = next((i for i, item in enumerate(menu) if item.get("id") == item_id), None)
    
    if item_index is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    # Update item fields
    for key, value in request.items():
        if value is not None and key not in ["id", "_id"]:
            menu[item_index][key] = value
    
    await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$set": {"menu": menu}}
    )
    
    return {"message": "Menu item updated", "item": menu[item_index]}


@router.delete("/restaurants/{restaurant_id}/menu/{item_id}")
async def delete_menu_item(restaurant_id: str, item_id: str):
    """Delete a menu item"""
    result = await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$pull": {"menu": {"id": item_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    return {"message": "Menu item deleted"}


@router.put("/restaurants/{restaurant_id}/menu/{item_id}/availability")
async def toggle_menu_item_availability(restaurant_id: str, item_id: str, is_available: bool):
    """Toggle menu item availability"""
    result = await db.restaurants.update_one(
        {"id": restaurant_id, "menu.id": item_id},
        {"$set": {"menu.$.is_available": is_available}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    return {"message": f"Item {'available' if is_available else 'unavailable'}"}


@router.put("/restaurants/{restaurant_id}/menu/{item_id}/visibility")
async def toggle_menu_item_visibility(restaurant_id: str, item_id: str, is_visible: bool):
    """Toggle menu item visibility"""
    result = await db.restaurants.update_one(
        {"id": restaurant_id, "menu.id": item_id},
        {"$set": {"menu.$.is_visible": is_visible}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    return {"message": f"Item {'visible' if is_visible else 'hidden'}"}


# ============== RESTAURANT DISCOUNTS ==============

@router.post("/restaurants/{restaurant_id}/discounts")
async def create_discount(restaurant_id: str, request: dict):
    """Create a restaurant discount"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    discount = {
        "id": str(uuid.uuid4()),
        "code": request.get("code", "").upper(),
        "description": request.get("description", ""),
        "discount_type": request.get("discount_type", "percentage"),
        "discount_value": request.get("discount_value", 0),
        "min_order_value": request.get("min_order_value", 0),
        "max_discount": request.get("max_discount"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.restaurant_discounts.insert_one({
        **discount,
        "restaurant_id": restaurant_id
    })
    
    return {"message": "Discount created", "discount": discount}


@router.get("/restaurants/{restaurant_id}/discounts")
async def get_restaurant_discounts(restaurant_id: str):
    """Get all discounts for a restaurant"""
    discounts = await db.restaurant_discounts.find(
        {"restaurant_id": restaurant_id},
        {"_id": 0}
    ).to_list(50)
    return discounts


@router.put("/restaurants/{restaurant_id}/discounts/{discount_id}")
async def update_discount(restaurant_id: str, discount_id: str, request: dict):
    """Update a restaurant discount"""
    update_data = {k: v for k, v in request.items() if v is not None}
    
    result = await db.restaurant_discounts.update_one(
        {"id": discount_id, "restaurant_id": restaurant_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Discount not found")
    
    return {"message": "Discount updated"}


@router.delete("/restaurants/{restaurant_id}/discounts/{discount_id}")
async def delete_discount(restaurant_id: str, discount_id: str):
    """Delete a restaurant discount"""
    result = await db.restaurant_discounts.delete_one({
        "id": discount_id,
        "restaurant_id": restaurant_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Discount not found")
    
    return {"message": "Discount deleted"}


@router.put("/restaurants/{restaurant_id}/discounts/{discount_id}/toggle")
async def toggle_discount(restaurant_id: str, discount_id: str):
    """Toggle discount active status"""
    discount = await db.restaurant_discounts.find_one(
        {"id": discount_id, "restaurant_id": restaurant_id},
        {"_id": 0}
    )
    
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    
    new_status = not discount.get("is_active", True)
    await db.restaurant_discounts.update_one(
        {"id": discount_id},
        {"$set": {"is_active": new_status}}
    )
    
    return {"message": f"Discount {'activated' if new_status else 'deactivated'}", "is_active": new_status}


@router.post("/restaurants/{restaurant_id}/discounts/apply")
async def apply_restaurant_discount(restaurant_id: str, request: dict):
    """Apply a restaurant discount to cart"""
    code = request.get("code", "").upper()
    cart_total = request.get("cart_total", 0)
    
    discount = await db.restaurant_discounts.find_one({
        "restaurant_id": restaurant_id,
        "code": code,
        "is_active": True
    }, {"_id": 0})
    
    if not discount:
        raise HTTPException(status_code=400, detail="Invalid or expired discount code")
    
    if cart_total < discount.get("min_order_value", 0):
        raise HTTPException(
            status_code=400,
            detail=f"Minimum order value is ₹{discount['min_order_value']}"
        )
    
    if discount["discount_type"] == "percentage":
        discount_amount = cart_total * (discount["discount_value"] / 100)
        if discount.get("max_discount"):
            discount_amount = min(discount_amount, discount["max_discount"])
    else:
        discount_amount = discount["discount_value"]
    
    return {
        "success": True,
        "discount": round(discount_amount, 2),
        "discount_info": discount
    }
