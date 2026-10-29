"""
Food Key Admin Routes
=====================
Admin authentication, dashboard, and management endpoints.
"""

import logging
import random
import string
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import db
from config import SUPER_ADMIN_PHONE
from models import (
    SendOTPRequest, VerifyOTPRequest, AdminLoginRequest, AdminSetPasswordRequest,
    CreateAdminRequest, AdminAssignDeliveryRequest, AdminUpdateRestaurantRequest,
    AdminApprovalRequest, AdminApproveChangesRequest, CreateRestaurantRequest,
    AddMenuItemRequest, MenuItem
)
from services import send_sms_otp
from utils import validate_phone, sanitize_input, hash_password, verify_password

router = APIRouter(prefix="/api", tags=["Admin"])
limiter = Limiter(key_func=get_remote_address)


# ============== ADMIN AUTH ==============

@router.post("/admin/send-otp")
@limiter.limit("3/minute")
async def admin_send_otp(request: Request, otp_request: SendOTPRequest):
    """Send OTP for admin login via Ping4SMS"""
    if not validate_phone(otp_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    user = await db.users.find_one({"phone": otp_request.phone, "role": "admin"}, {"_id": 0})
    
    if otp_request.phone != SUPER_ADMIN_PHONE and not user:
        raise HTTPException(status_code=403, detail="Not authorized as admin")
    
    otp = ''.join(random.choices(string.digits, k=5))
    
    otp_record = {
        "phone": otp_request.phone,
        "otp": otp,
        "type": "admin",
        "attempts": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    }
    
    await db.otps.delete_many({"phone": otp_request.phone, "type": "admin"})
    await db.otps.insert_one(otp_record)
    
    sms_sent = await send_sms_otp(otp_request.phone, otp)
    
    logging.info(f"Admin OTP for {otp_request.phone}: {otp}")
    
    return {"message": "Admin OTP sent successfully", "sms_sent": sms_sent}


@router.post("/admin/verify-otp")
@limiter.limit("5/minute")
async def admin_verify_otp(request: Request, otp_request: VerifyOTPRequest):
    """Verify OTP for admin - direct login without password"""
    if not validate_phone(otp_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    otp_record = await db.otps.find_one({"phone": otp_request.phone, "type": "admin"}, {"_id": 0})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="OTP not found")
    
    expires_at = datetime.fromisoformat(otp_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.otps.delete_many({"phone": otp_request.phone, "type": "admin"})
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new OTP.")
    
    if otp_record.get("attempts", 0) >= 3:
        await db.otps.delete_many({"phone": otp_request.phone, "type": "admin"})
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please request a new OTP.")
    
    if otp_record["otp"] != otp_request.otp:
        await db.otps.update_one(
            {"phone": otp_request.phone, "type": "admin"},
            {"$inc": {"attempts": 1}}
        )
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    await db.otps.delete_many({"phone": otp_request.phone, "type": "admin"})
    
    admin = await db.users.find_one({"phone": otp_request.phone, "role": "admin"}, {"_id": 0, "password_hash": 0})
    
    if admin:
        await db.users.update_one(
            {"phone": otp_request.phone},
            {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
        )
        admin["last_login"] = datetime.now(timezone.utc).isoformat()
        return {"message": "Login successful", "user": admin}
    
    if otp_request.phone == SUPER_ADMIN_PHONE:
        new_admin = {
            "id": str(uuid.uuid4()),
            "phone": otp_request.phone,
            "name": sanitize_input(otp_request.name) if otp_request.name else "Super Admin",
            "role": "admin",
            "is_super_admin": True,
            "addresses": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_admin)
        new_admin.pop("_id", None)
        return {"message": "Login successful", "user": new_admin}
    
    raise HTTPException(status_code=403, detail="Not authorized as admin")


@router.post("/admin/set-password")
async def admin_set_password(request: AdminSetPasswordRequest):
    """Set password for admin"""
    admin = await db.users.find_one({"phone": request.phone, "role": "admin"}, {"_id": 0})
    
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    password_hash = hash_password(request.password)
    
    await db.users.update_one(
        {"phone": request.phone},
        {"$set": {"password_hash": password_hash, "is_password_set": True}}
    )
    
    return {"message": "Password set successfully"}


@router.post("/admin/reset-password")
async def admin_reset_password(request: AdminSetPasswordRequest):
    """Reset password for admin"""
    admin = await db.users.find_one({"phone": request.phone, "role": "admin"}, {"_id": 0})
    
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    password_hash = hash_password(request.password)
    
    await db.users.update_one(
        {"phone": request.phone},
        {"$set": {"password_hash": password_hash, "is_password_set": True}}
    )
    
    return {"message": "Password reset successfully"}


@router.post("/admin/login")
async def admin_login(request: AdminLoginRequest):
    """Admin login with password"""
    admin_with_hash = await db.users.find_one({"phone": request.phone, "role": "admin"}, {"_id": 0})
    
    if not admin_with_hash:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    if not admin_with_hash.get("is_password_set"):
        raise HTTPException(status_code=400, detail="Password not set. Please login with OTP first.")
    
    if not request.password:
        raise HTTPException(status_code=400, detail="Password required")
    
    if not verify_password(request.password, admin_with_hash.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    await db.users.update_one(
        {"phone": request.phone},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    admin = await db.users.find_one({"phone": request.phone, "role": "admin"}, {"_id": 0, "password_hash": 0})
    admin["last_login"] = datetime.now(timezone.utc).isoformat()
    
    return {"message": "Login successful", "user": admin}


@router.post("/admin/create-admin")
async def create_admin(request: CreateAdminRequest, creator_phone: str):
    """Super admin creates other admin accounts"""
    creator = await db.users.find_one({"phone": creator_phone, "role": "admin"}, {"_id": 0})
    
    if not creator or not creator.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Only super admin can create other admins")
    
    existing = await db.users.find_one({"phone": request.phone}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    new_admin = {
        "id": str(uuid.uuid4()),
        "phone": request.phone,
        "name": sanitize_input(request.name),
        "email": request.email,
        "role": "admin",
        "is_super_admin": False,
        "addresses": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(new_admin)
    new_admin.pop("_id", None)
    
    return {"message": "Admin created", "admin": new_admin}


# ============== ADMIN DASHBOARD ==============

@router.get("/admin/dashboard")
async def get_admin_dashboard():
    """Get admin dashboard statistics"""
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    total_orders = await db.orders.count_documents({})
    today_orders = await db.orders.count_documents({"created_at": {"$gte": today.isoformat()}})
    pending_orders = await db.orders.count_documents({"status": {"$in": ["pending", "confirmed", "preparing", "ready"]}})
    
    total_restaurants = await db.restaurants.count_documents({})
    pending_restaurants = await db.restaurants.count_documents({"approval_status": "pending"})
    
    total_delivery_partners = await db.delivery_partners.count_documents({})
    pending_partners = await db.delivery_partners.count_documents({"approval_status": "pending"})
    online_partners = await db.delivery_partners.count_documents({"is_online": True, "approval_status": "approved"})
    
    pipeline = [
        {"$match": {"status": "delivered"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    revenue_result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    return {
        "orders": {
            "total": total_orders,
            "today": today_orders,
            "pending": pending_orders
        },
        "restaurants": {
            "total": total_restaurants,
            "pending_approval": pending_restaurants
        },
        "delivery_partners": {
            "total": total_delivery_partners,
            "pending_approval": pending_partners,
            "online": online_partners
        },
        "revenue": {
            "total": round(total_revenue, 2)
        }
    }


@router.get("/admin/users")
async def admin_get_all_users(page: int = 1, limit: int = 20, role: Optional[str] = None):
    """Get all users with optional role filter"""
    query = {}
    if role:
        query["role"] = role
    
    skip = (page - 1) * limit
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    total = await db.users.count_documents(query)
    
    return {
        "users": users,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin_phone: str):
    """Admin deletes a user"""
    admin = await db.users.find_one({"phone": admin_phone, "role": "admin"}, {"_id": 0})
    if not admin or not admin.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Only super admin can delete users")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("phone") == SUPER_ADMIN_PHONE:
        raise HTTPException(status_code=403, detail="Cannot delete super admin")
    
    await db.users.delete_one({"id": user_id})
    
    if user.get("role") == "restaurant":
        await db.restaurants.delete_many({"owner_id": user_id})
    elif user.get("role") == "delivery":
        await db.delivery_partners.delete_many({"user_id": user_id})
    
    return {"message": "User deleted successfully"}


# ============== ADMIN ORDER MANAGEMENT ==============

@router.get("/admin/orders")
async def admin_get_orders(page: int = 1, limit: int = 20, status: Optional[str] = None):
    """Get all orders with optional status filter"""
    query = {}
    if status:
        query["status"] = status
    
    skip = (page - 1) * limit
    orders = await db.orders.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    total = await db.orders.count_documents(query)
    
    return {
        "orders": orders,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.get("/admin/orders/{order_id}")
async def get_order_details(order_id: str):
    """Get detailed order information"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    customer = await db.users.find_one({"id": order.get("user_id")}, {"_id": 0, "password_hash": 0})
    restaurant = await db.restaurants.find_one({"id": order.get("restaurant_id")}, {"_id": 0})
    
    delivery_partner = None
    if order.get("delivery_partner_id"):
        delivery_partner = await db.delivery_partners.find_one({"id": order.get("delivery_partner_id")}, {"_id": 0})
    
    return {
        "order": order,
        "customer": customer,
        "restaurant": restaurant,
        "delivery_partner": delivery_partner
    }


@router.post("/admin/orders/assign-delivery")
async def admin_assign_delivery(request: AdminAssignDeliveryRequest):
    """Admin assigns delivery partner to order"""
    order = await db.orders.find_one({"id": request.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    partner = await db.delivery_partners.find_one({"id": request.delivery_partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    update_data = {
        "delivery_partner_id": request.delivery_partner_id,
        "delivery_partner_name": partner.get("name"),
        "admin_approved": True,
        "assigned_by_admin": not request.auto_assign,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if order.get("status") == "ready":
        update_data["status"] = "picked_up"
    
    await db.orders.update_one({"id": request.order_id}, {"$set": update_data})
    
    await db.delivery_partners.update_one(
        {"id": request.delivery_partner_id},
        {"$set": {"is_available": False}}
    )
    
    updated_order = await db.orders.find_one({"id": request.order_id}, {"_id": 0})
    return {"message": "Delivery partner assigned", "order": updated_order}


@router.get("/admin/order-history")
async def get_order_history(page: int = 1, limit: int = 50):
    """Get comprehensive order history for admin"""
    skip = (page - 1) * limit
    
    orders = await db.orders.find({}, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    total = await db.orders.count_documents({})
    
    stats = {
        "total": total,
        "pending": await db.orders.count_documents({"status": "pending"}),
        "confirmed": await db.orders.count_documents({"status": "confirmed"}),
        "preparing": await db.orders.count_documents({"status": "preparing"}),
        "ready": await db.orders.count_documents({"status": "ready"}),
        "picked_up": await db.orders.count_documents({"status": "picked_up"}),
        "delivered": await db.orders.count_documents({"status": "delivered"}),
        "cancelled": await db.orders.count_documents({"status": "cancelled"})
    }
    
    return {
        "orders": orders,
        "stats": stats,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


# ============== ADMIN RESTAURANT MANAGEMENT ==============

@router.get("/admin/restaurants")
async def admin_get_all_restaurants(page: int = 1, limit: int = 20):
    """Get all restaurants for admin"""
    skip = (page - 1) * limit
    restaurants = await db.restaurants.find({}, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    total = await db.restaurants.count_documents({})
    
    return {
        "restaurants": restaurants,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.post("/admin/restaurants")
async def admin_create_restaurant(request: CreateRestaurantRequest):
    """Admin creates a new restaurant"""
    from models import Restaurant
    
    restaurant = Restaurant(
        **request.model_dump(),
        owner_id=None
    )
    
    restaurant_dict = restaurant.model_dump()
    restaurant_dict["created_at"] = restaurant_dict["created_at"].isoformat()
    
    await db.restaurants.insert_one(restaurant_dict)
    restaurant_dict.pop("_id", None)
    
    return {"message": "Restaurant created", "restaurant": restaurant_dict}


@router.put("/admin/restaurants/{restaurant_id}")
async def admin_update_restaurant(restaurant_id: str, request: AdminUpdateRestaurantRequest):
    """Admin updates restaurant details"""
    update_data = {k: v for k, v in request.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.restaurants.update_one({"id": restaurant_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return {"message": "Restaurant updated", "restaurant": restaurant}


@router.delete("/admin/restaurants/{restaurant_id}")
async def admin_delete_restaurant(restaurant_id: str):
    """Admin deletes a restaurant"""
    result = await db.restaurants.delete_one({"id": restaurant_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    return {"message": "Restaurant deleted"}


@router.get("/admin/restaurants/pending")
async def admin_get_pending_restaurants():
    """Get restaurants pending approval"""
    pending_approval = await db.restaurants.find({"approval_status": "pending"}, {"_id": 0}).to_list(100)
    pending_changes = await db.restaurants.find({"has_pending_changes": True}, {"_id": 0}).to_list(100)
    
    return {
        "pending_approval": pending_approval,
        "pending_changes": pending_changes,
        "total_pending": len(pending_approval) + len(pending_changes)
    }


@router.post("/admin/restaurants/{restaurant_id}/approve")
async def admin_approve_restaurant(restaurant_id: str, request: AdminApprovalRequest, admin_phone: str = ""):
    """Admin approves or rejects a restaurant"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    update_data = {
        "approval_status": "approved" if request.action == "approve" else "rejected",
        "approval_notes": request.notes,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": admin_phone,
        "is_open": request.action == "approve"
    }
    
    await db.restaurants.update_one({"id": restaurant_id}, {"$set": update_data})
    
    if restaurant.get("owner_id"):
        notification = {
            "id": str(uuid.uuid4()),
            "recipient_type": "restaurant",
            "recipient_id": restaurant["owner_id"],
            "type": "approval_status",
            "title": "Restaurant " + ("Approved" if request.action == "approve" else "Rejected"),
            "message": f"Your restaurant '{restaurant['name']}' has been {request.action}d." + (f" Notes: {request.notes}" if request.notes else ""),
            "data": {"restaurant_id": restaurant_id, "status": update_data["approval_status"]},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    updated_restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return {"message": f"Restaurant {request.action}d", "restaurant": updated_restaurant}


# ============== ADMIN DELIVERY PARTNER MANAGEMENT ==============

@router.get("/admin/delivery-partners")
async def admin_get_delivery_partners(page: int = 1, limit: int = 20, approval_status: Optional[str] = None):
    """Get all delivery partners"""
    query = {}
    if approval_status:
        query["approval_status"] = approval_status
    
    skip = (page - 1) * limit
    partners = await db.delivery_partners.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    total = await db.delivery_partners.count_documents(query)
    
    pending_count = await db.delivery_partners.count_documents({"approval_status": "pending"})
    approved_count = await db.delivery_partners.count_documents({"approval_status": "approved"})
    
    return {
        "partners": partners,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "pending_count": pending_count,
        "approved_count": approved_count
    }


@router.get("/admin/delivery-partners/available")
async def admin_get_available_partners():
    """Get all available and approved delivery partners"""
    partners = await db.delivery_partners.find({
        "is_available": True, 
        "is_online": True,
        "approval_status": "approved"
    }, {"_id": 0}).to_list(100)
    return partners


@router.post("/admin/delivery-partners/{partner_id}/approve")
async def admin_approve_delivery_partner(partner_id: str, request: AdminApprovalRequest, admin_phone: str = ""):
    """Admin approves or rejects a delivery partner"""
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    update_data = {
        "approval_status": "approved" if request.action == "approve" else "rejected",
        "approval_notes": request.notes,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": admin_phone
    }
    
    await db.delivery_partners.update_one({"id": partner_id}, {"$set": update_data})
    
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "delivery",
        "recipient_id": partner["user_id"],
        "type": "approval_status",
        "title": "Registration " + ("Approved" if request.action == "approve" else "Rejected"),
        "message": f"Your delivery partner registration has been {request.action}d." + (f" Notes: {request.notes}" if request.notes else ""),
        "data": {"partner_id": partner_id, "status": update_data["approval_status"]},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    updated_partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    return {"message": f"Delivery partner {request.action}d", "partner": updated_partner}


@router.delete("/admin/delivery-partners/{partner_id}")
async def admin_delete_delivery_partner(partner_id: str):
    """Admin deletes a delivery partner"""
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    result = await db.delivery_partners.delete_one({"id": partner_id})
    
    if partner.get("user_id"):
        await db.users.delete_one({"id": partner["user_id"]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    return {"message": "Delivery partner deleted"}
