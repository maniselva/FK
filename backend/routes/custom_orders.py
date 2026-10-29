"""
Food Key Custom Order Routes
============================
Custom orders from unlisted restaurants.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from typing import Optional

from database import db

router = APIRouter(tags=["Custom Orders"])


@router.post("/custom-orders")
async def create_custom_order(request: dict):
    """Create a custom order from an unlisted restaurant"""
    custom_order = {
        "id": str(uuid.uuid4()),
        "user_id": request.get("user_id"),
        "user_name": request.get("user_name"),
        "user_phone": request.get("user_phone"),
        "restaurant_name": request.get("restaurant_name"),
        "restaurant_address": request.get("restaurant_address"),
        "items_description": request.get("items_description"),
        "delivery_address": request.get("delivery_address"),
        "special_instructions": request.get("special_instructions"),
        "estimated_amount": None,
        "delivery_partner_id": None,
        "delivery_partner_name": None,
        "status": "pending",  # pending, accepted, rejected, assigned, picked_up, delivered
        "payment_status": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.custom_orders.insert_one(custom_order)
    custom_order.pop("_id", None)
    
    # Notify admin
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "admin",
        "recipient_id": "admin",
        "type": "custom_order",
        "title": "New Custom Order",
        "message": f"Custom order from {custom_order['user_name']} for {custom_order['restaurant_name']}",
        "data": {"custom_order_id": custom_order["id"]},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Custom order submitted", "order": custom_order}


@router.get("/custom-orders/{order_id}")
async def get_custom_order(order_id: str):
    """Get a custom order by ID"""
    order = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Custom order not found")
    return order


@router.get("/custom-orders/user/{user_id}")
async def get_user_custom_orders(user_id: str):
    """Get custom orders for a user"""
    orders = await db.custom_orders.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return orders


# ============== ADMIN CUSTOM ORDER MANAGEMENT ==============

@router.get("/admin/custom-orders")
async def admin_get_custom_orders(status: Optional[str] = None):
    """Get all custom orders for admin"""
    query = {}
    if status:
        query["status"] = status
    
    orders = await db.custom_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders


@router.put("/admin/custom-orders/{order_id}")
async def admin_update_custom_order(order_id: str, request: dict):
    """Admin updates a custom order"""
    order = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Custom order not found")
    
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if "status" in request:
        update_data["status"] = request["status"]
    if "estimated_amount" in request:
        update_data["estimated_amount"] = request["estimated_amount"]
    if "admin_notes" in request:
        update_data["admin_notes"] = request["admin_notes"]
    if "delivery_partner_id" in request:
        update_data["delivery_partner_id"] = request["delivery_partner_id"]
        # Get partner name
        partner = await db.delivery_partners.find_one({"id": request["delivery_partner_id"]}, {"_id": 0})
        if partner:
            update_data["delivery_partner_name"] = partner.get("name")
    
    await db.custom_orders.update_one({"id": order_id}, {"$set": update_data})
    
    # Notify customer if status changed to accepted
    if request.get("status") == "accepted" and order.get("status") != "accepted":
        notification = {
            "id": str(uuid.uuid4()),
            "recipient_type": "customer",
            "recipient_id": order.get("user_id"),
            "type": "custom_order_accepted",
            "title": "Custom Order Accepted!",
            "message": f"Your custom order has been accepted. Estimated amount: ₹{update_data.get('estimated_amount', 'TBD')}",
            "data": {"custom_order_id": order_id},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    updated = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
    return {"message": "Custom order updated", "order": updated}


@router.delete("/admin/custom-orders/{order_id}")
async def admin_delete_custom_order(order_id: str):
    """Admin deletes a custom order"""
    result = await db.custom_orders.delete_one({"id": order_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom order not found")
    
    return {"message": "Custom order deleted"}
