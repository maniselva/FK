"""
Food Key Payment Routes
=======================
Payment processing, settlements, and Cashfree integration.
"""

import uuid
import os
import aiohttp
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from pydantic import BaseModel

from database import db
from config import (
    CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_BASE_URL,
    PLATFORM_COMMISSION_RATE, DELIVERY_PARTNER_SHARE
)

router = APIRouter(tags=["Payments"])


class InitiatePaymentRequest(BaseModel):
    order_id: str
    amount: float
    user_phone: str
    user_id: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    origin_url: Optional[str] = None
    is_custom_order: Optional[bool] = False


# ============== CASHFREE PAYMENT ==============

@router.post("/payments/cashfree/initiate")
async def initiate_cashfree_payment(request: InitiatePaymentRequest, http_request: Request):
    """Initiate a Cashfree payment for an order"""
    # Check if order exists (regular or custom)
    if request.is_custom_order:
        order = await db.custom_orders.find_one({"id": request.order_id}, {"_id": 0})
    else:
        order = await db.orders.find_one({"id": request.order_id}, {"_id": 0})
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")
    
    cf_order_id = f"FK_{request.order_id[:8]}_{str(uuid.uuid4())[:8]}".upper()
    
    frontend_url = request.origin_url
    if not frontend_url:
        referer = http_request.headers.get("referer", "")
        if referer:
            from urllib.parse import urlparse
            parsed = urlparse(referer)
            frontend_url = f"{parsed.scheme}://{parsed.netloc}"
    
    return_url = f"{frontend_url}/payment-status?order_id={request.order_id}"
    
    # Create Cashfree order
    cashfree_payload = {
        "order_id": cf_order_id,
        "order_amount": request.amount,
        "order_currency": "INR",
        "customer_details": {
            "customer_id": request.user_id[:50],
            "customer_phone": request.user_phone,
            "customer_email": request.user_email or "customer@foodkey.in",
            "customer_name": request.user_name or "Customer"
        },
        "order_meta": {
            "return_url": return_url,
            "notify_url": f"{frontend_url}/api/payments/cashfree/webhook"
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "x-api-version": "2023-08-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{CASHFREE_BASE_URL}/orders",
            json=cashfree_payload,
            headers=headers
        ) as response:
            cf_response = await response.json()
            
            if response.status != 200:
                raise HTTPException(
                    status_code=500,
                    detail=f"Payment initiation failed: {cf_response.get('message', 'Unknown error')}"
                )
    
    # Store payment record
    payment_record = {
        "id": str(uuid.uuid4()),
        "order_id": request.order_id,
        "cf_order_id": cf_order_id,
        "amount": request.amount,
        "status": "initiated",
        "payment_gateway": "cashfree",
        "is_custom_order": request.is_custom_order,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payments.insert_one(payment_record)
    
    # Update order with Cashfree order ID
    collection = db.custom_orders if request.is_custom_order else db.orders
    await collection.update_one(
        {"id": request.order_id},
        {"$set": {
            "cf_order_id": cf_order_id,
            "payment_method": "online",
            "payment_status": "pending",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "cf_order_id": cf_order_id,
        "payment_session_id": cf_response.get("payment_session_id"),
        "order_status": cf_response.get("order_status")
    }


@router.get("/payments/cashfree/status/{order_id}")
async def get_payment_status(order_id: str):
    """Get payment status for an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        order = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    cf_order_id = order.get("cf_order_id")
    if not cf_order_id:
        return {"status": order.get("payment_status", "pending")}
    
    # Check with Cashfree
    headers = {
        "x-api-version": "2023-08-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{CASHFREE_BASE_URL}/orders/{cf_order_id}",
            headers=headers
        ) as response:
            if response.status == 200:
                cf_data = await response.json()
                return {
                    "status": cf_data.get("order_status"),
                    "payment_status": order.get("payment_status"),
                    "cf_order_id": cf_order_id
                }
    
    return {"status": order.get("payment_status", "pending")}


@router.post("/payments/cashfree/webhook")
async def cashfree_webhook(request: Request):
    """Handle Cashfree payment webhook"""
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payload")
    
    event_type = payload.get("type")
    data = payload.get("data", {})
    
    if event_type == "PAYMENT_SUCCESS_WEBHOOK":
        cf_order_id = data.get("order", {}).get("order_id")
        
        # Find order by cf_order_id
        order = await db.orders.find_one({"cf_order_id": cf_order_id}, {"_id": 0})
        is_custom = False
        if not order:
            order = await db.custom_orders.find_one({"cf_order_id": cf_order_id}, {"_id": 0})
            is_custom = True
        
        if order:
            collection = db.custom_orders if is_custom else db.orders
            await collection.update_one(
                {"cf_order_id": cf_order_id},
                {"$set": {
                    "payment_status": "paid",
                    "paid_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Update payment record
            await db.payments.update_one(
                {"cf_order_id": cf_order_id},
                {"$set": {"status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}}
            )
    
    return {"status": "ok"}


@router.get("/payments/cashfree/verify/{cf_order_id}")
async def verify_payment(cf_order_id: str):
    """Verify a Cashfree payment"""
    headers = {
        "x-api-version": "2023-08-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{CASHFREE_BASE_URL}/orders/{cf_order_id}/payments",
            headers=headers
        ) as response:
            if response.status == 200:
                payments = await response.json()
                return {"payments": payments}
            else:
                raise HTTPException(status_code=404, detail="Payment not found")


# ============== ADMIN PAYMENT MANAGEMENT ==============

@router.get("/admin/payments/restaurants")
async def get_restaurant_payments(page: int = 1, limit: int = 20):
    """Get restaurant payment/payout summary"""
    # Get all delivered orders
    orders = await db.orders.find(
        {"status": "delivered"},
        {"_id": 0}
    ).sort("delivered_at", -1).to_list(500)
    
    # Group by restaurant
    restaurant_payments = {}
    for order in orders:
        rid = order.get("restaurant_id")
        if rid not in restaurant_payments:
            restaurant = await db.restaurants.find_one({"id": rid}, {"_id": 0, "name": 1})
            restaurant_payments[rid] = {
                "_id": rid,
                "restaurant_name": restaurant.get("name") if restaurant else "Unknown",
                "total_orders": 0,
                "total_amount": 0,
                "pending_payout": 0,
                "orders": []
            }
        
        order_amount = order.get("total_amount", 0) - order.get("delivery_fee", 0)
        platform_fee = order_amount * PLATFORM_COMMISSION_RATE
        payout = order_amount - platform_fee
        
        restaurant_payments[rid]["total_orders"] += 1
        restaurant_payments[rid]["total_amount"] += order_amount
        
        if order.get("restaurant_payout_status") != "cleared":
            restaurant_payments[rid]["pending_payout"] += payout
        
        restaurant_payments[rid]["orders"].append({
            "id": order["id"],
            "total_amount": order.get("total_amount"),
            "delivered_at": order.get("delivered_at"),
            "restaurant_payout_status": order.get("restaurant_payout_status"),
            "cleared_date": order.get("restaurant_cleared_date"),
            "clear_comment": order.get("restaurant_clear_comment"),
            "calculated_restaurant_payout": round(payout, 2)
        })
    
    return {
        "restaurants": list(restaurant_payments.values()),
        "orders": orders
    }


@router.put("/admin/payments/restaurants/{order_id}/clear")
async def clear_restaurant_payment(order_id: str, request: dict):
    """Mark restaurant payment as cleared for an order"""
    comment = request.get("comment", "")
    
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "restaurant_payout_status": "cleared",
            "restaurant_cleared_date": datetime.now(timezone.utc).isoformat(),
            "restaurant_clear_comment": comment
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"message": "Payment cleared"}


@router.put("/admin/payments/restaurants/bulk-clear")
async def bulk_clear_restaurant_payments(request: dict):
    """Clear all pending payments for a restaurant"""
    restaurant_id = request.get("restaurant_id")
    comment = request.get("comment", "Bulk cleared by admin")
    
    result = await db.orders.update_many(
        {
            "restaurant_id": restaurant_id,
            "status": "delivered",
            "restaurant_payout_status": {"$ne": "cleared"}
        },
        {"$set": {
            "restaurant_payout_status": "cleared",
            "restaurant_cleared_date": datetime.now(timezone.utc).isoformat(),
            "restaurant_clear_comment": comment
        }}
    )
    
    return {"message": f"Cleared {result.modified_count} payments"}


@router.get("/admin/payments/delivery-partners")
async def get_delivery_partner_payments(page: int = 1, limit: int = 20):
    """Get delivery partner payment summary"""
    orders = await db.orders.find(
        {"status": "delivered", "delivery_partner_id": {"$exists": True}},
        {"_id": 0}
    ).sort("delivered_at", -1).to_list(500)
    
    partner_payments = {}
    for order in orders:
        pid = order.get("delivery_partner_id")
        if pid not in partner_payments:
            partner = await db.delivery_partners.find_one({"id": pid}, {"_id": 0, "name": 1})
            partner_payments[pid] = {
                "_id": pid,
                "partner_name": partner.get("name") if partner else "Unknown",
                "total_deliveries": 0,
                "total_earnings": 0,
                "total_cod_collected": 0,
                "cod_to_return": 0,
                "orders": []
            }
        
        delivery_fee = order.get("delivery_fee", 0)
        earning = delivery_fee * DELIVERY_PARTNER_SHARE
        
        cod_collected = 0
        cod_to_return = 0
        if order.get("payment_method") == "cod":
            cod_collected = order.get("total_amount", 0) + delivery_fee
            cod_to_return = cod_collected - earning
        
        partner_payments[pid]["total_deliveries"] += 1
        partner_payments[pid]["total_earnings"] += earning
        partner_payments[pid]["total_cod_collected"] += cod_collected
        
        if order.get("delivery_settlement_status") != "cleared":
            partner_payments[pid]["cod_to_return"] += cod_to_return
        
        partner_payments[pid]["orders"].append({
            "id": order["id"],
            "restaurant_name": order.get("restaurant_name"),
            "delivery_fee": delivery_fee,
            "total_amount": order.get("total_amount"),
            "payment_method": order.get("payment_method"),
            "delivery_settlement_status": order.get("delivery_settlement_status"),
            "delivery_cleared_date": order.get("delivery_cleared_date"),
            "delivery_clear_comment": order.get("delivery_clear_comment")
        })
    
    return {
        "partners": list(partner_payments.values()),
        "orders": orders
    }


@router.put("/admin/payments/delivery-partners/{order_id}/clear")
async def clear_delivery_payment(order_id: str, request: dict):
    """Mark delivery partner payment as cleared for an order"""
    comment = request.get("comment", "")
    
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "delivery_settlement_status": "cleared",
            "delivery_cleared_date": datetime.now(timezone.utc).isoformat(),
            "delivery_clear_comment": comment
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"message": "Payment cleared"}


# ============== PARTNER-FACING PAYMENTS ==============

@router.get("/restaurant/{restaurant_id}/payments")
async def get_restaurant_payment_history(restaurant_id: str):
    """Get payment history for a restaurant"""
    orders = await db.orders.find(
        {"restaurant_id": restaurant_id, "status": "delivered"},
        {"_id": 0}
    ).sort("delivered_at", -1).to_list(100)
    
    total_earnings = 0
    pending_payout = 0
    
    for order in orders:
        order_amount = order.get("total_amount", 0) - order.get("delivery_fee", 0)
        platform_fee = order_amount * PLATFORM_COMMISSION_RATE
        payout = order_amount - platform_fee
        
        total_earnings += payout
        if order.get("restaurant_payout_status") != "cleared":
            pending_payout += payout
    
    return {
        "orders": orders,
        "summary": {
            "total_earnings": round(total_earnings, 2),
            "pending_payout": round(pending_payout, 2),
            "cleared_amount": round(total_earnings - pending_payout, 2)
        }
    }


@router.get("/delivery-partners/{partner_id}/payments")
async def get_delivery_partner_payment_history(partner_id: str):
    """Get payment history for a delivery partner"""
    orders = await db.orders.find(
        {"delivery_partner_id": partner_id, "status": "delivered"},
        {"_id": 0}
    ).sort("delivered_at", -1).to_list(100)
    
    total_earnings = 0
    pending_settlement = 0
    
    for order in orders:
        earning = order.get("delivery_fee", 0) * DELIVERY_PARTNER_SHARE
        total_earnings += earning
        
        if order.get("delivery_settlement_status") != "cleared":
            if order.get("payment_method") == "cod":
                cod_collected = order.get("total_amount", 0) + order.get("delivery_fee", 0)
                pending_settlement += cod_collected - earning
    
    return {
        "orders": orders,
        "summary": {
            "total_earnings": round(total_earnings, 2),
            "pending_settlement": round(pending_settlement, 2)
        }
    }


# ============== COD SETTLEMENT ADMIN ==============

@router.get("/admin/cod-settlements")
async def get_all_cod_settlements(status: Optional[str] = None):
    """Get all COD settlements for admin"""
    query = {}
    if status:
        query["status"] = status
    
    settlements = await db.cod_settlements.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return settlements


@router.post("/admin/cod-settlements/{settlement_id}/approve")
async def approve_cod_settlement(settlement_id: str, request: dict):
    """Approve or reject a COD settlement"""
    action = request.get("action", "approve")
    admin_comment = request.get("comment", "")
    
    update_data = {
        "status": "approved" if action == "approve" else "rejected",
        "admin_comment": admin_comment,
        "processed_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.cod_settlements.update_one(
        {"id": settlement_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Settlement not found")
    
    settlement = await db.cod_settlements.find_one({"id": settlement_id}, {"_id": 0})
    
    # Notify partner
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "delivery",
        "recipient_id": settlement.get("partner_id"),
        "type": "cod_settlement",
        "title": f"COD Settlement {action.title()}d",
        "message": f"Your COD settlement of ₹{settlement.get('amount')} has been {action}d." + (f" Note: {admin_comment}" if admin_comment else ""),
        "data": {"settlement_id": settlement_id},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": f"Settlement {action}d", "settlement": settlement}


# ============== RESTAURANT PAYOUTS ADMIN ==============

@router.get("/admin/restaurant-payouts")
async def get_restaurant_payouts():
    """Get all restaurant payouts for admin"""
    payouts = await db.restaurant_payouts.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return payouts


@router.post("/admin/restaurant-payouts/clear")
async def create_restaurant_payout(request: dict):
    """Create a restaurant payout record"""
    payout = {
        "id": str(uuid.uuid4()),
        "restaurant_id": request.get("restaurant_id"),
        "amount": request.get("amount"),
        "comment": request.get("comment", ""),
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.restaurant_payouts.insert_one(payout)
    payout.pop("_id", None)
    
    return {"message": "Payout recorded", "payout": payout}


@router.get("/restaurant/payouts/{restaurant_id}")
async def get_restaurant_payouts_history(restaurant_id: str):
    """Get payout history for a restaurant"""
    payouts = await db.restaurant_payouts.find(
        {"restaurant_id": restaurant_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return payouts


@router.post("/restaurant/payouts/{restaurant_id}/comment")
async def add_payout_comment(restaurant_id: str, request: dict):
    """Restaurant adds comment to a payout"""
    payout_id = request.get("payout_id")
    comment = request.get("comment", "")
    
    result = await db.restaurant_payouts.update_one(
        {"id": payout_id, "restaurant_id": restaurant_id},
        {"$set": {"restaurant_comment": comment}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payout not found")
    
    return {"message": "Comment added"}
