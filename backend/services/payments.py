"""
Food Key Payments Service
=========================
Cashfree payment gateway integration.
"""

import logging
import hashlib
import base64
import aiohttp
from config import (
    CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_BASE_URL,
    PLATFORM_COMMISSION_RATE, DELIVERY_PARTNER_SHARE
)


def verify_cashfree_webhook_signature(payload: str, timestamp: str, received_signature: str) -> bool:
    """Verify Cashfree webhook signature using HMAC-SHA256"""
    try:
        import hmac
        signed_content = f"{timestamp}.{payload}"
        signature_bytes = hmac.new(
            CASHFREE_SECRET_KEY.encode('utf-8'),
            signed_content.encode('utf-8'),
            hashlib.sha256
        ).digest()
        expected_signature = base64.b64encode(signature_bytes).decode('utf-8')
        return hmac.compare_digest(expected_signature, received_signature)
    except Exception as e:
        logging.error(f"Cashfree signature verification error: {e}")
        return False


async def create_cashfree_order(
    order_id: str,
    order_amount: float,
    customer_id: str,
    customer_phone: str,
    customer_email: str,
    customer_name: str,
    return_url: str,
    notify_url: str
) -> dict:
    """Create a Cashfree order"""
    try:
        url = f"{CASHFREE_BASE_URL}/orders"
        headers = {
            "accept": "application/json",
            "Content-Type": "application/json",
            "x-api-version": "2023-08-01",
            "x-client-id": CASHFREE_APP_ID,
            "x-client-secret": CASHFREE_SECRET_KEY
        }
        
        payload = {
            "order_id": order_id,
            "order_amount": order_amount,
            "order_currency": "INR",
            "customer_details": {
                "customer_id": customer_id,
                "customer_phone": customer_phone,
                "customer_email": customer_email or "customer@foodkey.in",
                "customer_name": customer_name or "Customer"
            },
            "order_meta": {
                "return_url": return_url,
                "notify_url": notify_url
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=payload) as response:
                result = await response.json()
                logging.info(f"Cashfree order creation response: {result}")
                return result
                
    except Exception as e:
        logging.error(f"Cashfree order creation error: {e}")
        return {"error": str(e)}


async def get_cashfree_order_status(order_id: str) -> dict:
    """Get Cashfree order status"""
    try:
        url = f"{CASHFREE_BASE_URL}/orders/{order_id}"
        headers = {
            "accept": "application/json",
            "x-api-version": "2023-08-01",
            "x-client-id": CASHFREE_APP_ID,
            "x-client-secret": CASHFREE_SECRET_KEY
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers) as response:
                result = await response.json()
                logging.info(f"Cashfree order status response: {result}")
                return result
                
    except Exception as e:
        logging.error(f"Cashfree order status error: {e}")
        return {"error": str(e)}


async def get_cashfree_payments(order_id: str) -> dict:
    """Get payments for a Cashfree order"""
    try:
        url = f"{CASHFREE_BASE_URL}/orders/{order_id}/payments"
        headers = {
            "accept": "application/json",
            "x-api-version": "2023-08-01",
            "x-client-id": CASHFREE_APP_ID,
            "x-client-secret": CASHFREE_SECRET_KEY
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers) as response:
                result = await response.json()
                logging.info(f"Cashfree payments response: {result}")
                return result
                
    except Exception as e:
        logging.error(f"Cashfree payments error: {e}")
        return {"error": str(e)}


def calculate_order_payments(order: dict) -> dict:
    """Calculate payment splits for an order"""
    total_amount = order.get("total_amount", 0)
    delivery_fee = order.get("delivery_fee", 0)
    
    # Restaurant gets: total_amount - platform commission (1%)
    platform_commission_food = total_amount * PLATFORM_COMMISSION_RATE
    restaurant_payout = total_amount - platform_commission_food
    
    # Delivery partner gets: 95% of delivery fee
    delivery_partner_earning = delivery_fee * DELIVERY_PARTNER_SHARE
    platform_commission_delivery = delivery_fee * (1 - DELIVERY_PARTNER_SHARE)
    
    # Total platform commission
    total_platform_commission = platform_commission_food + platform_commission_delivery
    
    return {
        "restaurant_payout": round(restaurant_payout, 2),
        "delivery_partner_earning": round(delivery_partner_earning, 2),
        "platform_commission": round(total_platform_commission, 2),
        "cod_collected": round(total_amount + delivery_fee, 2) if order.get("payment_method") == "cod" else 0
    }
