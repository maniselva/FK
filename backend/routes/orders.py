"""
Food Key Order Routes
=====================
Order creation, management, and tracking endpoints.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from typing import Optional
import math

from database import db
from config import PLATFORM_COMMISSION_RATE, COD_FEE

router = APIRouter(tags=["Orders"])


def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates using Haversine formula"""
    R = 6371
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def calculate_delivery_fee(distance_km: float, is_first_order: bool = False) -> dict:
    """Calculate delivery fee based on distance"""
    if is_first_order:
        return {
            "fee": 0,
            "serviceable": True,
            "message": "🎉 FREE delivery on your first order!",
            "is_first_order": True
        }
    
    if distance_km <= 10:
        return {"fee": 10, "serviceable": True, "message": "Delivery fee: ₹10", "is_first_order": False}
    else:
        return {"fee": 0, "serviceable": False, "message": "Sorry, this restaurant doesn't deliver to your location (beyond 10km)", "is_first_order": False}


# ============== DELIVERY FEE ==============

@router.get("/delivery-fee")
async def get_delivery_fee(
    restaurant_id: str,
    customer_lat: float,
    customer_lng: float,
    user_id: Optional[str] = None
):
    """Calculate delivery fee based on distance"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Check if this is user's first order
    is_first_order = False
    if user_id:
        order_count = await db.orders.count_documents({"user_id": user_id, "status": {"$ne": "cancelled"}})
        is_first_order = order_count == 0
    
    # Check if restaurant has coordinates
    if not restaurant.get("lat") or not restaurant.get("lng"):
        fee = 0 if is_first_order else 10
        return {
            "fee": fee,
            "serviceable": True,
            "distance_km": None,
            "message": "🎉 FREE delivery on your first order!" if is_first_order else "Delivery fee: ₹10",
            "is_first_order": is_first_order,
            "cod_fee": 0 if is_first_order else COD_FEE
        }
    
    distance_km = calculate_distance_km(
        restaurant["lat"], restaurant["lng"],
        customer_lat, customer_lng
    )
    
    fee_info = calculate_delivery_fee(distance_km, is_first_order)
    
    return {
        "fee": fee_info["fee"],
        "serviceable": fee_info["serviceable"],
        "distance_km": round(distance_km, 2),
        "message": fee_info["message"],
        "is_first_order": fee_info.get("is_first_order", False),
        "cod_fee": 0 if is_first_order else COD_FEE,
        "restaurant_location": {
            "lat": restaurant["lat"],
            "lng": restaurant["lng"],
            "address": restaurant.get("address")
        }
    }


# ============== ORDER CRUD ==============

@router.post("/orders")
async def create_order(request: dict):
    """Create a new order"""
    user_id = request.get("user_id")
    restaurant_id = request.get("restaurant_id")
    items = request.get("items", [])
    
    if not user_id or not restaurant_id or not items:
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    # Get restaurant
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Check first order
    order_count = await db.orders.count_documents({"user_id": user_id, "status": {"$ne": "cancelled"}})
    is_first_order = order_count == 0
    
    # Calculate totals
    subtotal = sum(item.get("price", 0) * item.get("quantity", 1) for item in items)
    delivery_fee = request.get("delivery_fee", 0 if is_first_order else 40.0)
    
    cod_fee = 0
    if request.get("payment_method") == 'cod' and not is_first_order:
        cod_fee = COD_FEE
    
    total_amount = subtotal + delivery_fee + cod_fee
    
    order = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "restaurant_id": restaurant_id,
        "restaurant_name": restaurant.get("name"),
        "restaurant_address": restaurant.get("address"),
        "items": items,
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "cod_fee": cod_fee,
        "total_amount": round(total_amount, 2),
        "status": "pending",
        "payment_method": request.get("payment_method", "cod"),
        "payment_status": "pending",
        "delivery_address": request.get("delivery_address"),
        "special_instructions": request.get("special_instructions"),
        "is_first_order": is_first_order,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.insert_one(order)
    order.pop("_id", None)
    
    # Create notification for restaurant
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "restaurant",
        "recipient_id": restaurant.get("owner_id"),
        "type": "new_order",
        "title": "New Order!",
        "message": f"Order #{order['id'][:8].upper()} - ₹{order['total_amount']}",
        "data": {"order_id": order["id"]},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Order created", "order": order}


@router.get("/orders")
async def get_user_orders(user_id: str, status: Optional[str] = None):
    """Get orders for a user"""
    query = {"user_id": user_id}
    if status:
        query["status"] = status
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders


@router.get("/orders/{order_id}")
async def get_order(order_id: str):
    """Get order details"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, request: dict):
    """Update order status"""
    new_status = request.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Status required")
    
    valid_statuses = ["pending", "confirmed", "preparing", "ready", "picked_up", "delivered", "cancelled"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    update_data = {
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if new_status == "delivered":
        update_data["delivered_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    
    # Create notification for customer
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "customer",
        "recipient_id": order.get("user_id"),
        "type": "order_status",
        "title": f"Order {new_status.replace('_', ' ').title()}",
        "message": f"Your order #{order_id[:8].upper()} is {new_status.replace('_', ' ')}",
        "data": {"order_id": order_id, "status": new_status},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Order status updated", "order": order}


@router.put("/orders/{order_id}/confirm-with-time")
async def confirm_order_with_time(order_id: str, request: dict):
    """Restaurant confirms order with estimated time"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    prep_time = request.get("estimated_prep_time", 30)
    
    update_data = {
        "status": "confirmed",
        "estimated_prep_time": prep_time,
        "confirmed_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    # Notify customer
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "customer",
        "recipient_id": order.get("user_id"),
        "type": "order_confirmed",
        "title": "Order Confirmed!",
        "message": f"Your order will be ready in {prep_time} minutes",
        "data": {"order_id": order_id, "prep_time": prep_time},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return {"message": "Order confirmed", "order": updated}


@router.put("/orders/{order_id}/update-delay")
async def update_order_delay(order_id: str, request: dict):
    """Update order with delay information"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    delay_info = {
        "delay_reason": request.get("reason"),
        "delay_minutes": request.get("minutes", 0),
        "delay_notified_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {**delay_info, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify customer
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "customer",
        "recipient_id": order.get("user_id"),
        "type": "order_delayed",
        "title": "Delivery Update",
        "message": f"Your order is delayed by {delay_info['delay_minutes']} minutes due to {delay_info['delay_reason']}",
        "data": {"order_id": order_id, **delay_info},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Delay updated"}


@router.put("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, request: dict):
    """Cancel an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    cancelled_by = request.get("cancelled_by", "customer")
    reason = request.get("reason", "")
    unavailable_items = request.get("unavailable_items", [])
    
    update_data = {
        "status": "cancelled",
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
        "cancellation_reason": reason,
        "cancelled_by": cancelled_by,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if cancelled_by == "restaurant":
        update_data["cancelled_by_restaurant"] = True
        update_data["unavailable_items"] = unavailable_items
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    # Notify relevant party
    if cancelled_by == "restaurant":
        notification = {
            "id": str(uuid.uuid4()),
            "recipient_type": "customer",
            "recipient_id": order.get("user_id"),
            "type": "order_cancelled",
            "title": "Order Cancelled",
            "message": f"Your order was cancelled by the restaurant. Reason: {reason}",
            "data": {"order_id": order_id, "reason": reason, "unavailable_items": unavailable_items},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return {"message": "Order cancelled", "order": updated}


@router.post("/orders/{order_id}/reorder")
async def reorder(order_id: str, request: dict):
    """Create a new order based on a previous order"""
    original_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not original_order:
        raise HTTPException(status_code=404, detail="Original order not found")
    
    # Get updated items from request or use original
    items = request.get("items", original_order.get("items", []))
    
    # Calculate new totals
    subtotal = sum(item.get("price", 0) * item.get("quantity", 1) for item in items)
    delivery_fee = request.get("delivery_fee", original_order.get("delivery_fee", 40))
    total_amount = subtotal + delivery_fee
    
    new_order = {
        "id": str(uuid.uuid4()),
        "user_id": original_order.get("user_id"),
        "restaurant_id": original_order.get("restaurant_id"),
        "restaurant_name": original_order.get("restaurant_name"),
        "restaurant_address": original_order.get("restaurant_address"),
        "items": items,
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "total_amount": round(total_amount, 2),
        "status": "pending",
        "payment_method": request.get("payment_method", "cod"),
        "payment_status": "pending",
        "delivery_address": request.get("delivery_address", original_order.get("delivery_address")),
        "special_instructions": request.get("special_instructions"),
        "reordered_from": order_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.insert_one(new_order)
    new_order.pop("_id", None)
    
    return {"message": "Reorder created", "order": new_order}


# ============== ORDER SHARING ==============

@router.post("/orders/{order_id}/share")
async def create_share_link(order_id: str, request: dict):
    """Create a shareable link for an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    share_token = str(uuid.uuid4())[:12]
    
    share_record = {
        "order_id": order_id,
        "share_token": share_token,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": request.get("expires_at")
    }
    
    await db.order_shares.insert_one(share_record)
    
    return {
        "share_token": share_token,
        "share_url": f"/orders/share/{share_token}"
    }


@router.get("/orders/share/{share_token}")
async def get_shared_order(share_token: str):
    """Get order details via share token"""
    share = await db.order_shares.find_one({"share_token": share_token}, {"_id": 0})
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found or expired")
    
    order = await db.orders.find_one({"id": share["order_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get restaurant info
    restaurant = await db.restaurants.find_one({"id": order.get("restaurant_id")}, {"_id": 0, "name": 1, "address": 1, "phone": 1})
    
    return {
        "order": order,
        "restaurant": restaurant
    }


@router.delete("/orders/{order_id}/share")
async def delete_share_link(order_id: str):
    """Delete all share links for an order"""
    await db.order_shares.delete_many({"order_id": order_id})
    return {"message": "Share links deleted"}


# ============== ORDER DIRECTIONS ==============

@router.get("/orders/{order_id}/directions")
async def get_order_directions(order_id: str):
    """Get directions for an order (restaurant to customer)"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    restaurant = await db.restaurants.find_one({"id": order.get("restaurant_id")}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    delivery_address = order.get("delivery_address", {})
    
    return {
        "origin": {
            "lat": restaurant.get("lat"),
            "lng": restaurant.get("lng"),
            "address": restaurant.get("address"),
            "name": restaurant.get("name")
        },
        "destination": {
            "lat": delivery_address.get("lat"),
            "lng": delivery_address.get("lng"),
            "address": delivery_address.get("full_address"),
            "label": delivery_address.get("label")
        },
        "google_maps_url": f"https://www.google.com/maps/dir/{restaurant.get('lat')},{restaurant.get('lng')}/{delivery_address.get('lat')},{delivery_address.get('lng')}"
    }
