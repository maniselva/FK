"""
Food Key Delivery Partner Routes
================================
Delivery partner registration, management, and operations.
"""

import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from typing import Optional
import math

from database import db
from models import DeliveryPartner

router = APIRouter(tags=["Delivery"])


def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates"""
    R = 6371
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


# ============== DELIVERY PARTNER REGISTRATION ==============

@router.post("/delivery-partners")
async def register_delivery_partner(request: dict):
    """Register a new delivery partner"""
    # Check if user already has a partner profile
    existing = await db.delivery_partners.find_one({"user_id": request.get("user_id")}, {"_id": 0})
    if existing:
        return {"message": "Partner profile exists", "partner": existing}
    
    partner = DeliveryPartner(
        user_id=request.get("user_id"),
        name=request.get("name"),
        phone=request.get("phone"),
        email=request.get("email"),
        vehicle_type=request.get("vehicle_type", "bike"),
        vehicle_number=request.get("vehicle_number"),
        license_number=request.get("license_number"),
        license_image=request.get("license_image"),
        photo=request.get("photo"),
        address=request.get("address"),
        city=request.get("city"),
        state=request.get("state"),
        pincode=request.get("pincode"),
        lat=request.get("lat"),
        lng=request.get("lng"),
        approval_status="pending",
        is_available=False,
        is_online=False
    )
    
    partner_dict = partner.model_dump()
    partner_dict["created_at"] = partner_dict["created_at"].isoformat()
    
    await db.delivery_partners.insert_one(partner_dict)
    partner_dict.pop("_id", None)
    
    return {"message": "Registration submitted", "partner": partner_dict}


@router.get("/delivery-partners/{partner_id}")
async def get_delivery_partner(partner_id: str):
    """Get delivery partner by ID"""
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    return partner


@router.get("/delivery-partners/user/{user_id}")
async def get_partner_by_user(user_id: str):
    """Get delivery partner by user ID"""
    partner = await db.delivery_partners.find_one({"user_id": user_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return partner


@router.get("/delivery-partners/available/list")
async def get_available_partners():
    """Get all available delivery partners"""
    partners = await db.delivery_partners.find({
        "is_available": True,
        "is_online": True,
        "approval_status": "approved"
    }, {"_id": 0}).to_list(50)
    return partners


# ============== DELIVERY PARTNER STATUS ==============

@router.put("/delivery-partners/{partner_id}/online")
async def update_online_status(partner_id: str, request: dict):
    """Update delivery partner online status"""
    is_online = request.get("is_online", False)
    
    update_data = {
        "is_online": is_online,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if is_online:
        update_data["is_available"] = True
    
    result = await db.delivery_partners.update_one(
        {"id": partner_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    return {"message": f"Status updated to {'online' if is_online else 'offline'}", "partner": partner}


@router.put("/delivery-partners/{partner_id}/availability")
async def update_availability(partner_id: str, request: dict):
    """Update delivery partner availability"""
    is_available = request.get("is_available", False)
    
    result = await db.delivery_partners.update_one(
        {"id": partner_id},
        {"$set": {
            "is_available": is_available,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    return {"message": f"Availability updated to {is_available}"}


# ============== DELIVERY PARTNER LOCATION ==============

@router.put("/delivery-partners/{partner_id}/location")
async def update_partner_location(partner_id: str, request: dict):
    """Update delivery partner current location"""
    lat = request.get("lat")
    lng = request.get("lng")
    
    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Coordinates required")
    
    result = await db.delivery_partners.update_one(
        {"id": partner_id},
        {"$set": {
            "current_lat": lat,
            "current_lng": lng,
            "location_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    return {"message": "Location updated"}


@router.post("/delivery-partner/location/{order_id}")
async def post_delivery_location(order_id: str, request: dict):
    """Post delivery partner location for an order (for tracking)"""
    lat = request.get("lat")
    lng = request.get("lng")
    partner_id = request.get("partner_id")
    
    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Coordinates required")
    
    location_record = {
        "order_id": order_id,
        "partner_id": partner_id,
        "lat": lat,
        "lng": lng,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.delivery_locations.update_one(
        {"order_id": order_id},
        {"$set": location_record},
        upsert=True
    )
    
    return {"message": "Location updated", "location": location_record}


@router.get("/delivery-partner/location/{order_id}")
async def get_delivery_location(order_id: str):
    """Get current delivery partner location for an order"""
    location = await db.delivery_locations.find_one({"order_id": order_id}, {"_id": 0})
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


# ============== DELIVERY PARTNER PROFILE ==============

@router.put("/delivery/partners/{partner_id}/profile")
async def update_partner_profile(partner_id: str, request: dict):
    """Update delivery partner profile (photo, license)"""
    update_data = {}
    
    if request.get("photo"):
        update_data["photo"] = request["photo"]
    if request.get("license_image"):
        update_data["license_image"] = request["license_image"]
    if request.get("name"):
        update_data["name"] = request["name"]
    if request.get("email"):
        update_data["email"] = request["email"]
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.delivery_partners.update_one({"id": partner_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    return {"message": "Profile updated", "partner": partner}


# ============== NEARBY ORDERS ==============

@router.get("/delivery-partners/{partner_id}/nearby-orders")
async def get_nearby_orders(partner_id: str, radius_km: float = 5.0):
    """Get orders near the delivery partner"""
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    partner_lat = partner.get("current_lat") or partner.get("lat")
    partner_lng = partner.get("current_lng") or partner.get("lng")
    
    if not partner_lat or not partner_lng:
        return {"orders": [], "message": "Partner location not set"}
    
    # Get orders that are ready for pickup
    orders = await db.orders.find({
        "status": {"$in": ["ready", "confirmed", "preparing"]},
        "delivery_partner_id": {"$exists": False}
    }, {"_id": 0}).to_list(50)
    
    nearby_orders = []
    for order in orders:
        restaurant = await db.restaurants.find_one({"id": order.get("restaurant_id")}, {"_id": 0})
        if restaurant and restaurant.get("lat") and restaurant.get("lng"):
            distance = calculate_distance_km(
                partner_lat, partner_lng,
                restaurant["lat"], restaurant["lng"]
            )
            if distance <= radius_km:
                order["distance_km"] = round(distance, 2)
                order["restaurant_location"] = {
                    "lat": restaurant["lat"],
                    "lng": restaurant["lng"],
                    "address": restaurant.get("address")
                }
                nearby_orders.append(order)
    
    # Sort by distance
    nearby_orders.sort(key=lambda x: x.get("distance_km", 999))
    
    return {"orders": nearby_orders}


# ============== EARNINGS ==============

@router.get("/delivery-partners/{partner_id}/earnings")
async def get_partner_earnings(partner_id: str):
    """Get delivery partner earnings summary"""
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    # Get all delivered orders for this partner
    delivered_orders = await db.orders.find({
        "delivery_partner_id": partner_id,
        "status": "delivered"
    }, {"_id": 0}).to_list(1000)
    
    total_earnings = 0
    today_earnings = 0
    week_earnings = 0
    total_deliveries = len(delivered_orders)
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    
    for order in delivered_orders:
        # Partner gets 95% of delivery fee
        earning = order.get("delivery_fee", 0) * 0.95
        total_earnings += earning
        
        delivered_at = order.get("delivered_at")
        if delivered_at:
            delivered_date = datetime.fromisoformat(delivered_at.replace('Z', '+00:00'))
            if delivered_date >= today:
                today_earnings += earning
            if delivered_date >= week_ago:
                week_earnings += earning
    
    # Count today's and week's deliveries
    today_deliveries = 0
    week_deliveries = 0
    for order in delivered_orders:
        delivered_at = order.get("delivered_at")
        if delivered_at:
            delivered_date = datetime.fromisoformat(delivered_at.replace('Z', '+00:00'))
            if delivered_date >= today:
                today_deliveries += 1
            if delivered_date >= week_ago:
                week_deliveries += 1
    
    return {
        "earnings": {
            "total": round(total_earnings, 2),
            "today": round(today_earnings, 2),
            "week": round(week_earnings, 2)
        },
        "deliveries": {
            "total": total_deliveries,
            "today": today_deliveries,
            "week": week_deliveries
        }
    }


# ============== COD SETTLEMENT ==============

@router.post("/delivery/cod-settlement")
async def submit_cod_settlement(request: dict):
    """Delivery partner submits COD collection for settlement"""
    partner_id = request.get("partner_id")
    amount = request.get("amount", 0)
    comment = request.get("comment", "")
    
    if not partner_id or amount <= 0:
        raise HTTPException(status_code=400, detail="Partner ID and valid amount required")
    
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    settlement = {
        "id": str(uuid.uuid4()),
        "partner_id": partner_id,
        "partner_name": partner.get("name"),
        "amount": amount,
        "comment": comment,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.cod_settlements.insert_one(settlement)
    settlement.pop("_id", None)
    
    return {"message": "Settlement submitted", "settlement": settlement}


@router.get("/delivery/cod-settlements")
async def get_partner_cod_settlements(partner_id: str):
    """Get COD settlements for a delivery partner"""
    settlements = await db.cod_settlements.find(
        {"partner_id": partner_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return settlements


# ============== DASHBOARD ==============

@router.get("/dashboard/delivery/{user_id}")
async def get_delivery_dashboard(user_id: str):
    """Get delivery partner dashboard data"""
    partner = await db.delivery_partners.find_one({"user_id": user_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    # Get assigned orders
    assigned_orders = await db.orders.find({
        "delivery_partner_id": partner["id"],
        "status": {"$in": ["confirmed", "preparing", "ready", "picked_up"]}
    }, {"_id": 0}).to_list(20)
    
    # Get recent completed orders
    recent_orders = await db.orders.find({
        "delivery_partner_id": partner["id"],
        "status": "delivered"
    }, {"_id": 0}).sort("delivered_at", -1).limit(10).to_list(10)
    
    return {
        "partner": partner,
        "assigned_orders": assigned_orders,
        "recent_orders": recent_orders
    }
