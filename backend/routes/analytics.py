"""
Food Key Analytics Routes
=========================
Analytics and reporting for restaurants and delivery partners.
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException

from database import db
from config import PLATFORM_COMMISSION_RATE, DELIVERY_PARTNER_SHARE

router = APIRouter(tags=["Analytics"])


@router.get("/analytics/restaurant/{restaurant_id}")
async def get_restaurant_analytics(restaurant_id: str, days: int = 30):
    """Get analytics for a restaurant"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Get orders in time range
    orders = await db.orders.find({
        "restaurant_id": restaurant_id,
        "created_at": {"$gte": start_date}
    }, {"_id": 0}).to_list(1000)
    
    # Calculate metrics
    total_orders = len(orders)
    delivered_orders = [o for o in orders if o.get("status") == "delivered"]
    cancelled_orders = [o for o in orders if o.get("status") == "cancelled"]
    
    total_revenue = sum(o.get("total_amount", 0) - o.get("delivery_fee", 0) for o in delivered_orders)
    platform_fee = total_revenue * PLATFORM_COMMISSION_RATE
    net_revenue = total_revenue - platform_fee
    
    # Daily breakdown
    daily_stats = {}
    for order in orders:
        date = order.get("created_at", "")[:10]
        if date not in daily_stats:
            daily_stats[date] = {"orders": 0, "revenue": 0, "delivered": 0, "cancelled": 0}
        daily_stats[date]["orders"] += 1
        if order.get("status") == "delivered":
            daily_stats[date]["delivered"] += 1
            daily_stats[date]["revenue"] += order.get("total_amount", 0) - order.get("delivery_fee", 0)
        elif order.get("status") == "cancelled":
            daily_stats[date]["cancelled"] += 1
    
    # Popular items
    item_counts = {}
    for order in delivered_orders:
        for item in order.get("items", []):
            name = item.get("name", "Unknown")
            item_counts[name] = item_counts.get(name, 0) + item.get("quantity", 1)
    
    top_items = sorted(item_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # Average order value
    avg_order_value = total_revenue / len(delivered_orders) if delivered_orders else 0
    
    return {
        "period": f"Last {days} days",
        "summary": {
            "total_orders": total_orders,
            "delivered_orders": len(delivered_orders),
            "cancelled_orders": len(cancelled_orders),
            "total_revenue": round(total_revenue, 2),
            "platform_fee": round(platform_fee, 2),
            "net_revenue": round(net_revenue, 2),
            "avg_order_value": round(avg_order_value, 2),
            "completion_rate": round(len(delivered_orders) / total_orders * 100, 1) if total_orders else 0
        },
        "daily_breakdown": [{"date": k, **v} for k, v in sorted(daily_stats.items())],
        "top_items": [{"name": name, "quantity": qty} for name, qty in top_items]
    }


@router.get("/analytics/delivery/{partner_id}")
async def get_delivery_partner_analytics(partner_id: str, days: int = 30):
    """Get analytics for a delivery partner"""
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Get deliveries in time range
    orders = await db.orders.find({
        "delivery_partner_id": partner_id,
        "created_at": {"$gte": start_date}
    }, {"_id": 0}).to_list(1000)
    
    # Calculate metrics
    total_deliveries = len([o for o in orders if o.get("status") == "delivered"])
    total_earnings = sum(o.get("delivery_fee", 0) * DELIVERY_PARTNER_SHARE for o in orders if o.get("status") == "delivered")
    
    # COD collection
    cod_collected = sum(
        o.get("total_amount", 0) + o.get("delivery_fee", 0)
        for o in orders
        if o.get("status") == "delivered" and o.get("payment_method") == "cod"
    )
    
    # Daily breakdown
    daily_stats = {}
    for order in orders:
        if order.get("status") != "delivered":
            continue
        date = order.get("delivered_at", order.get("created_at", ""))[:10]
        if date not in daily_stats:
            daily_stats[date] = {"deliveries": 0, "earnings": 0}
        daily_stats[date]["deliveries"] += 1
        daily_stats[date]["earnings"] += order.get("delivery_fee", 0) * DELIVERY_PARTNER_SHARE
    
    # Peak hours
    hour_counts = {}
    for order in orders:
        if order.get("status") == "delivered" and order.get("delivered_at"):
            hour = order["delivered_at"][11:13]
            hour_counts[hour] = hour_counts.get(hour, 0) + 1
    
    peak_hours = sorted(hour_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        "period": f"Last {days} days",
        "summary": {
            "total_deliveries": total_deliveries,
            "total_earnings": round(total_earnings, 2),
            "avg_earnings_per_delivery": round(total_earnings / total_deliveries, 2) if total_deliveries else 0,
            "cod_collected": round(cod_collected, 2)
        },
        "daily_breakdown": [{"date": k, **v} for k, v in sorted(daily_stats.items())],
        "peak_hours": [{"hour": h, "deliveries": c} for h, c in peak_hours]
    }
