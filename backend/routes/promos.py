"""
Food Key Promo/Coupon Routes
============================
Promotional codes and coupon management.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from typing import Optional

from database import db

router = APIRouter(tags=["Promos"])


# ============== ADMIN PROMO MANAGEMENT ==============

@router.post("/admin/promos")
async def create_promo(request: dict):
    """Admin creates a new promo code"""
    promo = {
        "id": str(uuid.uuid4()),
        "code": request.get("code", "").upper(),
        "description": request.get("description", ""),
        "discount_type": request.get("discount_type", "percentage"),  # percentage or flat
        "discount_value": request.get("discount_value", 0),
        "min_order_value": request.get("min_order_value", 0),
        "max_discount": request.get("max_discount"),
        "max_uses": request.get("max_uses"),
        "valid_from": request.get("valid_from"),
        "valid_until": request.get("valid_until"),
        "is_active": True,
        "use_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Check for duplicate code
    existing = await db.promo_codes.find_one({"code": promo["code"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Promo code already exists")
    
    await db.promo_codes.insert_one(promo)
    promo.pop("_id", None)
    
    return {"message": "Promo created", "promo": promo}


@router.get("/admin/promos")
async def admin_get_promos():
    """Get all promo codes for admin"""
    promos = await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return promos


@router.put("/admin/promos/{promo_id}")
async def update_promo(promo_id: str, request: dict):
    """Update a promo code"""
    update_data = {k: v for k, v in request.items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.promo_codes.update_one({"id": promo_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Promo not found")
    
    promo = await db.promo_codes.find_one({"id": promo_id}, {"_id": 0})
    return {"message": "Promo updated", "promo": promo}


@router.delete("/admin/promos/{promo_id}")
async def delete_promo(promo_id: str):
    """Delete a promo code"""
    result = await db.promo_codes.delete_one({"id": promo_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Promo not found")
    
    return {"message": "Promo deleted"}


# ============== PUBLIC PROMO ENDPOINTS ==============

@router.get("/promos/available")
async def get_available_promos(user_id: Optional[str] = None):
    """Get available promo codes for customers"""
    now = datetime.now(timezone.utc).isoformat()
    
    query = {
        "is_active": True,
        "$or": [
            {"valid_until": {"$exists": False}},
            {"valid_until": None},
            {"valid_until": {"$gte": now}}
        ]
    }
    
    promos = await db.promo_codes.find(query, {"_id": 0}).to_list(50)
    
    # Filter out promos that have reached max uses
    available_promos = []
    for promo in promos:
        if promo.get("max_uses") and promo.get("use_count", 0) >= promo["max_uses"]:
            continue
        available_promos.append(promo)
    
    return available_promos


@router.post("/promos/apply")
async def apply_promo(request: dict):
    """Apply a promo code to an order"""
    code = request.get("code", "").upper()
    cart_total = request.get("cart_total", 0)
    user_id = request.get("user_id")
    
    if not code:
        raise HTTPException(status_code=400, detail="Promo code required")
    
    promo = await db.promo_codes.find_one({"code": code, "is_active": True}, {"_id": 0})
    
    if not promo:
        raise HTTPException(status_code=400, detail="Invalid or expired promo code")
    
    # Check validity dates
    now = datetime.now(timezone.utc).isoformat()
    if promo.get("valid_from") and promo["valid_from"] > now:
        raise HTTPException(status_code=400, detail="Promo code not yet valid")
    if promo.get("valid_until") and promo["valid_until"] < now:
        raise HTTPException(status_code=400, detail="Promo code has expired")
    
    # Check max uses
    if promo.get("max_uses") and promo.get("use_count", 0) >= promo["max_uses"]:
        raise HTTPException(status_code=400, detail="Promo code usage limit reached")
    
    # Check minimum order value
    if cart_total < promo.get("min_order_value", 0):
        raise HTTPException(
            status_code=400,
            detail=f"Minimum order value is ₹{promo['min_order_value']}"
        )
    
    # Calculate discount
    if promo["discount_type"] == "percentage":
        discount = cart_total * (promo["discount_value"] / 100)
        if promo.get("max_discount"):
            discount = min(discount, promo["max_discount"])
    elif promo["discount_type"] == "free_delivery":
        discount = 0  # Handled separately
    else:  # flat
        discount = promo["discount_value"]
    
    return {
        "success": True,
        "discount": round(discount, 2),
        "promo_info": promo
    }
