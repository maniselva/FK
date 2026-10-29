"""
Food Key Review Routes
======================
Customer reviews and ratings management.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from typing import Optional

from database import db

router = APIRouter(tags=["Reviews"])


# ============== REVIEW SUBMISSION ==============

@router.post("/reviews")
async def submit_review(request: dict):
    """Submit a customer review"""
    order_id = request.get("order_id")
    restaurant_id = request.get("restaurant_id")
    user_id = request.get("user_id")
    rating = request.get("rating", 5)
    
    if not order_id or not restaurant_id or not user_id:
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    # Check if already reviewed
    existing = await db.reviews.find_one({"order_id": order_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Order already reviewed")
    
    review = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "restaurant_id": restaurant_id,
        "user_id": user_id,
        "user_name": request.get("user_name", "Customer"),
        "rating": rating,
        "comment": request.get("comment"),
        "delivery_partner_id": request.get("delivery_partner_id"),
        "delivery_rating": request.get("delivery_rating"),
        "delivery_comment": request.get("delivery_comment"),
        "status": "pending",  # Pending admin approval
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reviews.insert_one(review)
    review.pop("_id", None)
    
    return {"message": "Review submitted for approval", "review": review}


@router.get("/reviews/restaurant/{restaurant_id}")
async def get_restaurant_reviews(restaurant_id: str):
    """Get approved reviews for a restaurant"""
    reviews = await db.reviews.find(
        {"restaurant_id": restaurant_id, "status": "approved"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return reviews


@router.get("/reviews/check/{order_id}")
async def check_review_exists(order_id: str):
    """Check if an order has been reviewed"""
    review = await db.reviews.find_one({"order_id": order_id}, {"_id": 0})
    return {"reviewed": review is not None, "review": review}


@router.get("/reviews/user/{user_id}")
async def get_user_reviews(user_id: str):
    """Get all reviews by a user"""
    reviews = await db.reviews.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"reviews": reviews}


# ============== ADMIN REVIEW MANAGEMENT ==============

@router.get("/admin/reviews")
async def admin_get_reviews(status: Optional[str] = None, page: int = 1, limit: int = 20):
    """Get all reviews for admin"""
    query = {}
    if status:
        query["status"] = status
    
    skip = (page - 1) * limit
    reviews = await db.reviews.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    total = await db.reviews.count_documents(query)
    
    # Enrich with order and restaurant data
    for review in reviews:
        order = await db.orders.find_one({"id": review.get("order_id")}, {"_id": 0, "total_amount": 1, "items": 1})
        restaurant = await db.restaurants.find_one({"id": review.get("restaurant_id")}, {"_id": 0, "name": 1})
        review["order"] = order
        review["restaurant"] = restaurant
    
    return {
        "reviews": reviews,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.put("/admin/reviews/{review_id}")
async def admin_update_review(review_id: str, request: dict):
    """Admin approves, rejects, or edits a review"""
    review = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if "status" in request:
        update_data["status"] = request["status"]
    if "rating" in request:
        update_data["rating"] = request["rating"]
    if "comment" in request:
        update_data["comment"] = request["comment"]
    if "delivery_rating" in request:
        update_data["delivery_rating"] = request["delivery_rating"]
    if "delivery_comment" in request:
        update_data["delivery_comment"] = request["delivery_comment"]
    if "admin_notes" in request:
        update_data["admin_notes"] = request["admin_notes"]
    
    await db.reviews.update_one({"id": review_id}, {"$set": update_data})
    
    # If approved, update restaurant rating
    if request.get("status") == "approved":
        await update_restaurant_rating(review["restaurant_id"])
        
        # Update delivery partner rating if applicable
        if review.get("delivery_partner_id") and review.get("delivery_rating"):
            await update_delivery_partner_rating(review["delivery_partner_id"])
    
    updated = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    return {"message": "Review updated", "review": updated}


@router.delete("/admin/reviews/{review_id}")
async def admin_delete_review(review_id: str):
    """Admin deletes a review"""
    review = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    await db.reviews.delete_one({"id": review_id})
    
    # Recalculate restaurant rating
    await update_restaurant_rating(review["restaurant_id"])
    
    return {"message": "Review deleted"}


# ============== RATING CALCULATION HELPERS ==============

async def update_restaurant_rating(restaurant_id: str):
    """Recalculate and update restaurant rating from approved reviews"""
    reviews = await db.reviews.find(
        {"restaurant_id": restaurant_id, "status": "approved"},
        {"_id": 0, "rating": 1}
    ).to_list(1000)
    
    if reviews:
        avg_rating = sum(r["rating"] for r in reviews) / len(reviews)
        await db.restaurants.update_one(
            {"id": restaurant_id},
            {"$set": {
                "rating": round(avg_rating, 1),
                "review_count": len(reviews)
            }}
        )


async def update_delivery_partner_rating(partner_id: str):
    """Recalculate and update delivery partner rating from approved reviews"""
    reviews = await db.reviews.find(
        {"delivery_partner_id": partner_id, "status": "approved", "delivery_rating": {"$exists": True}},
        {"_id": 0, "delivery_rating": 1}
    ).to_list(1000)
    
    if reviews:
        avg_rating = sum(r["delivery_rating"] for r in reviews if r.get("delivery_rating")) / len(reviews)
        await db.delivery_partners.update_one(
            {"id": partner_id},
            {"$set": {
                "rating": round(avg_rating, 1),
                "review_count": len(reviews)
            }}
        )
