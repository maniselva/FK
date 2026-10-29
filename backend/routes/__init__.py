"""
Food Key Routes Package
=======================
All API route modules.
"""

from fastapi import APIRouter

# Import all route modules
from routes.auth import router as auth_router
from routes.admin import router as admin_router
from routes.restaurants import router as restaurants_router
from routes.orders import router as orders_router
from routes.delivery import router as delivery_router
from routes.payments import router as payments_router
from routes.reviews import router as reviews_router
from routes.notifications import router as notifications_router
from routes.promos import router as promos_router
from routes.analytics import router as analytics_router
from routes.custom_orders import router as custom_orders_router
from routes.users import router as users_router
from routes.misc import router as misc_router

# Main API router
api_router = APIRouter(prefix="/api")

# Include all routers
api_router.include_router(auth_router)
api_router.include_router(admin_router)
api_router.include_router(restaurants_router)
api_router.include_router(orders_router)
api_router.include_router(delivery_router)
api_router.include_router(payments_router)
api_router.include_router(reviews_router)
api_router.include_router(notifications_router)
api_router.include_router(promos_router)
api_router.include_router(analytics_router)
api_router.include_router(custom_orders_router)
api_router.include_router(users_router)
api_router.include_router(misc_router)

__all__ = ['api_router']
