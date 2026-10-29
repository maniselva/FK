"""
Food Key Push Notification Service
==================================
Web Push notifications via VAPID.
"""

import logging
import json
from pywebpush import webpush, WebPushException
from config import VAPID_PRIVATE_KEY, VAPID_CLAIMS_EMAIL
from database import db


async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """Send push notification to all subscribed devices for a user"""
    if not VAPID_PRIVATE_KEY:
        logging.warning("VAPID_PRIVATE_KEY not set, skipping push notification")
        return
    
    subscriptions = await db.push_subscriptions.find({"user_id": user_id}).to_list(100)
    
    if not subscriptions:
        logging.info(f"No push subscriptions found for user {user_id}")
        return
    
    payload = json.dumps({
        "title": title,
        "body": body,
        "icon": "/favicon.ico",
        "badge": "/favicon.ico",
        "data": data or {},
        "tag": f"foodkey-{data.get('type', 'notification') if data else 'notification'}",
        "requireInteraction": True
    })
    
    vapid_claims = {"sub": VAPID_CLAIMS_EMAIL}
    
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"]
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=vapid_claims
            )
            logging.info(f"Push notification sent to user {user_id}")
        except WebPushException as e:
            logging.error(f"Push notification failed: {e}")
            # If subscription is invalid, remove it
            if e.response and e.response.status_code in [404, 410]:
                await db.push_subscriptions.delete_one({"id": sub["id"]})
                logging.info(f"Removed invalid subscription for user {user_id}")
        except Exception as e:
            logging.error(f"Push notification error: {e}")
