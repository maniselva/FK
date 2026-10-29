"""
Food Key User Routes
====================
User profile and address management.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from database import db

router = APIRouter(tags=["Users"])


@router.get("/users/{user_id}")
async def get_user(user_id: str):
    """Get user profile"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/users/{user_id}")
async def update_user(user_id: str, request: dict):
    """Update user profile"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {}
    if request.get("name"):
        update_data["name"] = request["name"]
    if request.get("email"):
        update_data["email"] = request["email"]
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return {"message": "Profile updated", "user": updated}


@router.post("/users/{user_id}/addresses")
async def add_user_address(user_id: str, request: dict):
    """Add a new address for user"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_address = {
        "id": str(uuid.uuid4()),
        "label": request.get("label", "Home"),
        "full_address": request.get("full_address", ""),
        "lat": request.get("lat"),
        "lng": request.get("lng"),
        "is_default": request.get("is_default", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If this is default, unset other defaults
    if new_address["is_default"]:
        addresses = user.get("addresses", [])
        for addr in addresses:
            addr["is_default"] = False
        await db.users.update_one({"id": user_id}, {"$set": {"addresses": addresses}})
    
    await db.users.update_one(
        {"id": user_id},
        {"$push": {"addresses": new_address}}
    )
    
    return {"message": "Address added", "address": new_address}


@router.delete("/users/{user_id}/addresses/{address_id}")
async def delete_user_address(user_id: str, address_id: str):
    """Delete a user address"""
    result = await db.users.update_one(
        {"id": user_id},
        {"$pull": {"addresses": {"id": address_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Address not found")
    
    return {"message": "Address deleted"}
