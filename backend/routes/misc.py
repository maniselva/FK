"""
Food Key Miscellaneous Routes
=============================
Dashboard, feedback, uploads, maps, slides, tracking and other utilities.
"""

import uuid
import os
import base64
import aiohttp
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from typing import Optional

from database import db
from config import (
    UPLOADS_DIR, VAPID_PUBLIC_KEY,
    OLA_MAPS_API_KEY, OLA_MAPS_AUTOCOMPLETE_URL, OLA_MAPS_REVERSE_GEOCODE_URL
)

router = APIRouter(tags=["Misc"])


# ============== RESTAURANT DASHBOARD ==============

@router.get("/dashboard/restaurant/{owner_id}")
async def get_restaurant_dashboard(owner_id: str):
    """Get restaurant dashboard data"""
    restaurant = await db.restaurants.find_one({"owner_id": owner_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Get active orders
    active_orders = await db.orders.find({
        "restaurant_id": restaurant["id"],
        "status": {"$in": ["pending", "confirmed", "preparing", "ready"]}
    }, {"_id": 0}).to_list(50)
    
    # Get recent completed orders
    recent_orders = await db.orders.find({
        "restaurant_id": restaurant["id"],
        "status": "delivered"
    }, {"_id": 0}).sort("delivered_at", -1).limit(20).to_list(20)
    
    return {
        "restaurant": restaurant,
        "active_orders": active_orders,
        "recent_orders": recent_orders
    }


# ============== FEEDBACK ==============

@router.post("/feedback")
async def submit_feedback(request: dict):
    """Submit customer feedback or complaint"""
    feedback = {
        "id": str(uuid.uuid4()),
        "user_id": request.get("user_id"),
        "user_name": request.get("user_name"),
        "user_phone": request.get("user_phone"),
        "type": request.get("type", "feedback"),  # feedback, complaint, suggestion
        "subject": request.get("subject"),
        "message": request.get("message"),
        "order_id": request.get("order_id"),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.feedback.insert_one(feedback)
    feedback.pop("_id", None)
    
    return {"message": "Feedback submitted", "feedback": feedback}


@router.get("/admin/feedback")
async def admin_get_feedback(status: Optional[str] = None):
    """Get all feedback for admin"""
    query = {}
    if status:
        query["status"] = status
    
    feedback_list = await db.feedback.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return feedback_list


@router.put("/admin/feedback/{feedback_id}/resolve")
async def resolve_feedback(feedback_id: str, request: dict):
    """Admin resolves feedback"""
    update_data = {
        "status": "resolved",
        "admin_response": request.get("response"),
        "resolved_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.feedback.update_one({"id": feedback_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    return {"message": "Feedback resolved"}


@router.delete("/admin/feedback/{feedback_id}")
async def delete_feedback(feedback_id: str):
    """Admin deletes feedback"""
    result = await db.feedback.delete_one({"id": feedback_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    return {"message": "Feedback deleted"}


# ============== FILE UPLOADS ==============

@router.post("/upload/licence")
async def upload_licence(file: UploadFile = File(...), user_id: Optional[str] = None):
    """Upload delivery partner license image"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"licence_{user_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    return {"filename": filename, "url": f"/api/uploads/{filename}"}


@router.post("/upload/fssai")
async def upload_fssai(file: UploadFile = File(...), user_id: Optional[str] = None):
    """Upload restaurant FSSAI certificate"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"fssai_{user_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    return {"filename": filename, "url": f"/api/uploads/{filename}"}


@router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    """Serve uploaded files"""
    filepath = UPLOADS_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)


# ============== MAPS ==============

@router.post("/maps/directions")
async def get_directions(request: dict):
    """Get directions between two points"""
    origin = request.get("origin")
    destination = request.get("destination")
    
    if not origin or not destination:
        raise HTTPException(status_code=400, detail="Origin and destination required")
    
    return {
        "google_maps_url": f"https://www.google.com/maps/dir/{origin['lat']},{origin['lng']}/{destination['lat']},{destination['lng']}"
    }


@router.get("/maps/directions")
async def get_directions_get(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float):
    """Get directions via GET"""
    return {
        "google_maps_url": f"https://www.google.com/maps/dir/{origin_lat},{origin_lng}/{dest_lat},{dest_lng}"
    }


@router.get("/maps/autocomplete")
async def maps_autocomplete(input: str, lat: Optional[float] = None, lng: Optional[float] = None):
    """Get location autocomplete suggestions"""
    if not OLA_MAPS_API_KEY:
        return {"predictions": []}
    
    params = {"input": input, "api_key": OLA_MAPS_API_KEY}
    if lat and lng:
        params["location"] = f"{lat},{lng}"
    
    async with aiohttp.ClientSession() as session:
        async with session.get(OLA_MAPS_AUTOCOMPLETE_URL, params=params) as response:
            if response.status == 200:
                data = await response.json()
                return {"predictions": data.get("predictions", [])}
    
    return {"predictions": []}


@router.get("/maps/reverse-geocode")
async def reverse_geocode(lat: float, lng: float):
    """Get address from coordinates"""
    if not OLA_MAPS_API_KEY:
        return {"address": "Location detected"}
    
    params = {"latlng": f"{lat},{lng}", "api_key": OLA_MAPS_API_KEY}
    
    async with aiohttp.ClientSession() as session:
        async with session.get(OLA_MAPS_REVERSE_GEOCODE_URL, params=params) as response:
            if response.status == 200:
                data = await response.json()
                results = data.get("results", [])
                if results:
                    return {"address": results[0].get("formatted_address", "Unknown")}
    
    return {"address": "Location detected"}


@router.get("/maps/delivery-route/{order_id}")
async def get_delivery_route(order_id: str):
    """Get delivery route for an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    restaurant = await db.restaurants.find_one({"id": order.get("restaurant_id")}, {"_id": 0})
    delivery_address = order.get("delivery_address", {})
    
    return {
        "origin": {
            "lat": restaurant.get("lat") if restaurant else None,
            "lng": restaurant.get("lng") if restaurant else None,
            "name": restaurant.get("name") if restaurant else None
        },
        "destination": {
            "lat": delivery_address.get("lat"),
            "lng": delivery_address.get("lng"),
            "address": delivery_address.get("full_address")
        }
    }


# ============== PUSH NOTIFICATIONS ==============

@router.post("/push/subscribe")
async def push_subscribe(request: dict):
    """Subscribe to push notifications"""
    subscription = {
        "id": str(uuid.uuid4()),
        "user_id": request.get("user_id"),
        "endpoint": request.get("endpoint"),
        "keys": request.get("keys"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove existing subscription for this endpoint
    await db.push_subscriptions.delete_many({"endpoint": subscription["endpoint"]})
    
    await db.push_subscriptions.insert_one(subscription)
    
    return {"message": "Subscribed to push notifications"}


@router.delete("/push/unsubscribe")
async def push_unsubscribe(request: dict):
    """Unsubscribe from push notifications"""
    await db.push_subscriptions.delete_many({"endpoint": request.get("endpoint")})
    return {"message": "Unsubscribed"}


@router.get("/push/vapid-key")
async def get_vapid_key():
    """Get VAPID public key for push notifications"""
    return {"publicKey": VAPID_PUBLIC_KEY}


@router.post("/push/test")
async def test_push(request: dict):
    """Test push notification (for development)"""
    return {"message": "Push test endpoint"}


# ============== ORDER TRACKING ==============

@router.get("/orders/{order_id}/tracking")
async def get_order_tracking(order_id: str):
    """Get order tracking information"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get tracking updates
    tracking = await db.order_tracking.find(
        {"order_id": order_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(50)
    
    # Get delivery partner location if assigned
    delivery_location = None
    if order.get("delivery_partner_id"):
        location = await db.delivery_locations.find_one({"order_id": order_id}, {"_id": 0})
        delivery_location = location
    
    return {
        "order": order,
        "tracking_updates": tracking,
        "delivery_location": delivery_location
    }


@router.post("/orders/{order_id}/tracking")
async def add_tracking_update(order_id: str, request: dict):
    """Add a tracking update for an order"""
    tracking_update = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "status": request.get("status"),
        "message": request.get("message"),
        "location": request.get("location"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.order_tracking.insert_one(tracking_update)
    
    return {"message": "Tracking update added"}


@router.get("/orders/{order_id}/tracking-info")
async def get_tracking_info(order_id: str):
    """Get tracking info for real-time tracking page"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    restaurant = await db.restaurants.find_one({"id": order.get("restaurant_id")}, {"_id": 0})
    
    delivery_partner = None
    if order.get("delivery_partner_id"):
        delivery_partner = await db.delivery_partners.find_one(
            {"id": order["delivery_partner_id"]},
            {"_id": 0}
        )
    
    delivery_location = await db.delivery_locations.find_one({"order_id": order_id}, {"_id": 0})
    
    return {
        "order": order,
        "restaurant": restaurant,
        "delivery_partner": delivery_partner,
        "delivery_location": delivery_location
    }


# ============== SLIDES ==============

@router.get("/slides")
async def get_slides():
    """Get promotional slides for homepage"""
    slides = await db.promotional_slides.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("order", 1).to_list(10)
    return slides


@router.post("/admin/slides")
async def create_slide(request: dict):
    """Admin creates a promotional slide"""
    slide = {
        "id": str(uuid.uuid4()),
        "title": request.get("title"),
        "subtitle": request.get("subtitle"),
        "image": request.get("image"),
        "link": request.get("link"),
        "order": request.get("order", 0),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.promotional_slides.insert_one(slide)
    slide.pop("_id", None)
    
    return {"message": "Slide created", "slide": slide}


@router.put("/admin/slides/{slide_id}")
async def update_slide(slide_id: str, request: dict):
    """Admin updates a slide"""
    update_data = {k: v for k, v in request.items() if v is not None}
    
    result = await db.promotional_slides.update_one({"id": slide_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Slide not found")
    
    slide = await db.promotional_slides.find_one({"id": slide_id}, {"_id": 0})
    return {"message": "Slide updated", "slide": slide}


@router.delete("/admin/slides/{slide_id}")
async def delete_slide(slide_id: str):
    """Admin deletes a slide"""
    result = await db.promotional_slides.delete_one({"id": slide_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Slide not found")
    
    return {"message": "Slide deleted"}


@router.put("/admin/slides/{slide_id}/toggle")
async def toggle_slide(slide_id: str):
    """Toggle slide active status"""
    slide = await db.promotional_slides.find_one({"id": slide_id}, {"_id": 0})
    if not slide:
        raise HTTPException(status_code=404, detail="Slide not found")
    
    new_status = not slide.get("is_active", True)
    await db.promotional_slides.update_one({"id": slide_id}, {"$set": {"is_active": new_status}})
    
    return {"is_active": new_status}


# ============== STATIC PAGES ==============

@router.get("/pages/terms")
async def get_terms():
    """Get terms and conditions"""
    return {
        "title": "Terms and Conditions",
        "content": """
# Terms and Conditions

Welcome to Food Key. By using our services, you agree to these terms.

## 1. Service Description
Food Key is a food delivery platform connecting customers with restaurants.

## 2. User Responsibilities
- Provide accurate information
- Maintain account security
- Comply with applicable laws

## 3. Orders and Payments
- All prices are in Indian Rupees (₹)
- Payment must be made at time of order or on delivery (COD)
- Cancellation policy applies as stated

## 4. Delivery
- Delivery times are estimates only
- We are not liable for delays beyond our control

## 5. Contact
For questions, contact support@foodkey.in
"""
    }


@router.get("/pages/privacy")
async def get_privacy():
    """Get privacy policy"""
    return {
        "title": "Privacy Policy",
        "content": """
# Privacy Policy

Food Key is committed to protecting your privacy.

## Information We Collect
- Contact information (phone, email)
- Delivery addresses
- Order history
- Location data (with consent)

## How We Use Information
- Process and deliver orders
- Improve our services
- Send notifications about orders

## Data Security
We implement appropriate security measures to protect your data.

## Contact
For privacy concerns, contact privacy@foodkey.in
"""
    }


# ============== ROOT ==============

@router.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "Food Key API",
        "version": "2.0",
        "status": "running"
    }
