"""
Food Key Notification Routes
============================
User notifications and alerts.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from database import db

router = APIRouter(tags=["Notifications"])


@router.get("/notifications/{user_id}")
async def get_notifications(user_id: str, limit: int = 50):
    """Get notifications for a user"""
    notifications = await db.notifications.find(
        {"recipient_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    unread_count = await db.notifications.count_documents({
        "recipient_id": user_id,
        "is_read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Marked as read"}


@router.put("/notifications/{user_id}/read-all")
async def mark_all_notifications_read(user_id: str):
    """Mark all notifications as read for a user"""
    result = await db.notifications.update_many(
        {"recipient_id": user_id, "is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Marked {result.modified_count} notifications as read"}
