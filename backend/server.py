"""
Food Key API Server
====================
A comprehensive food delivery platform API.

TABLE OF CONTENTS:
------------------
Line 62:   OLA MAPS HELPER FUNCTIONS
Line 171:  PUSH NOTIFICATION HELPER
Line 218:  WEBSOCKET CONNECTION MANAGER
Line 267:  HELPER FUNCTIONS
Line 277:  PYDANTIC MODELS (Database Entities)
Line 488:  REQUEST/RESPONSE MODELS
Line 652:  AUTH ENDPOINTS (Customer login)
Line 761:  ADMIN AUTH ENDPOINTS
Line 962:  ADMIN DASHBOARD ENDPOINTS
Line 1254: ADMIN ORDER HISTORY
Line 1414: ADMIN RESTAURANT MANAGEMENT
Line 1431: PAYMENT & SETTLEMENT MANAGEMENT
Line 1803: ADMIN RESTAURANT CRUD
Line 1898: ADMIN DELIVERY PARTNER MANAGEMENT
Line 2019: ADMIN RESTAURANT APPROVAL
Line 2130: NOTIFICATIONS ENDPOINTS
Line 2169: DELIVERY PARTNER LOCATION & ORDERS
Line 2309: DELIVERY PARTNER EARNINGS
Line 2400: USER PROFILE ENDPOINTS
Line 2500: RESTAURANT ENDPOINTS (Public)
Line 2600: ORDER ENDPOINTS
Line 2800: RESTAURANT DASHBOARD
Line 3000: PROMO/COUPON MANAGEMENT
Line 3200: TRACKING ENDPOINTS
Line 3400: PUSH NOTIFICATION ENDPOINTS
Line 3500: FEEDBACK ENDPOINTS
Line 3600: T-SHIRT ORDER ENDPOINTS
Line 3700: REVIEW ENDPOINTS
Line 4300: DELIVERY FEE CALCULATION
Line 4400: FILE UPLOAD ENDPOINTS
Line 4600: SEED DATA
Line 4916: ROOT ENDPOINT
Line 4922: WEBSOCKET ENDPOINTS

PAYMENT STRUCTURE:
------------------
- Restaurant Share: 95% of order value (5% platform fee)
- Delivery Partner: 95% of delivery fee
- Company: 5% of order + 5% of delivery fee
"""

from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, UploadFile, File, Request
from fastapi.responses import JSONResponse
from starlette import status as http_status
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import logging
import re
import html
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import random
import string
import hashlib
import json
import asyncio
import base64
import aiohttp
import math
import socket
from pywebpush import webpush, WebPushException

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(
    title="Food Key API",
    docs_url=None,  # Disable Swagger UI in production
    redoc_url=None,  # Disable ReDoc in production
    openapi_url=None  # Disable OpenAPI schema in production
)

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(self), microphone=()"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Input sanitization helper
def sanitize_input(text: str) -> str:
    """Sanitize user input to prevent XSS attacks"""
    if not text:
        return text
    # HTML escape special characters
    sanitized = html.escape(text, quote=True)
    # Remove any script tags that might have been encoded
    sanitized = re.sub(r'(?i)<script[^>]*>.*?</script>', '', sanitized)
    return sanitized

def validate_phone(phone: str) -> bool:
    """Validate phone number format"""
    return bool(re.match(r'^[6-9]\d{9}$', phone))

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Super Admin Phone (first admin)
SUPER_ADMIN_PHONE = os.environ.get("SUPER_ADMIN_PHONE", "")
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', "")
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_CLAIMS_EMAIL = os.environ.get('VAPID_CLAIMS_EMAIL', "")

# Ola Maps API credentials
OLA_MAPS_API_KEY = os.environ.get('OLA_MAPS_API_KEY', '')
OLA_MAPS_CLIENT_ID = os.environ.get('OLA_MAPS_CLIENT_ID', '')
OLA_MAPS_CLIENT_SECRET = os.environ.get('OLA_MAPS_CLIENT_SECRET', '')
OLA_MAPS_TOKEN_URL = "https://account.olamaps.io/realms/olamaps/protocol/openid-connect/token"
OLA_MAPS_DIRECTIONS_URL = "https://api.olamaps.io/routing/v1/directions/basic"
OLA_MAPS_AUTOCOMPLETE_URL = "https://api.olamaps.io/places/v1/autocomplete"
OLA_MAPS_GEOCODE_URL = "https://api.olamaps.io/places/v1/geocode"
OLA_MAPS_REVERSE_GEOCODE_URL = "https://api.olamaps.io/places/v1/reverse-geocode"

# Cashfree Payment Gateway credentials
CASHFREE_APP_ID = os.environ.get('CASHFREE_APP_ID', '')
CASHFREE_SECRET_KEY = os.environ.get('CASHFREE_SECRET_KEY', '')
CASHFREE_ENV = os.environ.get('CASHFREE_ENV', 'production')
CASHFREE_BASE_URL = "https://sandbox.cashfree.com/pg" if CASHFREE_ENV == 'sandbox' else "https://api.cashfree.com/pg"

# Mapbox API credentials
MAPBOX_SECRET_TOKEN = os.environ.get('MAPBOX_SECRET_TOKEN', '')
MAPBOX_PUBLIC_TOKEN = os.environ.get('MAPBOX_PUBLIC_TOKEN', '')
MAPBOX_API_BASE = "https://api.mapbox.com"

# Google Maps API credentials
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', '')
GOOGLE_MAPS_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
GOOGLE_MAPS_PLACES_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
GOOGLE_MAPS_PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
GOOGLE_MAPS_DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"
GOOGLE_MAPS_DISTANCE_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"

# Cache for Ola Maps access token
ola_maps_token_cache = {
    "access_token": None,
    "expires_at": None
}


# ────────────────────────── Auth Guards ──────────────────────────
# Implementation extracted to /app/backend/auth_dependencies.py
# These thin wrappers preserve the existing call sites within server.py and
# pass the local `db` handle to the shared implementations.
from auth_dependencies import (
    require_admin as _require_admin_impl,
    require_delivery_partner_self_or_admin as _require_partner_impl,
)


async def require_admin(request: Request):
    return await _require_admin_impl(db, request)


async def require_delivery_partner_self_or_admin(request: Request, user_id: str = None, partner_id: str = None):
    return await _require_partner_impl(db, request, user_id=user_id, partner_id=partner_id)
# ─────────────────────────────────────────────────────────────────



# ============== OLA MAPS HELPER FUNCTIONS ==============

async def get_ola_maps_token():
    """Get Ola Maps access token (with caching) using OAuth"""
    global ola_maps_token_cache
    
    # Check if we have a valid cached token
    if ola_maps_token_cache["access_token"] and ola_maps_token_cache["expires_at"]:
        if datetime.now(timezone.utc) < ola_maps_token_cache["expires_at"]:
            return ola_maps_token_cache["access_token"]
    
    # Get new token via OAuth
    if not OLA_MAPS_CLIENT_ID or not OLA_MAPS_CLIENT_SECRET:
        logging.warning("Ola Maps credentials not configured")
        return None
    
    try:
        async with aiohttp.ClientSession() as session:
            data = {
                "grant_type": "client_credentials",
                "scope": "openid",
                "client_id": OLA_MAPS_CLIENT_ID,
                "client_secret": OLA_MAPS_CLIENT_SECRET
            }
            async with session.post(OLA_MAPS_TOKEN_URL, data=data) as response:
                if response.status == 200:
                    result = await response.json()
                    access_token = result.get("access_token")
                    expires_in = result.get("expires_in", 3600)
                    
                    # Cache the token
                    ola_maps_token_cache["access_token"] = access_token
                    ola_maps_token_cache["expires_at"] = datetime.now(timezone.utc) + timedelta(seconds=expires_in - 60)
                    
                    logging.info("Ola Maps token obtained successfully")
                    return access_token
                else:
                    error_text = await response.text()
                    logging.error(f"Failed to get Ola Maps token: {response.status} - {error_text}")
                    return None
    except Exception as e:
        logging.error(f"Ola Maps token error: {e}")
        return None

async def get_directions(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float):
    """Get directions between two points using Ola Maps"""
    token = await get_ola_maps_token()
    if not token:
        return None
    
    try:
        async with aiohttp.ClientSession() as session:
            url = f"{OLA_MAPS_DIRECTIONS_URL}?origin={origin_lat},{origin_lng}&destination={dest_lat},{dest_lng}"
            headers = {"Authorization": f"Bearer {token}"}
            
            async with session.post(url, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    return result
                else:
                    error_text = await response.text()
                    logging.error(f"Ola Maps directions error: {response.status} - {error_text}")
                    return None
    except Exception as e:
        logging.error(f"Ola Maps directions error: {e}")
        return None

async def search_places(query: str):
    """Search places using Ola Maps autocomplete with OpenStreetMap fallback"""
    # Try Ola Maps with OAuth token
    token = await get_ola_maps_token()
    if token:
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{OLA_MAPS_AUTOCOMPLETE_URL}?input={query}"
                headers = {"Authorization": f"Bearer {token}"}
                
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        result = await response.json()
                        logging.info(f"Ola Maps autocomplete success for: {query}")
                        return result
                    else:
                        error_text = await response.text()
                        logging.error(f"Ola Maps autocomplete error: {response.status} - {error_text}")
        except Exception as e:
            logging.error(f"Ola Maps autocomplete error: {e}")
    
    # Fallback to OpenStreetMap Nominatim
    try:
        async with aiohttp.ClientSession() as session:
            url = f"https://nominatim.openstreetmap.org/search?format=json&q={query}&limit=10&addressdetails=1&countrycodes=in"
            headers = {"User-Agent": "FoodKey/1.0 (food delivery app)"}
            
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if data:
                        # Format response similar to Ola Maps predictions format
                        predictions = []
                        for item in data:
                            predictions.append({
                                "place_id": item.get("place_id", ""),
                                "description": item.get("display_name", ""),
                                "structured_formatting": {
                                    "main_text": item.get("name", item.get("display_name", "").split(",")[0]),
                                    "secondary_text": ", ".join(item.get("display_name", "").split(",")[1:]).strip()
                                },
                                "geometry": {
                                    "location": {
                                        "lat": float(item.get("lat", 0)),
                                        "lng": float(item.get("lon", 0))
                                    }
                                }
                            })
                        return {"predictions": predictions}
                else:
                    logging.error(f"OpenStreetMap search error: {response.status}")
    except Exception as e:
        logging.error(f"OpenStreetMap search error: {e}")
    
    return None

async def reverse_geocode(lat: float, lng: float):
    """Reverse geocode coordinates to address using Ola Maps with OpenStreetMap fallback"""
    # Try Ola Maps with OAuth token
    token = await get_ola_maps_token()
    if token:
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{OLA_MAPS_REVERSE_GEOCODE_URL}?latlng={lat},{lng}"
                headers = {"Authorization": f"Bearer {token}"}
                
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        result = await response.json()
                        logging.info(f"Ola Maps reverse geocode success for: {lat},{lng}")
                        return result
                    else:
                        error_text = await response.text()
                        logging.error(f"Ola Maps reverse geocode error: {response.status} - {error_text}")
        except Exception as e:
            logging.error(f"Ola Maps reverse geocode error: {e}")
    
    # Fallback to OpenStreetMap Nominatim
    try:
        async with aiohttp.ClientSession() as session:
            url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}&zoom=18&addressdetails=1"
            headers = {"User-Agent": "FoodKey/1.0 (food delivery app)"}
            
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if data and data.get("display_name"):
                        # Format response similar to Ola Maps
                        return {
                            "results": [{
                                "formatted_address": data.get("display_name"),
                                "name": data.get("name", ""),
                                "address_components": data.get("address", {})
                            }]
                        }
                else:
                    logging.error(f"OpenStreetMap reverse geocode error: {response.status}")
    except Exception as e:
        logging.error(f"OpenStreetMap reverse geocode error: {e}")
    
    return None

# ============== CASHFREE PAYMENT GATEWAY HELPER FUNCTIONS ==============

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


# ============== MAPBOX HELPER FUNCTIONS ==============

async def mapbox_search_address(query: str, limit: int = 5, proximity: tuple = None):
    """Search for addresses using Mapbox Geocoding API with OpenStreetMap fallback"""
    import urllib.parse
    
    # Try Mapbox first if token is available
    if MAPBOX_PUBLIC_TOKEN:
        try:
            encoded_query = urllib.parse.quote(query)
            url = f"{MAPBOX_API_BASE}/geocoding/v5/mapbox.places/{encoded_query}.json"
            
            params = {
                "access_token": MAPBOX_PUBLIC_TOKEN,  # Use public token for geocoding
                "limit": limit,
                "types": "address,place,locality,neighborhood,poi",
                "language": "en",
                "country": "IN"  # Restrict to India
            }
            
            if proximity:
                params["proximity"] = f"{proximity[0]},{proximity[1]}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        data = await response.json()
                        results = []
                        for feature in data.get("features", []):
                            results.append({
                                "id": feature.get("id"),
                                "place_name": feature.get("place_name"),
                                "text": feature.get("text"),
                                "center": feature.get("center", []),  # [lon, lat]
                                "geometry": feature.get("geometry", {}),
                                "context": feature.get("context", [])
                            })
                        if results:
                            return results
                    else:
                        error_text = await response.text()
                        logging.warning(f"Mapbox geocoding error: {response.status} - {error_text[:200]}. Falling back to OpenStreetMap.")
        except Exception as e:
            logging.warning(f"Mapbox geocoding error: {e}. Falling back to OpenStreetMap.")
    
    # Fallback to OpenStreetMap Nominatim
    try:
        async with aiohttp.ClientSession() as session:
            encoded_query = urllib.parse.quote(query)
            url = f"https://nominatim.openstreetmap.org/search?format=json&q={encoded_query}&limit={limit}&addressdetails=1&countrycodes=in"
            headers = {"User-Agent": "FoodKey/1.0 (food delivery app)"}
            
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.json()
                    results = []
                    for item in data:
                        results.append({
                            "id": str(item.get("place_id", "")),
                            "place_name": item.get("display_name", ""),
                            "text": item.get("name") or item.get("display_name", "").split(",")[0],
                            "center": [float(item.get("lon", 0)), float(item.get("lat", 0))],
                            "geometry": {
                                "type": "Point",
                                "coordinates": [float(item.get("lon", 0)), float(item.get("lat", 0))]
                            },
                            "context": []
                        })
                    return results
                else:
                    logging.error(f"OpenStreetMap search error: {response.status}")
    except Exception as e:
        logging.error(f"OpenStreetMap search error: {e}")
    
    return []


async def mapbox_reverse_geocode(lon: float, lat: float):
    """Reverse geocode coordinates to address using Mapbox with OpenStreetMap fallback"""
    
    # Try Mapbox first if token is available
    if MAPBOX_PUBLIC_TOKEN:
        try:
            url = f"{MAPBOX_API_BASE}/geocoding/v5/mapbox.places/{lon},{lat}.json"
            params = {
                "access_token": MAPBOX_PUBLIC_TOKEN,  # Use public token for geocoding
                "limit": 1,
                "language": "en"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get("features"):
                            feature = data["features"][0]
                            return {
                                "address": feature.get("place_name"),
                                "text": feature.get("text"),
                                "center": feature.get("center"),
                                "context": feature.get("context", [])
                            }
                    else:
                        error_text = await response.text()
                        logging.warning(f"Mapbox reverse geocode error: {response.status} - {error_text[:200]}. Falling back to OpenStreetMap.")
        except Exception as e:
            logging.warning(f"Mapbox reverse geocode error: {e}. Falling back to OpenStreetMap.")
    
    # Fallback to OpenStreetMap Nominatim
    try:
        async with aiohttp.ClientSession() as session:
            url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1"
            headers = {"User-Agent": "FoodKey/1.0 (food delivery app)"}
            
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.json()
                    if data and data.get("display_name"):
                        return {
                            "address": data.get("display_name"),
                            "text": data.get("name") or data.get("address", {}).get("road") or data.get("display_name", "").split(",")[0],
                            "center": [float(data.get("lon", lon)), float(data.get("lat", lat))],
                            "context": [],
                            "osm_address": data.get("address", {})
                        }
                else:
                    logging.error(f"OpenStreetMap reverse geocode error: {response.status}")
    except Exception as e:
        logging.error(f"OpenStreetMap reverse geocode error: {e}")
    
    return None


async def mapbox_get_directions(waypoints: list, profile: str = "driving"):
    """
    Get directions between waypoints using Mapbox Directions API
    waypoints: List of [lon, lat] pairs
    profile: 'driving', 'walking', 'cycling', 'driving-traffic'
    """
    if not MAPBOX_SECRET_TOKEN:
        return None
    
    if len(waypoints) < 2:
        return None
    
    try:
        # Format waypoints for API: lon,lat;lon,lat;...
        coordinates = ";".join([f"{wp[0]},{wp[1]}" for wp in waypoints])
        
        url = f"{MAPBOX_API_BASE}/directions/v5/mapbox/{profile}/{coordinates}"
        params = {
            "access_token": MAPBOX_SECRET_TOKEN,
            "steps": "true",
            "geometries": "geojson",
            "overview": "full",
            "language": "en"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=15)) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("routes"):
                        route = data["routes"][0]
                        return {
                            "distance": route.get("distance", 0),  # meters
                            "duration": route.get("duration", 0),  # seconds
                            "geometry": route.get("geometry", {}),
                            "legs": route.get("legs", []),
                            "waypoints": data.get("waypoints", [])
                        }
                    return None
                else:
                    error_text = await response.text()
                    logging.error(f"Mapbox directions error: {response.status} - {error_text}")
                    return None
    except Exception as e:
        logging.error(f"Mapbox directions error: {e}")
        return None


# ============== GOOGLE MAPS HELPER FUNCTIONS ==============

import httpx
import socket
import ssl

def get_ipv4_address(hostname: str) -> str:
    """Resolve hostname to IPv4 address only"""
    try:
        # Get only IPv4 addresses (AF_INET)
        result = socket.getaddrinfo(hostname, None, socket.AF_INET, socket.SOCK_STREAM)
        if result:
            ipv4 = result[0][4][0]
            logging.info(f"Resolved {hostname} to IPv4: {ipv4}")
            return ipv4
    except socket.gaierror as e:
        logging.warning(f"Failed to resolve {hostname} to IPv4: {e}")
    return None

# Get the IPv4 address of Google's API servers at startup
GOOGLE_API_IPV4 = get_ipv4_address("maps.googleapis.com")
logging.info(f"Google Maps API IPv4 address: {GOOGLE_API_IPV4}")

async def google_api_request(url: str, params: dict = None, timeout: int = 10):
    """Make a request to Google API - falls back to OSM if Google rejects"""
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(url, params=params)
        return response

async def google_maps_search_places(query: str, limit: int = 5, location: tuple = None):
    """Search for places using Google Places Autocomplete API with OpenStreetMap fallback"""
    import urllib.parse
    
    # Try Google Maps first if key is available
    if GOOGLE_MAPS_API_KEY:
        try:
            params = {
                "input": query,
                "key": GOOGLE_MAPS_API_KEY,
                "components": "country:in",  # Restrict to India
                "types": "geocode|establishment"
            }
            
            if location:
                params["location"] = f"{location[0]},{location[1]}"
                params["radius"] = 50000  # 50km radius
            
            # Use httpx with IPv4 for Google Maps API
            response = await google_api_request(GOOGLE_MAPS_PLACES_URL, params)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "OK":
                    results = []
                    for pred in data.get("predictions", [])[:limit]:
                        # Get place details to get coordinates
                        place_details = await google_maps_get_place_details(pred.get("place_id"))
                        if place_details:
                            results.append({
                                "id": pred.get("place_id"),
                                "place_name": pred.get("description"),
                                "text": pred.get("structured_formatting", {}).get("main_text", pred.get("description", "").split(",")[0]),
                                "center": [place_details.get("lng"), place_details.get("lat")],  # [lng, lat] for consistency
                                "geometry": {
                                    "type": "Point",
                                    "coordinates": [place_details.get("lng"), place_details.get("lat")]
                                },
                                "context": []
                            })
                    if results:
                        return results
                elif data.get("status") != "ZERO_RESULTS":
                    logging.warning(f"Google Places API: {data.get('status')} - {data.get('error_message', '')}. Falling back to OSM.")
        except Exception as e:
            logging.warning(f"Google Places search error: {e}. Falling back to OSM.")
    
    # Fallback to OpenStreetMap Nominatim
    try:
        async with aiohttp.ClientSession() as session:
            encoded_query = urllib.parse.quote(query)
            url = f"https://nominatim.openstreetmap.org/search?format=json&q={encoded_query}&limit={limit}&addressdetails=1&countrycodes=in"
            headers = {"User-Agent": "FoodKey/1.0 (food delivery app)"}
            
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.json()
                    results = []
                    for item in data:
                        results.append({
                            "id": str(item.get("place_id", "")),
                            "place_name": item.get("display_name", ""),
                            "text": item.get("name") or item.get("display_name", "").split(",")[0],
                            "center": [float(item.get("lon", 0)), float(item.get("lat", 0))],
                            "geometry": {
                                "type": "Point",
                                "coordinates": [float(item.get("lon", 0)), float(item.get("lat", 0))]
                            },
                            "context": []
                        })
                    return results
    except Exception as e:
        logging.error(f"OpenStreetMap search error: {e}")
    
    return []


async def google_maps_get_place_details(place_id: str):
    """Get place details (including coordinates) from Google Place Details API"""
    if not GOOGLE_MAPS_API_KEY or not place_id:
        return None
    
    try:
        params = {
            "place_id": place_id,
            "key": GOOGLE_MAPS_API_KEY,
            "fields": "geometry,formatted_address,name"
        }
        
        # Use httpx with IPv4 for Google Maps API
        response = await google_api_request(GOOGLE_MAPS_PLACE_DETAILS_URL, params)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "OK" and data.get("result"):
                result = data["result"]
                location = result.get("geometry", {}).get("location", {})
                return {
                    "lat": location.get("lat"),
                    "lng": location.get("lng"),
                    "address": result.get("formatted_address"),
                    "name": result.get("name")
                }
    except Exception as e:
        logging.error(f"Google Place Details error: {e}")
    
    return None


async def google_maps_reverse_geocode(lat: float, lng: float):
    """Reverse geocode coordinates to address using Google Maps Geocoding API with fallback"""
    
    # Try Google Maps first if key is available
    if GOOGLE_MAPS_API_KEY:
        try:
            params = {
                "latlng": f"{lat},{lng}",
                "key": GOOGLE_MAPS_API_KEY,
                "language": "en"
            }
            
            # Use httpx with IPv4 for Google Maps API
            response = await google_api_request(GOOGLE_MAPS_GEOCODE_URL, params)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "OK" and data.get("results"):
                    result = data["results"][0]
                    # Extract address components
                    address_components = {}
                    for component in result.get("address_components", []):
                        for comp_type in component.get("types", []):
                            address_components[comp_type] = component.get("long_name")
                    
                    return {
                        "address": result.get("formatted_address"),
                        "text": address_components.get("sublocality_level_1") or address_components.get("locality") or result.get("formatted_address", "").split(",")[0],
                        "center": [lng, lat],
                        "context": [],
                        "address_components": address_components
                    }
                elif data.get("status") != "ZERO_RESULTS":
                    logging.warning(f"Google Maps reverse geocode: {data.get('status')} - {data.get('error_message', '')}. Falling back.")
        except Exception as e:
            logging.warning(f"Google Maps reverse geocode error: {e}. Falling back.")
    
    # Fallback to OpenStreetMap Nominatim
    try:
        async with aiohttp.ClientSession() as session:
            url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}&zoom=18&addressdetails=1"
            headers = {"User-Agent": "FoodKey/1.0 (food delivery app)"}
            
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.json()
                    if data and data.get("display_name"):
                        return {
                            "address": data.get("display_name"),
                            "text": data.get("name") or data.get("address", {}).get("road") or data.get("display_name", "").split(",")[0],
                            "center": [float(data.get("lon", lng)), float(data.get("lat", lat))],
                            "context": [],
                            "address_components": data.get("address", {})
                        }
    except Exception as e:
        logging.error(f"OpenStreetMap reverse geocode error: {e}")
    
    return None


async def google_maps_get_directions(origin: tuple, destination: tuple, waypoints: list = None, mode: str = "driving"):
    """
    Get directions between points using Google Directions API with OSRM fallback
    origin: (lat, lng)
    destination: (lat, lng)
    waypoints: list of (lat, lng) tuples
    mode: 'driving', 'walking', 'bicycling', 'transit'
    """
    
    # Try Google Maps first if key is available
    if GOOGLE_MAPS_API_KEY:
        try:
            params = {
                "origin": f"{origin[0]},{origin[1]}",
                "destination": f"{destination[0]},{destination[1]}",
                "key": GOOGLE_MAPS_API_KEY,
                "mode": mode,
                "language": "en",
                "units": "metric"
            }
            
            if waypoints:
                waypoint_str = "|".join([f"{wp[0]},{wp[1]}" for wp in waypoints])
                params["waypoints"] = waypoint_str
            
            # Use httpx with IPv4 for Google Maps API
            response = await google_api_request(GOOGLE_MAPS_DIRECTIONS_URL, params, timeout=15)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "OK" and data.get("routes"):
                    route = data["routes"][0]
                    legs = route.get("legs", [])
                    
                    # Calculate totals
                    total_distance = sum(leg.get("distance", {}).get("value", 0) for leg in legs)
                    total_duration = sum(leg.get("duration", {}).get("value", 0) for leg in legs)
                    
                    # Get polyline for map display
                    overview_polyline = route.get("overview_polyline", {}).get("points", "")
                    
                    return {
                        "distance": total_distance,  # meters
                        "duration": total_duration,  # seconds
                        "distance_text": route.get("legs", [{}])[0].get("distance", {}).get("text", ""),
                        "duration_text": route.get("legs", [{}])[0].get("duration", {}).get("text", ""),
                        "polyline": overview_polyline,
                        "legs": [{
                            "distance": leg.get("distance", {}).get("value", 0),
                            "duration": leg.get("duration", {}).get("value", 0),
                            "start_address": leg.get("start_address"),
                            "end_address": leg.get("end_address"),
                            "steps": leg.get("steps", [])
                        } for leg in legs],
                        "bounds": route.get("bounds", {}),
                        "source": "google"
                    }
                elif data.get("status") != "ZERO_RESULTS":
                    logging.warning(f"Google Directions API: {data.get('status')} - {data.get('error_message', '')}. Falling back to OSRM.")
        except Exception as e:
            logging.warning(f"Google Directions error: {e}. Falling back to OSRM.")
    
    # Fallback to OSRM (Open Source Routing Machine)
    try:
        # Build coordinates string: origin;waypoints;destination
        coords = [f"{origin[1]},{origin[0]}"]  # OSRM uses lng,lat
        if waypoints:
            for wp in waypoints:
                coords.append(f"{wp[1]},{wp[0]}")
        coords.append(f"{destination[1]},{destination[0]}")
        coords_str = ";".join(coords)
        
        osrm_url = f"https://router.project-osrm.org/route/v1/driving/{coords_str}"
        params = {
            "overview": "full",
            "geometries": "polyline",
            "steps": "true"
        }
        
        async with aiohttp.ClientSession() as session:
            headers = {"User-Agent": "FoodKey/1.0 (food delivery app)"}
            async with session.get(osrm_url, params=params, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("code") == "Ok" and data.get("routes"):
                        route = data["routes"][0]
                        legs = route.get("legs", [])
                        
                        total_distance = route.get("distance", 0)  # meters
                        total_duration = route.get("duration", 0)  # seconds
                        
                        return {
                            "distance": total_distance,
                            "duration": total_duration,
                            "distance_text": f"{round(total_distance/1000, 1)} km",
                            "duration_text": f"{round(total_duration/60)} mins",
                            "polyline": route.get("geometry", ""),
                            "legs": [{
                                "distance": leg.get("distance", 0),
                                "duration": leg.get("duration", 0),
                                "start_address": "",
                                "end_address": "",
                                "steps": leg.get("steps", [])
                            } for leg in legs],
                            "bounds": {},
                            "source": "osrm"
                        }
                    else:
                        logging.error(f"OSRM error: {data.get('code')} - {data.get('message', '')}")
    except Exception as e:
        logging.error(f"OSRM directions error: {e}")
    
    return None


async def google_maps_get_distance(origin: tuple, destination: tuple, mode: str = "driving"):
    """
    Get distance and duration between two points using Google Distance Matrix API with OSRM fallback
    origin: (lat, lng)
    destination: (lat, lng)
    Returns: dict with distance_km, duration_minutes
    """
    
    # Try Google Maps first if key is available
    if GOOGLE_MAPS_API_KEY:
        try:
            params = {
                "origins": f"{origin[0]},{origin[1]}",
                "destinations": f"{destination[0]},{destination[1]}",
                "key": GOOGLE_MAPS_API_KEY,
                "mode": mode,
                "units": "metric"
            }
            
            # Use httpx with IPv4 for Google Maps API
            response = await google_api_request(GOOGLE_MAPS_DISTANCE_URL, params)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "OK":
                    rows = data.get("rows", [])
                    if rows and rows[0].get("elements"):
                        element = rows[0]["elements"][0]
                        if element.get("status") == "OK":
                            distance_m = element.get("distance", {}).get("value", 0)
                            duration_s = element.get("duration", {}).get("value", 0)
                            return {
                                "distance_km": round(distance_m / 1000, 2),
                                "duration_minutes": round(duration_s / 60, 1),
                                "distance_text": element.get("distance", {}).get("text", ""),
                                "duration_text": element.get("duration", {}).get("text", ""),
                                "is_estimate": False,
                                "source": "google"
                            }
                elif data.get("status") != "ZERO_RESULTS":
                    logging.warning(f"Google Distance Matrix: {data.get('status')}. Falling back to OSRM.")
        except Exception as e:
            logging.warning(f"Google Distance Matrix error: {e}. Falling back to OSRM.")
    
    # Fallback to OSRM for distance calculation
    try:
        osrm_url = f"https://router.project-osrm.org/route/v1/driving/{origin[1]},{origin[0]};{destination[1]},{destination[0]}"
        params = {"overview": "false"}
        
        async with aiohttp.ClientSession() as session:
            headers = {"User-Agent": "FoodKey/1.0 (food delivery app)"}
            async with session.get(osrm_url, params=params, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("code") == "Ok" and data.get("routes"):
                        route = data["routes"][0]
                        distance_m = route.get("distance", 0)
                        duration_s = route.get("duration", 0)
                        return {
                            "distance_km": round(distance_m / 1000, 2),
                            "duration_minutes": round(duration_s / 60, 1),
                            "distance_text": f"{round(distance_m / 1000, 1)} km",
                            "duration_text": f"{round(duration_s / 60)} mins",
                            "is_estimate": False,
                            "source": "osrm"
                        }
    except Exception as e:
        logging.warning(f"OSRM distance error: {e}. Falling back to Haversine.")
    
    # Final fallback to Haversine formula (straight-line distance)
    return {
        "distance_km": calculate_distance_km(origin[0], origin[1], destination[0], destination[1]),
        "duration_minutes": None,
        "is_estimate": True,
        "source": "haversine"
    }


# Real-time tracking store (in-memory for active deliveries)
delivery_tracking_store = {}


# ============== PUSH NOTIFICATION HELPER ==============

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

# ============== WEBSOCKET CONNECTION MANAGER ==============

class ConnectionManager:
    """Manages WebSocket connections for real-time notifications"""
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}  # user_id -> [websockets]
        self.user_types: Dict[str, str] = {}  # user_id -> type (admin, restaurant, delivery, customer)
    
    async def connect(self, websocket: WebSocket, user_id: str, user_type: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        self.user_types[user_id] = user_type
        logging.info(f"WebSocket connected: {user_id} ({user_type})")
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                if user_id in self.user_types:
                    del self.user_types[user_id]
        logging.info(f"WebSocket disconnected: {user_id}")
    
    async def send_to_user(self, user_id: str, message: dict):
        """Send message to a specific user"""
        if user_id in self.active_connections:
            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logging.error(f"Failed to send to {user_id}: {e}")
    
    async def send_to_type(self, user_type: str, message: dict):
        """Send message to all users of a specific type"""
        for user_id, utype in self.user_types.items():
            if utype == user_type:
                await self.send_to_user(user_id, message)
    
    async def broadcast(self, message: dict):
        """Send message to all connected users"""
        for user_id in self.active_connections:
            await self.send_to_user(user_id, message)
    
    async def send_location_update(self, order_id: str, customer_id: str, location_data: dict):
        """Send delivery partner location update to customer tracking the order"""
        await self.send_to_user(customer_id, {
            "type": "location_update",
            "order_id": order_id,
            "payload": location_data
        })
    
    async def send_notification(self, user_id: str, user_type: str, payload: dict):
        """Send notification to a specific user with type info"""
        await self.send_to_user(user_id, {
            "type": "notification",
            "user_type": user_type,
            "payload": payload
        })

# Global connection manager
ws_manager = ConnectionManager()

# ============== DELIVERY PARTNER LOCATION TRACKING ==============

class LocationUpdate(BaseModel):
    lat: float
    lng: float
    heading: Optional[float] = None  # Direction in degrees
    speed: Optional[float] = None  # Speed in km/h
    accuracy: Optional[float] = None  # GPS accuracy in meters


@api_router.post("/delivery-partner/location/{order_id}")
async def send_order_location_update(order_id: str, location: LocationUpdate, partner_id: str):
    """Update delivery partner's location for real-time tracking"""
    # Verify the order exists and is assigned to this partner
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("delivery_partner_id") != partner_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this order's location")
    
    # Store location in database
    location_record = {
        "order_id": order_id,
        "partner_id": partner_id,
        "lat": location.lat,
        "lng": location.lng,
        "heading": location.heading,
        "speed": location.speed,
        "accuracy": location.accuracy,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert - update if exists, insert if not
    await db.delivery_locations.update_one(
        {"order_id": order_id},
        {"$set": location_record},
        upsert=True
    )
    
    # Calculate ETA if possible
    eta_minutes = None
    if order.get("delivery_address", {}).get("lat") and order.get("delivery_address", {}).get("lng"):
        customer_lat = order["delivery_address"]["lat"]
        customer_lng = order["delivery_address"]["lng"]
        distance_km = calculate_distance_km(location.lat, location.lng, customer_lat, customer_lng)
        # Assume average speed of 20 km/h in city
        avg_speed = location.speed if location.speed and location.speed > 0 else 20
        eta_minutes = int((distance_km / avg_speed) * 60)
    
    # Broadcast to customer via WebSocket
    location_data = {
        "lat": location.lat,
        "lng": location.lng,
        "heading": location.heading,
        "speed": location.speed,
        "eta_minutes": eta_minutes,
        "timestamp": location_record["timestamp"],
        "partner_name": order.get("delivery_partner_name", "Delivery Partner"),
        "order_status": order.get("status")
    }
    
    await ws_manager.send_location_update(order_id, order["user_id"], location_data)
    
    return {"success": True, "eta_minutes": eta_minutes}


@api_router.get("/delivery-partner/location/{order_id}")
async def get_delivery_location(order_id: str):
    """Get current delivery partner location for an order"""
    location = await db.delivery_locations.find_one({"order_id": order_id}, {"_id": 0})
    if not location:
        return {"success": False, "message": "No location data available"}
    
    # Get order for customer location
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Calculate ETA
    eta_minutes = None
    if order.get("delivery_address", {}).get("lat") and order.get("delivery_address", {}).get("lng"):
        customer_lat = order["delivery_address"]["lat"]
        customer_lng = order["delivery_address"]["lng"]
        distance_km = calculate_distance_km(location["lat"], location["lng"], customer_lat, customer_lng)
        eta_minutes = int((distance_km / 20) * 60)  # Assume 20 km/h
    
    return {
        "success": True,
        "location": {
            "lat": location["lat"],
            "lng": location["lng"],
            "heading": location.get("heading"),
            "speed": location.get("speed"),
            "timestamp": location["timestamp"]
        },
        "eta_minutes": eta_minutes,
        "partner_name": order.get("delivery_partner_name", "Delivery Partner"),
        "order_status": order.get("status"),
        "customer_location": {
            "lat": order.get("delivery_address", {}).get("lat"),
            "lng": order.get("delivery_address", {}).get("lng"),
            "address": order.get("delivery_address", {}).get("full_address")
        },
        "restaurant_location": {
            "lat": order.get("restaurant_lat"),
            "lng": order.get("restaurant_lng"),
            "address": order.get("restaurant_address")
        }
    }


@api_router.get("/orders/{order_id}/tracking-info")
async def get_order_tracking_info(order_id: str):
    """Get complete tracking info for an order including all locations"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get restaurant info
    restaurant = await db.restaurants.find_one({"id": order["restaurant_id"]}, {"_id": 0})
    
    # Get delivery partner location if assigned
    partner_location = None
    if order.get("delivery_partner_id"):
        loc = await db.delivery_locations.find_one({"order_id": order_id}, {"_id": 0})
        if loc:
            partner_location = {
                "lat": loc["lat"],
                "lng": loc["lng"],
                "heading": loc.get("heading"),
                "speed": loc.get("speed"),
                "timestamp": loc["timestamp"]
            }
    
    # Calculate total and grand total
    total_amount = order.get("total_amount", 0)
    delivery_fee = order.get("delivery_fee", 0)
    cod_fee = order.get("cod_fee", 0)
    grand_total = total_amount + delivery_fee + cod_fee
    
    return {
        "order_id": order_id,
        "status": order.get("status"),
        "payment_method": order.get("payment_method"),
        "payment_status": order.get("payment_status"),
        "total_amount": total_amount,
        "delivery_fee": delivery_fee,
        "cod_fee": cod_fee,
        "grand_total": grand_total,
        "estimated_prep_time": order.get("estimated_prep_time"),
        "estimated_delivery_time": order.get("estimated_delivery_time"),
        "restaurant": {
            "name": order.get("restaurant_name"),
            "address": order.get("restaurant_address"),
            "phone": order.get("restaurant_phone") or (restaurant.get("phone") if restaurant else None),
            "lat": restaurant.get("lat") if restaurant else None,
            "lng": restaurant.get("lng") if restaurant else None
        },
        "customer": {
            "address": order.get("delivery_address", {}).get("full_address"),
            "lat": order.get("delivery_address", {}).get("lat"),
            "lng": order.get("delivery_address", {}).get("lng")
        },
        "delivery_partner": {
            "id": order.get("delivery_partner_id"),
            "name": order.get("delivery_partner_name"),
            "current_location": partner_location
        } if order.get("delivery_partner_id") else None,
        "timestamps": {
            "created_at": order.get("created_at"),
            "confirmed_at": order.get("confirmed_at"),
            "ready_at": order.get("ready_at"),
            "picked_up_at": order.get("picked_up_at"),
            "delivered_at": order.get("delivered_at")
        },
        "directions": {
            "delivery_directions_link": order.get("delivery_directions_link"),
            "distance_km": order.get("distance_km"),
            "partner_to_customer_link": generate_partner_to_customer_link(partner_location, order) if partner_location else None
        }
    }


def generate_partner_to_customer_link(partner_location: dict, order: dict) -> str:
    """Generate Google Maps link from delivery partner to customer"""
    if not partner_location:
        return None
    customer_lat = order.get("delivery_address", {}).get("lat")
    customer_lng = order.get("delivery_address", {}).get("lng")
    if not customer_lat or not customer_lng:
        return None
    return (
        f"https://www.google.com/maps/dir/?api=1"
        f"&origin={partner_location['lat']},{partner_location['lng']}"
        f"&destination={customer_lat},{customer_lng}"
        f"&travelmode=driving"
    )


# ============== DELIVERY PARTNER TRACKING & KM CALCULATION ==============

@api_router.post("/tracking/update-partner-location")
async def update_partner_location_tracking(request: Request):
    """Update delivery partner location for real-time tracking and KM calculation"""
    data = await request.json()
    partner_id = data.get("partner_id")
    lat = data.get("lat")
    lng = data.get("lng")
    heading = data.get("heading", 0)
    speed = data.get("speed", 0)
    order_id = data.get("order_id")
    
    if not partner_id or lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    # Get previous location to calculate distance traveled
    previous_location = await db.partner_locations.find_one(
        {"partner_id": partner_id},
        sort=[("timestamp", -1)]
    )
    
    distance_traveled = 0
    if previous_location:
        prev_lat = previous_location.get("lat")
        prev_lng = previous_location.get("lng")
        if prev_lat and prev_lng:
            distance_traveled = calculate_distance_km(prev_lat, prev_lng, lat, lng)
    
    # Store current location
    location_record = {
        "partner_id": partner_id,
        "lat": lat,
        "lng": lng,
        "heading": heading,
        "speed": speed,
        "timestamp": now,
        "order_id": order_id,
        "distance_from_previous": distance_traveled
    }
    await db.partner_locations.insert_one(location_record)
    
    # Update daily kilometers
    if distance_traveled > 0 and distance_traveled < 10:  # Ignore unrealistic jumps > 10km
        await db.partner_daily_km.update_one(
            {"partner_id": partner_id, "date": today},
            {
                "$inc": {"total_km": distance_traveled, "location_updates": 1},
                "$set": {"last_updated": now},
                "$setOnInsert": {"created_at": now}
            },
            upsert=True
        )
    
    # Update partner's online status and last location
    await db.delivery_partners.update_one(
        {"user_id": partner_id},
        {
            "$set": {
                "last_location": {"lat": lat, "lng": lng},
                "last_location_time": now,
                "is_online": True
            }
        }
    )
    
    # If tracking a specific order, also update order location
    if order_id:
        await db.delivery_locations.update_one(
            {"order_id": order_id},
            {"$set": {
                "partner_id": partner_id,
                "lat": lat,
                "lng": lng,
                "heading": heading,
                "speed": speed,
                "timestamp": now
            }},
            upsert=True
        )
    
    return {"success": True, "distance_traveled_km": round(distance_traveled, 3)}


@api_router.get("/tracking/live/{order_id}")
async def get_live_tracking(order_id: str):
    """Get live tracking data for an order"""
    # Try regular orders first
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        # Try custom orders
        order = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    partner_id = order.get("delivery_partner_id")
    if not partner_id:
        return {"success": True, "partner": None, "eta": None}
    
    # Get partner's latest location
    location = await db.delivery_locations.find_one({"order_id": order_id})
    if not location:
        # Fallback to partner's last known location (try by id first, then user_id)
        partner = await db.delivery_partners.find_one({"id": partner_id})
        if not partner:
            partner = await db.delivery_partners.find_one({"user_id": partner_id})
        if partner:
            last_loc = partner.get("last_location") or partner.get("current_location")
            if last_loc and last_loc.get("lat") and last_loc.get("lng"):
                location = {
                    "lat": last_loc["lat"],
                    "lng": last_loc["lng"],
                    "heading": last_loc.get("heading"),
                    "speed": last_loc.get("speed"),
                    "timestamp": partner.get("last_location_time") or last_loc.get("timestamp")
                }
    
    if not location:
        return {"success": True, "partner": {"id": partner_id}, "eta": None}
    
    # Calculate ETA
    eta = None
    customer_lat = order.get("delivery_address", {}).get("lat")
    customer_lng = order.get("delivery_address", {}).get("lng")
    if customer_lat and customer_lng and location.get("lat"):
        distance_km = calculate_distance_km(location["lat"], location["lng"], customer_lat, customer_lng)
        speed = location.get("speed", 0) or 20  # Default 20 km/h
        eta_minutes = int((distance_km / speed) * 60)
        eta = {
            "minutes": min(eta_minutes, 120),  # Cap at 2 hours
            "distance_km": round(distance_km, 1)
        }
    
    return {
        "success": True,
        "partner": {
            "id": partner_id,
            "name": order.get("delivery_partner_name"),
            "phone": order.get("delivery_partner_phone"),
            "location": {
                "lat": location.get("lat"),
                "lng": location.get("lng"),
                "heading": location.get("heading"),
                "speed": location.get("speed"),
                "timestamp": location.get("timestamp")
            }
        },
        "eta": eta
    }


@api_router.get("/admin/delivery-partners/online")
async def get_online_delivery_partners():
    """Get all online delivery partners with their current locations"""
    # Get all approved partners who are online
    partners = await db.delivery_partners.find(
        {
            "approval_status": "approved",
            "is_online": True
        },
        {"_id": 0}
    ).to_list(100)
    
    # Get today's KM for each partner
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = []
    
    for partner in partners:
        daily_km = await db.partner_daily_km.find_one(
            {"partner_id": partner.get("user_id"), "date": today},
            {"_id": 0}
        )
        
        # Get user info
        user = await db.users.find_one({"id": partner.get("user_id")}, {"_id": 0, "name": 1, "phone": 1})
        
        # Get active deliveries count - use partner's id field (UUID) which is what orders reference
        active_deliveries = await db.orders.count_documents({
            "delivery_partner_id": partner.get("id"),
            "status": {"$in": ["assigned", "picked_up", "out_for_delivery"]}
        })
        
        result.append({
            "id": partner.get("id"),  # Use the partner's UUID
            "user_id": partner.get("user_id"),
            "name": user.get("name") if user else partner.get("name", "Unknown"),
            "phone": user.get("phone") if user else partner.get("phone"),
            "vehicle_type": partner.get("vehicle_type", "bike"),
            "is_online": partner.get("is_online", False),
            "last_location": partner.get("last_location"),
            "last_location_time": partner.get("last_location_time"),
            "today_km": round(daily_km.get("total_km", 0), 2) if daily_km else 0,
            "location_updates": daily_km.get("location_updates", 0) if daily_km else 0,
            "active_deliveries": active_deliveries
        })
    
    return {"partners": result, "count": len(result)}


@api_router.get("/admin/delivery-partners/{partner_id}/km-history")
async def get_partner_km_history(partner_id: str, days: int = 7):
    """Get delivery partner's KM history for the last N days"""
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    km_records = await db.partner_daily_km.find(
        {
            "partner_id": partner_id,
            "date": {"$gte": start_date.strftime("%Y-%m-%d")}
        },
        {"_id": 0}
    ).sort("date", -1).to_list(days)
    
    # Calculate totals
    total_km = sum(r.get("total_km", 0) for r in km_records)
    total_days = len(km_records)
    avg_daily_km = total_km / total_days if total_days > 0 else 0
    
    return {
        "partner_id": partner_id,
        "history": km_records,
        "summary": {
            "total_km": round(total_km, 2),
            "days_active": total_days,
            "avg_daily_km": round(avg_daily_km, 2)
        }
    }


@api_router.post("/delivery-partner/go-online")
async def delivery_partner_go_online(request: Request):
    """Mark delivery partner as online"""
    data = await request.json()
    partner_id = data.get("partner_id")
    lat = data.get("lat")
    lng = data.get("lng")
    
    if not partner_id:
        raise HTTPException(status_code=400, detail="Partner ID required")
    
    update_data = {"is_online": True, "online_since": datetime.now(timezone.utc)}
    if lat and lng:
        update_data["last_location"] = {"lat": lat, "lng": lng}
        update_data["last_location_time"] = datetime.now(timezone.utc)
    
    result = await db.delivery_partners.update_one(
        {"user_id": partner_id},
        {"$set": update_data}
    )
    
    return {"success": result.modified_count > 0}


@api_router.post("/delivery-partner/go-offline")
async def delivery_partner_go_offline(request: Request):
    """Mark delivery partner as offline"""
    data = await request.json()
    partner_id = data.get("partner_id")
    
    if not partner_id:
        raise HTTPException(status_code=400, detail="Partner ID required")
    
    result = await db.delivery_partners.update_one(
        {"user_id": partner_id},
        {"$set": {"is_online": False, "offline_since": datetime.now(timezone.utc)}}
    )
    
    return {"success": result.modified_count > 0}


@api_router.get("/delivery-partner/{partner_id}/today-stats")
async def get_partner_today_stats(partner_id: str):
    """Get delivery partner's stats for today"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get today's KM
    daily_km = await db.partner_daily_km.find_one(
        {"partner_id": partner_id, "date": today},
        {"_id": 0}
    )
    
    # Get today's completed deliveries
    completed_orders = await db.orders.count_documents({
        "delivery_partner_id": partner_id,
        "status": "delivered",
        "delivered_at": {"$gte": today_start}
    })
    
    # Get today's earnings
    earnings_pipeline = [
        {
            "$match": {
                "delivery_partner_id": partner_id,
                "status": "delivered",
                "delivered_at": {"$gte": today_start}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_delivery_fee": {"$sum": "$delivery_fee"},
                "total_tips": {"$sum": {"$ifNull": ["$tip_amount", 0]}}
            }
        }
    ]
    earnings_result = await db.orders.aggregate(earnings_pipeline).to_list(1)
    
    total_earnings = 0
    if earnings_result:
        delivery_fee = earnings_result[0].get("total_delivery_fee", 0)
        tips = earnings_result[0].get("total_tips", 0)
        # Partner gets 70% of delivery fee
        total_earnings = (delivery_fee * 0.70) + tips
    
    return {
        "date": today,
        "total_km": round(daily_km.get("total_km", 0), 2) if daily_km else 0,
        "completed_deliveries": completed_orders,
        "earnings": round(total_earnings, 2),
        "location_updates": daily_km.get("location_updates", 0) if daily_km else 0
    }


# ============== MAPBOX LOCATION & NAVIGATION ENDPOINTS ==============

@api_router.get("/mapbox/config")
async def get_mapbox_config():
    """Get Mapbox public token for frontend"""
    return {
        "publicToken": MAPBOX_PUBLIC_TOKEN,
        "style": "mapbox://styles/mapbox/streets-v12"
    }


@api_router.get("/mapbox/search")
async def mapbox_search(
    query: str,
    limit: int = 5,
    proximity_lat: float = None,
    proximity_lng: float = None
):
    """Search for addresses using Mapbox Geocoding API"""
    if not query or len(query) < 2:
        return {"results": []}
    
    proximity = None
    if proximity_lat and proximity_lng:
        proximity = (proximity_lng, proximity_lat)  # Mapbox uses lng,lat
    
    results = await mapbox_search_address(query, limit, proximity)
    return {"results": results}


@api_router.get("/mapbox/reverse-geocode")
async def mapbox_reverse(lat: float, lng: float):
    """Get address from coordinates using Mapbox"""
    result = await mapbox_reverse_geocode(lng, lat)  # Mapbox uses lng,lat
    if result:
        return {"success": True, "data": result}
    return {"success": False, "error": "Could not find address"}


@api_router.post("/mapbox/directions")
async def mapbox_directions(request: Request):
    """Get directions between points using Mapbox"""
    try:
        data = await request.json()
        waypoints = data.get("waypoints", [])  # List of {lat, lng} objects
        profile = data.get("profile", "driving")  # driving, walking, cycling, driving-traffic
        
        if len(waypoints) < 2:
            raise HTTPException(status_code=400, detail="At least 2 waypoints required")
        
        # Convert to [lng, lat] format for Mapbox
        mapbox_waypoints = [[wp["lng"], wp["lat"]] for wp in waypoints]
        
        result = await mapbox_get_directions(mapbox_waypoints, profile)
        
        if result:
            return {
                "success": True,
                "route": {
                    "distance_meters": result["distance"],
                    "distance_km": round(result["distance"] / 1000, 2),
                    "duration_seconds": result["duration"],
                    "duration_minutes": round(result["duration"] / 60, 1),
                    "geometry": result["geometry"],
                    "steps": result["legs"][0].get("steps", []) if result["legs"] else [],
                    "waypoints": result["waypoints"]
                }
            }
        return {"success": False, "error": "Failed to get directions"}
    except Exception as e:
        logging.error(f"Mapbox directions endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/mapbox/delivery-route")
async def mapbox_delivery_route(request: Request):
    """
    Get optimized delivery route: Partner -> Restaurant -> Customer
    Also calculates live ETA
    """
    try:
        data = await request.json()
        partner_location = data.get("partner_location")  # {lat, lng}
        restaurant_location = data.get("restaurant_location")  # {lat, lng}
        customer_location = data.get("customer_location")  # {lat, lng}
        
        if not all([partner_location, restaurant_location, customer_location]):
            raise HTTPException(status_code=400, detail="All locations required")
        
        # Build waypoints: Partner -> Restaurant -> Customer
        waypoints = [
            [partner_location["lng"], partner_location["lat"]],
            [restaurant_location["lng"], restaurant_location["lat"]],
            [customer_location["lng"], customer_location["lat"]]
        ]
        
        result = await mapbox_get_directions(waypoints, "driving-traffic")
        
        if result and result.get("legs"):
            # Leg 0: Partner to Restaurant
            # Leg 1: Restaurant to Customer
            leg_to_restaurant = result["legs"][0] if len(result["legs"]) > 0 else {}
            leg_to_customer = result["legs"][1] if len(result["legs"]) > 1 else {}
            
            return {
                "success": True,
                "route": {
                    "total_distance_km": round(result["distance"] / 1000, 2),
                    "total_duration_minutes": round(result["duration"] / 60, 1),
                    "geometry": result["geometry"],
                    "partner_to_restaurant": {
                        "distance_km": round(leg_to_restaurant.get("distance", 0) / 1000, 2),
                        "duration_minutes": round(leg_to_restaurant.get("duration", 0) / 60, 1),
                        "steps": leg_to_restaurant.get("steps", [])
                    },
                    "restaurant_to_customer": {
                        "distance_km": round(leg_to_customer.get("distance", 0) / 1000, 2),
                        "duration_minutes": round(leg_to_customer.get("duration", 0) / 60, 1),
                        "steps": leg_to_customer.get("steps", [])
                    }
                },
                "eta": {
                    "pickup_minutes": round(leg_to_restaurant.get("duration", 0) / 60, 1),
                    "delivery_minutes": round(result["duration"] / 60, 1)
                }
            }
        return {"success": False, "error": "Failed to calculate delivery route"}
    except Exception as e:
        logging.error(f"Mapbox delivery route error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/tracking/update-partner-location")
async def update_partner_location_mapbox(request: Request):
    """Update delivery partner location for live tracking (Mapbox version)"""
    try:
        data = await request.json()
        order_id = data.get("order_id")
        partner_id = data.get("partner_id")
        lat = data.get("lat")
        lng = data.get("lng")
        heading = data.get("heading")
        speed = data.get("speed")
        
        if not all([order_id, partner_id, lat, lng]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Update location in database
        location_data = {
            "order_id": order_id,
            "partner_id": partner_id,
            "lat": lat,
            "lng": lng,
            "heading": heading,
            "speed": speed,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await db.delivery_locations.update_one(
            {"order_id": order_id},
            {"$set": location_data},
            upsert=True
        )
        
        # Store in memory for quick access
        delivery_tracking_store[order_id] = location_data
        
        # Get order to calculate ETA
        order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        eta_info = None
        
        if order:
            customer_lat = order.get("delivery_address", {}).get("lat")
            customer_lng = order.get("delivery_address", {}).get("lng")
            
            if customer_lat and customer_lng:
                # Get ETA using Mapbox directions
                waypoints = [[lng, lat], [customer_lng, customer_lat]]
                route = await mapbox_get_directions(waypoints, "driving-traffic")
                
                if route:
                    eta_info = {
                        "distance_km": round(route["distance"] / 1000, 2),
                        "eta_minutes": round(route["duration"] / 60, 1)
                    }
        
        return {
            "success": True,
            "message": "Location updated",
            "location": location_data,
            "eta": eta_info
        }
    except Exception as e:
        logging.error(f"Partner location update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/tracking/live/{order_id}")
async def get_live_tracking(order_id: str):
    """Get live tracking data for an order including route and ETA"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        # Check custom orders too
        order = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
    
    # Get current partner location
    partner_location = delivery_tracking_store.get(order_id)
    if not partner_location:
        loc = await db.delivery_locations.find_one({"order_id": order_id}, {"_id": 0})
        if loc:
            partner_location = {
                "lat": loc["lat"],
                "lng": loc["lng"],
                "heading": loc.get("heading"),
                "speed": loc.get("speed"),
                "timestamp": loc["timestamp"]
            }
    
    # Get restaurant location
    restaurant = None
    if order.get("restaurant_id"):
        restaurant = await db.restaurants.find_one({"id": order["restaurant_id"]}, {"_id": 0})
    
    restaurant_location = None
    if restaurant:
        restaurant_location = {
            "lat": restaurant.get("lat"),
            "lng": restaurant.get("lng"),
            "name": restaurant.get("name"),
            "address": restaurant.get("address")
        }
    
    # Customer location
    customer_location = None
    delivery_address = order.get("delivery_address", {})
    if isinstance(delivery_address, dict):
        customer_location = {
            "lat": delivery_address.get("lat"),
            "lng": delivery_address.get("lng"),
            "address": delivery_address.get("full_address") or delivery_address.get("address")
        }
    
    # Calculate route and ETA if partner is active (using Google Maps)
    route_info = None
    eta_info = None
    
    if partner_location and customer_location and customer_location.get("lat"):
        # Try Google Maps first
        distance_result = await google_maps_get_distance(
            (partner_location["lat"], partner_location["lng"]),
            (customer_location["lat"], customer_location["lng"]),
            "driving"
        )
        
        if distance_result:
            route_info = {
                "distance_km": distance_result.get("distance_km", 0),
                "duration_minutes": distance_result.get("duration_minutes", 0),
                "distance_text": distance_result.get("distance_text", ""),
                "duration_text": distance_result.get("duration_text", ""),
                "is_estimate": distance_result.get("is_estimate", False)
            }
            eta_info = {
                "minutes": distance_result.get("duration_minutes", 0),
                "distance_km": distance_result.get("distance_km", 0)
            }
    
    return {
        "order_id": order_id,
        "status": order.get("status"),
        "partner": {
            "id": order.get("delivery_partner_id"),
            "name": order.get("delivery_partner_name"),
            "phone": order.get("delivery_partner_phone"),
            "location": partner_location
        } if order.get("delivery_partner_id") else None,
        "restaurant": restaurant_location,
        "customer": customer_location,
        "route": route_info,
        "eta": eta_info,
        "mapbox_token": MAPBOX_PUBLIC_TOKEN,  # For frontend map display (legacy)
        "google_maps_key": GOOGLE_MAPS_API_KEY  # For Google Maps display
    }


# ============== GOOGLE MAPS LOCATION & NAVIGATION ENDPOINTS ==============

@api_router.get("/google-maps/config")
async def get_google_maps_config():
    """Get Google Maps API key for frontend"""
    return {
        "apiKey": GOOGLE_MAPS_API_KEY,
        "api_key": GOOGLE_MAPS_API_KEY  # Alternative key name for compatibility
    }


@api_router.get("/google-maps/search")
async def google_maps_search(
    query: str,
    limit: int = 5,
    lat: float = None,
    lng: float = None
):
    """Search for places using Google Places Autocomplete API"""
    if not query or len(query) < 2:
        return {"results": []}
    
    location = None
    if lat and lng:
        location = (lat, lng)
    
    results = await google_maps_search_places(query, limit, location)
    return {"results": results}


@api_router.get("/google-maps/reverse-geocode")
async def google_maps_reverse(lat: float, lng: float):
    """Get address from coordinates using Google Maps Geocoding API"""
    result = await google_maps_reverse_geocode(lat, lng)
    if result:
        return {"success": True, "data": result}
    return {"success": False, "error": "Could not find address"}


@api_router.post("/google-maps/directions")
async def google_maps_directions_endpoint(request: Request):
    """Get directions between points using Google Directions API"""
    try:
        data = await request.json()
        waypoints = data.get("waypoints", [])  # List of {lat, lng} objects
        mode = data.get("mode", "driving")  # driving, walking, bicycling, transit
        
        if len(waypoints) < 2:
            raise HTTPException(status_code=400, detail="At least 2 waypoints required")
        
        origin = (waypoints[0]["lat"], waypoints[0]["lng"])
        destination = (waypoints[-1]["lat"], waypoints[-1]["lng"])
        
        # Get intermediate waypoints if more than 2
        intermediate = None
        if len(waypoints) > 2:
            intermediate = [(wp["lat"], wp["lng"]) for wp in waypoints[1:-1]]
        
        result = await google_maps_get_directions(origin, destination, intermediate, mode)
        
        if result:
            return {
                "success": True,
                "route": {
                    "distance_meters": result["distance"],
                    "distance_km": round(result["distance"] / 1000, 2),
                    "duration_seconds": result["duration"],
                    "duration_minutes": round(result["duration"] / 60, 1),
                    "distance_text": result.get("distance_text", ""),
                    "duration_text": result.get("duration_text", ""),
                    "polyline": result.get("polyline", ""),
                    "legs": result.get("legs", []),
                    "bounds": result.get("bounds", {})
                }
            }
        return {"success": False, "error": "Failed to get directions"}
    except Exception as e:
        logging.error(f"Google Maps directions endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/google-maps/delivery-route")
async def google_maps_delivery_route(request: Request):
    """
    Get optimized delivery route: Partner -> Restaurant -> Customer
    Also calculates live ETA using Google Maps
    """
    try:
        data = await request.json()
        partner_location = data.get("partner_location")  # {lat, lng}
        restaurant_location = data.get("restaurant_location")  # {lat, lng}
        customer_location = data.get("customer_location")  # {lat, lng}
        
        if not all([partner_location, restaurant_location, customer_location]):
            raise HTTPException(status_code=400, detail="All locations required")
        
        origin = (partner_location["lat"], partner_location["lng"])
        destination = (customer_location["lat"], customer_location["lng"])
        waypoint = [(restaurant_location["lat"], restaurant_location["lng"])]
        
        result = await google_maps_get_directions(origin, destination, waypoint, "driving")
        
        if result and result.get("legs"):
            # Leg 0: Partner to Restaurant
            # Leg 1: Restaurant to Customer
            legs = result["legs"]
            leg_to_restaurant = legs[0] if len(legs) > 0 else {}
            leg_to_customer = legs[1] if len(legs) > 1 else {}
            
            return {
                "success": True,
                "route": {
                    "total_distance_km": round(result["distance"] / 1000, 2),
                    "total_duration_minutes": round(result["duration"] / 60, 1),
                    "polyline": result.get("polyline", ""),
                    "partner_to_restaurant": {
                        "distance_km": round(leg_to_restaurant.get("distance", 0) / 1000, 2),
                        "duration_minutes": round(leg_to_restaurant.get("duration", 0) / 60, 1)
                    },
                    "restaurant_to_customer": {
                        "distance_km": round(leg_to_customer.get("distance", 0) / 1000, 2),
                        "duration_minutes": round(leg_to_customer.get("duration", 0) / 60, 1)
                    }
                },
                "eta": {
                    "pickup_minutes": round(leg_to_restaurant.get("duration", 0) / 60, 1),
                    "delivery_minutes": round(result["duration"] / 60, 1)
                }
            }
        return {"success": False, "error": "Failed to calculate delivery route"}
    except Exception as e:
        logging.error(f"Google Maps delivery route error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/google-maps/distance")
async def google_maps_distance_endpoint(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    mode: str = "driving"
):
    """Get distance and duration between two points using Google Distance Matrix API"""
    result = await google_maps_get_distance(
        (origin_lat, origin_lng),
        (dest_lat, dest_lng),
        mode
    )
    return result


# ============== HELPER FUNCTIONS ==============

async def get_next_order_id() -> str:
    """
    Generate sequential order ID in format F00001, F00002, etc.
    Uses MongoDB's findOneAndUpdate for atomic counter increment.
    """
    result = await db.counters.find_one_and_update(
        {"_id": "order_id"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    seq = result["seq"]
    # Format as F followed by 5 digits (e.g., F00001)
    return f"F{seq:05d}"


def hash_password(password: str) -> str:
    """Hash password with SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed

# ============== MODELS ==============

class Address(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str = "Home"
    full_address: str
    lat: Optional[float] = None
    lng: Optional[float] = None

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    phone: str
    name: Optional[str] = None
    email: Optional[str] = None
    role: str = "customer"  # customer, restaurant, delivery, admin
    addresses: List[Address] = []
    password_hash: Optional[str] = None  # For admin users
    is_password_set: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

class OTPRecord(BaseModel):
    phone: str
    otp: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime

class MenuItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    image: str
    category: str
    is_veg: bool = True
    is_available: bool = True

class Restaurant(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    cuisine: List[str]
    image: str
    cover_image: str
    rating: float = 4.0
    delivery_time: str = "30-40 min"
    price_for_two: int = 300
    address: str
    phone: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_veg: bool = False
    is_open: bool = True
    owner_id: Optional[str] = None
    menu: List[MenuItem] = []
    total_orders: int = 0
    total_revenue: float = 0
    # Approval system
    approval_status: str = "pending"  # pending, approved, rejected
    approval_notes: Optional[str] = None
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    # Opening hours
    opening_time: str = "09:00"
    closing_time: str = "22:00"
    # Pending changes (for admin approval)
    pending_changes: Optional[dict] = None
    has_pending_changes: bool = False
    # Additional registration fields
    owned_by: Optional[str] = None
    owner_email: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    city: Optional[str] = None
    fssai_number: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderItem(BaseModel):
    menu_item_id: str
    name: str
    price: float
    quantity: int
    image: str

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_phone: str
    user_name: str
    restaurant_id: str
    restaurant_name: str
    restaurant_address: Optional[str] = None
    restaurant_phone: Optional[str] = None
    items: List[OrderItem]
    total_amount: float
    delivery_address: Address
    status: str = "pending"  # pending, confirmed, preparing, ready, picked_up, delivered, cancelled
    delivery_partner_id: Optional[str] = None
    delivery_partner_name: Optional[str] = None
    payment_method: str = "cod"  # cod, online
    payment_status: str = "pending"  # pending, paid, collected, refunded
    delivery_fee: float = 30.0
    cod_fee: float = 0.0  # COD convenience fee
    is_first_order: bool = False
    notes: Optional[str] = None
    admin_approved: bool = False
    assigned_by_admin: bool = False
    # Cancellation tracking
    cancelled_by: Optional[str] = None  # restaurant, customer, admin
    cancellation_reason: Optional[str] = None
    cancellation_comment: Optional[str] = None
    unavailable_items: Optional[List[str]] = None  # List of unavailable item IDs
    cancelled_at: Optional[str] = None
    # Reorder tracking
    is_reorder: bool = False
    original_order_id: Optional[str] = None
    refund_status: Optional[str] = None  # pending, processed, failed
    refund_amount: Optional[float] = None
    # Notifications
    restaurant_notified: bool = False
    delivery_notified: bool = False
    # Time tracking
    estimated_prep_time: Optional[int] = None
    estimated_delivery_time: Optional[int] = None
    confirmed_at: Optional[str] = None
    ready_at: Optional[str] = None
    picked_up_at: Optional[str] = None
    delivered_at: Optional[str] = None
    # Delay tracking
    is_delayed: bool = False
    delay_reason: Optional[str] = None
    delay_minutes: int = 0
    # Payment & Settlement tracking
    restaurant_payout: Optional[float] = None  # Amount to pay restaurant (total - platform fee)
    restaurant_payout_status: str = "pending"  # pending, cleared
    restaurant_payout_date: Optional[str] = None
    delivery_partner_earning: Optional[float] = None  # 95% of delivery fee
    delivery_partner_cod_collected: Optional[float] = None  # COD amount collected
    delivery_partner_settlement_status: str = "pending"  # pending, cleared
    delivery_partner_settlement_date: Optional[str] = None
    platform_commission: Optional[float] = None  # Platform's cut (5% of order + 5% of delivery)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DeliveryPartner(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    phone: str
    vehicle_number: str
    vehicle_type: str = "bike"  # bike, scooter, car
    is_available: bool = True
    is_online: bool = False
    current_location: Optional[dict] = None  # {lat, lng, address, updated_at}
    # Approval system
    approval_status: str = "pending"  # pending, approved, rejected
    approval_notes: Optional[str] = None
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    # Stats
    total_deliveries: int = 0
    total_earnings: float = 0
    today_deliveries: int = 0
    today_earnings: float = 0
    rating: float = 5.0
    # Documents (for verification)
    id_proof: Optional[str] = None
    license_number: Optional[str] = None
    license_image: Optional[str] = None
    # Additional registration fields
    email: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    city: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Notification model for real-time alerts
class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    recipient_type: str  # restaurant, delivery, customer, admin
    recipient_id: str
    type: str  # new_order, order_update, delivery_request, approval_required, etc.
    title: str
    message: str
    data: Optional[dict] = None  # Additional data like order_id, etc.
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Promotional Offer / Coupon model
class PromoCode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str  # e.g., "FLAT50", "WELCOME20"
    description: str
    discount_type: str = "percentage"  # percentage, flat, free_delivery
    discount_value: float  # percentage or flat amount
    min_order_amount: float = 0
    max_discount: Optional[float] = None  # Cap for percentage discounts
    valid_from: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    valid_until: Optional[datetime] = None
    usage_limit: Optional[int] = None  # Total usage limit
    per_user_limit: int = 1
    applicable_restaurants: List[str] = []  # Empty = all restaurants
    is_active: bool = True
    usage_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Promo usage tracking
class PromoUsage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    promo_id: str
    promo_code: str
    user_id: str
    order_id: str
    discount_applied: float
    used_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Customer Review model for restaurants and delivery partners
class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    customer_id: str
    customer_name: str
    customer_phone: str
    # Restaurant review
    restaurant_id: str
    restaurant_name: str
    restaurant_rating: int  # 1-5 stars
    restaurant_comment: Optional[str] = None
    # Delivery partner review
    delivery_partner_id: Optional[str] = None
    delivery_partner_name: Optional[str] = None
    delivery_rating: Optional[int] = None  # 1-5 stars
    delivery_comment: Optional[str] = None
    # Approval system
    status: str = "pending"  # pending, approved, rejected
    admin_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Order tracking model for live tracking
class OrderTracking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    status: str
    location: Optional[dict] = None  # {lat, lng, address}
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    message: Optional[str] = None

# Push notification subscription
class PushSubscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    endpoint: str
    keys: dict  # {p256dh, auth}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== REQUEST/RESPONSE MODELS ==============

class SendOTPRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str
    role: str = "customer"
    name: Optional[str] = None

# Password Authentication Models
class RegisterWithPasswordRequest(BaseModel):
    phone: str
    password: str
    confirm_password: str
    name: Optional[str] = None
    role: str = "customer"

class LoginWithPasswordRequest(BaseModel):
    phone: str
    password: str
    role: str = "customer"

class SetPasswordRequest(BaseModel):
    phone: str
    password: str
    confirm_password: str
    role: str = "customer"

class ForgotPasswordRequest(BaseModel):
    phone: str
    role: str = "customer"

class ResetPasswordRequest(BaseModel):
    phone: str
    otp: str
    new_password: str
    confirm_password: str
    role: str = "customer"

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    fssai_licence: Optional[str] = None
    driving_licence: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    city: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_type: Optional[str] = None
    photo: Optional[str] = None
    license_image: Optional[str] = None

class AddAddressRequest(BaseModel):
    label: str
    full_address: str
    lat: Optional[float] = None
    lng: Optional[float] = None

class CreateOrderRequest(BaseModel):
    restaurant_id: str
    items: List[OrderItem]
    delivery_address: Address
    payment_method: str = "cod"  # cod, prepaid
    promo_code: Optional[str] = None
    notes: Optional[str] = None
    delivery_fee: Optional[float] = None
    cod_fee: Optional[float] = None
    is_first_order: Optional[bool] = False

class UpdateOrderStatusRequest(BaseModel):
    status: str
    delivery_partner_id: Optional[str] = None

class CreateRestaurantRequest(BaseModel):
    name: str
    description: str = ""
    cuisine: List[str] = []
    image: str = ""
    cover_image: str = ""
    address: str
    price_for_two: int = 300
    is_veg: bool = False
    rating: float = 4.0
    delivery_time: str = "30-40 min"
    opening_time: str = "09:00"
    closing_time: str = "22:00"
    lat: Optional[float] = None
    lng: Optional[float] = None
    # New fields
    owned_by: Optional[str] = None
    owner_email: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    city: Optional[str] = None
    fssai_number: Optional[str] = None
    phone: Optional[str] = None

class AddMenuItemRequest(BaseModel):
    name: str
    description: str
    price: float
    image: str
    category: str
    is_veg: bool = True

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class RegisterDeliveryPartnerRequest(BaseModel):
    name: str
    vehicle_number: str
    vehicle_type: str = "bike"
    id_proof: Optional[str] = None
    license_number: Optional[str] = None

class UpdateDeliveryLocationRequest(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None

# Restaurant Discount Models
class RestaurantDiscount(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    restaurant_id: str
    name: str
    description: str
    discount_type: str  # percentage, buy_one_get_one, min_order_value
    discount_value: float  # percentage or fixed amount
    min_order_amount: float = 0  # minimum order value required
    max_discount: Optional[float] = None  # cap for percentage discounts
    applicable_items: List[str] = []  # menu item IDs (empty = all items)
    display_message: str  # message shown below restaurant image
    is_active: bool = True
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CreateRestaurantDiscountRequest(BaseModel):
    name: str
    description: str
    discount_type: str  # percentage, buy_one_get_one, min_order_value
    discount_value: float
    min_order_amount: float = 0
    max_discount: Optional[float] = None
    applicable_items: List[str] = []
    display_message: str
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None

# COD Settlement Models
class CODSettlement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    delivery_partner_id: str
    delivery_partner_name: str
    delivery_partner_phone: str
    amount: float
    comment: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected
    admin_comment: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SubmitCODSettlementRequest(BaseModel):
    amount: float
    comment: Optional[str] = None

class ApproveCODSettlementRequest(BaseModel):
    action: str  # approve, reject
    comment: Optional[str] = None

# Restaurant Payout Models
class RestaurantPayoutComment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    restaurant_id: str
    order_id: str
    comment: str
    created_by: str  # restaurant or admin
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AddPayoutCommentRequest(BaseModel):
    order_id: str
    comment: str

# Promotional Slide Models
class PromotionalSlide(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subtitle: str
    description: str
    background_gradient: str = "from-orange-500 to-red-500"  # Tailwind gradient classes
    icon: str = "gift"  # Icon name: gift, truck, percent, star, etc.
    order: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CreateSlideRequest(BaseModel):
    title: str
    subtitle: str
    description: str
    background_gradient: str = "from-orange-500 to-red-500"
    icon: str = "gift"
    order: int = 0

class UpdateSlideRequest(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    background_gradient: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None

# Restaurant pending changes request
class RestaurantPendingChangesRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cuisine: Optional[List[str]] = None
    image: Optional[str] = None
    address: Optional[str] = None
    price_for_two: Optional[int] = None
    is_veg: Optional[bool] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    menu_changes: Optional[List[dict]] = None  # [{action: add/update/delete, item: {...}}]

# Admin Request Models
class AdminLoginRequest(BaseModel):
    phone: str
    password: Optional[str] = None
    otp: Optional[str] = None

class AdminSetPasswordRequest(BaseModel):
    phone: str
    password: str

class CreateAdminRequest(BaseModel):
    phone: str
    name: str
    email: Optional[str] = None

class AdminAssignDeliveryRequest(BaseModel):
    order_id: str
    delivery_partner_id: str
    auto_assign: bool = False

class AdminUpdateRestaurantRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cuisine: Optional[List[str]] = None
    image: Optional[str] = None
    cover_image: Optional[str] = None
    address: Optional[str] = None
    price_for_two: Optional[int] = None
    is_veg: Optional[bool] = None
    is_open: Optional[bool] = None
    rating: Optional[float] = None
    delivery_time: Optional[str] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    # Location coordinates
    lat: Optional[float] = None
    lng: Optional[float] = None
    # New fields
    owned_by: Optional[str] = None
    owner_email: Optional[str] = None
    phone: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    city: Optional[str] = None
    fssai_number: Optional[str] = None

class AdminApprovalRequest(BaseModel):
    action: str  # approve, reject
    notes: Optional[str] = None

class AdminApproveChangesRequest(BaseModel):
    approve: bool
    notes: Optional[str] = None

# Promo Code Request Models
class CreatePromoRequest(BaseModel):
    code: str
    description: str
    discount_type: str = "percentage"  # percentage, flat, free_delivery
    discount_value: float
    min_order_amount: float = 0
    max_discount: Optional[float] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    usage_limit: Optional[int] = None
    per_user_limit: int = 1
    applicable_restaurants: List[str] = []
    is_active: bool = True

class ApplyPromoRequest(BaseModel):
    code: str
    order_amount: float
    restaurant_id: str
    user_id: str

# Push Notification Request Models
class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: dict

class UpdateTrackingRequest(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None
    message: Optional[str] = None

# ============== AUTH ENDPOINTS ==============

# Ping4SMS API Configuration - Read from environment
PING4SMS_API_KEY = os.environ.get("PING4SMS_API_KEY", "")
PING4SMS_SENDER = os.environ.get("PING4SMS_SENDER", "PNGOTP")
PING4SMS_TEMPLATE_ID = os.environ.get("PING4SMS_TEMPLATE_ID", "")

async def send_sms_otp(phone: str, otp: str):
    """Send OTP via Ping4SMS API"""
    import aiohttp
    
    # Format phone number (remove +91 if present)
    clean_phone = phone.replace("+91", "").replace("+", "").strip()
    if len(clean_phone) == 10:
        clean_phone = "91" + clean_phone
    
    # Prepare SMS message
    sms_message = f"Dear Customer,{otp} is your verification code -PNGOTP"
    
    # API URL
    api_url = (
        f"https://site.ping4sms.com/api/smsapi?"
        f"key={PING4SMS_API_KEY}&route=2&sender={PING4SMS_SENDER}"
        f"&number={clean_phone}&sms={sms_message}&templateid={PING4SMS_TEMPLATE_ID}"
    )
    
    try:
        # Set a 5 second timeout for SMS API
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(api_url) as response:
                result = await response.text()
                logging.info(f"SMS API Response for {clean_phone}: {result}")
                return True
    except asyncio.TimeoutError:
        logging.warning(f"SMS API timeout for {clean_phone} - OTP still logged")
        return False
    except Exception as e:
        logging.error(f"Failed to send SMS to {clean_phone}: {e}")
        return False

@api_router.post("/auth/send-otp")
@limiter.limit("5/minute")  # Rate limit: 5 OTP requests per minute per IP
async def send_otp(request: Request, otp_request: SendOTPRequest):
    """Send OTP to phone number via Ping4SMS"""
    # Validate phone number format
    if not validate_phone(otp_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    otp = ''.join(random.choices(string.digits, k=5))
    
    # Store OTP in database with expiry (5 minutes)
    otp_record = {
        "phone": otp_request.phone,
        "otp": otp,
        "attempts": 0,  # Track failed attempts
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    }
    
    await db.otps.delete_many({"phone": otp_request.phone})
    await db.otps.insert_one(otp_record)
    
    # Send OTP via SMS
    sms_sent = await send_sms_otp(otp_request.phone, otp)
    
    # Log OTP for debugging (remove in production)
    logging.info(f"OTP for {otp_request.phone}: {otp}")
    
    return {"message": "OTP sent successfully", "sms_sent": sms_sent}

@api_router.post("/auth/verify-otp")
@limiter.limit("10/minute")  # Rate limit: 10 verify attempts per minute per IP
async def verify_otp(request: Request, otp_request: VerifyOTPRequest):
    """Verify OTP and login/register user"""
    # Validate phone number format
    if not validate_phone(otp_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Find OTP record
    otp_record = await db.otps.find_one({"phone": otp_request.phone}, {"_id": 0})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="OTP not found. Please request a new OTP.")
    
    # Check if OTP has expired
    expires_at = datetime.fromisoformat(otp_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.otps.delete_many({"phone": otp_request.phone})
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new OTP.")
    
    # Check failed attempts (max 3)
    if otp_record.get("attempts", 0) >= 3:
        await db.otps.delete_many({"phone": otp_request.phone})
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please request a new OTP.")
    
    if otp_record["otp"] != otp_request.otp:
        # Increment failed attempts
        await db.otps.update_one(
            {"phone": otp_request.phone},
            {"$inc": {"attempts": 1}}
        )
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Delete used OTP
    await db.otps.delete_many({"phone": otp_request.phone})
    
    # Check if user exists
    user = await db.users.find_one({"phone": otp_request.phone}, {"_id": 0})
    
    if user:
        # Check if user is trying to login with a different role
        existing_role = user.get("role", "customer")
        requested_role = otp_request.role or "customer"
        
        # Prevent role switching - phone number is tied to one user type
        if existing_role != requested_role and existing_role != "customer":
            role_names = {
                "customer": "Customer",
                "restaurant": "Restaurant Partner", 
                "delivery": "Delivery Partner"
            }
            raise HTTPException(
                status_code=400, 
                detail=f"This mobile number is already registered as {role_names.get(existing_role, existing_role)}. Please use a different number or login as {role_names.get(existing_role, existing_role)}."
            )
        
        # Update role and last login
        update_data = {"last_login": datetime.now(timezone.utc).isoformat()}
        if requested_role and existing_role == "customer" and requested_role != "customer":
            # Allow upgrading from customer to partner role
            update_data["role"] = requested_role
        
        await db.users.update_one(
            {"phone": otp_request.phone},
            {"$set": update_data}
        )
        user["role"] = update_data.get("role", existing_role)
        user["last_login"] = update_data["last_login"]
        return {"message": "Login successful", "user": user, "is_new": False}
    
    # Create new user with sanitized name
    sanitized_name = sanitize_input(otp_request.name) if otp_request.name else f"User_{otp_request.phone[-4:]}"
    new_user = User(
        phone=otp_request.phone,
        name=sanitized_name,
        role=otp_request.role
    )
    user_dict = new_user.model_dump()
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    user_dict["last_login"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Remove _id from response
    user_dict.pop("_id", None)
    
    return {"message": "Registration successful", "user": user_dict, "is_new": True}

# ============== PASSWORD AUTHENTICATION ENDPOINTS ==============

def validate_password(password: str) -> tuple[bool, str]:
    """Validate password: 8+ chars with at least 1 number"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least 1 number"
    return True, ""


@api_router.post("/auth/set-password")
@limiter.limit("5/minute")
async def set_password(request: Request, pwd_request: SetPasswordRequest):
    """Set password after OTP verification (for new users or existing users)"""
    # Validate phone
    if not validate_phone(pwd_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Check passwords match
    if pwd_request.password != pwd_request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    # Validate password strength
    is_valid, msg = validate_password(pwd_request.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)
    
    # Find user
    user = await db.users.find_one({"phone": pwd_request.phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please verify OTP first.")
    
    # Hash and save password
    password_hash = hash_password(pwd_request.password)
    await db.users.update_one(
        {"phone": pwd_request.phone},
        {"$set": {
            "password_hash": password_hash,
            "is_password_set": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Password set successfully"}


@api_router.post("/auth/login-password")
@limiter.limit("10/minute")
async def login_with_password(request: Request, login_request: LoginWithPasswordRequest):
    """Login with phone and password"""
    # Validate phone
    if not validate_phone(login_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Find user with password hash
    user = await db.users.find_one({"phone": login_request.phone}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is trying to login with a different role
    existing_role = user.get("role", "customer")
    requested_role = login_request.role or "customer"
    
    if existing_role != requested_role and existing_role != "customer":
        role_names = {
            "customer": "Customer",
            "restaurant": "Restaurant Partner", 
            "delivery": "Delivery Partner"
        }
        raise HTTPException(
            status_code=400, 
            detail=f"This mobile number is registered as {role_names.get(existing_role, existing_role)}. Please login from the correct portal."
        )
    
    # Check if password is set
    if not user.get("is_password_set"):
        raise HTTPException(status_code=400, detail="Password not set. Please login with OTP first and set a password.")
    
    # Verify password
    if not verify_password(login_request.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Update last login
    await db.users.update_one(
        {"phone": login_request.phone},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Remove password hash from response
    user.pop("password_hash", None)
    user["last_login"] = datetime.now(timezone.utc).isoformat()
    
    return {"message": "Login successful", "user": user}


@api_router.post("/auth/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, forgot_request: ForgotPasswordRequest):
    """Send OTP for password reset"""
    # Validate phone
    if not validate_phone(forgot_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Check if user exists
    user = await db.users.find_one({"phone": forgot_request.phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate OTP
    otp = ''.join(random.choices(string.digits, k=5))
    
    otp_record = {
        "phone": forgot_request.phone,
        "otp": otp,
        "type": "password_reset",
        "attempts": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    }
    
    await db.otps.delete_many({"phone": forgot_request.phone, "type": "password_reset"})
    await db.otps.insert_one(otp_record)
    
    # Send OTP via SMS
    sms_sent = await send_sms_otp(forgot_request.phone, otp)
    
    logging.info(f"Password reset OTP for {forgot_request.phone}: {otp}")
    
    return {"message": "OTP sent for password reset", "sms_sent": sms_sent}


@api_router.post("/auth/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, reset_request: ResetPasswordRequest):
    """Reset password with OTP verification"""
    # Validate phone
    if not validate_phone(reset_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Check passwords match
    if reset_request.new_password != reset_request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    # Validate password strength
    is_valid, msg = validate_password(reset_request.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)
    
    # Find OTP record
    otp_record = await db.otps.find_one({"phone": reset_request.phone, "type": "password_reset"}, {"_id": 0})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="OTP not found. Please request a new one.")
    
    # Check if OTP has expired
    expires_at = datetime.fromisoformat(otp_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.otps.delete_many({"phone": reset_request.phone, "type": "password_reset"})
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new OTP.")
    
    # Check failed attempts
    if otp_record.get("attempts", 0) >= 3:
        await db.otps.delete_many({"phone": reset_request.phone, "type": "password_reset"})
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please request a new OTP.")
    
    # Verify OTP
    if otp_record["otp"] != reset_request.otp:
        await db.otps.update_one(
            {"phone": reset_request.phone, "type": "password_reset"},
            {"$inc": {"attempts": 1}}
        )
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Delete used OTP
    await db.otps.delete_many({"phone": reset_request.phone, "type": "password_reset"})
    
    # Update password
    password_hash = hash_password(reset_request.new_password)
    await db.users.update_one(
        {"phone": reset_request.phone},
        {"$set": {
            "password_hash": password_hash,
            "is_password_set": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Password reset successfully"}


@api_router.get("/auth/check-password-status/{phone}")
async def check_password_status(phone: str):
    """Check if user has password set"""
    if not validate_phone(phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    user = await db.users.find_one({"phone": phone}, {"_id": 0, "is_password_set": 1})
    
    if not user:
        return {"exists": False, "has_password": False}
    
    return {"exists": True, "has_password": user.get("is_password_set", False)}

@api_router.get("/admin/check-status/{phone}")
async def check_admin_status(phone: str):
    """Check if admin exists and has password set"""
    if not validate_phone(phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    admin = await db.users.find_one({"phone": phone, "role": "admin"}, {"_id": 0, "is_password_set": 1})
    
    if not admin:
        return {"exists": False, "has_password": False}
    
    return {"exists": True, "has_password": admin.get("is_password_set", False)}


# ============== ADMIN AUTH ENDPOINTS ==============

# Master phone for receiving all admin OTPs
ADMIN_OTP_MASTER_PHONE = os.environ.get("ADMIN_OTP_MASTER_PHONE", "")
MAX_ADMIN_COUNT = 10

@api_router.post("/admin/signup/send-otp")
@limiter.limit("3/minute")
async def admin_signup_send_otp(request: Request, otp_request: SendOTPRequest):
    """Send OTP for admin signup - OTP always goes to master phone 9566722970"""
    # Validate phone number format
    if not validate_phone(otp_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Check if admin already exists
    existing_admin = await db.users.find_one({"phone": otp_request.phone, "role": "admin"}, {"_id": 0})
    if existing_admin:
        raise HTTPException(status_code=400, detail="Admin with this phone already exists. Please login instead.")
    
    # Check max admin limit
    admin_count = await db.users.count_documents({"role": "admin"})
    if admin_count >= MAX_ADMIN_COUNT:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_ADMIN_COUNT} admins allowed. Cannot create more admins.")
    
    otp = ''.join(random.choices(string.digits, k=5))
    
    otp_record = {
        "phone": otp_request.phone,
        "otp": otp,
        "type": "admin_signup",
        "attempts": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    }
    
    await db.otps.delete_many({"phone": otp_request.phone, "type": "admin_signup"})
    await db.otps.insert_one(otp_record)
    
    # Send OTP to master phone only
    sms_sent = await send_sms_otp(ADMIN_OTP_MASTER_PHONE, otp)
    
    logging.info(f"Admin Signup OTP for {otp_request.phone} sent to {ADMIN_OTP_MASTER_PHONE}: {otp}")
    
    return {"message": f"OTP sent to master phone ({ADMIN_OTP_MASTER_PHONE[-4:].rjust(10, '*')})", "sms_sent": sms_sent}

@api_router.post("/admin/signup/verify-otp")
@limiter.limit("5/minute")
async def admin_signup_verify_otp(request: Request, otp_request: VerifyOTPRequest):
    """Verify OTP for admin signup"""
    if not validate_phone(otp_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    otp_record = await db.otps.find_one({"phone": otp_request.phone, "type": "admin_signup"}, {"_id": 0})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="OTP not found. Please request a new OTP.")
    
    expires_at = datetime.fromisoformat(otp_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.otps.delete_many({"phone": otp_request.phone, "type": "admin_signup"})
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new OTP.")
    
    if otp_record.get("attempts", 0) >= 3:
        await db.otps.delete_many({"phone": otp_request.phone, "type": "admin_signup"})
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please request a new OTP.")
    
    if otp_record["otp"] != otp_request.otp:
        await db.otps.update_one(
            {"phone": otp_request.phone, "type": "admin_signup"},
            {"$inc": {"attempts": 1}}
        )
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Mark OTP as verified but don't delete yet (needed for password setup)
    await db.otps.update_one(
        {"phone": otp_request.phone, "type": "admin_signup"},
        {"$set": {"verified": True}}
    )
    
    return {"message": "OTP verified successfully. Please set your password."}

class AdminSignupPasswordRequest(BaseModel):
    phone: str
    password: str
    name: Optional[str] = None

@api_router.post("/admin/signup/set-password")
async def admin_signup_set_password(request: AdminSignupPasswordRequest):
    """Complete admin signup by setting password"""
    if not validate_phone(request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Check if OTP was verified
    otp_record = await db.otps.find_one({"phone": request.phone, "type": "admin_signup", "verified": True}, {"_id": 0})
    if not otp_record:
        raise HTTPException(status_code=400, detail="Please verify OTP first")
    
    # Validate password (minimum 8 characters)
    if len(request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Check max admin limit again
    admin_count = await db.users.count_documents({"role": "admin"})
    if admin_count >= MAX_ADMIN_COUNT:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_ADMIN_COUNT} admins reached")
    
    # Check if admin already exists
    existing = await db.users.find_one({"phone": request.phone, "role": "admin"}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Admin already exists")
    
    password_hash = hash_password(request.password)
    
    new_admin = {
        "id": str(uuid.uuid4()),
        "phone": request.phone,
        "name": sanitize_input(request.name) if request.name else f"Admin {request.phone[-4:]}",
        "role": "admin",
        "is_super_admin": True,  # All admins are super admins
        "password_hash": password_hash,
        "is_password_set": True,
        "addresses": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_login": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(new_admin)
    new_admin.pop("_id", None)
    new_admin.pop("password_hash", None)
    
    # Clean up OTP
    await db.otps.delete_many({"phone": request.phone, "type": "admin_signup"})
    
    return {"message": "Admin account created successfully", "user": new_admin}

@api_router.post("/admin/send-otp")
@limiter.limit("3/minute")
async def admin_send_otp(request: Request, otp_request: SendOTPRequest):
    """Send OTP for admin login - OTP always goes to master phone 9566722970"""
    if not validate_phone(otp_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Check if admin exists
    admin = await db.users.find_one({"phone": otp_request.phone, "role": "admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found. Please sign up first.")
    
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
    
    # Send OTP to master phone only
    sms_sent = await send_sms_otp(ADMIN_OTP_MASTER_PHONE, otp)
    
    logging.info(f"Admin Login OTP for {otp_request.phone} sent to {ADMIN_OTP_MASTER_PHONE}: {otp}")
    
    return {"message": f"OTP sent to master phone ({ADMIN_OTP_MASTER_PHONE[-4:].rjust(10, '*')})", "sms_sent": sms_sent}

@api_router.post("/admin/verify-otp")
@limiter.limit("5/minute")
async def admin_verify_otp(request: Request, otp_request: VerifyOTPRequest):
    """Verify OTP for admin login"""
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
    
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    await db.users.update_one(
        {"phone": otp_request.phone},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    admin["last_login"] = datetime.now(timezone.utc).isoformat()
    
    return {"message": "Login successful", "user": admin}

@api_router.post("/admin/forgot-password/send-otp")
@limiter.limit("3/minute")
async def admin_forgot_password_send_otp(request: Request, otp_request: SendOTPRequest):
    """Send OTP for admin forgot password - OTP always goes to master phone 9566722970"""
    if not validate_phone(otp_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Check if admin exists
    admin = await db.users.find_one({"phone": otp_request.phone, "role": "admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    otp = ''.join(random.choices(string.digits, k=5))
    
    otp_record = {
        "phone": otp_request.phone,
        "otp": otp,
        "type": "admin_forgot_password",
        "attempts": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    }
    
    await db.otps.delete_many({"phone": otp_request.phone, "type": "admin_forgot_password"})
    await db.otps.insert_one(otp_record)
    
    # Send OTP to master phone only
    sms_sent = await send_sms_otp(ADMIN_OTP_MASTER_PHONE, otp)
    
    logging.info(f"Admin Forgot Password OTP for {otp_request.phone} sent to {ADMIN_OTP_MASTER_PHONE}: {otp}")
    
    return {"message": f"OTP sent to master phone ({ADMIN_OTP_MASTER_PHONE[-4:].rjust(10, '*')})", "sms_sent": sms_sent}

@api_router.post("/admin/forgot-password/verify-otp")
@limiter.limit("5/minute")
async def admin_forgot_password_verify_otp(request: Request, otp_request: VerifyOTPRequest):
    """Verify OTP for admin forgot password"""
    if not validate_phone(otp_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    otp_record = await db.otps.find_one({"phone": otp_request.phone, "type": "admin_forgot_password"}, {"_id": 0})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="OTP not found")
    
    expires_at = datetime.fromisoformat(otp_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.otps.delete_many({"phone": otp_request.phone, "type": "admin_forgot_password"})
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new OTP.")
    
    if otp_record.get("attempts", 0) >= 3:
        await db.otps.delete_many({"phone": otp_request.phone, "type": "admin_forgot_password"})
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please request a new OTP.")
    
    if otp_record["otp"] != otp_request.otp:
        await db.otps.update_one(
            {"phone": otp_request.phone, "type": "admin_forgot_password"},
            {"$inc": {"attempts": 1}}
        )
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Mark as verified for password reset
    await db.otps.update_one(
        {"phone": otp_request.phone, "type": "admin_forgot_password"},
        {"$set": {"verified": True}}
    )
    
    return {"message": "OTP verified. Please set your new password."}

@api_router.post("/admin/forgot-password/reset")
async def admin_forgot_password_reset(request: AdminSetPasswordRequest):
    """Reset admin password after OTP verification"""
    if not validate_phone(request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Check if OTP was verified
    otp_record = await db.otps.find_one({"phone": request.phone, "type": "admin_forgot_password", "verified": True}, {"_id": 0})
    if not otp_record:
        raise HTTPException(status_code=400, detail="Please verify OTP first")
    
    # Validate password
    if len(request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    admin = await db.users.find_one({"phone": request.phone, "role": "admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    password_hash = hash_password(request.password)
    
    await db.users.update_one(
        {"phone": request.phone},
        {"$set": {"password_hash": password_hash, "is_password_set": True}}
    )
    
    # Clean up OTP
    await db.otps.delete_many({"phone": request.phone, "type": "admin_forgot_password"})
    
    return {"message": "Password reset successfully"}

@api_router.get("/admin/count")
async def get_admin_count():
    """Get current admin count and max allowed"""
    count = await db.users.count_documents({"role": "admin"})
    return {"current": count, "max": MAX_ADMIN_COUNT, "can_signup": count < MAX_ADMIN_COUNT}

class ClearDataRequest(BaseModel):
    confirmation: str  # Must be "CLEAR_ALL_DATA"
    admin_phone: str

@api_router.post("/admin/clear-all-data")
async def clear_all_data(request: ClearDataRequest):
    """Clear all user and admin data - DANGEROUS OPERATION"""
    # Verify confirmation
    if request.confirmation != "CLEAR_ALL_DATA":
        raise HTTPException(status_code=400, detail="Invalid confirmation. Type 'CLEAR_ALL_DATA' to confirm.")
    
    # Verify admin exists
    admin = await db.users.find_one({"phone": request.admin_phone, "role": "admin"}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Admin verification failed")
    
    # Clear all collections
    collections_cleared = []
    
    # Clear users
    result = await db.users.delete_many({})
    collections_cleared.append(f"users: {result.deleted_count}")
    
    # Clear OTPs
    result = await db.otps.delete_many({})
    collections_cleared.append(f"otps: {result.deleted_count}")
    
    # Clear orders
    result = await db.orders.delete_many({})
    collections_cleared.append(f"orders: {result.deleted_count}")
    
    # Clear restaurants
    result = await db.restaurants.delete_many({})
    collections_cleared.append(f"restaurants: {result.deleted_count}")
    
    # Clear menu items
    result = await db.menu_items.delete_many({})
    collections_cleared.append(f"menu_items: {result.deleted_count}")
    
    # Clear delivery partners data
    result = await db.delivery_partners.delete_many({})
    collections_cleared.append(f"delivery_partners: {result.deleted_count}")
    
    # Clear reviews
    result = await db.reviews.delete_many({})
    collections_cleared.append(f"reviews: {result.deleted_count}")
    
    # Clear feedback
    result = await db.feedback.delete_many({})
    collections_cleared.append(f"feedback: {result.deleted_count}")
    
    # Clear promo codes
    result = await db.promo_codes.delete_many({})
    collections_cleared.append(f"promo_codes: {result.deleted_count}")
    
    # Clear notifications
    result = await db.notifications.delete_many({})
    collections_cleared.append(f"notifications: {result.deleted_count}")
    
    # Clear promotional slides
    result = await db.promotional_slides.delete_many({})
    collections_cleared.append(f"promotional_slides: {result.deleted_count}")
    
    # Clear restaurant discounts
    result = await db.restaurant_discounts.delete_many({})
    collections_cleared.append(f"restaurant_discounts: {result.deleted_count}")
    
    # Clear COD settlements
    result = await db.cod_settlements.delete_many({})
    collections_cleared.append(f"cod_settlements: {result.deleted_count}")
    
    # Clear restaurant payouts
    result = await db.restaurant_payouts.delete_many({})
    collections_cleared.append(f"restaurant_payouts: {result.deleted_count}")
    
    logging.warning(f"ALL DATA CLEARED by admin {request.admin_phone}: {collections_cleared}")
    
    return {
        "message": "All data cleared successfully",
        "cleared": collections_cleared
    }

@api_router.post("/admin/set-password")
async def admin_set_password(request: AdminSetPasswordRequest):
    """Set password for admin (after first OTP login or for reset)"""
    admin = await db.users.find_one({"phone": request.phone, "role": "admin"}, {"_id": 0})
    
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    password_hash = hash_password(request.password)
    
    await db.users.update_one(
        {"phone": request.phone},
        {"$set": {"password_hash": password_hash, "is_password_set": True}}
    )
    
    return {"message": "Password set successfully"}

@api_router.post("/admin/reset-password")
async def admin_reset_password(request: AdminSetPasswordRequest):
    """Reset password for admin (after OTP verification)"""
    # This endpoint allows resetting password - same as set-password
    # The OTP verification step should happen before calling this
    admin = await db.users.find_one({"phone": request.phone, "role": "admin"}, {"_id": 0})
    
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    password_hash = hash_password(request.password)
    
    await db.users.update_one(
        {"phone": request.phone},
        {"$set": {"password_hash": password_hash, "is_password_set": True}}
    )
    
    return {"message": "Password reset successfully"}

@api_router.post("/admin/login")
async def admin_login(request: AdminLoginRequest):
    """Admin login with password (after initial setup)"""
    # First get admin with password_hash for verification
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
    
    # Get admin again without password_hash for response
    admin = await db.users.find_one({"phone": request.phone, "role": "admin"}, {"_id": 0, "password_hash": 0})
    admin["last_login"] = datetime.now(timezone.utc).isoformat()
    
    return {"message": "Login successful", "user": admin}

@api_router.post("/admin/create-admin")
async def create_admin(request: CreateAdminRequest, creator_phone: str):
    """Super admin creates other admin accounts"""
    # Verify creator is super admin
    creator = await db.users.find_one({"phone": creator_phone, "role": "admin"}, {"_id": 0})
    
    if not creator or not creator.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Only super admin can create other admins")
    
    # Check if phone already exists
    existing = await db.users.find_one({"phone": request.phone}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="User with this phone already exists")
    
    new_admin = {
        "id": str(uuid.uuid4()),
        "phone": request.phone,
        "name": request.name,
        "email": request.email,
        "role": "admin",
        "is_super_admin": False,  # Always create regular admin
        "is_password_set": False,
        "addresses": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(new_admin)
    new_admin.pop("_id", None)
    
    return {"message": "Admin created successfully", "admin": new_admin}

@api_router.get("/admin/list")
async def list_admins(requester_phone: str):
    """List all admins (super admin only)"""
    requester = await db.users.find_one({"phone": requester_phone, "role": "admin"}, {"_id": 0})
    
    if not requester or not requester.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Only super admin can view admin list")
    
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "password_hash": 0}).to_list(100)
    return admins

@api_router.delete("/admin/{admin_id}")
async def delete_admin(admin_id: str, requester_phone: str):
    """Delete admin account (super admin only)"""
    requester = await db.users.find_one({"phone": requester_phone, "role": "admin"}, {"_id": 0})
    
    if not requester or not requester.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Only super admin can delete admins")
    
    admin_to_delete = await db.users.find_one({"id": admin_id, "role": "admin"}, {"_id": 0})
    
    if not admin_to_delete:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    if admin_to_delete.get("is_super_admin"):
        raise HTTPException(status_code=400, detail="Cannot delete super admin")
    
    await db.users.delete_one({"id": admin_id})
    return {"message": "Admin deleted successfully"}

# ============== ADMIN DASHBOARD ENDPOINTS ==============

@api_router.get("/admin/dashboard/stats")
async def get_admin_dashboard_stats():
    """Get admin dashboard statistics"""
    # Total users
    total_users = await db.users.count_documents({"role": {"$ne": "admin"}})
    total_customers = await db.users.count_documents({"role": "customer"})
    total_restaurant_owners = await db.users.count_documents({"role": "restaurant"})
    total_delivery_partners = await db.delivery_partners.count_documents({})
    
    # Total restaurants
    total_restaurants = await db.restaurants.count_documents({})
    active_restaurants = await db.restaurants.count_documents({"is_open": True})
    
    # Orders stats
    total_orders = await db.orders.count_documents({})
    pending_orders = await db.orders.count_documents({"status": "pending"})
    active_orders = await db.orders.count_documents({"status": {"$in": ["confirmed", "preparing", "ready", "picked_up"]}})
    delivered_orders = await db.orders.count_documents({"status": "delivered"})
    cancelled_orders = await db.orders.count_documents({"status": "cancelled"})
    
    # Revenue calculations
    orders = await db.orders.find({"status": "delivered"}, {"_id": 0, "total_amount": 1, "created_at": 1}).to_list(10000)
    total_revenue = sum(o.get("total_amount", 0) for o in orders)
    
    # Today's stats
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_orders = await db.orders.count_documents({
        "created_at": {"$gte": today.isoformat()}
    })
    today_revenue_orders = await db.orders.find({
        "status": "delivered",
        "created_at": {"$gte": today.isoformat()}
    }, {"_id": 0, "total_amount": 1}).to_list(1000)
    today_revenue = sum(o.get("total_amount", 0) for o in today_revenue_orders)
    
    # This week's stats
    week_ago = today - timedelta(days=7)
    week_orders = await db.orders.count_documents({
        "created_at": {"$gte": week_ago.isoformat()}
    })
    week_revenue_orders = await db.orders.find({
        "status": "delivered",
        "created_at": {"$gte": week_ago.isoformat()}
    }, {"_id": 0, "total_amount": 1}).to_list(1000)
    week_revenue = sum(o.get("total_amount", 0) for o in week_revenue_orders)
    
    # This month's stats
    month_ago = today - timedelta(days=30)
    month_orders = await db.orders.count_documents({
        "created_at": {"$gte": month_ago.isoformat()}
    })
    month_revenue_orders = await db.orders.find({
        "status": "delivered",
        "created_at": {"$gte": month_ago.isoformat()}
    }, {"_id": 0, "total_amount": 1}).to_list(1000)
    month_revenue = sum(o.get("total_amount", 0) for o in month_revenue_orders)
    
    # Popular restaurants (by order count)
    pipeline = [
        {"$match": {"status": "delivered"}},
        {"$group": {"_id": "$restaurant_id", "order_count": {"$sum": 1}, "revenue": {"$sum": "$total_amount"}}},
        {"$sort": {"order_count": -1}},
        {"$limit": 5}
    ]
    popular_restaurant_ids = await db.orders.aggregate(pipeline).to_list(5)
    
    popular_restaurants = []
    for pr in popular_restaurant_ids:
        restaurant = await db.restaurants.find_one({"id": pr["_id"]}, {"_id": 0, "name": 1, "image": 1})
        if restaurant:
            popular_restaurants.append({
                **restaurant,
                "order_count": pr["order_count"],
                "revenue": pr["revenue"]
            })
    
    # Popular items
    item_pipeline = [
        {"$match": {"status": "delivered"}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.name", "order_count": {"$sum": "$items.quantity"}, "image": {"$first": "$items.image"}}},
        {"$sort": {"order_count": -1}},
        {"$limit": 5}
    ]
    popular_items = await db.orders.aggregate(item_pipeline).to_list(5)
    
    return {
        "users": {
            "total": total_users,
            "customers": total_customers,
            "restaurant_owners": total_restaurant_owners,
            "delivery_partners": total_delivery_partners
        },
        "restaurants": {
            "total": total_restaurants,
            "active": active_restaurants
        },
        "orders": {
            "total": total_orders,
            "pending": pending_orders,
            "active": active_orders,
            "delivered": delivered_orders,
            "cancelled": cancelled_orders
        },
        "revenue": {
            "total": total_revenue,
            "today": today_revenue,
            "this_week": week_revenue,
            "this_month": month_revenue
        },
        "today": {
            "orders": today_orders,
            "revenue": today_revenue
        },
        "this_week": {
            "orders": week_orders,
            "revenue": week_revenue
        },
        "this_month": {
            "orders": month_orders,
            "revenue": month_revenue
        },
        "popular_restaurants": popular_restaurants,
        "popular_items": popular_items
    }

@api_router.get("/admin/users")
async def get_all_users(role: Optional[str] = None, page: int = 1, limit: int = 20):
    """Get all users with pagination"""
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

@api_router.get("/admin/users/{user_id}")
async def get_user_details(user_id: str):
    """Get detailed user information"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's orders
    orders = await db.orders.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Calculate stats
    total_orders = len(orders)
    total_spent = sum(o.get("total_amount", 0) for o in orders if o.get("status") == "delivered")
    
    return {
        "user": user,
        "orders": orders,
        "stats": {
            "total_orders": total_orders,
            "total_spent": total_spent
        }
    }

@api_router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, request: Request):
    """Admin: Update user information"""
    data = await request.json()
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Only allow updating name and email
    update_data = {}
    if "name" in data:
        update_data["name"] = data["name"]
    if "email" in data:
        update_data["email"] = data["email"]
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return updated_user

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str):
    """Admin: Delete a user account and all related entries"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_role = user.get("role", "customer")
    
    # Handle admin deletion - only allow if more than one admin exists
    if user_role == "admin":
        # Count total admin users
        admin_count = await db.users.count_documents({"role": "admin"})
        
        if admin_count <= 1:
            raise HTTPException(
                status_code=403, 
                detail="Cannot delete the last admin user. At least one admin must exist."
            )
        
        # Delete admin user
        await db.users.delete_one({"id": user_id})
        
        # Delete admin notifications
        await db.notifications.delete_many({"user_id": user_id})
        
        return {"message": "Admin user deleted successfully", "user_id": user_id}
    
    # Handle cascade deletion based on user role
    if user_role == "restaurant":
        # Find and delete associated restaurant
        restaurant = await db.restaurants.find_one({"owner_id": user_id}, {"_id": 0})
        if restaurant:
            # Delete restaurant
            await db.restaurants.delete_one({"owner_id": user_id})
            # Delete restaurant discounts
            await db.restaurant_discounts.delete_many({"restaurant_id": restaurant["id"]})
            # Update orders
            await db.orders.update_many(
                {"restaurant_id": restaurant["id"]},
                {"$set": {"restaurant_deleted": True}}
            )
            # Delete notifications
            await db.notifications.delete_many({"data.restaurant_id": restaurant["id"]})
    
    elif user_role == "delivery":
        # Find and delete associated delivery partner
        partner = await db.delivery_partners.find_one({"user_id": user_id}, {"_id": 0})
        if partner:
            # Delete delivery partner
            await db.delivery_partners.delete_one({"user_id": user_id})
            # Update orders
            await db.orders.update_many(
                {"delivery_partner_id": partner["id"]},
                {"$set": {"delivery_partner_id": None, "delivery_partner_deleted": True}}
            )
            # Delete COD settlements
            await db.cod_settlements.delete_many({"partner_id": partner["id"]})
            # Delete notifications
            await db.notifications.delete_many({"data.partner_id": partner["id"]})
    
    else:
        # Customer - update their orders
        await db.orders.update_many(
            {"user_id": user_id},
            {"$set": {"customer_deleted": True}}
        )
    
    # Delete user notifications
    await db.notifications.delete_many({"user_id": user_id})
    
    # Delete push subscriptions
    await db.push_subscriptions.delete_many({"user_id": user_id})
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    return {"message": "User and all related entries deleted successfully", "user_id": user_id}

@api_router.get("/admin/orders")
async def get_all_orders(status: Optional[str] = None, page: int = 1, limit: int = 100):
    """Get all orders with pagination and auto-cancel stale orders"""
    # First, auto-cancel orders older than 24 hours that are still pending/confirmed
    await auto_cancel_stale_orders()
    
    query = {}
    if status and status != 'all':
        query["status"] = status
    
    skip = (page - 1) * limit
    orders = await db.orders.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    total = await db.orders.count_documents(query)
    
    # Get status counts for all statuses
    stats = {
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
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "stats": stats
    }

async def auto_cancel_stale_orders():
    """Auto-cancel orders that are more than 24 hours old and still in pending status only"""
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
    cutoff_time_str = cutoff_time.isoformat()
    
    # Find stale orders (only PENDING for more than 24 hours - NOT confirmed)
    stale_orders = await db.orders.find({
        "status": "pending",
        "created_at": {"$lt": cutoff_time_str}
    }, {"_id": 0, "id": 1}).to_list(100)
    
    now = datetime.now(timezone.utc).isoformat()
    
    for order in stale_orders:
        await db.orders.update_one(
            {"id": order["id"]},
            {"$set": {
                "status": "cancelled",
                "cancellation_reason": "Auto cancelled due to unresponsive (24+ hours)",
                "cancelled_at": now,
                "updated_at": now
            }}
        )
        
        # Add tracking entry
        tracking_entry = {
            "id": str(uuid.uuid4()),
            "order_id": order["id"],
            "status": "cancelled",
            "message": "Order auto-cancelled due to no response for 24+ hours",
            "timestamp": now
        }
        await db.order_tracking.insert_one(tracking_entry)
    
    if stale_orders:
        logging.info(f"Auto-cancelled {len(stale_orders)} stale orders")

@api_router.get("/admin/orders/{order_id}")
async def get_order_details(order_id: str):
    """Get detailed order information"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get customer info
    customer = await db.users.find_one({"id": order.get("user_id")}, {"_id": 0, "password_hash": 0})
    
    # Get restaurant info
    restaurant = await db.restaurants.find_one({"id": order.get("restaurant_id")}, {"_id": 0})
    
    # Get delivery partner info if assigned
    delivery_partner = None
    if order.get("delivery_partner_id"):
        delivery_partner = await db.delivery_partners.find_one({"id": order.get("delivery_partner_id")}, {"_id": 0})
    
    return {
        "order": order,
        "customer": customer,
        "restaurant": restaurant,
        "delivery_partner": delivery_partner
    }

@api_router.post("/admin/orders/assign-delivery")
async def admin_assign_delivery(request: AdminAssignDeliveryRequest):
    """Admin assigns delivery partner to order"""
    order = await db.orders.find_one({"id": request.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    partner = await db.delivery_partners.find_one({"id": request.delivery_partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    # Update order
    update_data = {
        "delivery_partner_id": request.delivery_partner_id,
        "delivery_partner_name": partner.get("name"),
        "admin_approved": True,
        "assigned_by_admin": not request.auto_assign,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If order is ready, mark as picked up
    if order.get("status") == "ready":
        update_data["status"] = "picked_up"
    
    await db.orders.update_one({"id": request.order_id}, {"$set": update_data})
    
    # Update delivery partner availability
    await db.delivery_partners.update_one(
        {"id": request.delivery_partner_id},
        {"$set": {"is_available": False}}
    )
    
    updated_order = await db.orders.find_one({"id": request.order_id}, {"_id": 0})
    return {"message": "Delivery partner assigned", "order": updated_order}

@api_router.get("/admin/order-history")
async def get_order_history(page: int = 1, limit: int = 50):
    """Get comprehensive order history for admin with all details"""
    skip = (page - 1) * limit
    
    # Get all orders sorted by most recent
    orders = await db.orders.find({}, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    total = await db.orders.count_documents({})
    
    # Get stats by status
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
    
    # Collect unique restaurant and delivery partner IDs for batch fetching
    restaurant_ids = set(o.get("restaurant_id") for o in orders if o.get("restaurant_id"))
    partner_ids = set(o.get("delivery_partner_id") for o in orders if o.get("delivery_partner_id"))
    
    # Batch fetch restaurants and delivery partners
    restaurants = {}
    if restaurant_ids:
        restaurant_list = await db.restaurants.find(
            {"id": {"$in": list(restaurant_ids)}}, 
            {"_id": 0, "id": 1, "phone": 1}
        ).to_list(100)
        restaurants = {r["id"]: r.get("phone") for r in restaurant_list}
    
    partners = {}
    if partner_ids:
        partner_list = await db.delivery_partners.find(
            {"id": {"$in": list(partner_ids)}}, 
            {"_id": 0, "id": 1, "phone": 1}
        ).to_list(100)
        partners = {p["id"]: p.get("phone") for p in partner_list}
    
    # Enrich orders with additional info
    enriched_orders = []
    for order in orders:
        restaurant_id = order.get("restaurant_id")
        partner_id = order.get("delivery_partner_id")
        
        enriched_order = {
            "id": order.get("id"),
            "customer_name": order.get("user_name"),
            "customer_phone": order.get("user_phone"),
            "restaurant_name": order.get("restaurant_name"),
            "restaurant_id": restaurant_id,
            "restaurant_phone": restaurants.get(restaurant_id) if restaurant_id else None,
            "order_value": order.get("total_amount", 0),
            "delivery_fee": order.get("delivery_fee", 0),
            "cod_fee": order.get("cod_fee", 0),
            "total_value": order.get("total_amount", 0) + order.get("delivery_fee", 0) + order.get("cod_fee", 0),
            "items": order.get("items", []),
            "items_count": sum(item.get("quantity", 1) for item in order.get("items", [])),
            "restaurant_status": order.get("status"),
            "delivery_partner_name": order.get("delivery_partner_name"),
            "delivery_partner_id": partner_id,
            "delivery_partner_phone": partners.get(partner_id) if partner_id else None,
            "delivery_status": get_delivery_status(order.get("status"), partner_id),
            "payment_method": order.get("payment_method", "cod"),
            "payment_status": order.get("payment_status", "pending"),
            "delivery_address": order.get("delivery_address", {}),
            "notes": order.get("notes"),
            "created_at": order.get("created_at"),
            "updated_at": order.get("updated_at"),
            "estimated_prep_time": order.get("estimated_prep_time"),
            "estimated_delivery_time": order.get("estimated_delivery_time"),
            "is_delayed": order.get("is_delayed", False),
            "delay_reason": order.get("delay_reason"),
            "delivery_partner_settlement_status": order.get("delivery_partner_settlement_status", "pending")
        }
        enriched_orders.append(enriched_order)
    
    return {
        "orders": enriched_orders,
        "stats": stats,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }
    
    return {
        "orders": enriched_orders,
        "stats": stats,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


def get_delivery_status(order_status: str, delivery_partner_id: str) -> str:
    """Determine delivery status based on order status and partner assignment"""
    if order_status in ["pending", "confirmed", "preparing"]:
        return "awaiting_pickup"
    elif order_status == "ready":
        if delivery_partner_id:
            return "partner_assigned"
        return "awaiting_partner"
    elif order_status == "picked_up":
        return "out_for_delivery"
    elif order_status == "delivered":
        return "delivered"
    elif order_status == "cancelled":
        return "cancelled"
    return "unknown"


@api_router.post("/admin/orders/auto-assign")
async def admin_auto_assign_delivery():
    """Auto-assign available delivery partners to ready orders"""
    # Get orders ready for pickup without delivery partner
    ready_orders = await db.orders.find({
        "status": "ready",
        "delivery_partner_id": None
    }, {"_id": 0}).to_list(100)
    
    # Get available delivery partners
    available_partners = await db.delivery_partners.find({
        "is_available": True
    }, {"_id": 0}).to_list(100)
    
    assignments = []
    for i, order in enumerate(ready_orders):
        if i < len(available_partners):
            partner = available_partners[i]
            
            await db.orders.update_one(
                {"id": order["id"]},
                {"$set": {
                    "delivery_partner_id": partner["id"],
                    "delivery_partner_name": partner["name"],
                    "status": "picked_up",
                    "admin_approved": True,
                    "assigned_by_admin": False,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            await db.delivery_partners.update_one(
                {"id": partner["id"]},
                {"$set": {"is_available": False}}
            )
            
            assignments.append({
                "order_id": order["id"],
                "partner_id": partner["id"],
                "partner_name": partner["name"]
            })
    
    return {
        "message": f"Auto-assigned {len(assignments)} orders",
        "assignments": assignments,
        "unassigned": len(ready_orders) - len(assignments)
    }

# ============== ADMIN RESTAURANT MANAGEMENT ==============

@api_router.get("/admin/restaurants")
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


# ============= PAYMENT & SETTLEMENT MANAGEMENT =============

PLATFORM_COMMISSION_RATE = 0.01  # 1% platform commission on food
DELIVERY_PARTNER_SHARE = 0.95  # 95% of delivery fee goes to partner for regular orders
CUSTOM_ORDER_PARTNER_SHARE = 0.70  # 70% of delivery fee goes to partner for custom orders


def calculate_order_payments(order: dict, is_custom_order: bool = False) -> dict:
    """Calculate payment splits for an order
    
    Regular orders: Partner gets 95% of delivery fee
    Custom orders: Partner gets 70% of delivery fee
    COD fee: 100% goes to company
    """
    total_amount = order.get("total_amount", 0)
    delivery_fee = order.get("delivery_fee", 0)
    cod_fee = order.get("cod_fee", 0)
    
    # Determine partner share based on order type
    partner_share = CUSTOM_ORDER_PARTNER_SHARE if is_custom_order else DELIVERY_PARTNER_SHARE
    
    # Restaurant gets: total_amount - platform commission (1%)
    platform_commission_food = total_amount * PLATFORM_COMMISSION_RATE
    restaurant_payout = total_amount - platform_commission_food
    
    # Delivery partner gets: 95% (regular) or 70% (custom) of delivery fee
    delivery_partner_earning = delivery_fee * partner_share
    platform_commission_delivery = delivery_fee * (1 - partner_share)
    
    # Total platform commission (includes delivery fee commission + full COD fee)
    total_platform_commission = platform_commission_food + platform_commission_delivery + cod_fee
    
    # COD collected includes: food amount + delivery fee + COD convenience fee
    cod_collected = round(total_amount + delivery_fee + cod_fee, 2) if order.get("payment_method") == "cod" else 0
    
    # Amount to return to admin from COD: total collected - partner's earning
    cod_to_return = round(cod_collected - delivery_partner_earning, 2) if order.get("payment_method") == "cod" else 0
    
    return {
        "restaurant_payout": round(restaurant_payout, 2),
        "delivery_partner_earning": round(delivery_partner_earning, 2),
        "platform_commission": round(total_platform_commission, 2),
        "partner_share_percent": int(partner_share * 100),
        "company_share_percent": int((1 - partner_share) * 100),
        "cod_collected": cod_collected,
        "cod_to_return": cod_to_return,
        "cod_fee": cod_fee,
        "is_custom_order": is_custom_order
    }


# ============= CASHFREE PAYMENT GATEWAY ENDPOINTS =============

class InitiatePaymentRequest(BaseModel):
    order_id: str
    amount: float  # Amount in rupees
    user_phone: str
    user_id: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    origin_url: Optional[str] = None  # Frontend origin URL for redirect
    is_custom_order: Optional[bool] = False  # Flag for custom orders


@api_router.post("/payments/cashfree/initiate")
async def initiate_cashfree_payment(request: InitiatePaymentRequest, http_request: Request):
    """Initiate a Cashfree payment for an order"""
    # Check if order exists (regular or custom)
    if request.is_custom_order:
        order = await db.custom_orders.find_one({"id": request.order_id}, {"_id": 0})
    else:
        order = await db.orders.find_one({"id": request.order_id}, {"_id": 0})
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if order is already paid
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")
    
    # Generate unique order ID for Cashfree (must be unique)
    cf_order_id = f"FK_{request.order_id[:8]}_{str(uuid.uuid4())[:8]}".upper()
    
    # Get frontend URL for redirect
    frontend_url = request.origin_url
    if not frontend_url:
        referer = http_request.headers.get('referer', '')
        if referer:
            from urllib.parse import urlparse
            parsed = urlparse(referer)
            frontend_url = f"{parsed.scheme}://{parsed.netloc}"
        else:
            frontend_url = os.environ.get('REACT_APP_BACKEND_URL', '')
    
    if not frontend_url:
        raise HTTPException(status_code=500, detail="Frontend URL not configured")
    
    return_url = f"{frontend_url}/payment/status/{request.order_id}?cf_order_id={cf_order_id}"
    notify_url = f"{frontend_url}/api/payments/cashfree/webhook"
    
    # Store payment attempt
    payment_record = {
        "id": str(uuid.uuid4()),
        "order_id": request.order_id,
        "cf_order_id": cf_order_id,
        "user_id": request.user_id,
        "amount": request.amount,
        "status": "initiated",
        "payment_gateway": "cashfree",
        "is_custom_order": request.is_custom_order,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payments.insert_one(payment_record)
    
    # Update order with Cashfree order ID (use correct collection)
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
    
    # Create Cashfree order
    result = await create_cashfree_order(
        order_id=cf_order_id,
        order_amount=request.amount,
        customer_id=request.user_id,
        customer_phone=request.user_phone,
        customer_email=request.user_email or "customer@foodkey.in",
        customer_name=request.user_name or "Customer",
        return_url=return_url,
        notify_url=notify_url
    )
    
    if result.get("payment_session_id"):
        payment_session_id = result.get("payment_session_id")
        cf_order_id_response = result.get("cf_order_id", cf_order_id)
        
        # Generate payment link - Cashfree hosted checkout URL
        if CASHFREE_ENV == 'production':
            payment_url = f"https://payments.cashfree.com/order/#/{cf_order_id_response}"
        else:
            payment_url = f"https://sandbox.cashfree.com/pg/view/order/{cf_order_id_response}"
        
        # Update payment record
        await db.payments.update_one(
            {"cf_order_id": cf_order_id},
            {"$set": {
                "status": "order_created",
                "payment_session_id": payment_session_id,
                "cf_order_id_response": cf_order_id_response,
                "payment_url": payment_url
            }}
        )
        
        return {
            "success": True,
            "cf_order_id": cf_order_id,
            "payment_session_id": payment_session_id,
            "payment_url": payment_url,
            "message": "Payment initiated successfully"
        }
    else:
        error_msg = result.get("message", result.get("error", "Payment initiation failed"))
        
        # Update payment record with failure
        await db.payments.update_one(
            {"cf_order_id": cf_order_id},
            {"$set": {"status": "failed", "error": error_msg}}
        )
        
        raise HTTPException(status_code=400, detail=error_msg)


@api_router.get("/payments/cashfree/status/{order_id}")
async def get_cashfree_payment_status(order_id: str):
    """Get payment status for an order (regular or custom)"""
    # Check regular orders first
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    is_custom_order = False
    
    # If not found in regular orders, check custom orders
    if not order:
        order = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
        is_custom_order = True
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    cf_order_id = order.get("cf_order_id")
    if not cf_order_id:
        return {
            "success": True,
            "order_id": order_id,
            "payment_status": order.get("payment_status", "pending"),
            "payment_method": order.get("payment_method", "cod"),
            "message": "No online payment initiated for this order",
            "is_custom_order": is_custom_order
        }
    
    # Get Cashfree order status
    result = await get_cashfree_order_status(cf_order_id)
    
    cf_status = result.get("order_status", "PENDING")
    
    # Map Cashfree status to our status
    status_map = {
        "PAID": "paid",
        "ACTIVE": "pending",
        "EXPIRED": "failed",
        "TERMINATED": "failed"
    }
    
    payment_status = status_map.get(cf_status, "pending")
    
    # Update order if payment is successful - use correct collection
    if payment_status == "paid" and order.get("payment_status") != "paid":
        collection = db.custom_orders if is_custom_order else db.orders
        await collection.update_one(
            {"id": order_id},
            {"$set": {
                "payment_status": "paid",
                "paid_at": datetime.now(timezone.utc).isoformat(),
                "payment_completed_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update payment record
        await db.payments.update_one(
            {"cf_order_id": cf_order_id},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Calculate total including all fees
    if is_custom_order:
        estimated_amount = order.get("estimated_amount", 0)
        delivery_fee = 40  # Fixed for custom orders
        total_amount = estimated_amount + delivery_fee
        grand_total = total_amount
        cod_fee = 0
    else:
        total_amount = order.get("total_amount", 0)
        delivery_fee = order.get("delivery_fee", 0)
        cod_fee = order.get("cod_fee", 0)
        grand_total = total_amount + delivery_fee + cod_fee
    
    return {
        "success": True,
        "order_id": order_id,
        "cf_order_id": cf_order_id,
        "payment_status": payment_status,
        "cashfree_status": cf_status,
        "payment_method": "online",
        "amount": grand_total,
        "is_custom_order": is_custom_order,
        "paid_at": order.get("paid_at"),
        "breakdown": {
            "food_total": total_amount if not is_custom_order else order.get("estimated_amount", 0),
            "delivery_fee": delivery_fee,
            "cod_fee": cod_fee,
            "grand_total": grand_total
        }
    }


@api_router.post("/payments/cashfree/webhook")
async def cashfree_webhook(request: Request):
    """Handle Cashfree payment webhook"""
    try:
        raw_body = await request.body()
        payload_str = raw_body.decode('utf-8')
        
        # Get signature headers
        received_signature = request.headers.get('x-webhook-signature', '')
        timestamp = request.headers.get('x-webhook-timestamp', '')
        
        # Verify signature (optional but recommended)
        if received_signature and timestamp and CASHFREE_SECRET_KEY:
            is_valid = verify_cashfree_webhook_signature(payload_str, timestamp, received_signature)
            if not is_valid:
                logging.warning("Cashfree webhook signature verification failed")
                # Continue processing anyway for now
        
        body = json.loads(payload_str)
        logging.info(f"Cashfree webhook received: {body}")
        
        # Extract data from webhook
        data = body.get("data", {})
        order_data = data.get("order", {})
        payment_data = data.get("payment", {})
        
        cf_order_id = order_data.get("order_id")
        order_status = order_data.get("order_status")
        payment_status_cf = payment_data.get("payment_status")
        
        if cf_order_id:
            # Find the payment record
            payment = await db.payments.find_one({"cf_order_id": cf_order_id}, {"_id": 0})
            
            if payment:
                internal_order_id = payment.get("order_id")
                
                # Determine payment status
                is_paid = order_status == "PAID" or payment_status_cf == "SUCCESS"
                payment_status = "paid" if is_paid else "failed"
                
                # Update payment record
                await db.payments.update_one(
                    {"cf_order_id": cf_order_id},
                    {"$set": {
                        "status": "completed" if is_paid else "failed",
                        "cashfree_response": body,
                        "completed_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Check if it's a custom order based on payment record
                is_custom_order = payment.get("is_custom_order", False)
                
                # Update the correct collection (orders or custom_orders)
                collection = db.custom_orders if is_custom_order else db.orders
                await collection.update_one(
                    {"id": internal_order_id},
                    {"$set": {
                        "payment_status": payment_status,
                        "paid_at": datetime.now(timezone.utc).isoformat() if is_paid else None,
                        "payment_completed_at": datetime.now(timezone.utc).isoformat() if is_paid else None,
                        "cf_payment_status": payment_status_cf,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                logging.info(f"{'Custom ' if is_custom_order else ''}Order {internal_order_id} payment status updated to {payment_status}")
        
        return {"success": True}
    except Exception as e:
        logging.error(f"Cashfree webhook error: {e}")
        return {"success": False, "error": str(e)}


@api_router.get("/payments/cashfree/verify/{cf_order_id}")
async def verify_cashfree_payment(cf_order_id: str):
    """Manually verify a payment by Cashfree order ID"""
    result = await get_cashfree_order_status(cf_order_id)
    
    if result.get("order_status"):
        return {
            "success": True,
            "cf_order_id": cf_order_id,
            "order_status": result.get("order_status"),
            "order_amount": result.get("order_amount"),
            "raw_response": result
        }
    else:
        return {
            "success": False,
            "cf_order_id": cf_order_id,
            "message": result.get("message", "Verification failed"),
            "raw_response": result
        }


@api_router.get("/admin/payments/restaurants")
async def admin_get_restaurant_payments(
    page: int = 1, 
    limit: int = 20,
    status: Optional[str] = None,  # pending, cleared
    restaurant_id: Optional[str] = None
):
    """Get restaurant payment summary for admin"""
    query = {"status": "delivered"}
    if status:
        query["restaurant_payout_status"] = status
    if restaurant_id:
        query["restaurant_id"] = restaurant_id
    
    skip = (page - 1) * limit
    orders = await db.orders.find(query, {"_id": 0}).skip(skip).limit(limit).sort("delivered_at", -1).to_list(limit)
    total = await db.orders.count_documents(query)
    
    # Calculate payments for each order
    for order in orders:
        payments = calculate_order_payments(order)
        order["calculated_restaurant_payout"] = payments["restaurant_payout"]
        order["calculated_platform_commission"] = payments["platform_commission"]
    
    # Get summary by restaurant
    pipeline = [
        {"$match": {"status": "delivered"}},
        {"$group": {
            "_id": "$restaurant_id",
            "restaurant_name": {"$first": "$restaurant_name"},
            "total_orders": {"$sum": 1},
            "total_amount": {"$sum": "$total_amount"},
            "pending_amount": {
                "$sum": {
                    "$cond": [{"$eq": ["$restaurant_payout_status", "pending"]}, "$total_amount", 0]
                }
            },
            "cleared_amount": {
                "$sum": {
                    "$cond": [{"$eq": ["$restaurant_payout_status", "cleared"]}, "$total_amount", 0]
                }
            }
        }},
        {"$sort": {"pending_amount": -1}}
    ]
    summary = await db.orders.aggregate(pipeline).to_list(100)
    
    # Calculate actual payouts (with commission deducted)
    for item in summary:
        item["pending_payout"] = round(item["pending_amount"] * (1 - PLATFORM_COMMISSION_RATE), 2)
        item["cleared_payout"] = round(item["cleared_amount"] * (1 - PLATFORM_COMMISSION_RATE), 2)
    
    return {
        "orders": orders,
        "summary": summary,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@api_router.put("/admin/payments/restaurants/{order_id}/clear")
async def admin_clear_restaurant_payment(order_id: str, request: Request):
    """Mark restaurant payment as cleared"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get optional comment and cleared_date from request body
    try:
        data = await request.json()
        comment = data.get("comment", "")
        cleared_date = data.get("cleared_date", datetime.now(timezone.utc).isoformat())
    except Exception:
        comment = ""
        cleared_date = datetime.now(timezone.utc).isoformat()
    
    payments = calculate_order_payments(order)
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "restaurant_payout": payments["restaurant_payout"],
            "restaurant_payout_status": "cleared",
            "restaurant_payout_date": datetime.now(timezone.utc).isoformat(),
            "cleared_date": cleared_date,
            "clear_comment": comment,
            "platform_commission": payments["platform_commission"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Payment cleared", "amount": payments["restaurant_payout"]}


@api_router.put("/admin/payments/restaurants/bulk-clear")
async def admin_bulk_clear_restaurant_payments(request: Request):
    """Clear multiple restaurant payments at once"""
    data = await request.json()
    restaurant_id = data.get("restaurant_id")
    comment = data.get("comment", "")
    cleared_date = data.get("cleared_date", datetime.now(timezone.utc).isoformat())
    
    if not restaurant_id:
        raise HTTPException(status_code=400, detail="restaurant_id required")
    
    # Get all pending orders for this restaurant
    orders = await db.orders.find({
        "restaurant_id": restaurant_id,
        "status": "delivered",
        "restaurant_payout_status": "pending"
    }, {"_id": 0}).to_list(1000)
    
    total_cleared = 0
    now = datetime.now(timezone.utc).isoformat()
    
    for order in orders:
        payments = calculate_order_payments(order)
        total_cleared += payments["restaurant_payout"]
        
        await db.orders.update_one(
            {"id": order["id"]},
            {"$set": {
                "restaurant_payout": payments["restaurant_payout"],
                "restaurant_payout_status": "cleared",
                "restaurant_payout_date": now,
                "cleared_date": cleared_date,
                "clear_comment": comment,
                "platform_commission": payments["platform_commission"],
                "updated_at": now
            }}
        )
    
    return {
        "message": f"Cleared {len(orders)} orders",
        "total_amount": round(total_cleared, 2),
        "orders_count": len(orders)
    }


@api_router.get("/admin/payments/delivery-partners")
async def admin_get_delivery_partner_payments(
    page: int = 1,
    limit: int = 20,
    partner_id: Optional[str] = None,
    date: Optional[str] = None  # YYYY-MM-DD
):
    """Get delivery partner payment summary for admin - includes regular and custom orders"""
    # Query for regular orders
    regular_query = {"status": "delivered", "delivery_partner_id": {"$ne": None}}
    if partner_id:
        regular_query["delivery_partner_id"] = partner_id
    
    skip = (page - 1) * limit
    regular_orders = await db.orders.find(regular_query, {"_id": 0}).skip(skip).limit(limit).sort("delivered_at", -1).to_list(limit)
    regular_total = await db.orders.count_documents(regular_query)
    
    # Query for custom orders
    custom_query = {"status": "delivered", "delivery_partner_id": {"$ne": None}}
    if partner_id:
        custom_query["delivery_partner_id"] = partner_id
    
    custom_orders = await db.custom_orders.find(custom_query, {"_id": 0}).skip(skip).limit(limit).sort("delivered_at", -1).to_list(limit)
    custom_total = await db.custom_orders.count_documents(custom_query)
    
    # Calculate for each regular order (95% share)
    for order in regular_orders:
        payments = calculate_order_payments(order, is_custom_order=False)
        order["calculated_earning"] = payments["delivery_partner_earning"]
        order["calculated_cod_collected"] = payments["cod_collected"]
        order["calculated_cod_to_return"] = payments["cod_to_return"]
        order["cod_fee"] = payments["cod_fee"]
        order["partner_share_percent"] = payments["partner_share_percent"]
        order["company_share_percent"] = payments["company_share_percent"]
        order["order_type"] = "regular"
        if not order.get("delivery_partner_settlement_status"):
            order["delivery_partner_settlement_status"] = "pending"
    
    # Calculate for each custom order (70% share)
    for order in custom_orders:
        payments = calculate_order_payments(order, is_custom_order=True)
        order["calculated_earning"] = payments["delivery_partner_earning"]
        order["calculated_cod_collected"] = payments["cod_collected"]
        order["calculated_cod_to_return"] = payments["cod_to_return"]
        order["cod_fee"] = payments.get("cod_fee", 0)
        order["partner_share_percent"] = payments["partner_share_percent"]
        order["company_share_percent"] = payments["company_share_percent"]
        order["order_type"] = "custom"
        if not order.get("delivery_partner_settlement_status"):
            order["delivery_partner_settlement_status"] = "pending"
    
    # Combine all orders sorted by date
    all_orders = regular_orders + custom_orders
    all_orders.sort(key=lambda x: x.get("delivered_at", ""), reverse=True)
    
    # Summary for regular orders by partner
    regular_pipeline = [
        {"$match": {"status": "delivered", "delivery_partner_id": {"$ne": None}}},
        {"$group": {
            "_id": "$delivery_partner_id",
            "partner_name": {"$first": "$delivery_partner_name"},
            "total_deliveries": {"$sum": 1},
            "total_delivery_fees": {"$sum": {"$ifNull": ["$delivery_fee", 30]}},
            "total_cod_fees": {
                "$sum": {
                    "$cond": [
                        {"$eq": ["$payment_method", "cod"]},
                        {"$ifNull": ["$cod_fee", 0]},
                        0
                    ]
                }
            },
            "total_cod_collected": {
                "$sum": {
                    "$cond": [
                        {"$eq": ["$payment_method", "cod"]},
                        {"$add": [
                            {"$ifNull": ["$total_amount", 0]}, 
                            {"$ifNull": ["$delivery_fee", 30]},
                            {"$ifNull": ["$cod_fee", 0]}
                        ]},
                        0
                    ]
                }
            },
            "pending_count": {
                "$sum": {
                    "$cond": [
                        {"$or": [
                            {"$eq": [{"$ifNull": ["$delivery_partner_settlement_status", "pending"]}, "pending"]},
                            {"$eq": ["$delivery_partner_settlement_status", None]}
                        ]},
                        1,
                        0
                    ]
                }
            },
            "cleared_count": {
                "$sum": {
                    "$cond": [
                        {"$eq": ["$delivery_partner_settlement_status", "cleared"]},
                        1,
                        0
                    ]
                }
            },
            "pending_delivery_fees": {
                "$sum": {
                    "$cond": [
                        {"$or": [
                            {"$eq": [{"$ifNull": ["$delivery_partner_settlement_status", "pending"]}, "pending"]},
                            {"$eq": ["$delivery_partner_settlement_status", None]}
                        ]},
                        {"$ifNull": ["$delivery_fee", 30]},
                        0
                    ]
                }
            },
            "cleared_delivery_fees": {
                "$sum": {
                    "$cond": [
                        {"$eq": ["$delivery_partner_settlement_status", "cleared"]},
                        {"$ifNull": ["$delivery_fee", 30]},
                        0
                    ]
                }
            }
        }},
        {"$sort": {"pending_delivery_fees": -1}}
    ]
    regular_summary = await db.orders.aggregate(regular_pipeline).to_list(100)
    
    # Summary for custom orders by partner
    custom_pipeline = [
        {"$match": {"status": "delivered", "delivery_partner_id": {"$ne": None}}},
        {"$group": {
            "_id": "$delivery_partner_id",
            "partner_name": {"$first": "$delivery_partner_name"},
            "custom_deliveries": {"$sum": 1},
            "custom_delivery_fees": {"$sum": {"$ifNull": ["$delivery_fee", 0]}},
            "custom_pending_count": {
                "$sum": {
                    "$cond": [
                        {"$or": [
                            {"$eq": [{"$ifNull": ["$delivery_partner_settlement_status", "pending"]}, "pending"]},
                            {"$eq": ["$delivery_partner_settlement_status", None]}
                        ]},
                        1,
                        0
                    ]
                }
            },
            "custom_cleared_count": {
                "$sum": {
                    "$cond": [
                        {"$eq": ["$delivery_partner_settlement_status", "cleared"]},
                        1,
                        0
                    ]
                }
            },
            "custom_pending_fees": {
                "$sum": {
                    "$cond": [
                        {"$or": [
                            {"$eq": [{"$ifNull": ["$delivery_partner_settlement_status", "pending"]}, "pending"]},
                            {"$eq": ["$delivery_partner_settlement_status", None]}
                        ]},
                        {"$ifNull": ["$delivery_fee", 0]},
                        0
                    ]
                }
            },
            "custom_cleared_fees": {
                "$sum": {
                    "$cond": [
                        {"$eq": ["$delivery_partner_settlement_status", "cleared"]},
                        {"$ifNull": ["$delivery_fee", 0]},
                        0
                    ]
                }
            }
        }}
    ]
    custom_summary = await db.custom_orders.aggregate(custom_pipeline).to_list(100)
    
    # Merge regular and custom summaries by partner
    custom_by_partner = {c["_id"]: c for c in custom_summary}
    
    for item in regular_summary:
        partner_id_val = item["_id"]
        # Regular order earnings (95%)
        item["regular_earnings"] = round(item["total_delivery_fees"] * DELIVERY_PARTNER_SHARE, 2)
        item["regular_pending"] = round(item["pending_delivery_fees"] * DELIVERY_PARTNER_SHARE, 2)
        item["regular_cleared"] = round(item["cleared_delivery_fees"] * DELIVERY_PARTNER_SHARE, 2)
        
        # Add custom order data if exists (70%)
        custom_data = custom_by_partner.get(partner_id_val, {})
        item["custom_deliveries"] = custom_data.get("custom_deliveries", 0)
        item["custom_delivery_fees"] = custom_data.get("custom_delivery_fees", 0)
        item["custom_earnings"] = round(item["custom_delivery_fees"] * CUSTOM_ORDER_PARTNER_SHARE, 2)
        item["custom_pending_count"] = custom_data.get("custom_pending_count", 0)
        item["custom_cleared_count"] = custom_data.get("custom_cleared_count", 0)
        item["custom_pending"] = round(custom_data.get("custom_pending_fees", 0) * CUSTOM_ORDER_PARTNER_SHARE, 2)
        item["custom_cleared"] = round(custom_data.get("custom_cleared_fees", 0) * CUSTOM_ORDER_PARTNER_SHARE, 2)
        
        # Combined totals
        item["total_earnings"] = item["regular_earnings"] + item["custom_earnings"]
        item["pending_settlement"] = item["regular_pending"] + item["custom_pending"]
        item["cleared_settlement"] = item["regular_cleared"] + item["custom_cleared"]
        item["total_pending_count"] = item["pending_count"] + item["custom_pending_count"]
        item["total_cleared_count"] = item["cleared_count"] + item["custom_cleared_count"]
        
        # COD to return = total COD collected - regular earnings (custom orders may have different handling)
        item["cod_to_return"] = round(item["total_cod_collected"] - item["regular_earnings"], 2)
    
    # Add partners who only have custom orders
    for partner_id_val, custom_data in custom_by_partner.items():
        if partner_id_val not in [s["_id"] for s in regular_summary]:
            item = {
                "_id": partner_id_val,
                "partner_name": custom_data.get("partner_name"),
                "total_deliveries": 0,
                "total_delivery_fees": 0,
                "total_cod_fees": 0,
                "total_cod_collected": 0,
                "pending_count": 0,
                "cleared_count": 0,
                "regular_earnings": 0,
                "regular_pending": 0,
                "regular_cleared": 0,
                "custom_deliveries": custom_data.get("custom_deliveries", 0),
                "custom_delivery_fees": custom_data.get("custom_delivery_fees", 0),
                "custom_earnings": round(custom_data.get("custom_delivery_fees", 0) * CUSTOM_ORDER_PARTNER_SHARE, 2),
                "custom_pending_count": custom_data.get("custom_pending_count", 0),
                "custom_cleared_count": custom_data.get("custom_cleared_count", 0),
                "custom_pending": round(custom_data.get("custom_pending_fees", 0) * CUSTOM_ORDER_PARTNER_SHARE, 2),
                "custom_cleared": round(custom_data.get("custom_cleared_fees", 0) * CUSTOM_ORDER_PARTNER_SHARE, 2),
                "total_earnings": round(custom_data.get("custom_delivery_fees", 0) * CUSTOM_ORDER_PARTNER_SHARE, 2),
                "pending_settlement": round(custom_data.get("custom_pending_fees", 0) * CUSTOM_ORDER_PARTNER_SHARE, 2),
                "cleared_settlement": round(custom_data.get("custom_cleared_fees", 0) * CUSTOM_ORDER_PARTNER_SHARE, 2),
                "total_pending_count": custom_data.get("custom_pending_count", 0),
                "total_cleared_count": custom_data.get("custom_cleared_count", 0),
                "cod_to_return": 0
            }
            regular_summary.append(item)
    
    # Global counts
    global_pending_count = sum(s.get("total_pending_count", 0) for s in regular_summary)
    global_cleared_count = sum(s.get("total_cleared_count", 0) for s in regular_summary)
    global_pending_amount = sum(s.get("pending_settlement", 0) for s in regular_summary)
    global_cleared_amount = sum(s.get("cleared_settlement", 0) for s in regular_summary)
    
    return {
        "orders": all_orders,
        "summary": regular_summary,
        "total": regular_total + custom_total,
        "page": page,
        "pages": ((regular_total + custom_total) + limit - 1) // limit,
        "global_stats": {
            "pending_count": global_pending_count,
            "cleared_count": global_cleared_count,
            "pending_amount": round(global_pending_amount, 2),
            "cleared_amount": round(global_cleared_amount, 2)
        }
    }


@api_router.put("/admin/payments/delivery-partners/{order_id}/clear")
async def admin_clear_delivery_partner_settlement(order_id: str, request: Request):
    """Mark delivery partner settlement as cleared"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get optional comment and cleared_date from request body
    try:
        data = await request.json()
        comment = data.get("comment", "")
        cleared_date = data.get("cleared_date", datetime.now(timezone.utc).isoformat())
    except Exception:
        comment = ""
        cleared_date = datetime.now(timezone.utc).isoformat()
    
    payments = calculate_order_payments(order)
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "delivery_partner_earning": payments["delivery_partner_earning"],
            "delivery_partner_cod_collected": payments["cod_collected"],
            "delivery_partner_settlement_status": "cleared",
            "delivery_partner_settlement_date": datetime.now(timezone.utc).isoformat(),
            "delivery_cleared_date": cleared_date,
            "delivery_clear_comment": comment,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Settlement cleared",
        "earning": payments["delivery_partner_earning"],
        "cod_collected": payments["cod_collected"]
    }


# ============== CUSTOM ORDER PAYMENTS ==============

@api_router.get("/admin/payments/custom-orders")
async def admin_get_custom_order_payments():
    """Get custom order payments for admin"""
    # Get all delivered custom orders
    orders = await db.custom_orders.find(
        {"status": "delivered"},
        {"_id": 0}
    ).sort("delivered_at", -1).to_list(500)
    
    # Group by delivery partner
    partner_payments = {}
    for order in orders:
        pid = order.get("delivery_partner_id")
        if not pid:
            continue
            
        if pid not in partner_payments:
            partner_payments[pid] = {
                "_id": pid,
                "partner_name": order.get("delivery_partner_name", "Unknown"),
                "partner_phone": order.get("delivery_partner_phone"),
                "total_deliveries": 0,
                "total_earnings": 0,
                "pending_payout": 0,
                "orders": []
            }
        
        delivery_fee = order.get("delivery_fee", 40)
        earning = order.get("delivery_partner_earning", delivery_fee * 0.95)
        
        partner_payments[pid]["total_deliveries"] += 1
        partner_payments[pid]["total_earnings"] += earning
        
        if order.get("delivery_payout_status") != "cleared":
            partner_payments[pid]["pending_payout"] += earning
        
        partner_payments[pid]["orders"].append({
            "id": order["id"],
            "restaurant_name": order.get("restaurant_name"),
            "estimated_amount": order.get("estimated_amount"),
            "delivery_fee": delivery_fee,
            "earning": round(earning, 2),
            "payment_status": order.get("payment_status"),
            "delivery_payout_status": order.get("delivery_payout_status"),
            "delivered_at": order.get("delivered_at"),
            "cleared_date": order.get("delivery_cleared_date"),
            "clear_comment": order.get("delivery_clear_comment")
        })
    
    return {
        "partners": list(partner_payments.values()),
        "total_orders": len(orders)
    }


@api_router.put("/admin/payments/custom-orders/{order_id}/clear")
async def admin_clear_custom_order_delivery_payment(order_id: str, request: Request):
    """Clear delivery partner payment for a custom order"""
    order = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Custom order not found")
    
    try:
        data = await request.json()
        comment = data.get("comment", "")
        cleared_date = data.get("cleared_date", datetime.now(timezone.utc).isoformat())
    except Exception:
        comment = ""
        cleared_date = datetime.now(timezone.utc).isoformat()
    
    delivery_fee = order.get("delivery_fee", 40)
    earning = round(delivery_fee * CUSTOM_ORDER_PARTNER_SHARE, 2)  # 70% for custom orders
    
    await db.custom_orders.update_one(
        {"id": order_id},
        {"$set": {
            "delivery_partner_settlement_status": "cleared",  # Use consistent field name
            "delivery_payout_status": "cleared",  # Also update legacy field
            "delivery_partner_earning": earning,
            "delivery_cleared_date": cleared_date,
            "delivery_clear_comment": comment,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Custom order delivery payment cleared",
        "earning": earning,
        "order_id": order_id
    }


@api_router.put("/admin/payments/custom-orders/bulk-clear/{partner_id}")
async def admin_bulk_clear_custom_order_payments(partner_id: str, request: Request):
    """Bulk clear all pending custom order payments for a delivery partner"""
    try:
        data = await request.json()
        comment = data.get("comment", "Bulk cleared by admin")
        cleared_date = data.get("cleared_date", datetime.now(timezone.utc).isoformat())
    except Exception:
        comment = "Bulk cleared by admin"
        cleared_date = datetime.now(timezone.utc).isoformat()
    
    # Find pending orders first to calculate earnings
    pending_orders = await db.custom_orders.find({
        "delivery_partner_id": partner_id,
        "status": "delivered",
        "$or": [
            {"delivery_partner_settlement_status": {"$ne": "cleared"}},
            {"delivery_partner_settlement_status": {"$exists": False}}
        ]
    }).to_list(100)
    
    total_earnings = 0
    for order in pending_orders:
        delivery_fee = order.get("delivery_fee", 40)
        earning = round(delivery_fee * CUSTOM_ORDER_PARTNER_SHARE, 2)
        total_earnings += earning
    
    result = await db.custom_orders.update_many(
        {
            "delivery_partner_id": partner_id,
            "status": "delivered",
            "$or": [
                {"delivery_partner_settlement_status": {"$ne": "cleared"}},
                {"delivery_partner_settlement_status": {"$exists": False}}
            ]
        },
        {"$set": {
            "delivery_partner_settlement_status": "cleared",
            "delivery_payout_status": "cleared",
            "delivery_cleared_date": cleared_date,
            "delivery_clear_comment": comment,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": f"Cleared {result.modified_count} custom order payments",
        "orders_count": result.modified_count,
        "total_earnings": round(total_earnings, 2)
    }
    
    return {"message": f"Cleared {result.modified_count} custom order payments"}


@api_router.get("/restaurant/{restaurant_id}/payments")
async def get_restaurant_payments(restaurant_id: str, page: int = 1, limit: int = 20):
    """Get payment details for a restaurant (restaurant view)"""
    query = {"restaurant_id": restaurant_id, "status": "delivered"}
    
    skip = (page - 1) * limit
    orders = await db.orders.find(query, {"_id": 0}).skip(skip).limit(limit).sort("delivered_at", -1).to_list(limit)
    total = await db.orders.count_documents(query)
    
    # Calculate for each order
    for order in orders:
        payments = calculate_order_payments(order)
        order["your_payout"] = payments["restaurant_payout"]
        order["platform_fee"] = round(order.get("total_amount", 0) * PLATFORM_COMMISSION_RATE, 2)
    
    # Summary
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "total_orders": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"},
            "pending_payout": {
                "$sum": {
                    "$cond": [{"$eq": ["$restaurant_payout_status", "pending"]}, "$total_amount", 0]
                }
            },
            "cleared_payout": {
                "$sum": {
                    "$cond": [{"$eq": ["$restaurant_payout_status", "cleared"]}, "$total_amount", 0]
                }
            }
        }}
    ]
    summary_result = await db.orders.aggregate(pipeline).to_list(1)
    summary = summary_result[0] if summary_result else {
        "total_orders": 0, "total_sales": 0, "pending_payout": 0, "cleared_payout": 0
    }
    
    # Apply commission to get actual payouts
    summary["pending_payout"] = round(summary["pending_payout"] * (1 - PLATFORM_COMMISSION_RATE), 2)
    summary["cleared_payout"] = round(summary["cleared_payout"] * (1 - PLATFORM_COMMISSION_RATE), 2)
    summary["total_earnings"] = round(summary["total_sales"] * (1 - PLATFORM_COMMISSION_RATE), 2)
    summary["platform_fees"] = round(summary["total_sales"] * PLATFORM_COMMISSION_RATE, 2)
    
    return {
        "orders": orders,
        "summary": summary,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "commission_rate": f"{PLATFORM_COMMISSION_RATE * 100}%"
    }


@api_router.get("/delivery-partners/{partner_id}/payments")
async def get_delivery_partner_payments(partner_id: str, page: int = 1, limit: int = 20):
    """Get payment and COD details for a delivery partner (partner view) - includes regular and custom orders"""
    # Regular orders query
    regular_query = {"delivery_partner_id": partner_id, "status": "delivered"}
    
    skip = (page - 1) * limit
    regular_orders = await db.orders.find(regular_query, {"_id": 0}).skip(skip).limit(limit).sort("delivered_at", -1).to_list(limit)
    regular_total = await db.orders.count_documents(regular_query)
    
    # Custom orders query
    custom_query = {"delivery_partner_id": partner_id, "status": "delivered"}
    custom_orders = await db.custom_orders.find(custom_query, {"_id": 0}).skip(skip).limit(limit).sort("delivered_at", -1).to_list(limit)
    custom_total = await db.custom_orders.count_documents(custom_query)
    
    # Calculate for each regular order (95% share)
    for order in regular_orders:
        payments = calculate_order_payments(order, is_custom_order=False)
        order["your_earning"] = payments["delivery_partner_earning"]
        order["cod_collected"] = payments["cod_collected"]
        order["cod_to_return"] = payments["cod_to_return"]
        order["cod_fee"] = payments["cod_fee"]
        order["partner_share_percent"] = payments["partner_share_percent"]
        order["company_share_percent"] = payments["company_share_percent"]
        order["order_type"] = "regular"
        if not order.get("delivery_partner_settlement_status"):
            order["delivery_partner_settlement_status"] = "pending"
    
    # Calculate for each custom order (70% share)
    for order in custom_orders:
        payments = calculate_order_payments(order, is_custom_order=True)
        order["your_earning"] = payments["delivery_partner_earning"]
        order["cod_collected"] = payments["cod_collected"]
        order["cod_to_return"] = payments["cod_to_return"]
        order["cod_fee"] = payments.get("cod_fee", 0)
        order["partner_share_percent"] = payments["partner_share_percent"]
        order["company_share_percent"] = payments["company_share_percent"]
        order["order_type"] = "custom"
        if not order.get("delivery_partner_settlement_status"):
            order["delivery_partner_settlement_status"] = "pending"
    
    # Combine all orders sorted by date
    all_orders = regular_orders + custom_orders
    all_orders.sort(key=lambda x: x.get("delivered_at", ""), reverse=True)
    
    # Regular orders summary
    regular_pipeline = [
        {"$match": regular_query},
        {"$group": {
            "_id": None,
            "total_deliveries": {"$sum": 1},
            "total_delivery_fees": {"$sum": {"$ifNull": ["$delivery_fee", 30]}},
            "total_cod_fees": {
                "$sum": {
                    "$cond": [
                        {"$eq": ["$payment_method", "cod"]},
                        {"$ifNull": ["$cod_fee", 0]},
                        0
                    ]
                }
            },
            "total_cod_collected": {
                "$sum": {
                    "$cond": [
                        {"$eq": ["$payment_method", "cod"]},
                        {"$add": [
                            {"$ifNull": ["$total_amount", 0]}, 
                            {"$ifNull": ["$delivery_fee", 30]},
                            {"$ifNull": ["$cod_fee", 0]}
                        ]},
                        0
                    ]
                }
            },
            "pending_count": {
                "$sum": {
                    "$cond": [
                        {"$or": [
                            {"$eq": [{"$ifNull": ["$delivery_partner_settlement_status", "pending"]}, "pending"]},
                            {"$eq": ["$delivery_partner_settlement_status", None]}
                        ]},
                        1,
                        0
                    ]
                }
            },
            "cleared_count": {
                "$sum": {
                    "$cond": [
                        {"$eq": ["$delivery_partner_settlement_status", "cleared"]},
                        1,
                        0
                    ]
                }
            },
            "pending_delivery_fees": {
                "$sum": {
                    "$cond": [
                        {"$or": [
                            {"$eq": [{"$ifNull": ["$delivery_partner_settlement_status", "pending"]}, "pending"]},
                            {"$eq": ["$delivery_partner_settlement_status", None]}
                        ]},
                        {"$ifNull": ["$delivery_fee", 30]},
                        0
                    ]
                }
            },
            "cleared_delivery_fees": {
                "$sum": {
                    "$cond": [
                        {"$eq": ["$delivery_partner_settlement_status", "cleared"]},
                        {"$ifNull": ["$delivery_fee", 30]},
                        0
                    ]
                }
            }
        }}
    ]
    regular_summary = await db.orders.aggregate(regular_pipeline).to_list(1)
    regular_data = regular_summary[0] if regular_summary else {
        "total_deliveries": 0, "total_delivery_fees": 0, "total_cod_collected": 0,
        "total_cod_fees": 0, "pending_delivery_fees": 0, "cleared_delivery_fees": 0,
        "pending_count": 0, "cleared_count": 0
    }
    
    # Custom orders summary
    custom_pipeline = [
        {"$match": custom_query},
        {"$group": {
            "_id": None,
            "custom_deliveries": {"$sum": 1},
            "custom_delivery_fees": {"$sum": {"$ifNull": ["$delivery_fee", 0]}},
            "custom_pending_count": {
                "$sum": {
                    "$cond": [
                        {"$or": [
                            {"$eq": [{"$ifNull": ["$delivery_partner_settlement_status", "pending"]}, "pending"]},
                            {"$eq": ["$delivery_partner_settlement_status", None]}
                        ]},
                        1,
                        0
                    ]
                }
            },
            "custom_cleared_count": {
                "$sum": {
                    "$cond": [
                        {"$eq": ["$delivery_partner_settlement_status", "cleared"]},
                        1,
                        0
                    ]
                }
            },
            "custom_pending_fees": {
                "$sum": {
                    "$cond": [
                        {"$or": [
                            {"$eq": [{"$ifNull": ["$delivery_partner_settlement_status", "pending"]}, "pending"]},
                            {"$eq": ["$delivery_partner_settlement_status", None]}
                        ]},
                        {"$ifNull": ["$delivery_fee", 0]},
                        0
                    ]
                }
            },
            "custom_cleared_fees": {
                "$sum": {
                    "$cond": [
                        {"$eq": ["$delivery_partner_settlement_status", "cleared"]},
                        {"$ifNull": ["$delivery_fee", 0]},
                        0
                    ]
                }
            }
        }}
    ]
    custom_summary = await db.custom_orders.aggregate(custom_pipeline).to_list(1)
    custom_data = custom_summary[0] if custom_summary else {
        "custom_deliveries": 0, "custom_delivery_fees": 0,
        "custom_pending_count": 0, "custom_cleared_count": 0,
        "custom_pending_fees": 0, "custom_cleared_fees": 0
    }
    
    # Build combined summary
    summary = {
        # Regular orders (95% share)
        "regular_deliveries": regular_data["total_deliveries"],
        "regular_delivery_fees": regular_data["total_delivery_fees"],
        "regular_earnings": round(regular_data["total_delivery_fees"] * DELIVERY_PARTNER_SHARE, 2),
        "regular_pending": round(regular_data["pending_delivery_fees"] * DELIVERY_PARTNER_SHARE, 2),
        "regular_cleared": round(regular_data["cleared_delivery_fees"] * DELIVERY_PARTNER_SHARE, 2),
        "regular_pending_count": regular_data["pending_count"],
        "regular_cleared_count": regular_data["cleared_count"],
        "regular_share_percent": int(DELIVERY_PARTNER_SHARE * 100),
        
        # Custom orders (70% share)
        "custom_deliveries": custom_data["custom_deliveries"],
        "custom_delivery_fees": custom_data["custom_delivery_fees"],
        "custom_earnings": round(custom_data["custom_delivery_fees"] * CUSTOM_ORDER_PARTNER_SHARE, 2),
        "custom_pending": round(custom_data["custom_pending_fees"] * CUSTOM_ORDER_PARTNER_SHARE, 2),
        "custom_cleared": round(custom_data["custom_cleared_fees"] * CUSTOM_ORDER_PARTNER_SHARE, 2),
        "custom_pending_count": custom_data["custom_pending_count"],
        "custom_cleared_count": custom_data["custom_cleared_count"],
        "custom_share_percent": int(CUSTOM_ORDER_PARTNER_SHARE * 100),
        
        # Combined totals
        "total_deliveries": regular_data["total_deliveries"] + custom_data["custom_deliveries"],
        "total_earnings": round(
            regular_data["total_delivery_fees"] * DELIVERY_PARTNER_SHARE + 
            custom_data["custom_delivery_fees"] * CUSTOM_ORDER_PARTNER_SHARE, 2
        ),
        "pending_settlement": round(
            regular_data["pending_delivery_fees"] * DELIVERY_PARTNER_SHARE + 
            custom_data["custom_pending_fees"] * CUSTOM_ORDER_PARTNER_SHARE, 2
        ),
        "cleared_earnings": round(
            regular_data["cleared_delivery_fees"] * DELIVERY_PARTNER_SHARE + 
            custom_data["custom_cleared_fees"] * CUSTOM_ORDER_PARTNER_SHARE, 2
        ),
        "total_pending_count": regular_data["pending_count"] + custom_data["custom_pending_count"],
        "total_cleared_count": regular_data["cleared_count"] + custom_data["custom_cleared_count"],
        
        # COD related
        "total_cod_collected": regular_data["total_cod_collected"],
        "total_cod_fees": regular_data["total_cod_fees"],
        "cod_to_return": round(regular_data["total_cod_collected"] - (regular_data["total_delivery_fees"] * DELIVERY_PARTNER_SHARE), 2)
    }
    
    return {
        "orders": all_orders,
        "summary": summary,
        "total": regular_total + custom_total,
        "page": page,
        "pages": ((regular_total + custom_total) + limit - 1) // limit
    }


@api_router.post("/admin/restaurants")
async def admin_create_restaurant(request: CreateRestaurantRequest):
    """Admin creates a new restaurant"""
    restaurant = Restaurant(
        **request.model_dump(),
        owner_id=None  # Admin created
    )
    
    restaurant_dict = restaurant.model_dump()
    restaurant_dict["created_at"] = restaurant_dict["created_at"].isoformat()
    
    await db.restaurants.insert_one(restaurant_dict)
    restaurant_dict.pop("_id", None)
    
    return {"message": "Restaurant created", "restaurant": restaurant_dict}

@api_router.put("/admin/restaurants/{restaurant_id}")
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

@api_router.delete("/admin/restaurants/{restaurant_id}")
async def admin_delete_restaurant(restaurant_id: str):
    """Admin deletes a restaurant and all related entries"""
    # First get the restaurant to find owner_id
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Delete the restaurant record
    result = await db.restaurants.delete_one({"id": restaurant_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Cascade delete related entries
    # 1. Delete restaurant discounts
    await db.restaurant_discounts.delete_many({"restaurant_id": restaurant_id})
    
    # 2. Delete/update orders (mark restaurant as deleted)
    await db.orders.update_many(
        {"restaurant_id": restaurant_id},
        {"$set": {"restaurant_deleted": True}}
    )
    
    # 3. Delete notifications related to this restaurant
    await db.notifications.delete_many({"data.restaurant_id": restaurant_id})
    
    # 4. Delete the associated user record (owner)
    if restaurant.get("owner_id"):
        await db.users.delete_one({"id": restaurant["owner_id"]})
    
    # 5. Delete any pending approval records if stored separately
    await db.restaurant_approvals.delete_many({"restaurant_id": restaurant_id})
    
    return {"message": "Restaurant and all related entries deleted"}

@api_router.post("/admin/restaurants/{restaurant_id}/menu")
async def admin_add_menu_item(restaurant_id: str, request: AddMenuItemRequest):
    """Admin adds menu item to restaurant"""
    menu_item = MenuItem(**request.model_dump())
    
    result = await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$push": {"menu": menu_item.model_dump()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return {"message": "Menu item added", "restaurant": restaurant}

@api_router.put("/admin/restaurants/{restaurant_id}/menu/{item_id}")
async def admin_update_menu_item(restaurant_id: str, item_id: str, request: AddMenuItemRequest):
    """Admin updates menu item"""
    update_data = request.model_dump()
    
    result = await db.restaurants.update_one(
        {"id": restaurant_id, "menu.id": item_id},
        {"$set": {
            "menu.$.name": update_data["name"],
            "menu.$.description": update_data["description"],
            "menu.$.price": update_data["price"],
            "menu.$.image": update_data["image"],
            "menu.$.category": update_data["category"],
            "menu.$.is_veg": update_data["is_veg"]
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant or menu item not found")
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return {"message": "Menu item updated", "restaurant": restaurant}

@api_router.delete("/admin/restaurants/{restaurant_id}/menu/{item_id}")
async def admin_delete_menu_item(restaurant_id: str, item_id: str):
    """Admin deletes menu item"""
    result = await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$pull": {"menu": {"id": item_id}}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return {"message": "Menu item deleted", "restaurant": restaurant}

# ============== ADMIN DELIVERY PARTNER MANAGEMENT ==============

@api_router.get("/admin/delivery-partners")
async def admin_get_delivery_partners(page: int = 1, limit: int = 20, approval_status: Optional[str] = None):
    """Get all delivery partners with optional approval status filter"""
    query = {}
    if approval_status:
        query["approval_status"] = approval_status
    
    skip = (page - 1) * limit
    partners = await db.delivery_partners.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    total = await db.delivery_partners.count_documents(query)
    
    # Count by approval status
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

@api_router.get("/admin/delivery-partners/available")
async def admin_get_available_partners():
    """Get all available and approved delivery partners"""
    partners = await db.delivery_partners.find({
        "is_available": True, 
        "is_online": True,
        "approval_status": "approved"
    }, {"_id": 0}).to_list(100)
    return partners

@api_router.post("/admin/delivery-partners/{partner_id}/approve")
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
    
    # Create notification for delivery partner
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

@api_router.put("/admin/delivery-partners/{partner_id}")
async def admin_update_delivery_partner(partner_id: str, request: dict):
    """Admin updates delivery partner details"""
    # Get current partner
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    # Fields that admin can update
    allowed_fields = ["name", "phone", "email", "address", "state", "pincode", "city",
                      "vehicle_type", "vehicle_number", "license_number", "license_image",
                      "approval_status", "is_available", "is_online", "approval_notes"]
    
    update_data = {k: v for k, v in request.items() if k in allowed_fields and v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.delivery_partners.update_one({"id": partner_id}, {"$set": update_data})
    
    # Also update user record if relevant fields changed
    user_sync_fields = {"name", "phone", "email", "address", "state", "pincode", "city", "license_image"}
    user_update = {k: v for k, v in update_data.items() if k in user_sync_fields}
    if user_update:
        await db.users.update_one({"id": partner["user_id"]}, {"$set": user_update})
    
    updated_partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    return {"message": "Delivery partner updated", "partner": updated_partner}

@api_router.delete("/admin/delivery-partners/{partner_id}")
async def admin_delete_delivery_partner(partner_id: str):
    """Admin deletes a delivery partner and all related entries"""
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    # Delete delivery partner record
    result = await db.delivery_partners.delete_one({"id": partner_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    # Cascade delete related entries
    # 1. Update orders assigned to this partner (unassign them)
    await db.orders.update_many(
        {"delivery_partner_id": partner_id},
        {"$set": {"delivery_partner_id": None, "delivery_partner_deleted": True}}
    )
    
    # 2. Delete COD settlements for this partner
    await db.cod_settlements.delete_many({"partner_id": partner_id})
    
    # 3. Delete notifications for this partner
    await db.notifications.delete_many({"user_id": partner.get("user_id")})
    await db.notifications.delete_many({"data.partner_id": partner_id})
    
    # 4. Delete any pending approval records if stored separately
    await db.delivery_approvals.delete_many({"partner_id": partner_id})
    
    # 5. Delete the associated user record
    if partner.get("user_id"):
        await db.users.delete_one({"id": partner["user_id"]})
    
    return {"message": "Delivery partner and all related entries deleted"}

# ============== ADMIN RESTAURANT APPROVAL ==============

@api_router.get("/admin/restaurants/pending")
async def admin_get_pending_restaurants():
    """Get restaurants pending approval or with pending changes"""
    pending_approval = await db.restaurants.find({"approval_status": "pending"}, {"_id": 0}).to_list(100)
    pending_changes = await db.restaurants.find({"has_pending_changes": True}, {"_id": 0}).to_list(100)
    
    return {
        "pending_approval": pending_approval,
        "pending_changes": pending_changes,
        "total_pending": len(pending_approval) + len(pending_changes)
    }

@api_router.post("/admin/restaurants/{restaurant_id}/approve")
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
        "is_open": request.action == "approve"  # Only open if approved
    }
    
    await db.restaurants.update_one({"id": restaurant_id}, {"$set": update_data})
    
    # Create notification for restaurant owner
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

@api_router.post("/admin/restaurants/{restaurant_id}/approve-changes")
async def admin_approve_restaurant_changes(restaurant_id: str, request: AdminApproveChangesRequest, admin_phone: str = ""):
    """Admin approves or rejects pending changes to a restaurant"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    if not restaurant.get("pending_changes"):
        raise HTTPException(status_code=400, detail="No pending changes to approve")
    
    if request.approve:
        # Apply pending changes
        pending = restaurant["pending_changes"]
        update_data = {k: v for k, v in pending.items() if v is not None and k != "menu_changes"}
        update_data["has_pending_changes"] = False
        update_data["pending_changes"] = None
        
        # Handle menu changes
        if pending.get("menu_changes"):
            current_menu = restaurant.get("menu", [])
            for change in pending["menu_changes"]:
                if change["action"] == "add":
                    new_item = change["item"]
                    new_item["id"] = str(uuid.uuid4())
                    current_menu.append(new_item)
                elif change["action"] == "update":
                    for i, item in enumerate(current_menu):
                        if item["id"] == change["item"]["id"]:
                            current_menu[i] = {**item, **change["item"]}
                            break
                elif change["action"] == "delete":
                    current_menu = [item for item in current_menu if item["id"] != change["item_id"]]
            update_data["menu"] = current_menu
        
        await db.restaurants.update_one({"id": restaurant_id}, {"$set": update_data})
        message = "Changes approved and applied"
    else:
        # Reject changes
        await db.restaurants.update_one({"id": restaurant_id}, {"$set": {
            "has_pending_changes": False,
            "pending_changes": None
        }})
        message = "Changes rejected"
    
    # Notify restaurant owner
    if restaurant.get("owner_id"):
        notification = {
            "id": str(uuid.uuid4()),
            "recipient_type": "restaurant",
            "recipient_id": restaurant["owner_id"],
            "type": "changes_reviewed",
            "title": "Changes " + ("Approved" if request.approve else "Rejected"),
            "message": f"Your pending changes for '{restaurant['name']}' have been {'approved and applied' if request.approve else 'rejected'}." + (f" Notes: {request.notes}" if request.notes else ""),
            "data": {"restaurant_id": restaurant_id, "approved": request.approve},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    updated_restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return {"message": message, "restaurant": updated_restaurant}

# ============== NOTIFICATIONS ENDPOINTS ==============

@api_router.get("/notifications/{user_id}")
async def get_notifications(user_id: str, limit: int = 50):
    """Get notifications for a user"""
    notifications = await db.notifications.find(
        {"recipient_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    unread_count = await db.notifications.count_documents({"recipient_id": user_id, "is_read": False})
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"is_read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/{user_id}/read-all")
async def mark_all_notifications_read(user_id: str):
    """Mark all notifications as read for a user"""
    await db.notifications.update_many(
        {"recipient_id": user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

# ============== DELIVERY PARTNER LOCATION & ORDERS ==============

@api_router.put("/delivery-partners/{partner_id}/location")
async def update_delivery_location(partner_id: str, request: UpdateDeliveryLocationRequest):
    """Update delivery partner's current location"""
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    location_data = {
        "lat": request.lat,
        "lng": request.lng,
        "address": request.address,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.delivery_partners.update_one(
        {"id": partner_id},
        {"$set": {"current_location": location_data}}
    )
    
    return {"message": "Location updated", "location": location_data}

class DeliveryPartnerProfileUpdate(BaseModel):
    photo: Optional[str] = None
    license_image: Optional[str] = None

@api_router.put("/delivery/partners/{partner_id}/profile")
async def update_delivery_partner_profile(partner_id: str, request: DeliveryPartnerProfileUpdate):
    """Update delivery partner photo and license image"""
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    update_data = {}
    if request.photo is not None:
        update_data["photo"] = request.photo
    if request.license_image is not None:
        update_data["license_image"] = request.license_image
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.delivery_partners.update_one(
            {"id": partner_id},
            {"$set": update_data}
        )
        
        # Sync to user record if user_id exists
        if partner.get("user_id"):
            user_sync = {}
            if "photo" in update_data:
                user_sync["photo"] = update_data["photo"]
            if "license_image" in update_data:
                user_sync["license_image"] = update_data["license_image"]
            
            if user_sync:
                await db.users.update_one(
                    {"id": partner["user_id"]},
                    {"$set": user_sync}
                )
    
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    return {"message": "Profile updated", "partner": partner}


@api_router.get("/delivery-partners/{partner_id}/custom-orders")
async def get_delivery_partner_custom_orders(partner_id: str, request: Request):
    """Get only the custom orders assigned to a specific delivery partner.
    Auth-gated: caller must be the same partner OR an admin."""
    await require_delivery_partner_self_or_admin(request, partner_id=partner_id)
    orders = await db.custom_orders.find(
        {
            "delivery_partner_id": partner_id,
            "status": {"$nin": ["delivered", "cancelled"]},
        },
        {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    return {"orders": orders, "total": len(orders)}


@api_router.put("/delivery-partners/{partner_id}/custom-orders/{order_id}/status")
async def update_custom_order_status_by_partner(
    partner_id: str,
    order_id: str,
    request: Request,
    payload: dict,
):
    """Delivery partner updates lifecycle status of an assigned custom order.
    Allowed transitions for partners: assigned → picked_up → delivered.
    Auth-gated: caller must be the same partner OR an admin."""
    await require_delivery_partner_self_or_admin(request, partner_id=partner_id)

    new_status = (payload or {}).get("status")
    if new_status not in {"picked_up", "delivered"}:
        raise HTTPException(status_code=400, detail="Partners may only set status to picked_up or delivered")

    order = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("delivery_partner_id") != partner_id:
        raise HTTPException(status_code=403, detail="Order is not assigned to you")

    now_iso = datetime.now(timezone.utc).isoformat()
    update_data = {"status": new_status, "updated_at": now_iso}

    if new_status == "picked_up" and not order.get("picked_up_at"):
        update_data["picked_up_at"] = now_iso
    elif new_status == "delivered" and order.get("status") != "delivered":
        update_data["delivered_at"] = now_iso
        # Settle delivery partner earnings (matches admin endpoint logic)
        delivery_fee = order.get("delivery_fee") or 40
        update_data["delivery_fee"] = delivery_fee
        update_data["delivery_partner_earning"] = round(delivery_fee * CUSTOM_ORDER_PARTNER_SHARE, 2)
        update_data["platform_delivery_fee"] = round(delivery_fee * (1 - CUSTOM_ORDER_PARTNER_SHARE), 2)
        update_data["delivery_partner_settlement_status"] = "pending"
        update_data["delivery_payout_status"] = "pending"

    await db.custom_orders.update_one({"id": order_id}, {"$set": update_data})

    # Notify customer
    msg_map = {
        "picked_up": "Your order has been picked up and is on the way!",
        "delivered": "Your order has been delivered. Enjoy your meal!",
    }
    if new_status in msg_map:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "type": "custom_order_update",
            "title": f"Order {new_status.replace('_', ' ').title()}",
            "message": msg_map[new_status],
            "user_id": order["user_id"],
            "order_id": order_id,
            "is_read": False,
            "created_at": now_iso,
        })

    updated = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
    return {"message": f"Order marked as {new_status}", "order": updated}


@api_router.put("/delivery-partners/{partner_id}/online")
async def toggle_delivery_online_status(partner_id: str):
    """Toggle delivery partner online/offline status"""
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    # Can only go online if approved
    if partner.get("approval_status") != "approved":
        raise HTTPException(status_code=400, detail="Your account must be approved to go online")
    
    new_status = not partner.get("is_online", False)
    
    await db.delivery_partners.update_one(
        {"id": partner_id},
        {"$set": {"is_online": new_status, "is_available": new_status}}
    )
    
    updated = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    return {"message": f"Now {'online' if new_status else 'offline'}", "partner": updated}

@api_router.get("/delivery-partners/{partner_id}/nearby-orders")
async def get_nearby_orders_for_delivery(partner_id: str):
    """Get orders ready for pickup near delivery partner's location"""
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    if partner.get("approval_status") != "approved":
        return {"orders": [], "message": "Account pending approval"}
    
    if not partner.get("is_online"):
        return {"orders": [], "message": "Go online to see available orders"}
    
    # Get orders that are ready for pickup and don't have a delivery partner assigned
    ready_orders = await db.orders.find({
        "status": "ready",
        "delivery_partner_id": None
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Enrich with full details
    enriched_orders = []
    for order in ready_orders:
        restaurant = await db.restaurants.find_one({"id": order.get("restaurant_id")}, {"_id": 0, "name": 1, "address": 1, "lat": 1, "lng": 1, "image": 1})
        
        enriched_orders.append({
            **order,
            "restaurant_details": restaurant,
            "estimated_earnings": round(order.get("total_amount", 0) * 0.1 + order.get("delivery_fee", 30), 2),
            "distance_km": None  # Would calculate based on lat/lng if available
        })
    
    return {
        "orders": enriched_orders,
        "partner_location": partner.get("current_location")
    }

@api_router.get("/delivery-partners/{partner_id}/earnings")
async def get_delivery_earnings(partner_id: str, request: Request):
    """Get detailed earnings for a delivery partner (regular + custom orders)"""
    # Auth: only the partner themselves or an admin
    await require_delivery_partner_self_or_admin(request, partner_id=partner_id)
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    # Get all delivered regular orders by this partner
    delivered_orders = await db.orders.find({
        "delivery_partner_id": partner_id,
        "status": "delivered"
    }, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Get all delivered custom orders by this partner
    delivered_custom_orders = await db.custom_orders.find({
        "delivery_partner_id": partner_id,
        "status": "delivered"
    }, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Calculate earnings: 95% of delivery fee (regular), 70% (custom)
    def calc_earning(order, is_custom=False):
        share = CUSTOM_ORDER_PARTNER_SHARE if is_custom else DELIVERY_PARTNER_SHARE
        return order.get("delivery_fee", 40 if is_custom else 30) * share
    
    # Tag orders with type for combined analysis
    for o in delivered_orders:
        o["_order_type"] = "regular"
    for o in delivered_custom_orders:
        o["_order_type"] = "custom"
    
    all_delivered = delivered_orders + delivered_custom_orders
    
    total_earnings = sum(calc_earning(o, o["_order_type"] == "custom") for o in all_delivered)
    
    # Today's stats
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_orders = [o for o in all_delivered if o.get("created_at", "") >= today.isoformat()]
    today_earnings = sum(calc_earning(o, o["_order_type"] == "custom") for o in today_orders)
    
    # This week's stats
    week_ago = today - timedelta(days=7)
    week_orders = [o for o in all_delivered if o.get("created_at", "") >= week_ago.isoformat()]
    week_earnings = sum(calc_earning(o, o["_order_type"] == "custom") for o in week_orders)
    
    # This month's stats
    month_ago = today - timedelta(days=30)
    month_orders = [o for o in all_delivered if o.get("created_at", "") >= month_ago.isoformat()]
    month_earnings = sum(calc_earning(o, o["_order_type"] == "custom") for o in month_orders)
    
    # Calculate COD totals (only regular orders have COD in standard flow)
    cod_orders = [o for o in delivered_orders if o.get("payment_method") == "cod"]
    total_cod_collected = sum(o.get("total_amount", 0) + o.get("delivery_fee", 0) for o in cod_orders)
    cod_earnings = sum(calc_earning(o, False) for o in cod_orders)
    cod_to_return = total_cod_collected - cod_earnings
    
    # Recent orders with earnings and COD info - merge and sort by date
    all_sorted = sorted(all_delivered, key=lambda x: x.get("delivered_at") or x.get("created_at", ""), reverse=True)
    recent_deliveries = []
    for order in all_sorted[:20]:
        is_custom = order["_order_type"] == "custom"
        earning = calc_earning(order, is_custom)
        cod_collected = 0
        to_return = 0
        if not is_custom and order.get("payment_method") == "cod":
            cod_collected = order.get("total_amount", 0) + order.get("delivery_fee", 0)
            to_return = cod_collected - earning
        recent_deliveries.append({
            "order_id": order["id"],
            "order_type": order["_order_type"],
            "restaurant_name": order.get("restaurant_name"),
            "amount": order.get("total_amount") or order.get("estimated_amount"),
            "delivery_fee": order.get("delivery_fee", 40 if is_custom else 30),
            "earning": round(earning, 2),
            "payment_method": order.get("payment_method", "cod"),
            "cod_collected": round(cod_collected, 2),
            "cod_to_return": round(to_return, 2),
            "delivered_at": order.get("delivered_at") or order.get("updated_at")
        })
    
    return {
        "partner": {
            "name": partner.get("name"),
            "total_deliveries": len(all_delivered),
            "rating": partner.get("rating", 5.0)
        },
        "earnings": {
            "total": round(total_earnings, 2),
            "today": round(today_earnings, 2),
            "this_week": round(week_earnings, 2),
            "this_month": round(month_earnings, 2),
            "earning_rate": f"{DELIVERY_PARTNER_SHARE * 100}% regular / {CUSTOM_ORDER_PARTNER_SHARE * 100}% custom"
        },
        "deliveries": {
            "total": len(all_delivered),
            "regular": len(delivered_orders),
            "custom": len(delivered_custom_orders),
            "today": len(today_orders),
            "this_week": len(week_orders),
            "this_month": len(month_orders)
        },
        "cod": {
            "total_collected": round(total_cod_collected, 2),
            "your_earnings": round(cod_earnings, 2),
            "to_return": round(cod_to_return, 2),
            "orders_count": len(cod_orders)
        },
        "recent_deliveries": recent_deliveries
    }

# ============== USER ENDPOINTS ==============

@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    """Get user profile"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, request: UpdateProfileRequest):
    """Update user profile and sync to related collections"""
    update_data = {k: v for k, v in request.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    # Get current user to check role
    current_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check for duplicate email (if email is being updated and is not empty)
    if "email" in update_data and update_data["email"]:
        existing_email = await db.users.find_one({
            "email": update_data["email"],
            "id": {"$ne": user_id}
        }, {"_id": 0})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered with another account")
    
    # Check for duplicate FSSAI licence
    if "fssai_licence" in update_data and update_data["fssai_licence"]:
        existing_fssai = await db.users.find_one({
            "fssai_licence": update_data["fssai_licence"],
            "id": {"$ne": user_id}
        }, {"_id": 0})
        if existing_fssai:
            raise HTTPException(status_code=400, detail="FSSAI licence already registered with another account. Please go to login page.")
    
    # Check for duplicate driving licence
    if "driving_licence" in update_data and update_data["driving_licence"]:
        existing_licence = await db.users.find_one({
            "driving_licence": update_data["driving_licence"],
            "id": {"$ne": user_id}
        }, {"_id": 0})
        if existing_licence:
            raise HTTPException(status_code=400, detail="Driving licence already registered with another account. Please go to login page.")
    
    # Update user record
    result = await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Sync to related collections based on user role
    user_role = update_data.get("role") or current_user.get("role", "customer")
    
    # Sync to restaurant collection if user is restaurant owner
    if user_role == "restaurant":
        restaurant_sync_fields = {}
        if "name" in update_data:
            restaurant_sync_fields["owner_name"] = update_data["name"]
        if "email" in update_data:
            restaurant_sync_fields["owner_email"] = update_data["email"]
        if "address" in update_data:
            restaurant_sync_fields["address"] = update_data["address"]
        if "state" in update_data:
            restaurant_sync_fields["state"] = update_data["state"]
        if "pincode" in update_data:
            restaurant_sync_fields["pincode"] = update_data["pincode"]
        if "city" in update_data:
            restaurant_sync_fields["city"] = update_data["city"]
        if "fssai_licence" in update_data:
            restaurant_sync_fields["fssai_number"] = update_data["fssai_licence"]
        
        if restaurant_sync_fields:
            restaurant_sync_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.restaurants.update_one(
                {"owner_id": user_id},
                {"$set": restaurant_sync_fields}
            )
    
    # Sync to delivery_partners collection if user is delivery partner
    elif user_role == "delivery":
        partner_sync_fields = {}
        if "name" in update_data:
            partner_sync_fields["name"] = update_data["name"]
        if "email" in update_data:
            partner_sync_fields["email"] = update_data["email"]
        if "address" in update_data:
            partner_sync_fields["address"] = update_data["address"]
        if "state" in update_data:
            partner_sync_fields["state"] = update_data["state"]
        if "pincode" in update_data:
            partner_sync_fields["pincode"] = update_data["pincode"]
        if "city" in update_data:
            partner_sync_fields["city"] = update_data["city"]
        if "vehicle_number" in update_data:
            partner_sync_fields["vehicle_number"] = update_data["vehicle_number"]
        if "vehicle_type" in update_data:
            partner_sync_fields["vehicle_type"] = update_data["vehicle_type"]
        if "driving_licence" in update_data:
            partner_sync_fields["license_number"] = update_data["driving_licence"]
        if "license_image" in update_data:
            partner_sync_fields["license_image"] = update_data["license_image"]
        
        if partner_sync_fields:
            partner_sync_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
            
            # Check if delivery partner record exists
            existing_partner = await db.delivery_partners.find_one({"user_id": user_id})
            
            if existing_partner:
                # Update existing partner record
                await db.delivery_partners.update_one(
                    {"user_id": user_id},
                    {"$set": partner_sync_fields}
                )
            else:
                # Create new delivery partner record for admin approval
                new_partner = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "name": update_data.get("name") or current_user.get("name", ""),
                    "phone": current_user.get("phone", ""),
                    "email": update_data.get("email") or current_user.get("email"),
                    "address": update_data.get("address") or current_user.get("address"),
                    "state": update_data.get("state") or current_user.get("state"),
                    "pincode": update_data.get("pincode") or current_user.get("pincode"),
                    "city": update_data.get("city") or current_user.get("city"),
                    "vehicle_number": update_data.get("vehicle_number", ""),
                    "vehicle_type": update_data.get("vehicle_type", "bike"),
                    "license_number": update_data.get("driving_licence"),
                    "license_image": update_data.get("license_image"),
                    "is_available": True,
                    "is_online": False,
                    "approval_status": "pending",
                    "total_deliveries": 0,
                    "total_earnings": 0,
                    "rating": 5.0,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.delivery_partners.insert_one(new_partner)
                
                # Send notification to admin
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "type": "new_delivery_partner",
                    "title": "New Delivery Partner Registration",
                    "message": f"New delivery partner registration from {new_partner['name']} ({new_partner['phone']})",
                    "user_id": "admin",
                    "is_read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user

@api_router.post("/users/{user_id}/addresses")
async def add_address(user_id: str, request: AddAddressRequest):
    """Add address to user profile"""
    address = Address(**request.model_dump())
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$push": {"addresses": address.model_dump()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user

@api_router.delete("/users/{user_id}/addresses/{address_id}")
async def delete_address(user_id: str, address_id: str):
    """Delete address from user profile"""
    result = await db.users.update_one(
        {"id": user_id},
        {"$pull": {"addresses": {"id": address_id}}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user

# ============== RESTAURANT ENDPOINTS ==============

@api_router.get("/restaurants")
async def get_restaurants(
    cuisine: Optional[str] = None, 
    is_veg: Optional[bool] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 15.0
):
    """Get all restaurants with optional filters. If lat/lng provided, filters by distance."""
    query = {"is_open": True, "approval_status": "approved"}
    
    if cuisine:
        query["cuisine"] = {"$in": [cuisine]}
    if is_veg is not None:
        query["is_veg"] = is_veg
    
    restaurants = await db.restaurants.find(query, {"_id": 0}).to_list(100)
    
    # Filter by location if coordinates provided
    if lat is not None and lng is not None:
        filtered_restaurants = []
        for restaurant in restaurants:
            if restaurant.get("lat") and restaurant.get("lng"):
                distance = calculate_distance_km(lat, lng, restaurant["lat"], restaurant["lng"])
                if distance <= radius_km:
                    restaurant["distance_km"] = round(distance, 1)
                    filtered_restaurants.append(restaurant)
            else:
                # Include restaurants without coordinates but mark as unknown distance
                restaurant["distance_km"] = None
                filtered_restaurants.append(restaurant)
        
        # Sort by distance (restaurants without coordinates at the end)
        # Note: Use explicit None check since 0.0 is falsy but should sort first
        filtered_restaurants.sort(key=lambda x: (x["distance_km"] is None, x["distance_km"] if x["distance_km"] is not None else 999))
        return filtered_restaurants
    
    return restaurants

@api_router.get("/search")
async def search(q: str, type: str = "all"):
    """Search restaurants and menu items with autocomplete"""
    if len(q) < 2:
        return {"restaurants": [], "items": [], "suggestions": []}
    
    search_regex = {"$regex": q, "$options": "i"}
    
    results = {
        "restaurants": [],
        "items": [],
        "suggestions": []
    }
    
    if type in ["all", "restaurants"]:
        # Search restaurants by name, cuisine, or description
        restaurant_query = {
            "$or": [
                {"name": search_regex},
                {"cuisine": search_regex},
                {"description": search_regex}
            ],
            "is_open": True,
            "approval_status": "approved"
        }
        restaurants = await db.restaurants.find(
            restaurant_query, 
            {"_id": 0, "id": 1, "name": 1, "cuisine": 1, "rating": 1, "image": 1, "delivery_time": 1}
        ).limit(10).to_list(10)
        results["restaurants"] = restaurants
    
    if type in ["all", "items"]:
        # Search menu items across all restaurants
        pipeline = [
            {"$match": {"is_open": True, "approval_status": "approved"}},
            {"$unwind": "$menu"},
            {"$match": {
                "$or": [
                    {"menu.name": search_regex},
                    {"menu.description": search_regex},
                    {"menu.category": search_regex}
                ]
            }},
            {"$project": {
                "_id": 0,
                "restaurant_id": "$id",
                "restaurant_name": "$name",
                "item": "$menu"
            }},
            {"$limit": 15}
        ]
        items = await db.restaurants.aggregate(pipeline).to_list(15)
        results["items"] = items
    
    # Generate search suggestions
    all_names = [r["name"] for r in results["restaurants"]]
    all_items = [i["item"]["name"] for i in results["items"]]
    all_cuisines = []
    for r in results["restaurants"]:
        all_cuisines.extend(r.get("cuisine", []))
    
    suggestions = list(set(all_names + all_items + all_cuisines))[:8]
    results["suggestions"] = suggestions
    
    return results

@api_router.get("/search/suggestions")
async def get_search_suggestions(q: str):
    """Get autocomplete suggestions while typing"""
    if len(q) < 2:
        return []
    
    search_regex = {"$regex": f"^{q}", "$options": "i"}
    
    # Get restaurant name suggestions
    restaurants = await db.restaurants.find(
        {"name": search_regex, "is_open": True},
        {"_id": 0, "name": 1}
    ).limit(5).to_list(5)
    
    # Get menu item suggestions
    pipeline = [
        {"$unwind": "$menu"},
        {"$match": {"menu.name": search_regex}},
        {"$project": {"_id": 0, "name": "$menu.name"}},
        {"$limit": 5}
    ]
    items = await db.restaurants.aggregate(pipeline).to_list(5)
    
    # Get cuisine suggestions
    cuisines_pipeline = [
        {"$unwind": "$cuisine"},
        {"$match": {"cuisine": search_regex}},
        {"$group": {"_id": "$cuisine"}},
        {"$limit": 5}
    ]
    cuisines = await db.restaurants.aggregate(cuisines_pipeline).to_list(5)
    
    suggestions = []
    for r in restaurants:
        suggestions.append({"text": r["name"], "type": "restaurant"})
    for i in items:
        suggestions.append({"text": i["name"], "type": "item"})
    for c in cuisines:
        suggestions.append({"text": c["_id"], "type": "cuisine"})
    
    return suggestions[:10]

@api_router.get("/restaurants/{restaurant_id}")
async def get_restaurant(restaurant_id: str):
    """Get restaurant by ID with full menu"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant


# Delivery fee calculation helper
def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates using Haversine formula"""
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c


def calculate_delivery_fee(distance_km: float, is_first_order: bool = False) -> dict:
    """
    Calculate delivery fee based on order history:
    - First order: FREE delivery
    - From second order: Flat ₹10 delivery fee
    """
    if is_first_order:
        return {
            "fee": 0, 
            "serviceable": True, 
            "message": "🎉 FREE delivery on your first order!",
            "is_first_order": True
        }
    
    # Flat ₹10 delivery fee from second order onwards
    if distance_km <= 10:
        return {"fee": 10, "serviceable": True, "message": "Delivery fee: ₹10", "is_first_order": False}
    else:
        return {"fee": 0, "serviceable": False, "message": "Sorry, this restaurant doesn't deliver to your location (beyond 10km)", "is_first_order": False}


# COD fee (₹5 from second order)
COD_FEE = 5


@api_router.get("/delivery-fee")
async def get_delivery_fee(
    restaurant_id: str,
    customer_lat: float,
    customer_lng: float,
    user_id: Optional[str] = None
):
    """Calculate delivery fee based on distance between restaurant and customer"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Check if this is user's first order
    is_first_order = False
    if user_id:
        order_count = await db.orders.count_documents({"user_id": user_id, "status": {"$ne": "cancelled"}})
        is_first_order = order_count == 0
    
    # Check if restaurant has coordinates
    if not restaurant.get("lat") or not restaurant.get("lng"):
        # Default fee if restaurant doesn't have coordinates
        fee = 0 if is_first_order else 10  # Flat ₹10 from second order
        return {
            "fee": fee,
            "serviceable": True,
            "distance_km": None,
            "message": "🎉 FREE delivery on your first order!" if is_first_order else "Delivery fee: ₹10",
            "is_first_order": is_first_order,
            "cod_fee": 0 if is_first_order else COD_FEE
        }
    
    # Calculate distance
    distance_km = calculate_distance_km(
        restaurant["lat"], restaurant["lng"],
        customer_lat, customer_lng
    )
    
    # Calculate fee
    fee_info = calculate_delivery_fee(distance_km, is_first_order)
    
    return {
        "fee": fee_info["fee"],
        "serviceable": fee_info["serviceable"],
        "distance_km": round(distance_km, 2),
        "message": fee_info["message"],
        "is_first_order": fee_info.get("is_first_order", False),
        "cod_fee": 0 if is_first_order else COD_FEE,
        "restaurant_location": {
            "lat": restaurant["lat"],
            "lng": restaurant["lng"],
            "address": restaurant.get("address")
        }
    }


@api_router.post("/restaurants")
async def create_restaurant(request: CreateRestaurantRequest, owner_id: str):
    """Create a new restaurant (requires admin approval)"""
    restaurant = Restaurant(
        **request.model_dump(),
        owner_id=owner_id,
        approval_status="pending",  # New restaurants need approval
        is_open=False  # Can't be open until approved
    )
    
    restaurant_dict = restaurant.model_dump()
    restaurant_dict["created_at"] = restaurant_dict["created_at"].isoformat()
    
    await db.restaurants.insert_one(restaurant_dict)
    restaurant_dict.pop("_id", None)
    
    # Create notification for admin
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "admin",
        "recipient_id": "all",
        "type": "restaurant_registration",
        "title": "New Restaurant Registration",
        "message": f"'{restaurant_dict['name']}' has registered and is awaiting approval.",
        "data": {"restaurant_id": restaurant_dict["id"], "name": restaurant_dict["name"]},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {**restaurant_dict, "message": "Restaurant submitted for approval"}

@api_router.put("/restaurants/{restaurant_id}")
async def update_restaurant(restaurant_id: str, request: CreateRestaurantRequest):
    """Update restaurant details - changes need admin approval if restaurant is approved"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    update_data = request.model_dump()
    
    # If restaurant is approved, changes need admin approval
    if restaurant.get("approval_status") == "approved":
        await db.restaurants.update_one(
            {"id": restaurant_id},
            {"$set": {
                "pending_changes": update_data,
                "has_pending_changes": True
            }}
        )
        
        # Notify admin
        notification = {
            "id": str(uuid.uuid4()),
            "recipient_type": "admin",
            "recipient_id": "all",
            "type": "restaurant_changes",
            "title": "Restaurant Changes Pending",
            "message": f"'{restaurant['name']}' has submitted changes for approval.",
            "data": {"restaurant_id": restaurant_id, "name": restaurant["name"]},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        
        return {"message": "Changes submitted for admin approval", "pending_changes": update_data}
    else:
        # If not yet approved, update directly
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.restaurants.update_one(
            {"id": restaurant_id},
            {"$set": update_data}
        )
        
        # Sync relevant fields back to user record
        if restaurant.get("owner_id"):
            user_sync_fields = {}
            if "address" in update_data:
                user_sync_fields["address"] = update_data["address"]
            if "state" in update_data:
                user_sync_fields["state"] = update_data["state"]
            if "pincode" in update_data:
                user_sync_fields["pincode"] = update_data["pincode"]
            if "city" in update_data:
                user_sync_fields["city"] = update_data["city"]
            if "fssai_number" in update_data:
                user_sync_fields["fssai_licence"] = update_data["fssai_number"]
            
            if user_sync_fields:
                await db.users.update_one(
                    {"id": restaurant["owner_id"]},
                    {"$set": user_sync_fields}
                )
        
        restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
        return restaurant

class RestaurantImageUpdateRequest(BaseModel):
    image: Optional[str] = None
    fssai_certificate: Optional[str] = None

@api_router.put("/restaurants/{restaurant_id}/profile")
async def update_restaurant_profile(restaurant_id: str, request: RestaurantImageUpdateRequest):
    """Update restaurant image and FSSAI certificate only"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    update_data = {}
    if request.image is not None:
        update_data["image"] = request.image
    if request.fssai_certificate is not None:
        update_data["fssai_certificate"] = request.fssai_certificate
    
    if update_data:
        await db.restaurants.update_one(
            {"id": restaurant_id},
            {"$set": update_data}
        )
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return restaurant

@api_router.post("/restaurants/{restaurant_id}/submit-changes")
async def submit_restaurant_changes(restaurant_id: str, request: RestaurantPendingChangesRequest):
    """Submit changes for admin approval"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    pending_changes = {k: v for k, v in request.model_dump().items() if v is not None}
    
    await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$set": {
            "pending_changes": pending_changes,
            "has_pending_changes": True
        }}
    )
    
    # Notify admin
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "admin",
        "recipient_id": "all",
        "type": "restaurant_changes",
        "title": "Restaurant Changes Pending",
        "message": f"'{restaurant['name']}' has submitted changes for approval.",
        "data": {"restaurant_id": restaurant_id, "name": restaurant["name"], "changes": list(pending_changes.keys())},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Changes submitted for approval", "pending_changes": pending_changes}

@api_router.put("/restaurants/{restaurant_id}/toggle-status")
async def toggle_restaurant_status(restaurant_id: str):
    """Toggle restaurant open/closed status"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Can only toggle if approved
    if restaurant.get("approval_status") != "approved":
        raise HTTPException(status_code=400, detail="Restaurant must be approved to open")
    
    new_status = not restaurant.get("is_open", False)
    await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$set": {"is_open": new_status}}
    )
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return restaurant

@api_router.post("/restaurants/{restaurant_id}/menu")
async def add_menu_item(restaurant_id: str, request: AddMenuItemRequest):
    """Add menu item to restaurant (no approval required)"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    menu_item = MenuItem(**request.model_dump())
    menu_item_dict = menu_item.model_dump()
    
    # Add directly without approval
    await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$push": {"menu": menu_item_dict}}
    )
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return restaurant

@api_router.put("/restaurants/{restaurant_id}/menu/{item_id}")
async def update_menu_item(restaurant_id: str, item_id: str, request: AddMenuItemRequest):
    """Update menu item (no approval required)"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    update_data = request.model_dump()
    update_data["id"] = item_id
    
    # Update directly without approval
    result = await db.restaurants.update_one(
        {"id": restaurant_id, "menu.id": item_id},
        {"$set": {
            "menu.$.name": update_data["name"],
            "menu.$.description": update_data["description"],
            "menu.$.price": update_data["price"],
            "menu.$.image": update_data["image"],
            "menu.$.category": update_data["category"],
            "menu.$.is_veg": update_data["is_veg"]
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant or menu item not found")

    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return restaurant

@api_router.delete("/restaurants/{restaurant_id}/menu/{item_id}")
async def delete_menu_item(restaurant_id: str, item_id: str):
    """Delete menu item"""
    result = await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$pull": {"menu": {"id": item_id}}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return restaurant

@api_router.put("/restaurants/{restaurant_id}/menu/{item_id}/availability")
async def toggle_menu_item_availability(restaurant_id: str, item_id: str):
    """Toggle menu item availability"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    menu_item = next((item for item in restaurant.get("menu", []) if item["id"] == item_id), None)
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    new_availability = not menu_item.get("is_available", True)
    
    await db.restaurants.update_one(
        {"id": restaurant_id, "menu.id": item_id},
        {"$set": {"menu.$.is_available": new_availability}}
    )
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return restaurant

@api_router.put("/restaurants/{restaurant_id}/menu/{item_id}/visibility")
async def toggle_menu_item_visibility(restaurant_id: str, item_id: str, request: Request):
    """Toggle menu item visibility (show/hide from customer menu)"""
    data = await request.json()
    is_visible = data.get("is_visible", True)
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    menu_item = next((item for item in restaurant.get("menu", []) if item["id"] == item_id), None)
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    await db.restaurants.update_one(
        {"id": restaurant_id, "menu.id": item_id},
        {"$set": {"menu.$.is_visible": is_visible}}
    )
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return restaurant

@api_router.put("/restaurants/{restaurant_id}/menu/{item_id}/available-time")
async def update_menu_item_available_time(restaurant_id: str, item_id: str, request: Request):
    """Set availability time for menu item (e.g., 'after 11:00')"""
    data = await request.json()
    available_after = data.get("available_after")  # Can be null/None for always available
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    menu_item = next((item for item in restaurant.get("menu", []) if item["id"] == item_id), None)
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    await db.restaurants.update_one(
        {"id": restaurant_id, "menu.id": item_id},
        {"$set": {"menu.$.available_after": available_after}}
    )
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    return restaurant

# ============== RESTAURANT DISCOUNT ENDPOINTS ==============

@api_router.post("/restaurants/{restaurant_id}/discounts")
async def create_restaurant_discount(restaurant_id: str, request: CreateRestaurantDiscountRequest):
    """Restaurant creates a discount offer"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    discount = RestaurantDiscount(
        restaurant_id=restaurant_id,
        **request.model_dump()
    )
    discount_dict = discount.model_dump()
    discount_dict["created_at"] = discount_dict["created_at"].isoformat()
    
    await db.restaurant_discounts.insert_one(discount_dict)
    discount_dict.pop("_id", None)
    
    return {"message": "Discount created successfully", "discount": discount_dict}

@api_router.get("/restaurants/{restaurant_id}/discounts")
async def get_restaurant_discounts(restaurant_id: str, active_only: bool = True):
    """Get all discounts for a restaurant"""
    query = {"restaurant_id": restaurant_id}
    if active_only:
        query["is_active"] = True
    
    discounts = await db.restaurant_discounts.find(query, {"_id": 0}).to_list(100)
    return discounts

@api_router.put("/restaurants/{restaurant_id}/discounts/{discount_id}")
async def update_restaurant_discount(restaurant_id: str, discount_id: str, request: CreateRestaurantDiscountRequest):
    """Update a restaurant discount"""
    result = await db.restaurant_discounts.update_one(
        {"id": discount_id, "restaurant_id": restaurant_id},
        {"$set": request.model_dump()}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Discount not found")
    
    discount = await db.restaurant_discounts.find_one({"id": discount_id}, {"_id": 0})
    return {"message": "Discount updated", "discount": discount}

@api_router.delete("/restaurants/{restaurant_id}/discounts/{discount_id}")
async def delete_restaurant_discount(restaurant_id: str, discount_id: str):
    """Delete a restaurant discount"""
    result = await db.restaurant_discounts.delete_one({"id": discount_id, "restaurant_id": restaurant_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Discount not found")
    
    return {"message": "Discount deleted"}

@api_router.put("/restaurants/{restaurant_id}/discounts/{discount_id}/toggle")
async def toggle_restaurant_discount(restaurant_id: str, discount_id: str):
    """Toggle discount active status"""
    discount = await db.restaurant_discounts.find_one({"id": discount_id, "restaurant_id": restaurant_id}, {"_id": 0})
    
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    
    new_status = not discount.get("is_active", True)
    await db.restaurant_discounts.update_one(
        {"id": discount_id},
        {"$set": {"is_active": new_status}}
    )
    
    return {"message": f"Discount {'activated' if new_status else 'deactivated'}", "is_active": new_status}

@api_router.post("/restaurants/{restaurant_id}/discounts/apply")
async def apply_restaurant_discount(restaurant_id: str, request: Request):
    """Apply discount to cart items and calculate final price"""
    data = await request.json()
    cart_items = data.get("items", [])
    cart_total = data.get("total", 0)
    
    # Get active discounts for restaurant
    discounts = await db.restaurant_discounts.find({
        "restaurant_id": restaurant_id,
        "is_active": True
    }, {"_id": 0}).to_list(100)
    
    applied_discounts = []
    total_discount = 0
    
    for discount in discounts:
        discount_type = discount.get("discount_type")
        discount_value = discount.get("discount_value", 0)
        min_order = discount.get("min_order_amount", 0)
        max_discount = discount.get("max_discount")
        applicable_items = discount.get("applicable_items", [])
        
        # Check minimum order requirement
        if cart_total < min_order:
            continue
        
        # Check applicable items (empty = all items)
        if applicable_items:
            applicable_total = sum(
                item.get("price", 0) * item.get("quantity", 1)
                for item in cart_items
                if item.get("menu_item_id") in applicable_items
            )
        else:
            applicable_total = cart_total
        
        if applicable_total <= 0:
            continue
        
        # Calculate discount based on type
        if discount_type == "percentage":
            disc_amount = applicable_total * (discount_value / 100)
            if max_discount:
                disc_amount = min(disc_amount, max_discount)
        elif discount_type == "min_order_value":
            disc_amount = discount_value  # Fixed amount discount
        elif discount_type == "buy_one_get_one":
            # Find eligible items and apply BOGO
            disc_amount = 0
            for item in cart_items:
                if not applicable_items or item.get("menu_item_id") in applicable_items:
                    qty = item.get("quantity", 1)
                    if qty >= 2:
                        free_items = qty // 2
                        disc_amount += item.get("price", 0) * free_items
        else:
            continue
        
        if disc_amount > 0:
            applied_discounts.append({
                "id": discount.get("id"),
                "name": discount.get("name"),
                "type": discount_type,
                "discount_amount": round(disc_amount, 2),
                "message": discount.get("display_message")
            })
            total_discount += disc_amount
    
    return {
        "original_total": cart_total,
        "total_discount": round(total_discount, 2),
        "final_total": round(cart_total - total_discount, 2),
        "applied_discounts": applied_discounts
    }

# ============== ORDER ENDPOINTS ==============

@api_router.post("/orders")
async def create_order(request: CreateOrderRequest, user_id: str):
    """Create a new order and notify restaurant via WebSocket"""
    # Get user
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get restaurant
    restaurant = await db.restaurants.find_one({"id": request.restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Check if restaurant is open and approved
    if not restaurant.get("is_open"):
        raise HTTPException(status_code=400, detail="Restaurant is currently closed")
    if restaurant.get("approval_status") != "approved":
        raise HTTPException(status_code=400, detail="Restaurant is not available")
    
    # Calculate total
    total_amount = sum(item.price * item.quantity for item in request.items)
    
    # Check if this is user's first order
    order_count = await db.orders.count_documents({"user_id": user_id, "status": {"$ne": "cancelled"}})
    is_first_order = order_count == 0
    
    # Get delivery fee from request or calculate
    delivery_fee = getattr(request, 'delivery_fee', None)
    if delivery_fee is None:
        delivery_fee = 0 if is_first_order else 40.0  # Default fee
    
    # COD fee (₹5 from second order for COD payments)
    cod_fee = 0
    if request.payment_method == 'cod' and not is_first_order:
        cod_fee = getattr(request, 'cod_fee', None)
        if cod_fee is None:
            cod_fee = COD_FEE
    
    # Generate sequential order ID (F00001, F00002, etc.)
    sequential_order_id = await get_next_order_id()
    
    order = Order(
        id=sequential_order_id,  # Use sequential order ID
        user_id=user_id,
        user_phone=user["phone"],
        user_name=user.get("name", "Customer"),
        restaurant_id=request.restaurant_id,
        restaurant_name=restaurant["name"],
        restaurant_address=restaurant.get("address"),
        restaurant_phone=restaurant.get("phone"),
        items=[item.model_dump() for item in request.items],
        total_amount=total_amount,
        delivery_fee=delivery_fee,
        cod_fee=cod_fee,
        is_first_order=is_first_order,
        delivery_address=request.delivery_address,
        payment_method=request.payment_method,
        payment_status="pending",  # All orders start as pending, paid status is set after payment completion
        notes=request.notes,
        restaurant_notified=True
    )
    
    order_dict = order.model_dump()
    order_dict["created_at"] = order_dict["created_at"].isoformat()
    order_dict["updated_at"] = order_dict["updated_at"].isoformat()
    
    # Store restaurant location for tracking
    order_dict["restaurant_lat"] = restaurant.get("lat")
    order_dict["restaurant_lng"] = restaurant.get("lng")
    
    # Generate Google Maps direction links
    customer_lat = request.delivery_address.lat if hasattr(request.delivery_address, 'lat') else request.delivery_address.get('lat')
    customer_lng = request.delivery_address.lng if hasattr(request.delivery_address, 'lng') else request.delivery_address.get('lng')
    restaurant_lat = restaurant.get("lat")
    restaurant_lng = restaurant.get("lng")
    
    # Link for delivery partner: Restaurant → Customer
    if restaurant_lat and restaurant_lng and customer_lat and customer_lng:
        order_dict["delivery_directions_link"] = (
            f"https://www.google.com/maps/dir/?api=1"
            f"&origin={restaurant_lat},{restaurant_lng}"
            f"&destination={customer_lat},{customer_lng}"
            f"&travelmode=driving"
        )
        
        # Calculate distance between restaurant and customer
        distance_km = calculate_distance_km(restaurant_lat, restaurant_lng, customer_lat, customer_lng)
        order_dict["distance_km"] = round(distance_km, 2)
        
        # Estimated delivery time based on distance (avg 20 km/h in city)
        order_dict["estimated_delivery_time"] = max(10, int((distance_km / 20) * 60))
    else:
        order_dict["delivery_directions_link"] = None
        order_dict["distance_km"] = None
    
    # Calculate grand total for notifications
    grand_total = total_amount + delivery_fee + cod_fee
    
    await db.orders.insert_one(order_dict)
    order_dict.pop("_id", None)
    
    # Create notification for restaurant
    notification_data = {
        "order_id": order_dict["id"],
        "customer_name": user.get("name", "Customer"),
        "customer_phone": user["phone"],
        "items": [{"name": i.name, "qty": i.quantity, "price": i.price} for i in request.items],
        "total": grand_total,
        "food_total": total_amount,
        "delivery_fee": delivery_fee,
        "cod_fee": cod_fee,
        "payment_method": request.payment_method,
        "delivery_address": request.delivery_address.model_dump() if hasattr(request.delivery_address, 'model_dump') else request.delivery_address
    }
    
    if restaurant.get("owner_id"):
        notification = {
            "id": str(uuid.uuid4()),
            "recipient_type": "restaurant",
            "recipient_id": restaurant["owner_id"],
            "type": "new_order",
            "title": "New Order Received!",
            "message": f"New order #{order_dict['id']} - {len(request.items)} items - ₹{grand_total}",
            "data": notification_data,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        notification.pop("_id", None)
        
        # Send WebSocket notification in real-time
        await ws_manager.send_to_user(restaurant["owner_id"], {
            "type": "new_order",
            "payload": notification
        })
    
    # Also notify all admins about the new order
    await ws_manager.send_to_type("admin", {
        "type": "new_order",
        "payload": {
            "order_id": order_dict["id"],
            "restaurant_name": restaurant["name"],
            "total": grand_total,
            "status": "pending"
        }
    })
    
    return order_dict

@api_router.get("/orders")
async def get_orders(user_id: Optional[str] = None, restaurant_id: Optional[str] = None, delivery_partner_id: Optional[str] = None):
    """Get orders with optional filters"""
    query = {}
    
    if user_id:
        query["user_id"] = user_id
    if restaurant_id:
        query["restaurant_id"] = restaurant_id
    if delivery_partner_id:
        query["delivery_partner_id"] = delivery_partner_id
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    """Get order by ID"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, request: UpdateOrderStatusRequest):
    """Update order status and send appropriate notifications"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    update_data = {
        "status": request.status,
        "updated_at": now
    }
    
    # Track timestamps based on status
    if request.status == "confirmed" and not order.get("confirmed_at"):
        update_data["confirmed_at"] = now
    elif request.status == "ready" and not order.get("ready_at"):
        update_data["ready_at"] = now
    elif request.status == "picked_up" and not order.get("picked_up_at"):
        update_data["picked_up_at"] = now
    elif request.status == "delivered" and not order.get("delivered_at"):
        update_data["delivered_at"] = now
    
    if request.delivery_partner_id:
        # Get delivery partner name
        partner = await db.delivery_partners.find_one({"id": request.delivery_partner_id}, {"_id": 0})
        if partner:
            update_data["delivery_partner_id"] = request.delivery_partner_id
            update_data["delivery_partner_name"] = partner.get("name", "Delivery Partner")
            update_data["delivery_notified"] = True
            
            # Notify delivery partner
            notification = {
                "id": str(uuid.uuid4()),
                "recipient_type": "delivery",
                "recipient_id": partner.get("user_id"),
                "type": "order_assigned",
                "title": "New Delivery Assigned!",
                "message": f"Order #{order_id[:8].upper()} has been assigned to you.",
                "data": {
                    "order_id": order_id,
                    "restaurant_name": order.get("restaurant_name"),
                    "restaurant_address": order.get("restaurant_address"),
                    "customer_name": order.get("user_name"),
                    "customer_phone": order.get("user_phone"),
                    "delivery_address": order.get("delivery_address"),
                    "items": order.get("items"),
                    "total_amount": order.get("total_amount"),
                    "payment_method": order.get("payment_method"),
                    "estimated_earning": round(order.get("total_amount", 0) * 0.1 + order.get("delivery_fee", 30), 2)
                },
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notification)
    
    # Send notifications based on status change
    if request.status == "ready" and not order.get("delivery_partner_id"):
        # Notify all online delivery partners about available order
        online_partners = await db.delivery_partners.find({
            "is_online": True,
            "is_available": True,
            "approval_status": "approved"
        }, {"_id": 0}).to_list(100)
        
        for partner in online_partners:
            notification = {
                "id": str(uuid.uuid4()),
                "recipient_type": "delivery",
                "recipient_id": partner.get("user_id"),
                "type": "order_available",
                "title": "Order Ready for Pickup!",
                "message": f"Order #{order_id[:8].upper()} from {order.get('restaurant_name')} is ready for pickup.",
                "data": {
                    "order_id": order_id,
                    "restaurant_name": order.get("restaurant_name"),
                    "restaurant_address": order.get("restaurant_address"),
                    "customer_name": order.get("user_name"),
                    "customer_phone": order.get("user_phone"),
                    "delivery_address": order.get("delivery_address"),
                    "items": order.get("items"),
                    "total_amount": order.get("total_amount"),
                    "payment_method": order.get("payment_method"),
                    "estimated_earning": round(order.get("total_amount", 0) * 0.1 + order.get("delivery_fee", 30), 2)
                },
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notification)
    
    # Notify customer about status updates
    customer_notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "customer",
        "recipient_id": order.get("user_id"),
        "type": "order_status",
        "title": f"Order {request.status.replace('_', ' ').title()}",
        "message": f"Your order #{order_id[:8].upper()} is now {request.status.replace('_', ' ')}.",
        "data": {"order_id": order_id, "status": request.status},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(customer_notification)
    
    # If delivered, update stats
    if request.status == "delivered":
        # Calculate and store payment details
        delivery_fee = order.get("delivery_fee", 30)
        cod_fee = order.get("cod_fee", 0)
        delivery_partner_earning = round(delivery_fee * 0.95, 2)  # 95% of delivery fee
        
        update_data["delivery_partner_earning"] = delivery_partner_earning
        update_data["delivery_partner_settlement_status"] = "pending"  # Set to pending on delivery
        
        # For COD orders, calculate what partner needs to return
        if order.get("payment_method") == "cod":
            total_cod_collected = order.get("total_amount", 0) + delivery_fee + cod_fee
            cod_to_return = total_cod_collected - delivery_partner_earning  # Food amount + 5% delivery fee + COD fee
            update_data["delivery_partner_cod_collected"] = total_cod_collected
            update_data["cod_to_return"] = cod_to_return
        
        # Update restaurant stats
        await db.restaurants.update_one(
            {"id": order.get("restaurant_id")},
            {"$inc": {"total_orders": 1, "total_revenue": order.get("total_amount", 0)}}
        )
        # Update delivery partner stats
        if order.get("delivery_partner_id") or request.delivery_partner_id:
            partner_id = request.delivery_partner_id or order.get("delivery_partner_id")
            await db.delivery_partners.update_one(
                {"id": partner_id},
                {
                    "$inc": {"total_deliveries": 1, "total_earnings": delivery_partner_earning, "today_deliveries": 1, "today_earnings": delivery_partner_earning},
                    "$set": {"is_available": True}
                }
            )
        # Update payment status if COD
        if order.get("payment_method") == "cod":
            update_data["payment_status"] = "paid"
    
    result = await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return order

class CancelOrderRequest(BaseModel):
    reason: str
    cancelled_by: str = "restaurant"  # restaurant, customer, admin
    comment: Optional[str] = None  # Additional comment from restaurant
    unavailable_items: Optional[List[str]] = None  # List of unavailable item names


class ReorderRequest(BaseModel):
    original_order_id: str
    action: str  # "reorder_modified" or "cancel_refund"
    modified_items: Optional[List[dict]] = None  # [{menu_item_id, name, price, quantity, image}]


class ConfirmOrderRequest(BaseModel):
    estimated_prep_time: int = 20  # minutes (default 20 as per product spec)
    

class UpdateDeliveryRequest(BaseModel):
    delay_reason: Optional[str] = None  # "heavy_traffic", "restaurant_busy"
    delay_minutes: int = 0


def generate_google_maps_link(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> str:
    """Generate Google Maps directions URL"""
    return f"https://www.google.com/maps/dir/?api=1&origin={origin_lat},{origin_lng}&destination={dest_lat},{dest_lng}&travelmode=driving"


@api_router.put("/orders/{order_id}/confirm-with-time")
async def confirm_order_with_prep_time(order_id: str, request: ConfirmOrderRequest):
    """Restaurant confirms order with estimated preparation time"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Calculate estimated delivery time (prep time + avg delivery 15-20 mins)
    estimated_delivery = request.estimated_prep_time + 20
    
    update_data = {
        "status": "confirmed",
        "estimated_prep_time": request.estimated_prep_time,
        "estimated_delivery_time": estimated_delivery,
        "confirmed_at": now,
        "updated_at": now
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    # Notify customer
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "customer",
        "recipient_id": order.get("user_id"),
        "type": "order_confirmed",
        "title": "Order Confirmed!",
        "message": f"Your order from {order.get('restaurant_name')} is confirmed. Estimated delivery in {estimated_delivery} mins.",
        "data": {
            "order_id": order_id,
            "estimated_prep_time": request.estimated_prep_time,
            "estimated_delivery_time": estimated_delivery
        },
        "is_read": False,
        "created_at": now
    }
    await db.notifications.insert_one(notification)
    
    return {
        "message": "Order confirmed",
        "estimated_prep_time": request.estimated_prep_time,
        "estimated_delivery_time": estimated_delivery
    }


@api_router.put("/orders/{order_id}/update-delay")
async def update_order_delay(order_id: str, request: UpdateDeliveryRequest):
    """Update order with delay information"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    delay_messages = {
        "heavy_traffic": "Apologies! Your delivery is delayed due to heavy traffic.",
        "restaurant_busy": "Sorry for the delay! The restaurant is preparing your order due to high demand.",
        "weather": "Delivery delayed due to weather conditions. Thanks for your patience!",
        "other": "Your order is slightly delayed. We're working to get it to you soon!"
    }
    
    update_data = {
        "is_delayed": True,
        "delay_reason": request.delay_reason,
        "delay_minutes": request.delay_minutes,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Update estimated delivery time
    if order.get("estimated_delivery_time"):
        update_data["estimated_delivery_time"] = order["estimated_delivery_time"] + request.delay_minutes
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    # Notify customer about delay
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "customer",
        "recipient_id": order.get("user_id"),
        "type": "order_delayed",
        "title": "Delivery Update",
        "message": delay_messages.get(request.delay_reason, delay_messages["other"]),
        "data": {
            "order_id": order_id,
            "delay_minutes": request.delay_minutes,
            "delay_reason": request.delay_reason
        },
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Delay updated", "new_estimated_time": update_data.get("estimated_delivery_time")}


@api_router.get("/orders/{order_id}/directions")
async def get_order_directions(order_id: str, from_location: str = "restaurant"):
    """Get Google Maps directions link for an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get restaurant coordinates
    restaurant = await db.restaurants.find_one({"id": order.get("restaurant_id")}, {"_id": 0})
    
    restaurant_lat = restaurant.get("lat") if restaurant else None
    restaurant_lng = restaurant.get("lng") if restaurant else None
    customer_lat = order.get("delivery_address", {}).get("lat")
    customer_lng = order.get("delivery_address", {}).get("lng")
    
    result = {
        "order_id": order_id,
        "restaurant": {
            "name": order.get("restaurant_name"),
            "address": order.get("restaurant_address"),
            "lat": restaurant_lat,
            "lng": restaurant_lng
        },
        "customer": {
            "name": order.get("user_name"),
            "address": order.get("delivery_address", {}).get("full_address"),
            "lat": customer_lat,
            "lng": customer_lng
        }
    }
    
    # Generate Google Maps links
    if restaurant_lat and restaurant_lng and customer_lat and customer_lng:
        # Directions from restaurant to customer
        result["directions_to_customer"] = generate_google_maps_link(
            restaurant_lat, restaurant_lng, customer_lat, customer_lng
        )
        
        # Calculate distance
        distance = calculate_distance_km(restaurant_lat, restaurant_lng, customer_lat, customer_lng)
        estimated_time = max(5, int(distance * 3))  # Rough estimate: 3 mins per km
        
        result["distance_km"] = round(distance, 1)
        result["estimated_travel_time"] = estimated_time
    
    # If from_location is provided with coordinates, generate directions to restaurant
    if from_location == "current" and restaurant_lat and restaurant_lng:
        result["directions_to_restaurant_base"] = f"https://www.google.com/maps/dir/?api=1&destination={restaurant_lat},{restaurant_lng}&travelmode=driving"
    
    return result


@api_router.put("/orders/{order_id}/cancel")
async def cancel_order_with_reason(order_id: str, request: CancelOrderRequest):
    """Cancel order with a reason, optional comment, and unavailable items list. Notify the customer."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if order can be cancelled
    if order.get("status") in ["delivered", "cancelled"]:
        raise HTTPException(status_code=400, detail="Order cannot be cancelled at this stage")
    
    # Calculate refund amount if payment was made
    refund_amount = None
    refund_status = None
    if order.get("payment_status") == "paid":
        refund_amount = order.get("total_amount", 0)
        refund_status = "pending"
    
    update_data = {
        "status": "cancelled",
        "cancellation_reason": request.reason,
        "cancellation_comment": request.comment,
        "cancelled_by": request.cancelled_by,
        "unavailable_items": request.unavailable_items,
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
        "refund_amount": refund_amount,
        "refund_status": refund_status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    # Build notification message
    message_parts = [f"Your order #{order_id[:8].upper()} from {order.get('restaurant_name')} has been cancelled."]
    if request.reason:
        message_parts.append(f"Reason: {request.reason}")
    if request.unavailable_items and len(request.unavailable_items) > 0:
        message_parts.append(f"Unavailable items: {', '.join(request.unavailable_items)}")
    if request.comment:
        message_parts.append(f"Restaurant note: {request.comment}")
    if refund_amount:
        message_parts.append(f"A refund of ₹{refund_amount:.2f} will be processed shortly.")
    
    notification_message = " ".join(message_parts)
    
    # Create notification for customer
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "customer",
        "recipient_id": order.get("user_id"),
        "type": "order_cancelled",
        "title": "Order Cancelled",
        "message": notification_message,
        "data": {
            "order_id": order_id,
            "restaurant_name": order.get("restaurant_name"),
            "cancelled_by": request.cancelled_by,
            "reason": request.reason,
            "comment": request.comment,
            "unavailable_items": request.unavailable_items,
            "total_amount": order.get("total_amount"),
            "refund_amount": refund_amount,
            "can_reorder": True  # Flag to show reorder options
        },
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    # Send push notification to customer
    await send_push_notification(
        user_id=order.get("user_id"),
        title="Order Cancelled",
        body=f"Your order from {order.get('restaurant_name')} was cancelled. {request.reason}",
        data={"type": "order_cancelled", "order_id": order_id}
    )
    
    # Send WebSocket notification
    await ws_manager.send_notification(
        order.get("user_id"),
        "customer",
        {
            "type": "order_cancelled",
            "order_id": order_id,
            "restaurant_name": order.get("restaurant_name"),
            "reason": request.reason,
            "comment": request.comment,
            "unavailable_items": request.unavailable_items,
            "cancelled_by": request.cancelled_by,
            "refund_amount": refund_amount,
            "can_reorder": True
        }
    )
    
    return {
        "message": "Order cancelled successfully", 
        "reason": request.reason,
        "unavailable_items": request.unavailable_items,
        "refund_amount": refund_amount
    }


@api_router.post("/orders/{order_id}/reorder")
async def reorder_cancelled_order(order_id: str, request: ReorderRequest):
    """
    Handle reorder for cancelled order.
    - action='reorder_modified': Create new order with modified items
    - action='cancel_refund': Just process refund, no new order
    """
    original_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not original_order:
        raise HTTPException(status_code=404, detail="Original order not found")
    
    if original_order.get("status") != "cancelled":
        raise HTTPException(status_code=400, detail="Can only reorder cancelled orders")
    
    if request.action == "cancel_refund":
        # Just mark refund as processed
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "refund_status": "processed",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        refund_amount = original_order.get("total_amount", 0)
        
        # Notify customer about refund
        notification = {
            "id": str(uuid.uuid4()),
            "recipient_type": "customer",
            "recipient_id": original_order.get("user_id"),
            "type": "refund_processed",
            "title": "Refund Processed",
            "message": f"Your refund of ₹{refund_amount:.2f} for order #{order_id[:8].upper()} has been processed.",
            "data": {"order_id": order_id, "refund_amount": refund_amount},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        
        return {"message": "Refund processed successfully", "refund_amount": refund_amount}
    
    elif request.action == "reorder_modified":
        if not request.modified_items or len(request.modified_items) == 0:
            raise HTTPException(status_code=400, detail="Modified items required for reorder")
        
        # Calculate new total
        new_total = sum(item.get("price", 0) * item.get("quantity", 1) for item in request.modified_items)
        delivery_fee = original_order.get("delivery_fee", 30.0)
        
        # Calculate refund/additional payment
        original_total = original_order.get("total_amount", 0)
        difference = original_total - new_total
        
        # Create new order
        new_order_items = [
            OrderItem(
                menu_item_id=item.get("menu_item_id"),
                name=item.get("name"),
                price=item.get("price"),
                quantity=item.get("quantity"),
                image=item.get("image", "")
            )
            for item in request.modified_items
        ]
        
        new_order = Order(
            user_id=original_order.get("user_id"),
            user_phone=original_order.get("user_phone"),
            user_name=original_order.get("user_name"),
            restaurant_id=original_order.get("restaurant_id"),
            restaurant_name=original_order.get("restaurant_name"),
            restaurant_address=original_order.get("restaurant_address"),
            restaurant_phone=original_order.get("restaurant_phone"),
            items=new_order_items,
            total_amount=new_total + delivery_fee,
            delivery_address=Address(**original_order.get("delivery_address", {})),
            status="pending",
            payment_method=original_order.get("payment_method", "cod"),
            payment_status="paid" if original_order.get("payment_status") == "paid" else "pending",
            delivery_fee=delivery_fee,
            is_first_order=False,
            notes=f"Reorder from cancelled order #{order_id[:8].upper()}",
            is_reorder=True,
            original_order_id=order_id
        )
        
        new_order_dict = new_order.model_dump()
        new_order_dict["created_at"] = new_order_dict["created_at"].isoformat()
        new_order_dict["updated_at"] = new_order_dict["updated_at"].isoformat()
        
        await db.orders.insert_one(new_order_dict)
        new_order_dict.pop("_id", None)
        
        # Update original order with refund info
        if difference > 0:
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {
                    "refund_amount": difference,
                    "refund_status": "processed",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        # Notify restaurant about new order
        restaurant = await db.restaurants.find_one({"id": original_order.get("restaurant_id")}, {"_id": 0})
        if restaurant and restaurant.get("owner_id"):
            notification = {
                "id": str(uuid.uuid4()),
                "recipient_type": "restaurant",
                "recipient_id": restaurant.get("owner_id"),
                "type": "new_order",
                "title": "New Reorder Received",
                "message": f"Modified order from {original_order.get('user_name')} - ₹{new_total + delivery_fee:.2f}",
                "data": {"order_id": new_order_dict["id"], "is_reorder": True},
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notification)
        
        return {
            "message": "Reorder placed successfully",
            "new_order_id": new_order_dict["id"],
            "new_total": new_total + delivery_fee,
            "refund_amount": difference if difference > 0 else 0
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'reorder_modified' or 'cancel_refund'")


# ============== DELIVERY PARTNER ENDPOINTS ==============

@api_router.post("/delivery-partners")
async def register_delivery_partner(request: RegisterDeliveryPartnerRequest, user_id: str, phone: str):
    """Register as delivery partner (requires admin approval)"""
    # Check if already registered by user_id
    existing = await db.delivery_partners.find_one({"user_id": user_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Already registered as delivery partner. Please go to login page.")
    
    # Check for duplicate phone number
    existing_phone = await db.delivery_partners.find_one({"phone": phone}, {"_id": 0})
    if existing_phone:
        raise HTTPException(status_code=400, detail="Phone number already registered. Please go to login page.")
    
    # Check for duplicate license number
    if request.license_number:
        existing_license = await db.delivery_partners.find_one({"license_number": request.license_number}, {"_id": 0})
        if existing_license:
            raise HTTPException(status_code=400, detail="Driving licence already registered with another account.")
    
    partner = DeliveryPartner(
        user_id=user_id,
        name=request.name,
        phone=phone,
        vehicle_number=request.vehicle_number,
        vehicle_type=request.vehicle_type,
        id_proof=request.id_proof,
        license_number=request.license_number,
        approval_status="pending",
        is_online=False,
        is_available=False
    )
    
    partner_dict = partner.model_dump()
    partner_dict["created_at"] = partner_dict["created_at"].isoformat()
    
    await db.delivery_partners.insert_one(partner_dict)
    partner_dict.pop("_id", None)
    
    # Create notification for admin
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "admin",
        "recipient_id": "all",
        "type": "delivery_registration",
        "title": "New Delivery Partner Registration",
        "message": f"'{request.name}' has registered as a delivery partner and is awaiting approval.",
        "data": {"partner_id": partner_dict["id"], "name": request.name, "vehicle": request.vehicle_number},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {**partner_dict, "message": "Registration submitted for approval"}

@api_router.get("/delivery-partners/{partner_id}")
async def get_delivery_partner(partner_id: str):
    """Get delivery partner by ID"""
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    return partner

@api_router.get("/delivery-partners/user/{user_id}")
async def get_delivery_partner_by_user(user_id: str):
    """Get delivery partner by user ID"""
    partner = await db.delivery_partners.find_one({"user_id": user_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    return partner

@api_router.put("/delivery-partners/{partner_id}/availability")
async def toggle_delivery_partner_availability(partner_id: str):
    """Toggle delivery partner availability"""
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    new_availability = not partner.get("is_available", True)
    
    await db.delivery_partners.update_one(
        {"id": partner_id},
        {"$set": {"is_available": new_availability}}
    )
    
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    return partner

@api_router.get("/delivery-partners/available/list")
async def get_available_delivery_partners():
    """Get all available delivery partners"""
    partners = await db.delivery_partners.find({"is_available": True}, {"_id": 0}).to_list(50)
    return partners

# ============== DASHBOARD ENDPOINTS ==============

@api_router.get("/dashboard/restaurant/{owner_id}")
async def get_restaurant_dashboard(owner_id: str):
    """Get restaurant dashboard data"""
    restaurant = await db.restaurants.find_one({"owner_id": owner_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Get orders for this restaurant
    orders = await db.orders.find({"restaurant_id": restaurant["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Calculate stats
    total_orders = len(orders)
    pending_orders = len([o for o in orders if o["status"] in ["pending", "confirmed", "preparing"]])
    total_revenue = sum(o["total_amount"] for o in orders if o["status"] == "delivered")
    
    return {
        "restaurant": restaurant,
        "orders": orders,
        "stats": {
            "total_orders": total_orders,
            "pending_orders": pending_orders,
            "total_revenue": total_revenue
        }
    }

@api_router.get("/dashboard/delivery/{user_id}")
async def get_delivery_dashboard(user_id: str, request: Request):
    """Get delivery partner dashboard data"""
    # Auth: only the delivery partner themselves or an admin
    await require_delivery_partner_self_or_admin(request, user_id=user_id)
    partner = await db.delivery_partners.find_one({"user_id": user_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    # Get assigned orders - include all active statuses (not just picked_up and ready)
    assigned_orders = await db.orders.find(
        {
            "delivery_partner_id": partner["id"], 
            "status": {"$in": ["pending", "confirmed", "preparing", "ready", "picked_up"]}
        },
        {"_id": 0}
    ).to_list(50)
    
    # Get available orders (ready for pickup, not assigned)
    available_orders = await db.orders.find(
        {"status": "ready", "delivery_partner_id": None},
        {"_id": 0}
    ).to_list(20)
    
    # Get completed orders
    completed_orders = await db.orders.find(
        {"delivery_partner_id": partner["id"], "status": "delivered"},
        {"_id": 0}
    ).to_list(50)
    
    total_earnings = partner.get("total_earnings", sum(o["total_amount"] * 0.1 for o in completed_orders))
    
    return {
        "partner": partner,
        "assigned_orders": assigned_orders,
        "available_orders": available_orders,
        "stats": {
            "total_deliveries": partner.get("total_deliveries", len(completed_orders)),
            "total_earnings": total_earnings,
            "is_available": partner.get("is_available", True)
        }
    }

# ============== AI CHAT ENDPOINT ==============

@api_router.post("/chat")
async def chat_with_ai(request: ChatRequest):
    """AI-powered food recommendation chatbot"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return {"response": "I'm sorry, the AI service is currently unavailable. How can I help you with our menu?"}
        
        session_id = request.session_id or str(uuid.uuid4())
        
        # Get restaurants and menu items for context
        restaurants = await db.restaurants.find({}, {"_id": 0, "name": 1, "cuisine": 1, "menu": 1}).to_list(10)
        
        menu_context = "Available restaurants and dishes:\n"
        for r in restaurants:
            menu_context += f"\n{r['name']} ({', '.join(r.get('cuisine', []))}):\n"
            for item in r.get("menu", [])[:5]:
                menu_context += f"  - {item['name']}: ₹{item['price']} - {item['description']}\n"
        
        system_message = f"""You are FoodKey AI, a friendly food recommendation assistant for the Food Key delivery app. 
        You help customers discover delicious food, make recommendations based on their preferences, dietary needs, and cravings.
        Be enthusiastic about food! Use appetizing descriptions. Keep responses concise but helpful.
        
        {menu_context}
        
        When recommending, mention specific dishes and restaurants. If asked about something not available, suggest similar alternatives."""
        
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=system_message
        ).with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(text=request.message)
        response = await chat.send_message(user_message)
        
        return {"response": response, "session_id": session_id}
        
    except Exception as e:
        logging.error(f"Chat error: {e}")
        return {"response": "I'm here to help you find great food! What are you craving today?", "session_id": request.session_id}

# ============== PROMOTIONAL OFFERS ENDPOINTS ==============

@api_router.post("/admin/promos")
async def create_promo(request: CreatePromoRequest):
    """Create a new promotional offer"""
    # Check if code already exists
    existing = await db.promos.find_one({"code": request.code.upper()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Promo code already exists")
    
    promo = PromoCode(
        code=request.code.upper(),
        description=request.description,
        discount_type=request.discount_type,
        discount_value=request.discount_value,
        min_order_amount=request.min_order_amount,
        max_discount=request.max_discount,
        valid_from=datetime.fromisoformat(request.valid_from) if request.valid_from else datetime.now(timezone.utc),
        valid_until=datetime.fromisoformat(request.valid_until) if request.valid_until else None,
        usage_limit=request.usage_limit,
        per_user_limit=request.per_user_limit,
        applicable_restaurants=request.applicable_restaurants,
        is_active=request.is_active
    )
    
    promo_dict = promo.model_dump()
    promo_dict["created_at"] = promo_dict["created_at"].isoformat()
    promo_dict["valid_from"] = promo_dict["valid_from"].isoformat() if promo_dict["valid_from"] else None
    promo_dict["valid_until"] = promo_dict["valid_until"].isoformat() if promo_dict["valid_until"] else None
    
    await db.promos.insert_one(promo_dict)
    promo_dict.pop("_id", None)
    
    return promo_dict

@api_router.get("/admin/promos")
async def get_all_promos():
    """Get all promotional offers"""
    promos = await db.promos.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Get usage stats
    for promo in promos:
        usage_count = await db.promo_usage.count_documents({"promo_id": promo["id"]})
        promo["usage_count"] = usage_count
    
    return promos

@api_router.put("/admin/promos/{promo_id}")
async def update_promo(promo_id: str, request: CreatePromoRequest):
    """Update a promotional offer"""
    update_data = request.model_dump()
    update_data["code"] = update_data["code"].upper()
    
    if update_data.get("valid_from"):
        update_data["valid_from"] = datetime.fromisoformat(update_data["valid_from"]).isoformat()
    if update_data.get("valid_until"):
        update_data["valid_until"] = datetime.fromisoformat(update_data["valid_until"]).isoformat()
    
    result = await db.promos.update_one({"id": promo_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Promo not found")
    
    promo = await db.promos.find_one({"id": promo_id}, {"_id": 0})
    return promo

@api_router.delete("/admin/promos/{promo_id}")
async def delete_promo(promo_id: str):
    """Delete a promotional offer"""
    result = await db.promos.delete_one({"id": promo_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Promo not found")
    
    return {"message": "Promo deleted successfully"}

@api_router.get("/promos/available")
async def get_available_promos(restaurant_id: Optional[str] = None):
    """Get available promo codes for customers"""
    now = datetime.now(timezone.utc)
    
    query = {
        "is_active": True,
        "$or": [
            {"valid_until": None},
            {"valid_until": {"$gte": now.isoformat()}}
        ]
    }
    
    promos = await db.promos.find(query, {"_id": 0}).to_list(50)
    
    # Filter by restaurant if specified
    if restaurant_id:
        promos = [p for p in promos if not p.get("applicable_restaurants") or restaurant_id in p.get("applicable_restaurants", [])]
    
    # Return only public info
    return [{
        "code": p["code"],
        "description": p["description"],
        "discount_type": p["discount_type"],
        "discount_value": p["discount_value"],
        "min_order_amount": p["min_order_amount"],
        "max_discount": p.get("max_discount")
    } for p in promos]

@api_router.post("/promos/apply")
async def apply_promo(request: ApplyPromoRequest):
    """Validate and apply a promo code"""
    promo = await db.promos.find_one({"code": request.code.upper(), "is_active": True}, {"_id": 0})
    
    if not promo:
        raise HTTPException(status_code=400, detail="Invalid or expired promo code")
    
    now = datetime.now(timezone.utc)
    
    # Check validity period
    if promo.get("valid_until"):
        valid_until_str = promo["valid_until"]
        if isinstance(valid_until_str, str):
            # Handle various datetime formats
            if 'Z' in valid_until_str:
                valid_until = datetime.fromisoformat(valid_until_str.replace('Z', '+00:00'))
            elif '+' in valid_until_str or valid_until_str.endswith('00:00'):
                valid_until = datetime.fromisoformat(valid_until_str)
            else:
                # Naive datetime - assume UTC
                valid_until = datetime.fromisoformat(valid_until_str).replace(tzinfo=timezone.utc)
        else:
            valid_until = valid_until_str
            if valid_until.tzinfo is None:
                valid_until = valid_until.replace(tzinfo=timezone.utc)
        if now > valid_until:
            raise HTTPException(status_code=400, detail="Promo code has expired")
    
    # Check minimum order amount
    if request.order_amount < promo.get("min_order_amount", 0):
        raise HTTPException(status_code=400, detail=f"Minimum order amount is ₹{promo['min_order_amount']}")
    
    # Check restaurant applicability
    if promo.get("applicable_restaurants") and request.restaurant_id not in promo["applicable_restaurants"]:
        raise HTTPException(status_code=400, detail="Promo code not valid for this restaurant")
    
    # Check usage limit
    if promo.get("usage_limit"):
        total_usage = await db.promo_usage.count_documents({"promo_id": promo["id"]})
        if total_usage >= promo["usage_limit"]:
            raise HTTPException(status_code=400, detail="Promo code usage limit reached")
    
    # Check per-user limit
    user_usage = await db.promo_usage.count_documents({"promo_id": promo["id"], "user_id": request.user_id})
    if user_usage >= promo.get("per_user_limit", 1):
        raise HTTPException(status_code=400, detail="You have already used this promo code")
    
    # Calculate discount
    discount = 0
    if promo["discount_type"] == "percentage":
        discount = request.order_amount * (promo["discount_value"] / 100)
        if promo.get("max_discount"):
            discount = min(discount, promo["max_discount"])
    elif promo["discount_type"] == "flat":
        discount = promo["discount_value"]
    elif promo["discount_type"] == "free_delivery":
        discount = 30  # Standard delivery fee
    
    return {
        "valid": True,
        "promo_id": promo["id"],
        "code": promo["code"],
        "discount": round(discount, 2),
        "discount_type": promo["discount_type"],
        "message": f"₹{round(discount, 2)} off applied!"
    }

# ============== COD SETTLEMENT ENDPOINTS ==============

@api_router.post("/delivery/cod-settlement")
async def submit_cod_settlement(request: SubmitCODSettlementRequest, user_id: str):
    """Delivery partner submits COD amount for settlement"""
    # Get delivery partner
    partner = await db.delivery_partners.find_one({"user_id": user_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    settlement = CODSettlement(
        delivery_partner_id=partner["id"],
        delivery_partner_name=partner["name"],
        delivery_partner_phone=partner["phone"],
        amount=request.amount,
        comment=request.comment
    )
    
    settlement_dict = settlement.model_dump()
    settlement_dict["created_at"] = settlement_dict["created_at"].isoformat()
    
    await db.cod_settlements.insert_one(settlement_dict)
    settlement_dict.pop("_id", None)
    
    # Notify admins
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "admin",
        "recipient_id": "all",
        "type": "cod_settlement",
        "title": "COD Settlement Request",
        "message": f"{partner['name']} submitted ₹{request.amount} for COD settlement",
        "data": {"settlement_id": settlement_dict["id"], "amount": request.amount},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "COD settlement submitted for approval", "settlement": settlement_dict}

@api_router.get("/delivery/cod-settlements")
async def get_partner_cod_settlements(user_id: str):
    """Get all COD settlements for a delivery partner"""
    partner = await db.delivery_partners.find_one({"user_id": user_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    settlements = await db.cod_settlements.find(
        {"delivery_partner_id": partner["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate totals
    pending_total = sum(s["amount"] for s in settlements if s["status"] == "pending")
    approved_total = sum(s["amount"] for s in settlements if s["status"] == "approved")
    
    return {
        "settlements": settlements,
        "pending_total": pending_total,
        "approved_total": approved_total
    }

@api_router.get("/admin/cod-settlements")
async def get_all_cod_settlements(status: Optional[str] = None):
    """Admin gets all COD settlements"""
    query = {}
    if status:
        query["status"] = status
    
    settlements = await db.cod_settlements.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Stats
    pending_count = await db.cod_settlements.count_documents({"status": "pending"})
    pending_amount = sum(s["amount"] for s in settlements if s["status"] == "pending")
    
    return {
        "settlements": settlements,
        "pending_count": pending_count,
        "pending_amount": pending_amount
    }

@api_router.post("/admin/cod-settlements/{settlement_id}/approve")
async def approve_cod_settlement(settlement_id: str, request: ApproveCODSettlementRequest, admin_phone: str):
    """Admin approves or rejects COD settlement"""
    settlement = await db.cod_settlements.find_one({"id": settlement_id}, {"_id": 0})
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    
    if settlement["status"] != "pending":
        raise HTTPException(status_code=400, detail="Settlement already processed")
    
    new_status = "approved" if request.action == "approve" else "rejected"
    
    await db.cod_settlements.update_one(
        {"id": settlement_id},
        {"$set": {
            "status": new_status,
            "admin_comment": request.comment,
            "approved_by": admin_phone,
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # If approved, update partner's cleared amount
    if new_status == "approved":
        await db.delivery_partners.update_one(
            {"id": settlement["delivery_partner_id"]},
            {"$inc": {"total_cod_cleared": settlement["amount"]}}
        )
    
    # Notify delivery partner
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "delivery",
        "recipient_id": settlement["delivery_partner_id"],
        "type": "cod_settlement_status",
        "title": f"COD Settlement {new_status.title()}",
        "message": f"Your COD settlement of ₹{settlement['amount']} has been {new_status}" + 
                   (f". Comment: {request.comment}" if request.comment else ""),
        "data": {"settlement_id": settlement_id, "status": new_status},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    updated_settlement = await db.cod_settlements.find_one({"id": settlement_id}, {"_id": 0})
    return {"message": f"Settlement {new_status}", "settlement": updated_settlement}

# ============== RESTAURANT PAYOUT ENDPOINTS ==============

@api_router.get("/admin/restaurant-payouts")
async def get_restaurant_payouts(status: Optional[str] = None):
    """Admin gets all restaurant payouts from orders"""
    query = {"status": "delivered"}
    if status:
        query["restaurant_payout_status"] = status
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Group by restaurant
    payouts_by_restaurant = {}
    for order in orders:
        rest_id = order.get("restaurant_id")
        if rest_id not in payouts_by_restaurant:
            payouts_by_restaurant[rest_id] = {
                "restaurant_id": rest_id,
                "restaurant_name": order.get("restaurant_name"),
                "pending_amount": 0,
                "cleared_amount": 0,
                "orders": []
            }
        
        payout_amount = order.get("restaurant_payout", order.get("total_amount", 0) * 0.99)
        if order.get("restaurant_payout_status") == "cleared":
            payouts_by_restaurant[rest_id]["cleared_amount"] += payout_amount
        else:
            payouts_by_restaurant[rest_id]["pending_amount"] += payout_amount
        
        payouts_by_restaurant[rest_id]["orders"].append({
            "order_id": order.get("id"),
            "amount": payout_amount,
            "status": order.get("restaurant_payout_status", "pending"),
            "payout_date": order.get("restaurant_payout_date"),
            "created_at": order.get("created_at")
        })
    
    return list(payouts_by_restaurant.values())

@api_router.post("/admin/restaurant-payouts/clear")
async def clear_restaurant_payout(request: Request, admin_phone: str):
    """Admin clears payment to restaurant"""
    data = await request.json()
    order_ids = data.get("order_ids", [])
    restaurant_id = data.get("restaurant_id")
    comment = data.get("comment", "")
    
    if not order_ids and not restaurant_id:
        raise HTTPException(status_code=400, detail="Provide order_ids or restaurant_id")
    
    query = {"status": "delivered", "restaurant_payout_status": {"$ne": "cleared"}}
    if order_ids:
        query["id"] = {"$in": order_ids}
    elif restaurant_id:
        query["restaurant_id"] = restaurant_id
    
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.orders.update_many(
        query,
        {"$set": {
            "restaurant_payout_status": "cleared",
            "restaurant_payout_date": now,
            "restaurant_payout_cleared_by": admin_phone,
            "restaurant_payout_comment": comment
        }}
    )
    
    # Get restaurant info for notification
    if restaurant_id:
        restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
        if restaurant and restaurant.get("owner_id"):
            notification = {
                "id": str(uuid.uuid4()),
                "recipient_type": "restaurant",
                "recipient_id": restaurant["owner_id"],
                "type": "payout_cleared",
                "title": "Payment Cleared",
                "message": "Your pending payment has been cleared by admin" + 
                           (f". Note: {comment}" if comment else ""),
                "data": {"restaurant_id": restaurant_id, "cleared_orders": result.modified_count},
                "is_read": False,
                "created_at": now
            }
            await db.notifications.insert_one(notification)
    
    return {"message": f"Cleared {result.modified_count} order payouts"}

@api_router.get("/restaurant/payouts/{restaurant_id}")
async def get_restaurant_payout_status(restaurant_id: str):
    """Restaurant views their payout status"""
    orders = await db.orders.find(
        {"restaurant_id": restaurant_id, "status": "delivered"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    pending_amount = 0
    cleared_amount = 0
    pending_orders = []
    cleared_orders = []
    
    for order in orders:
        payout = order.get("restaurant_payout", order.get("total_amount", 0) * 0.99)
        if order.get("restaurant_payout_status") == "cleared":
            cleared_amount += payout
            cleared_orders.append({
                "order_id": order.get("id"),
                "amount": round(payout, 2),
                "cleared_date": order.get("restaurant_payout_date"),
                "admin_comment": order.get("restaurant_payout_comment"),
                "created_at": order.get("created_at")
            })
        else:
            pending_amount += payout
            pending_orders.append({
                "order_id": order.get("id"),
                "amount": round(payout, 2),
                "created_at": order.get("created_at")
            })
    
    # Get restaurant comments
    comments = await db.payout_comments.find(
        {"restaurant_id": restaurant_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {
        "pending_amount": round(pending_amount, 2),
        "cleared_amount": round(cleared_amount, 2),
        "pending_orders": pending_orders,
        "cleared_orders": cleared_orders,
        "comments": comments
    }

@api_router.post("/restaurant/payouts/{restaurant_id}/comment")
async def add_restaurant_payout_comment(restaurant_id: str, request: AddPayoutCommentRequest):
    """Restaurant adds comment on payout status"""
    comment_record = RestaurantPayoutComment(
        restaurant_id=restaurant_id,
        order_id=request.order_id,
        comment=request.comment,
        created_by="restaurant"
    )
    
    comment_dict = comment_record.model_dump()
    comment_dict["created_at"] = comment_dict["created_at"].isoformat()
    
    await db.payout_comments.insert_one(comment_dict)
    comment_dict.pop("_id", None)
    
    # Notify admin
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_type": "admin",
        "recipient_id": "all",
        "type": "payout_comment",
        "title": "Restaurant Payout Comment",
        "message": f"Restaurant commented on order {request.order_id}: {request.comment[:50]}...",
        "data": {"restaurant_id": restaurant_id, "order_id": request.order_id},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Comment added", "comment": comment_dict}

# ============== RESTAURANT ANALYTICS ENDPOINTS ==============

@api_router.get("/analytics/restaurant/{restaurant_id}")
async def get_restaurant_analytics(restaurant_id: str, days: int = 30):
    """Get comprehensive analytics for a restaurant"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Get orders for this restaurant
    orders = await db.orders.find({
        "restaurant_id": restaurant_id,
        "status": {"$in": ["delivered", "picked_up", "ready", "preparing", "confirmed"]}
    }, {"_id": 0}).to_list(1000)
    
    # Parse dates and filter
    filtered_orders = []
    for order in orders:
        try:
            order_date = datetime.fromisoformat(order["created_at"].replace('Z', '+00:00')) if isinstance(order["created_at"], str) else order["created_at"]
            if order_date >= start_date:
                order["parsed_date"] = order_date
                filtered_orders.append(order)
        except Exception:
            pass
    
    # Revenue by day
    revenue_by_day = {}
    orders_by_day = {}
    for order in filtered_orders:
        day = order["parsed_date"].strftime("%Y-%m-%d")
        revenue_by_day[day] = revenue_by_day.get(day, 0) + order.get("total_amount", 0)
        orders_by_day[day] = orders_by_day.get(day, 0) + 1
    
    # Popular items
    item_counts = {}
    item_revenue = {}
    for order in filtered_orders:
        for item in order.get("items", []):
            name = item.get("name", "Unknown")
            qty = item.get("quantity", 1)
            price = item.get("price", 0)
            item_counts[name] = item_counts.get(name, 0) + qty
            item_revenue[name] = item_revenue.get(name, 0) + (price * qty)
    
    popular_items = sorted([
        {"name": name, "orders": count, "revenue": item_revenue.get(name, 0)}
        for name, count in item_counts.items()
    ], key=lambda x: x["orders"], reverse=True)[:10]
    
    # Order status breakdown
    status_counts = {}
    for order in orders:
        order_status = order.get("status", "unknown")
        status_counts[order_status] = status_counts.get(order_status, 0) + 1
    
    # Peak hours
    hour_counts = {}
    for order in filtered_orders:
        hour = order["parsed_date"].hour
        hour_counts[hour] = hour_counts.get(hour, 0) + 1
    
    peak_hours = sorted([
        {"hour": f"{h:02d}:00", "orders": count}
        for h, count in hour_counts.items()
    ], key=lambda x: x["orders"], reverse=True)[:5]
    
    # Payment method breakdown
    payment_methods = {}
    for order in filtered_orders:
        method = order.get("payment_method", "cod")
        payment_methods[method] = payment_methods.get(method, 0) + 1
    
    # Calculate totals
    total_revenue = sum(o.get("total_amount", 0) for o in filtered_orders)
    total_orders = len(filtered_orders)
    avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
    delivered_orders = len([o for o in filtered_orders if o.get("status") == "delivered"])
    
    return {
        "restaurant": {
            "id": restaurant["id"],
            "name": restaurant["name"],
            "rating": restaurant.get("rating", 0)
        },
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "days": days
        },
        "summary": {
            "total_revenue": round(total_revenue, 2),
            "total_orders": total_orders,
            "delivered_orders": delivered_orders,
            "avg_order_value": round(avg_order_value, 2),
            "completion_rate": round((delivered_orders / total_orders * 100) if total_orders > 0 else 0, 1)
        },
        "revenue_trend": [
            {"date": date, "revenue": rev, "orders": orders_by_day.get(date, 0)}
            for date, rev in sorted(revenue_by_day.items())
        ],
        "popular_items": popular_items,
        "status_breakdown": status_counts,
        "peak_hours": peak_hours,
        "payment_methods": payment_methods
    }

# ============== DELIVERY PARTNER PERFORMANCE ENDPOINTS ==============

@api_router.get("/analytics/delivery/{partner_id}")
async def get_delivery_analytics(partner_id: str, days: int = 30):
    """Get comprehensive performance metrics for a delivery partner"""
    partner = await db.delivery_partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    
    # Date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Get delivered orders
    orders = await db.orders.find({
        "delivery_partner_id": partner_id
    }, {"_id": 0}).to_list(1000)
    
    # Parse dates
    filtered_orders = []
    for order in orders:
        try:
            order_date = datetime.fromisoformat(order["created_at"].replace('Z', '+00:00')) if isinstance(order["created_at"], str) else order["created_at"]
            if order_date >= start_date:
                order["parsed_date"] = order_date
                filtered_orders.append(order)
        except Exception:
            pass
    
    # Deliveries by day
    deliveries_by_day = {}
    earnings_by_day = {}
    for order in filtered_orders:
        if order.get("status") == "delivered":
            day = order["parsed_date"].strftime("%Y-%m-%d")
            deliveries_by_day[day] = deliveries_by_day.get(day, 0) + 1
            earning = order.get("total_amount", 0) * 0.1 + order.get("delivery_fee", 30)
            earnings_by_day[day] = earnings_by_day.get(day, 0) + earning
    
    # Peak hours
    hour_counts = {}
    for order in filtered_orders:
        if order.get("status") == "delivered":
            hour = order["parsed_date"].hour
            hour_counts[hour] = hour_counts.get(hour, 0) + 1
    
    peak_hours = sorted([
        {"hour": f"{h:02d}:00", "deliveries": count}
        for h, count in hour_counts.items()
    ], key=lambda x: x["deliveries"], reverse=True)[:5]
    
    # Performance metrics
    delivered = [o for o in filtered_orders if o.get("status") == "delivered"]
    total_earnings = sum(o.get("total_amount", 0) * 0.1 + o.get("delivery_fee", 30) for o in delivered)
    
    # Average daily stats
    days_worked = len(set(o["parsed_date"].strftime("%Y-%m-%d") for o in delivered)) or 1
    avg_daily_deliveries = len(delivered) / days_worked
    avg_daily_earnings = total_earnings / days_worked
    
    # Restaurants served
    restaurants_served = len(set(o.get("restaurant_id") for o in filtered_orders))
    
    return {
        "partner": {
            "id": partner["id"],
            "name": partner.get("name"),
            "rating": partner.get("rating", 5.0),
            "vehicle": partner.get("vehicle_number"),
            "total_deliveries": partner.get("total_deliveries", 0),
            "total_earnings": partner.get("total_earnings", 0)
        },
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "days": days
        },
        "summary": {
            "deliveries_in_period": len(delivered),
            "earnings_in_period": round(total_earnings, 2),
            "avg_daily_deliveries": round(avg_daily_deliveries, 1),
            "avg_daily_earnings": round(avg_daily_earnings, 2),
            "restaurants_served": restaurants_served,
            "days_worked": days_worked
        },
        "daily_trend": [
            {"date": date, "deliveries": deliveries_by_day.get(date, 0), "earnings": round(earnings_by_day.get(date, 0), 2)}
            for date in sorted(set(list(deliveries_by_day.keys()) + list(earnings_by_day.keys())))
        ],
        "peak_hours": peak_hours,
        "performance": {
            "completion_rate": 100,  # All assigned orders are tracked
            "rating": partner.get("rating", 5.0)
        }
    }

# ============== LIVE ORDER TRACKING ENDPOINTS ==============

@api_router.get("/orders/{order_id}/tracking")
async def get_order_tracking(order_id: str):
    """Get live tracking info for an order (supports regular + custom orders)"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    is_custom = False
    if not order:
        order = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
        is_custom = True
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get tracking history
    tracking_history = await db.order_tracking.find(
        {"order_id": order_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(50)
    
    # Get delivery partner location if assigned
    delivery_location = None
    partner_live_location = None
    if order.get("delivery_partner_id"):
        partner = await db.delivery_partners.find_one(
            {"id": order["delivery_partner_id"]},
            {"_id": 0, "name": 1, "phone": 1, "current_location": 1, "last_location": 1, "vehicle_number": 1}
        )
        if partner:
            # Get live location from delivery_locations collection
            live_loc = await db.delivery_locations.find_one({"order_id": order_id})
            if live_loc:
                partner_live_location = {
                    "lat": live_loc.get("lat"),
                    "lng": live_loc.get("lng"),
                    "heading": live_loc.get("heading"),
                    "speed": live_loc.get("speed"),
                    "timestamp": live_loc.get("timestamp")
                }
            elif partner.get("last_location"):
                partner_live_location = partner.get("last_location")
            
            delivery_location = {
                "partner_name": partner.get("name") or order.get("delivery_partner", {}).get("partner_name"),
                "partner_phone": partner.get("phone") or order.get("delivery_partner", {}).get("partner_phone"),
                "vehicle": partner.get("vehicle_number") or order.get("delivery_partner", {}).get("vehicle"),
                "location": partner_live_location
            }
    elif order.get("delivery_partner"):
        # Use embedded delivery partner info
        delivery_location = order.get("delivery_partner")
    
    # Get restaurant location - first from database, then from order
    restaurant = None
    if not is_custom:
        restaurant = await db.restaurants.find_one(
            {"id": order.get("restaurant_id")},
            {"_id": 0, "name": 1, "address": 1, "lat": 1, "lng": 1}
        )
    
    # If not found in database, use embedded data from order
    if not restaurant:
        restaurant = order.get("restaurant")
        if restaurant:
            restaurant["lat"] = order.get("restaurant_lat")
            restaurant["lng"] = order.get("restaurant_lng")
    
    # For custom orders, synthesize restaurant info from shop_name/shop_location
    if is_custom:
        restaurant = {
            "name": order.get("restaurant_name"),
            "address": order.get("shop_location"),
            "lat": order.get("shop_lat"),
            "lng": order.get("shop_lng")
        }
    
    # Normalize delivery_address to object shape expected by frontend
    raw_delivery = order.get("delivery_address")
    if isinstance(raw_delivery, str):
        delivery_address = {
            "full_address": raw_delivery,
            "lat": order.get("delivery_lat"),
            "lng": order.get("delivery_lng")
        }
    else:
        delivery_address = raw_delivery
    
    # Map custom-order statuses to regular-order timeline statuses for UI parity
    raw_status = order.get("status")
    if is_custom:
        status_map = {
            "accepted": "confirmed",    # custom "accepted" == regular "confirmed"
            "assigned": "ready",        # custom "assigned" == regular "ready"
        }
        normalized_status = status_map.get(raw_status, raw_status)
    else:
        normalized_status = raw_status
    
    # Build response with all necessary data
    return {
        "order_id": order_id,
        "status": normalized_status,
        "raw_status": raw_status,
        "is_custom_order": is_custom,
        "restaurant": restaurant,
        "restaurant_lat": (order.get("restaurant_lat") or order.get("shop_lat")) or (restaurant.get("lat") if restaurant else None),
        "restaurant_lng": (order.get("restaurant_lng") or order.get("shop_lng")) or (restaurant.get("lng") if restaurant else None),
        "delivery_address": delivery_address,
        "delivery_partner": delivery_location,
        "delivery_partner_location": partner_live_location,
        "items": order.get("items", []) if not is_custom else [{
            "name": "Custom Order Items",
            "description": order.get("food_items"),
            "quantity": 1,
            "price": order.get("estimated_amount") or 0
        }],
        "food_items_description": order.get("food_items") if is_custom else None,
        "total_amount": order.get("total_amount") or order.get("estimated_amount"),
        "delivery_fee": order.get("delivery_fee"),
        "tracking_history": tracking_history,
        "estimated_prep_time": order.get("estimated_prep_time"),
        "estimated_delivery_time": order.get("estimated_delivery_time"),
        "confirmed_at": order.get("confirmed_at") or order.get("accepted_at"),
        "picked_up_at": order.get("picked_up_at"),
        "ready_at": order.get("ready_at") or order.get("assigned_at"),
        "created_at": order.get("created_at")
    }

@api_router.post("/orders/{order_id}/tracking")
async def update_order_tracking(order_id: str, request: UpdateTrackingRequest):
    """Update tracking location for an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    tracking = OrderTracking(
        order_id=order_id,
        status=order.get("status"),
        location={"lat": request.lat, "lng": request.lng, "address": request.address},
        message=request.message
    )
    
    tracking_dict = tracking.model_dump()
    tracking_dict["timestamp"] = tracking_dict["timestamp"].isoformat()
    
    await db.order_tracking.insert_one(tracking_dict)
    tracking_dict.pop("_id", None)
    
    return tracking_dict

# ============== SHARE ORDER ENDPOINTS ==============

class ShareOrderRequest(BaseModel):
    order_id: str
    user_id: str

def generate_share_token(length: int = 8) -> str:
    """Generate a short, URL-safe share token"""
    chars = string.ascii_uppercase + string.digits
    # Remove ambiguous characters
    chars = chars.replace('0', '').replace('O', '').replace('I', '').replace('1', '').replace('L', '')
    return ''.join(random.choice(chars) for _ in range(length))

@api_router.post("/orders/{order_id}/share")
async def create_share_link(order_id: str, user_id: str):
    """Generate a shareable tracking link for an order"""
    # Verify order exists and belongs to user
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to share this order")
    
    # Check if share token already exists
    existing_share = await db.order_shares.find_one({"order_id": order_id}, {"_id": 0})
    if existing_share:
        return {
            "share_token": existing_share["share_token"],
            "share_url": f"/track/share/{existing_share['share_token']}",
            "created_at": existing_share["created_at"],
            "expires_at": existing_share.get("expires_at")
        }
    
    # Generate new share token
    share_token = generate_share_token()
    
    # Ensure token is unique
    while await db.order_shares.find_one({"share_token": share_token}):
        share_token = generate_share_token()
    
    now = datetime.now(timezone.utc)
    # Share link expires 24 hours after order is delivered or 7 days from creation
    expires_at = now + timedelta(days=7)
    
    share_record = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "user_id": user_id,
        "share_token": share_token,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "view_count": 0
    }
    
    await db.order_shares.insert_one(share_record)
    
    return {
        "share_token": share_token,
        "share_url": f"/track/share/{share_token}",
        "created_at": share_record["created_at"],
        "expires_at": share_record["expires_at"]
    }

@api_router.get("/orders/share/{share_token}")
async def get_shared_order_tracking(share_token: str):
    """Get tracking info for a shared order (public endpoint - no auth required)"""
    # Find the share record
    share_record = await db.order_shares.find_one({"share_token": share_token}, {"_id": 0})
    if not share_record:
        raise HTTPException(status_code=404, detail="Share link not found or expired")
    
    # Check if expired
    if share_record.get("expires_at"):
        expires_at = datetime.fromisoformat(share_record["expires_at"].replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=410, detail="Share link has expired")
    
    # Increment view count
    await db.order_shares.update_one(
        {"share_token": share_token},
        {"$inc": {"view_count": 1}}
    )
    
    # Get order details
    order = await db.orders.find_one({"id": share_record["order_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get tracking history
    tracking_history = await db.order_tracking.find(
        {"order_id": order["id"]},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(50)
    
    # Get delivery partner info (limited)
    delivery_partner = None
    if order.get("delivery_partner_id"):
        partner = await db.delivery_partners.find_one(
            {"id": order["delivery_partner_id"]},
            {"_id": 0, "name": 1, "vehicle_number": 1, "current_location": 1}
        )
        if partner:
            delivery_partner = {
                "partner_name": partner.get("name"),
                "vehicle": partner.get("vehicle_number"),
                "partner_id": order["delivery_partner_id"]
            }
    
    # Get restaurant info (limited)
    restaurant = await db.restaurants.find_one(
        {"id": order.get("restaurant_id")},
        {"_id": 0, "name": 1, "address": 1, "lat": 1, "lng": 1, "image": 1}
    )
    
    # Get latest delivery location
    delivery_location = await db.delivery_locations.find_one(
        {"order_id": order["id"]},
        {"_id": 0}
    )
    
    # Return limited info for privacy
    return {
        "order_id": order["id"][:8].upper(),  # Only show partial order ID
        "status": order.get("status"),
        "restaurant": {
            "name": restaurant.get("name") if restaurant else order.get("restaurant_name"),
            "image": restaurant.get("image") if restaurant else None
        },
        "delivery_address": {
            "label": order.get("delivery_address", {}).get("label"),
            # Don't expose full address for privacy
            "city": order.get("delivery_address", {}).get("full_address", "").split(",")[-2].strip() if order.get("delivery_address", {}).get("full_address") else None
        },
        "delivery_partner": delivery_partner,
        "delivery_partner_location": delivery_location,
        "tracking_history": tracking_history,
        "estimated_delivery_time": order.get("estimated_delivery_time"),
        "estimated_prep_time": order.get("estimated_prep_time"),
        "is_delayed": order.get("is_delayed", False),
        "delay_reason": order.get("delay_reason"),
        "delay_minutes": order.get("delay_minutes"),
        "items_count": len(order.get("items", [])),
        "created_at": order.get("created_at"),
        "restaurant_lat": restaurant.get("lat") if restaurant else None,
        "restaurant_lng": restaurant.get("lng") if restaurant else None,
        "customer_lat": order.get("delivery_address", {}).get("lat"),
        "customer_lng": order.get("delivery_address", {}).get("lng"),
        "share_view_count": share_record.get("view_count", 0) + 1
    }

@api_router.delete("/orders/{order_id}/share")
async def revoke_share_link(order_id: str, user_id: str):
    """Revoke a shared tracking link"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.order_shares.delete_one({"order_id": order_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No share link found")
    
    return {"message": "Share link revoked"}

# ============== OLA MAPS API ENDPOINTS ==============

class DirectionsRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float

@api_router.post("/maps/directions")
async def get_map_directions(request: DirectionsRequest):
    """Get directions between two points using Ola Maps"""
    result = await get_directions(
        request.origin_lat, 
        request.origin_lng, 
        request.dest_lat, 
        request.dest_lng
    )
    
    if not result:
        raise HTTPException(status_code=503, detail="Maps service unavailable")
    
    return result

@api_router.get("/maps/directions")
async def get_map_directions_get(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float):
    """Get directions between two points using Ola Maps (GET)"""
    result = await get_directions(origin_lat, origin_lng, dest_lat, dest_lng)
    
    if not result:
        raise HTTPException(status_code=503, detail="Maps service unavailable")
    
    return result

@api_router.get("/maps/autocomplete")
async def autocomplete_places(query: str):
    """Search places with autocomplete using Ola Maps"""
    if not query or len(query) < 2:
        return {"predictions": []}
    
    result = await search_places(query)
    
    if not result:
        raise HTTPException(status_code=503, detail="Maps service unavailable")
    
    return result

@api_router.get("/maps/reverse-geocode")
async def reverse_geocode_location(lat: float, lng: float):
    """Reverse geocode coordinates to address using Ola Maps"""
    result = await reverse_geocode(lat, lng)
    
    if not result:
        raise HTTPException(status_code=503, detail="Maps service unavailable")
    
    return result

@api_router.get("/maps/delivery-route/{order_id}")
async def get_delivery_route(order_id: str):
    """Get delivery route for an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get restaurant location
    restaurant = await db.restaurants.find_one(
        {"id": order.get("restaurant_id")},
        {"_id": 0, "lat": 1, "lng": 1, "address": 1, "name": 1}
    )
    
    delivery_address = order.get("delivery_address", {})
    
    # Check if we have coordinates
    if not restaurant or not restaurant.get("lat") or not restaurant.get("lng"):
        return {
            "error": "Restaurant location not available",
            "restaurant": restaurant,
            "delivery_address": delivery_address
        }
    
    if not delivery_address.get("lat") or not delivery_address.get("lng"):
        return {
            "error": "Delivery location not available",
            "restaurant": restaurant,
            "delivery_address": delivery_address
        }
    
    # Get directions from restaurant to delivery address
    directions = await get_directions(
        restaurant["lat"],
        restaurant["lng"],
        delivery_address["lat"],
        delivery_address["lng"]
    )
    
    if not directions:
        return {
            "error": "Could not calculate route",
            "restaurant": restaurant,
            "delivery_address": delivery_address
        }
    
    # Extract route info
    route_info = None
    if directions.get("routes") and len(directions["routes"]) > 0:
        route = directions["routes"][0]
        legs = route.get("legs", [])
        if legs:
            leg = legs[0]
            route_info = {
                "distance": leg.get("distance", {}).get("text", "N/A"),
                "distance_meters": leg.get("distance", {}).get("value", 0),
                "duration": leg.get("duration", {}).get("text", "N/A"),
                "duration_seconds": leg.get("duration", {}).get("value", 0),
                "steps": leg.get("steps", []),
                "polyline": route.get("overview_polyline", {}).get("points", "")
            }
    
    return {
        "order_id": order_id,
        "restaurant": {
            "name": restaurant.get("name"),
            "address": restaurant.get("address"),
            "lat": restaurant.get("lat"),
            "lng": restaurant.get("lng")
        },
        "delivery_address": {
            "address": delivery_address.get("full_address"),
            "lat": delivery_address.get("lat"),
            "lng": delivery_address.get("lng")
        },
        "route": route_info,
        "raw_directions": directions
    }

# ============== PUSH NOTIFICATION ENDPOINTS ==============

@api_router.post("/push/subscribe")
async def subscribe_push(request: PushSubscriptionRequest, user_id: str):
    """Subscribe to push notifications"""
    # Check if already subscribed
    existing = await db.push_subscriptions.find_one(
        {"user_id": user_id, "endpoint": request.endpoint},
        {"_id": 0}
    )
    
    if existing:
        return {"message": "Already subscribed", "subscription_id": existing["id"]}
    
    subscription = PushSubscription(
        user_id=user_id,
        endpoint=request.endpoint,
        keys=request.keys
    )
    
    sub_dict = subscription.model_dump()
    sub_dict["created_at"] = sub_dict["created_at"].isoformat()
    
    await db.push_subscriptions.insert_one(sub_dict)
    sub_dict.pop("_id", None)
    
    return {"message": "Subscribed successfully", "subscription_id": sub_dict["id"]}

@api_router.delete("/push/unsubscribe")
async def unsubscribe_push(user_id: str):
    """Unsubscribe from push notifications"""
    result = await db.push_subscriptions.delete_many({"user_id": user_id})
    return {"message": f"Unsubscribed {result.deleted_count} devices"}

@api_router.get("/push/vapid-key")
async def get_vapid_key():
    """Get VAPID public key for push notifications"""
    return {
        "publicKey": VAPID_PUBLIC_KEY
    }

@api_router.post("/push/test")
async def test_push_notification(user_id: str):
    """Test push notification for a user"""
    await send_push_notification(
        user_id=user_id,
        title="🍽️ Food Key Test",
        body="Push notifications are working! You'll receive order updates here.",
        data={"type": "test"}
    )
    return {"message": "Test notification sent"}

# ============== FEEDBACK ENDPOINTS ==============

class FeedbackRequest(BaseModel):
    name: str
    phone: str
    message: str
    type: str = "complaint"  # 'complaint' or 'suggestion'

@api_router.post("/feedback")
async def submit_feedback(request: FeedbackRequest):
    """Submit customer feedback/complaint/suggestion"""
    feedback_type = request.type if request.type in ("complaint", "suggestion") else "complaint"
    feedback = {
        "id": str(uuid.uuid4()),
        "name": request.name,
        "phone": request.phone,
        "message": request.message,
        "type": feedback_type,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "resolved_at": None
    }
    
    await db.feedback.insert_one(feedback)
    feedback.pop("_id", None)
    
    return {"message": "Feedback submitted successfully", "feedback": feedback}

@api_router.get("/admin/feedback")
async def get_all_feedback(request: Request, type: Optional[str] = None):
    """Admin: Get all feedback (within 30 days), optionally filtered by type"""
    await require_admin(request)
    # Calculate 30 days ago
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    # Delete feedback older than 30 days
    await db.feedback.delete_many({"created_at": {"$lt": thirty_days_ago}})
    
    query = {}
    if type in ("complaint", "suggestion"):
        query["type"] = type
    
    feedback = await db.feedback.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Default type for legacy items
    for f in feedback:
        if not f.get("type"):
            f["type"] = "complaint"
    
    pending_count = sum(1 for f in feedback if f.get("status") == "pending")
    resolved_count = sum(1 for f in feedback if f.get("status") == "resolved")
    complaint_count = sum(1 for f in feedback if f.get("type") == "complaint")
    suggestion_count = sum(1 for f in feedback if f.get("type") == "suggestion")
    
    return {
        "feedback": feedback,
        "pending_count": pending_count,
        "resolved_count": resolved_count,
        "complaint_count": complaint_count,
        "suggestion_count": suggestion_count
    }

@api_router.put("/admin/feedback/{feedback_id}/resolve")
async def resolve_feedback(feedback_id: str, request: Request):
    """Admin: Mark feedback as resolved"""
    await require_admin(request)
    result = await db.feedback.update_one(
        {"id": feedback_id},
        {"$set": {
            "status": "resolved",
            "resolved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    return {"message": "Feedback marked as resolved"}

@api_router.delete("/admin/feedback/{feedback_id}")
async def delete_feedback(feedback_id: str, request: Request):
    """Admin: Delete feedback"""
    await require_admin(request)
    result = await db.feedback.delete_one({"id": feedback_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    return {"message": "Feedback deleted"}

# ============== T-SHIRT ORDERS ENDPOINTS ==============

class TshirtOrderRequest(BaseModel):
    order_id: str
    user_id: str
    user_phone: str
    user_name: str
    order_amount: float

@api_router.post("/admin/tshirt-orders")
async def create_tshirt_order(request: TshirtOrderRequest):
    """Create a t-shirt order notification for admin"""
    tshirt_order = {
        "id": str(uuid.uuid4()),
        "order_id": request.order_id,
        "user_id": request.user_id,
        "user_phone": request.user_phone,
        "user_name": request.user_name,
        "order_amount": request.order_amount,
        "status": "pending",  # pending, fulfilled, cancelled
        "created_at": datetime.now(timezone.utc).isoformat(),
        "fulfilled_at": None
    }
    
    await db.tshirt_orders.insert_one(tshirt_order)
    tshirt_order.pop("_id", None)
    
    return {"message": "T-shirt order created", "tshirt_order": tshirt_order}

@api_router.get("/admin/tshirt-orders")
async def get_tshirt_orders():
    """Admin: Get all t-shirt orders"""
    orders = await db.tshirt_orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    pending_count = sum(1 for o in orders if o.get("status") == "pending")
    fulfilled_count = sum(1 for o in orders if o.get("status") == "fulfilled")
    
    return {
        "tshirt_orders": orders,
        "pending_count": pending_count,
        "fulfilled_count": fulfilled_count
    }

@api_router.put("/admin/tshirt-orders/{order_id}/fulfill")
async def fulfill_tshirt_order(order_id: str):
    """Admin: Mark t-shirt order as fulfilled"""
    result = await db.tshirt_orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "fulfilled",
            "fulfilled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="T-shirt order not found")
    
    return {"message": "T-shirt order marked as fulfilled"}

@api_router.delete("/admin/tshirt-orders/{order_id}")
async def delete_tshirt_order(order_id: str):
    """Admin: Delete t-shirt order"""
    result = await db.tshirt_orders.delete_one({"id": order_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="T-shirt order not found")
    
    return {"message": "T-shirt order deleted"}

# ============== FILE UPLOAD ENDPOINTS ==============

MAX_FILE_SIZE = 1 * 1024 * 1024  # 1 MB

@api_router.post("/upload/licence")
async def upload_licence(file: UploadFile = File(...), user_id: str = None):
    """Upload driving licence document (max 1MB)"""
    # Check file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 1MB limit")
    
    # Check file type
    allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and PDF files are allowed")
    
    # Generate unique filename
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
    filename = f"licence_{user_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
    file_path = UPLOADS_DIR / filename
    
    # Save file
    with open(file_path, 'wb') as f:
        f.write(contents)
    
    # Update user record with licence document path
    if user_id:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"licence_document": filename}}
        )
        # Also update delivery partner if exists
        await db.delivery_partners.update_one(
            {"user_id": user_id},
            {"$set": {"licence_document": filename}}
        )
    
    return {"message": "Licence uploaded successfully", "filename": filename}

@api_router.post("/upload/fssai")
async def upload_fssai_certificate(file: UploadFile = File(...), user_id: str = None):
    """Upload FSSAI certificate (max 1MB)"""
    # Check file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 1MB limit")
    
    # Check file type
    allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and PDF files are allowed")
    
    # Generate unique filename
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
    filename = f"fssai_{user_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
    file_path = UPLOADS_DIR / filename
    
    # Save file
    with open(file_path, 'wb') as f:
        f.write(contents)
    
    # Update user record with FSSAI certificate path
    if user_id:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"fssai_certificate": filename}}
        )
    
    return {"message": "FSSAI certificate uploaded successfully", "filename": filename}

@api_router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    """Get uploaded file"""
    from fastapi.responses import FileResponse
    
    file_path = UPLOADS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path)

# ============== RATINGS AND REVIEWS ENDPOINTS ==============

class ReviewCreate(BaseModel):
    order_id: str
    restaurant_id: str
    user_id: str
    user_name: str
    user_phone: Optional[str] = None
    rating: int = Field(..., ge=1, le=5)  # Restaurant rating (1-5 stars)
    comment: Optional[str] = None
    # Delivery partner rating
    delivery_partner_id: Optional[str] = None
    delivery_rating: Optional[int] = Field(None, ge=1, le=5)  # 1-5 stars
    delivery_comment: Optional[str] = None

class ReviewResponse(BaseModel):
    id: str
    order_id: str
    restaurant_id: str
    restaurant_name: Optional[str] = None
    user_id: str
    user_name: str
    user_phone: Optional[str] = None
    rating: int
    comment: Optional[str] = None
    # Delivery partner rating
    delivery_partner_id: Optional[str] = None
    delivery_partner_name: Optional[str] = None
    delivery_rating: Optional[int] = None
    delivery_comment: Optional[str] = None
    # Approval status
    status: str = "pending"  # pending, approved, rejected
    admin_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    created_at: str

class AdminReviewUpdate(BaseModel):
    status: Optional[str] = None  # approved, rejected
    admin_notes: Optional[str] = None
    # Editable fields
    rating: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = None
    delivery_rating: Optional[int] = Field(None, ge=1, le=5)
    delivery_comment: Optional[str] = None

@api_router.post("/reviews")
async def create_review(review: ReviewCreate):
    """Customer: Create a new review for a restaurant and optionally delivery partner"""
    # Check if review already exists for this order
    existing = await db.reviews.find_one({"order_id": review.order_id})
    if existing:
        raise HTTPException(status_code=400, detail="Review already exists for this order")
    
    # Get restaurant name
    restaurant = await db.restaurants.find_one({"id": review.restaurant_id}, {"_id": 0, "name": 1})
    
    # Get delivery partner name if provided
    delivery_partner_name = None
    if review.delivery_partner_id:
        partner = await db.delivery_partners.find_one({"id": review.delivery_partner_id}, {"_id": 0, "name": 1})
        delivery_partner_name = partner.get("name") if partner else None
    
    review_data = {
        "id": str(uuid.uuid4()),
        "order_id": review.order_id,
        "restaurant_id": review.restaurant_id,
        "restaurant_name": restaurant.get("name") if restaurant else None,
        "user_id": review.user_id,
        "user_name": review.user_name,
        "user_phone": review.user_phone,
        "rating": review.rating,
        "comment": review.comment,
        # Delivery partner review
        "delivery_partner_id": review.delivery_partner_id,
        "delivery_partner_name": delivery_partner_name,
        "delivery_rating": review.delivery_rating,
        "delivery_comment": review.delivery_comment,
        # Approval status - pending until admin approves
        "status": "pending",
        "admin_notes": None,
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reviews.insert_one(review_data)
    
    # Note: Rating is NOT updated here - only updated when admin approves
    
    return {k: v for k, v in review_data.items() if k != "_id"}

async def update_restaurant_rating(restaurant_id: str):
    """Helper: Recalculate restaurant's average rating from approved reviews only"""
    reviews = await db.reviews.find(
        {"restaurant_id": restaurant_id, "status": "approved"}
    ).to_list(1000)
    
    if reviews:
        avg_rating = sum(r.get("rating", 0) for r in reviews) / len(reviews)
        await db.restaurants.update_one(
            {"id": restaurant_id},
            {"$set": {"rating": round(avg_rating, 1), "review_count": len(reviews)}}
        )
    else:
        # Reset to default if no approved reviews
        await db.restaurants.update_one(
            {"id": restaurant_id},
            {"$set": {"review_count": 0}}
        )

async def update_delivery_partner_rating(partner_id: str):
    """Helper: Recalculate delivery partner's average rating from approved reviews only"""
    reviews = await db.reviews.find(
        {"delivery_partner_id": partner_id, "status": "approved", "delivery_rating": {"$ne": None}}
    ).to_list(1000)
    
    if reviews:
        avg_rating = sum(r.get("delivery_rating", 5) for r in reviews) / len(reviews)
        await db.delivery_partners.update_one(
            {"id": partner_id},
            {"$set": {"rating": round(avg_rating, 1)}}
        )

@api_router.get("/reviews/restaurant/{restaurant_id}")
async def get_restaurant_reviews(restaurant_id: str, page: int = 1, limit: int = 10):
    """Get all approved reviews for a restaurant"""
    skip = (page - 1) * limit
    reviews = await db.reviews.find(
        {"restaurant_id": restaurant_id, "status": "approved"},
        {"_id": 0}
    ).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    
    total = await db.reviews.count_documents({"restaurant_id": restaurant_id, "status": "approved"})
    
    return {
        "reviews": reviews,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.get("/reviews/check/{order_id}")
async def check_review_eligibility(order_id: str):
    """Check if an order can be reviewed (delivered and not yet reviewed)"""
    # Check if order exists and is delivered
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        return {"can_review": False, "reason": "Order not found"}
    
    if order.get("status") != "delivered":
        return {"can_review": False, "reason": "Order not yet delivered"}
    
    # Check if review already exists
    existing_review = await db.reviews.find_one({"order_id": order_id}, {"_id": 0})
    if existing_review:
        return {"can_review": False, "reason": "Already reviewed", "review": existing_review}
    
    return {
        "can_review": True,
        "order": order,
        "restaurant_id": order.get("restaurant_id"),
        "restaurant_name": order.get("restaurant_name"),
        "delivery_partner_id": order.get("delivery_partner_id"),
        "delivery_partner_name": order.get("delivery_partner_name")
    }

@api_router.get("/reviews/user/{user_id}")
async def get_user_reviews(user_id: str):
    """Get all reviews submitted by a user"""
    reviews = await db.reviews.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"reviews": reviews}

@api_router.get("/admin/reviews")
async def admin_get_all_reviews(
    page: int = 1, 
    limit: int = 20, 
    restaurant_id: Optional[str] = None,
    status: Optional[str] = None,  # pending, approved, rejected
    rating_filter: Optional[str] = None  # "low" (1-2), "medium" (3), "high" (4-5)
):
    """Admin: Get all reviews with filters"""
    query = {}
    
    if restaurant_id:
        query["restaurant_id"] = restaurant_id
    
    if status:
        query["status"] = status
    
    if rating_filter == "low":
        query["rating"] = {"$lte": 2}
    elif rating_filter == "medium":
        query["rating"] = {"$gt": 2, "$lt": 4}
    elif rating_filter == "high":
        query["rating"] = {"$gte": 4}
    
    skip = (page - 1) * limit
    reviews = await db.reviews.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    total = await db.reviews.count_documents(query)
    
    # Get counts by status
    pending_count = await db.reviews.count_documents({"status": "pending"})
    approved_count = await db.reviews.count_documents({"status": "approved"})
    rejected_count = await db.reviews.count_documents({"status": "rejected"})
    
    # Get rating statistics from approved reviews only
    approved_reviews = await db.reviews.find({"status": "approved"}, {"rating": 1}).to_list(10000)
    stats = {
        "total_reviews": len(approved_reviews),
        "average_rating": round(sum(r.get("rating", 0) for r in approved_reviews) / len(approved_reviews), 1) if approved_reviews else 0,
        "pending_count": pending_count,
        "approved_count": approved_count,
        "rejected_count": rejected_count,
        "rating_distribution": {
            "5_star": len([r for r in approved_reviews if r.get("rating", 0) == 5]),
            "4_star": len([r for r in approved_reviews if r.get("rating", 0) == 4]),
            "3_star": len([r for r in approved_reviews if r.get("rating", 0) == 3]),
            "2_star": len([r for r in approved_reviews if r.get("rating", 0) == 2]),
            "1_star": len([r for r in approved_reviews if r.get("rating", 0) == 1]),
        }
    }
    
    return {
        "reviews": reviews,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "stats": stats
    }

@api_router.put("/admin/reviews/{review_id}")
async def admin_update_review(review_id: str, request: AdminReviewUpdate, admin_phone: Optional[str] = None):
    """Admin: Update review - approve, reject, or edit content"""
    review = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    update_data = {}
    
    # Status change (approve/reject)
    if request.status and request.status in ["approved", "rejected"]:
        update_data["status"] = request.status
        update_data["reviewed_by"] = admin_phone
        update_data["reviewed_at"] = datetime.now(timezone.utc).isoformat()
    
    # Admin notes
    if request.admin_notes is not None:
        update_data["admin_notes"] = request.admin_notes
    
    # Editable fields - admin can edit ratings and comments
    if request.rating is not None:
        update_data["rating"] = request.rating
    if request.comment is not None:
        update_data["comment"] = request.comment
    if request.delivery_rating is not None:
        update_data["delivery_rating"] = request.delivery_rating
    if request.delivery_comment is not None:
        update_data["delivery_comment"] = request.delivery_comment
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    await db.reviews.update_one(
        {"id": review_id},
        {"$set": update_data}
    )
    
    # Get the updated review
    updated_review = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    
    # Update ratings if status changed to approved or rating was edited on an approved review
    if request.status == "approved" or (updated_review.get("status") == "approved" and (request.rating is not None or request.delivery_rating is not None)):
        # Update restaurant rating
        await update_restaurant_rating(review["restaurant_id"])
        
        # Update delivery partner rating if applicable
        if review.get("delivery_partner_id"):
            await update_delivery_partner_rating(review["delivery_partner_id"])
    
    # If review was rejected or changed from approved to another status, recalculate
    if request.status == "rejected" and review.get("status") == "approved":
        await update_restaurant_rating(review["restaurant_id"])
        if review.get("delivery_partner_id"):
            await update_delivery_partner_rating(review["delivery_partner_id"])
    
    return {"message": "Review updated", "review": updated_review}

@api_router.delete("/admin/reviews/{review_id}")
async def admin_delete_review(review_id: str):
    """Admin: Delete a review"""
    review = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    restaurant_id = review.get("restaurant_id")
    delivery_partner_id = review.get("delivery_partner_id")
    was_approved = review.get("status") == "approved"
    
    await db.reviews.delete_one({"id": review_id})
    
    # Update ratings only if the review was approved
    if was_approved:
        if restaurant_id:
            await update_restaurant_rating(restaurant_id)
        if delivery_partner_id:
            await update_delivery_partner_rating(delivery_partner_id)
    
    return {"message": "Review deleted"}

# ============== CUSTOM ORDERS (Unlisted Restaurants) ENDPOINTS ==============

class CustomOrderCreate(BaseModel):
    user_id: str
    user_name: str
    user_phone: str
    restaurant_name: str  # Shop / Restaurant name
    shop_location: Optional[str] = None  # Shop location
    shop_lat: Optional[float] = None
    shop_lng: Optional[float] = None
    food_items: str  # Product / Food items needed
    delivery_address: str
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    alternate_phone: Optional[str] = None  # Alternate phone number
    payment_method: str = "online"  # Only online payment

class CustomOrderUpdate(BaseModel):
    restaurant_name: Optional[str] = None  # Shop / Restaurant name
    shop_location: Optional[str] = None  # Shop location
    food_items: Optional[str] = None  # Product / Food items needed
    delivery_address: Optional[str] = None
    alternate_phone: Optional[str] = None  # Alternate phone number
    status: Optional[str] = None
    estimated_amount: Optional[float] = None
    delivery_fee: Optional[float] = None
    delivery_partner_id: Optional[str] = None
    delivery_partner_name: Optional[str] = None
    delivery_partner_phone: Optional[str] = None
    admin_notes: Optional[str] = None

@api_router.post("/custom-orders")
async def create_custom_order(request: CustomOrderCreate):
    """Customer creates a custom order from unlisted shop/restaurant"""
    order_data = {
        "id": str(uuid.uuid4()),
        "user_id": request.user_id,
        "user_name": request.user_name,
        "user_phone": request.user_phone,
        "restaurant_name": request.restaurant_name,  # Shop / Restaurant name
        "shop_location": request.shop_location,  # Shop location
        "shop_lat": request.shop_lat,
        "shop_lng": request.shop_lng,
        "food_items": request.food_items,  # Product / Food items needed
        "delivery_address": request.delivery_address,
        "delivery_lat": request.delivery_lat,
        "delivery_lng": request.delivery_lng,
        "alternate_phone": request.alternate_phone,  # Alternate phone number
        "payment_method": "online",  # Only online payment
        "payment_status": "pending",
        "status": "pending",  # pending, accepted, preparing, assigned, picked_up, delivered, cancelled
        "estimated_amount": None,
        "delivery_fee": None,
        "delivery_partner_id": None,
        "delivery_partner_name": None,
        "delivery_partner_phone": None,
        "admin_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.custom_orders.insert_one(order_data)
    
    # Send notification to admin
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "type": "custom_order",
        "title": "New Custom Order",
        "message": f"New custom order from {request.user_name} for {request.restaurant_name}",
        "user_id": "admin",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {k: v for k, v in order_data.items() if k != "_id"}

@api_router.get("/custom-orders/{order_id}")
async def get_custom_order(order_id: str):
    """Get a specific custom order"""
    order = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Custom order not found")
    return order

@api_router.get("/custom-orders/user/{user_id}")
async def get_user_custom_orders(user_id: str):
    """Get all custom orders for a specific user"""
    orders = await db.custom_orders.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"orders": orders}


@api_router.put("/custom-orders/{order_id}/cancel")
async def cancel_custom_order(order_id: str, request: dict):
    """Cancel a custom order (by customer or admin)"""
    order = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Custom order not found")
    
    # Don't allow cancellation if already delivered or cancelled
    if order.get("status") in ["delivered", "cancelled"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel order with status: {order.get('status')}")
    
    # Don't allow customer cancellation if payment is already completed
    if request.get("cancelled_by") == "customer" and order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Cannot cancel order after payment is completed")
    
    update_data = {
        "status": "cancelled",
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
        "cancelled_by": request.get("cancelled_by", "customer"),
        "cancellation_reason": request.get("reason", ""),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.custom_orders.update_one({"id": order_id}, {"$set": update_data})
    
    # Notify customer if cancelled by admin
    if request.get("cancelled_by") == "admin":
        notification = {
            "id": str(uuid.uuid4()),
            "recipient_type": "customer",
            "recipient_id": order.get("user_id"),
            "type": "custom_order_cancelled",
            "title": "Custom Order Cancelled",
            "message": f"Your custom order for {order.get('restaurant_name')} has been cancelled." + (f" Reason: {request.get('reason')}" if request.get('reason') else ""),
            "data": {"custom_order_id": order_id},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    updated = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
    return {"message": "Custom order cancelled", "order": updated}


@api_router.get("/admin/custom-orders")
async def admin_get_custom_orders(
    request: Request,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    """Admin gets all custom orders with optional filters"""
    await require_admin(request)
    query = {}
    
    if status and status != 'all':
        query["status"] = status
    
    if search:
        query["$or"] = [
            {"user_name": {"$regex": search, "$options": "i"}},
            {"user_phone": {"$regex": search, "$options": "i"}},
            {"restaurant_name": {"$regex": search, "$options": "i"}}
        ]
    
    orders = await db.custom_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    return {"orders": orders, "total": len(orders)}

@api_router.put("/admin/custom-orders/{order_id}")
async def admin_update_custom_order(order_id: str, request: Request, update: CustomOrderUpdate):
    """Admin updates a custom order"""
    await require_admin(request)
    order = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Custom order not found")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    now_iso = datetime.now(timezone.utc).isoformat()
    update_data["updated_at"] = now_iso
    
    # If assigning a delivery partner, also fetch and store their phone number
    if update.delivery_partner_id:
        partner = await db.delivery_partners.find_one({"id": update.delivery_partner_id}, {"_id": 0})
        if partner:
            update_data["delivery_partner_name"] = partner.get("name")
            update_data["delivery_partner_phone"] = partner.get("phone")
    
    # Track lifecycle timestamps based on status transitions
    if update.status == "accepted" and not order.get("accepted_at"):
        update_data["accepted_at"] = now_iso
    elif update.status == "assigned" and not order.get("assigned_at"):
        update_data["assigned_at"] = now_iso
    elif update.status == "picked_up" and not order.get("picked_up_at"):
        update_data["picked_up_at"] = now_iso
    
    # If marking as delivered, add delivery timestamp and calculate earnings
    if update.status == "delivered" and order.get("status") != "delivered":
        update_data["delivered_at"] = datetime.now(timezone.utc).isoformat()
        
        # Use delivery_fee from update or order, default to ₹40
        delivery_fee = update.delivery_fee or order.get("delivery_fee") or 40
        update_data["delivery_fee"] = delivery_fee
        
        # Custom orders: Delivery partner gets 70% of delivery fee
        partner_earning = delivery_fee * CUSTOM_ORDER_PARTNER_SHARE  # 70%
        update_data["delivery_partner_earning"] = round(partner_earning, 2)
        
        # Platform gets 30% of delivery fee for custom orders
        platform_fee = delivery_fee * (1 - CUSTOM_ORDER_PARTNER_SHARE)
        update_data["platform_delivery_fee"] = round(platform_fee, 2)
        
        # Initialize payout statuses
        update_data["delivery_partner_settlement_status"] = "pending"
        update_data["delivery_payout_status"] = "pending"
        update_data["restaurant_payout_status"] = "pending"  # For custom orders, this is just tracking
    
    await db.custom_orders.update_one({"id": order_id}, {"$set": update_data})
    
    # Notify customer on status change
    if update.status and update.status != order.get("status"):
        status_messages = {
            "accepted": "Your custom order has been accepted! Estimated amount: ₹" + str(update.estimated_amount or order.get("estimated_amount", "")),
            "preparing": "Your order is being prepared!",
            "assigned": f"Delivery partner {update.delivery_partner_name or ''} has been assigned to your order!",
            "picked_up": "Your order has been picked up and is on the way!",
            "delivered": "Your order has been delivered. Enjoy your meal!",
            "cancelled": "Your custom order has been cancelled."
        }
        
        if update.status in status_messages:
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "type": "custom_order_update",
                "title": f"Order {update.status.replace('_', ' ').title()}",
                "message": status_messages[update.status],
                "user_id": order["user_id"],
                "order_id": order_id,
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    updated_order = await db.custom_orders.find_one({"id": order_id}, {"_id": 0})
    return {"message": "Order updated", "order": updated_order}

@api_router.delete("/admin/custom-orders/{order_id}")
async def admin_delete_custom_order(order_id: str, request: Request):
    """Admin deletes a custom order"""
    await require_admin(request)
    result = await db.custom_orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom order not found")
    return {"message": "Custom order deleted"}

# ============== PROMOTIONAL SLIDES ENDPOINTS ==============

@api_router.get("/slides")
async def get_promotional_slides(active_only: bool = True):
    """Get all promotional slides"""
    query = {"is_active": True} if active_only else {}
    slides = await db.promotional_slides.find(query, {"_id": 0}).sort("order", 1).to_list(50)
    return slides

@api_router.post("/admin/slides")
async def create_promotional_slide(request: CreateSlideRequest):
    """Admin creates a new promotional slide"""
    slide = PromotionalSlide(**request.model_dump())
    slide_dict = slide.model_dump()
    slide_dict["created_at"] = slide_dict["created_at"].isoformat()
    
    await db.promotional_slides.insert_one(slide_dict)
    slide_dict.pop("_id", None)
    
    return {"message": "Slide created", "slide": slide_dict}

@api_router.put("/admin/slides/{slide_id}")
async def update_promotional_slide(slide_id: str, request: UpdateSlideRequest):
    """Admin updates a promotional slide"""
    update_data = {k: v for k, v in request.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.promotional_slides.update_one(
        {"id": slide_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Slide not found")
    
    slide = await db.promotional_slides.find_one({"id": slide_id}, {"_id": 0})
    return {"message": "Slide updated", "slide": slide}

@api_router.delete("/admin/slides/{slide_id}")
async def delete_promotional_slide(slide_id: str):
    """Admin deletes a promotional slide"""
    result = await db.promotional_slides.delete_one({"id": slide_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Slide not found")
    
    return {"message": "Slide deleted"}

@api_router.put("/admin/slides/{slide_id}/toggle")
async def toggle_slide_status(slide_id: str):
    """Toggle slide active status"""
    slide = await db.promotional_slides.find_one({"id": slide_id}, {"_id": 0})
    
    if not slide:
        raise HTTPException(status_code=404, detail="Slide not found")
    
    new_status = not slide.get("is_active", True)
    await db.promotional_slides.update_one(
        {"id": slide_id},
        {"$set": {"is_active": new_status}}
    )
    
    return {"message": f"Slide {'activated' if new_status else 'deactivated'}", "is_active": new_status}

@api_router.post("/seed-slides")
async def seed_promotional_slides():
    """Seed default promotional slides"""
    # Check if slides already exist
    existing = await db.promotional_slides.count_documents({})
    if existing > 0:
        return {"message": "Slides already exist", "count": existing}
    
    default_slides = [
        {
            "id": str(uuid.uuid4()),
            "title": "ZERO DELIVERY FEE",
            "subtitle": "On Your First Order!",
            "description": "New to FoodKey? Enjoy free delivery on your very first order. No minimum order required!",
            "background_gradient": "from-orange-500 via-red-500 to-pink-500",
            "icon": "truck",
            "order": 1,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "FREE FOODKEY T-SHIRT",
            "subtitle": "On Orders Above ₹999",
            "description": "Order food worth ₹999 or more and get an exclusive FoodKey branded t-shirt absolutely FREE!",
            "background_gradient": "from-emerald-500 via-teal-500 to-cyan-500",
            "icon": "gift",
            "order": 2,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "100% OFF FOR LUCKY USER",
            "subtitle": "Every 100th Order is FREE!",
            "description": "Feeling lucky? Every 100th customer gets their entire order FREE! Will you be the next winner?",
            "background_gradient": "from-violet-500 via-purple-500 to-fuchsia-500",
            "icon": "star",
            "order": 3,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.promotional_slides.insert_many(default_slides)
    
    return {"message": "Default slides created", "count": len(default_slides)}

# ============== SEED DATA ENDPOINT ==============

@api_router.post("/seed")
async def seed_database():
    """Seed database with sample South Indian restaurants and menu items"""
    
    # South Indian themed restaurants
    restaurants_data = [
        {
            "id": str(uuid.uuid4()),
            "name": "Dosa Palace",
            "description": "Authentic South Indian dosas and idlis made with traditional recipes",
            "cuisine": ["South Indian", "Dosa", "Idli"],
            "image": "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400",
            "cover_image": "https://images.unsplash.com/photo-1630383249896-424e482df921?w=800",
            "rating": 4.7,
            "delivery_time": "25-35 min",
            "price_for_two": 300,
            "address": "45 Temple Street, Anna Nagar, Chennai",
            "phone": "9876543210",
            "lat": 13.0827,
            "lng": 80.2707,
            "is_veg": True,
            "is_open": True,
            "approval_status": "approved",
            "total_orders": 0,
            "total_revenue": 0,
            "menu": [
                {"id": str(uuid.uuid4()), "name": "Masala Dosa", "description": "Crispy rice crepe stuffed with spiced potato filling, served with sambar and chutneys", "price": 89, "image": "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400", "category": "Dosa", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Rava Dosa", "description": "Crispy semolina crepe with onions and curry leaves", "price": 99, "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400", "category": "Dosa", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Idli Sambar", "description": "Soft steamed rice cakes served with sambar and coconut chutney", "price": 69, "image": "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=400", "category": "Idli", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Medu Vada", "description": "Crispy lentil donuts served with sambar and chutney", "price": 59, "image": "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=400", "category": "Snacks", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Filter Coffee", "description": "Traditional South Indian filter coffee with chicory", "price": 39, "image": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400", "category": "Beverages", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Pongal", "description": "Comforting rice and lentil dish tempered with pepper and ghee", "price": 79, "image": "https://images.unsplash.com/photo-1630383249896-424e482df921?w=400", "category": "Rice", "is_veg": True, "is_available": True}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Biryani House",
            "description": "Hyderabadi Dum Biryani prepared with aromatic spices and tender meat",
            "cuisine": ["Biryani", "Hyderabadi", "South Indian"],
            "image": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400",
            "cover_image": "https://images.unsplash.com/photo-1642821373181-696a54913e93?w=800",
            "rating": 4.8,
            "delivery_time": "35-45 min",
            "price_for_two": 450,
            "address": "12 Nizam Lane, Secunderabad, Hyderabad",
            "lat": 17.4399,
            "lng": 78.4983,
            "is_veg": False,
            "is_open": True,
            "approval_status": "approved",
            "total_orders": 0,
            "total_revenue": 0,
            "menu": [
                {"id": str(uuid.uuid4()), "name": "Chicken Dum Biryani", "description": "Slow-cooked aromatic basmati rice with succulent chicken pieces", "price": 249, "image": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400", "category": "Biryani", "is_veg": False, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Mutton Biryani", "description": "Premium mutton slow-cooked with fragrant rice and special spices", "price": 349, "image": "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=400", "category": "Biryani", "is_veg": False, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Vegetable Biryani", "description": "Flavorful biryani with garden fresh vegetables", "price": 199, "image": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400", "category": "Biryani", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Mirchi Ka Salan", "description": "Tangy peanut curry with green chilies", "price": 129, "image": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400", "category": "Sides", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Double Ka Meetha", "description": "Traditional Hyderabadi bread pudding with saffron", "price": 99, "image": "https://images.unsplash.com/photo-1666190094762-2e71b0fc73a5?w=400", "category": "Desserts", "is_veg": True, "is_available": True}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Chettinad Kitchen",
            "description": "Spicy and aromatic Chettinad cuisine from Tamil Nadu",
            "cuisine": ["Chettinad", "South Indian", "Non-Veg"],
            "image": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400",
            "cover_image": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=800",
            "rating": 4.6,
            "delivery_time": "30-40 min",
            "price_for_two": 500,
            "address": "78 Spice Market, T. Nagar, Chennai",
            "phone": "9876543211",
            "lat": 13.0418,
            "lng": 80.2341,
            "is_veg": False,
            "is_open": True,
            "approval_status": "approved",
            "total_orders": 0,
            "total_revenue": 0,
            "menu": [
                {"id": str(uuid.uuid4()), "name": "Chettinad Chicken", "description": "Fiery chicken curry with freshly ground Chettinad spices", "price": 279, "image": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400", "category": "Main Course", "is_veg": False, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Pepper Chicken Fry", "description": "Crispy chicken tossed with black pepper and curry leaves", "price": 249, "image": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400", "category": "Starters", "is_veg": False, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Mutton Chukka", "description": "Dry mutton preparation with aromatic spices", "price": 329, "image": "https://images.unsplash.com/photo-1545247181-516773cae754?w=400", "category": "Main Course", "is_veg": False, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Parotta", "description": "Layered flatbread perfect with curries", "price": 39, "image": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400", "category": "Breads", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Payasam", "description": "Traditional South Indian sweet milk pudding", "price": 79, "image": "https://images.unsplash.com/photo-1589733955941-5eeaf752f6dd?w=400", "category": "Desserts", "is_veg": True, "is_available": True}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Kerala Spice",
            "description": "Authentic Kerala cuisine with coconut-based curries and fresh seafood",
            "cuisine": ["Kerala", "South Indian", "Seafood"],
            "image": "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=400",
            "cover_image": "https://images.unsplash.com/photo-1574653853027-5382a3d23a15?w=800",
            "rating": 4.5,
            "delivery_time": "30-40 min",
            "price_for_two": 550,
            "address": "23 Backwater Road, Kochi, Kerala",
            "phone": "9876543212",
            "lat": 9.9312,
            "lng": 76.2673,
            "is_veg": False,
            "is_open": True,
            "approval_status": "approved",
            "total_orders": 0,
            "total_revenue": 0,
            "menu": [
                {"id": str(uuid.uuid4()), "name": "Kerala Fish Curry", "description": "Tangy fish curry with raw mango and coconut", "price": 299, "image": "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=400", "category": "Seafood", "is_veg": False, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Appam with Stew", "description": "Lacy rice hoppers with coconut vegetable stew", "price": 149, "image": "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=400", "category": "Breakfast", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Prawn Roast", "description": "Crispy prawns in Kerala-style masala", "price": 349, "image": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400", "category": "Seafood", "is_veg": False, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Kerala Parotta", "description": "Flaky layered bread from Kerala", "price": 45, "image": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400", "category": "Breads", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Banana Chips", "description": "Crispy Kerala-style banana chips with salt", "price": 59, "image": "https://images.unsplash.com/photo-1621447504864-d8686e12698c?w=400", "category": "Snacks", "is_veg": True, "is_available": True}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Andhra Spice Box",
            "description": "Fiery Andhra cuisine known for its spice and tangy flavors",
            "cuisine": ["Andhra", "South Indian", "Spicy"],
            "image": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=400",
            "cover_image": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800",
            "rating": 4.4,
            "delivery_time": "25-35 min",
            "price_for_two": 400,
            "address": "56 Guntur Road, Vijayawada, Andhra Pradesh",
            "lat": 16.5062,
            "lng": 80.6480,
            "is_veg": False,
            "is_open": True,
            "approval_status": "approved",
            "total_orders": 0,
            "total_revenue": 0,
            "menu": [
                {"id": str(uuid.uuid4()), "name": "Andhra Chicken Curry", "description": "Fiery red chicken curry with Guntur chilies", "price": 259, "image": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=400", "category": "Main Course", "is_veg": False, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Gongura Mutton", "description": "Tangy mutton curry with sorrel leaves", "price": 329, "image": "https://images.unsplash.com/photo-1545247181-516773cae754?w=400", "category": "Main Course", "is_veg": False, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Pesarattu", "description": "Healthy green gram dosa with ginger chutney", "price": 79, "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400", "category": "Breakfast", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Pulihora", "description": "Tangy tamarind rice with peanuts", "price": 99, "image": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400", "category": "Rice", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Bobbatlu", "description": "Sweet flatbread stuffed with lentil filling", "price": 69, "image": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400", "category": "Desserts", "is_veg": True, "is_available": True}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Fresh Juice Bar",
            "description": "Fresh fruit juices, smoothies and healthy drinks",
            "cuisine": ["Juices", "Healthy", "Smoothies"],
            "image": "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400",
            "cover_image": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=800",
            "rating": 4.3,
            "delivery_time": "15-25 min",
            "price_for_two": 200,
            "address": "90 Health Street, Jubilee Hills, Hyderabad",
            "lat": 17.4319,
            "lng": 78.4014,
            "is_veg": True,
            "is_open": True,
            "approval_status": "approved",
            "total_orders": 0,
            "total_revenue": 0,
            "menu": [
                {"id": str(uuid.uuid4()), "name": "Fresh Mango Lassi", "description": "Creamy yogurt drink blended with ripe mangoes", "price": 79, "image": "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400", "category": "Lassi", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Sugarcane Juice", "description": "Fresh pressed sugarcane with lime and ginger", "price": 49, "image": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400", "category": "Juices", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Tender Coconut", "description": "Fresh tender coconut water with malai", "price": 69, "image": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400", "category": "Natural", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Buttermilk", "description": "Refreshing spiced buttermilk with curry leaves", "price": 39, "image": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400", "category": "Traditional", "is_veg": True, "is_available": True},
                {"id": str(uuid.uuid4()), "name": "Mixed Fruit Bowl", "description": "Assorted seasonal fresh fruits", "price": 99, "image": "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=400", "category": "Fruits", "is_veg": True, "is_available": True}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Clear existing data
    await db.restaurants.delete_many({})
    
    # Insert restaurants
    await db.restaurants.insert_many(restaurants_data)
    
    return {"message": "Database seeded successfully with South Indian restaurants", "restaurants_count": len(restaurants_data)}

# ============== STATIC PAGES ==============

@api_router.get("/pages/terms")
async def get_terms():
    """Get terms and conditions"""
    return {
        "title": "Terms of Service",
        "last_updated": "2024-01-01",
        "content": """
# Terms of Service for Food Key

## 1. Acceptance of Terms
By accessing and using Food Key, you agree to be bound by these Terms of Service.

## 2. Service Description
Food Key provides an online food ordering and delivery platform connecting customers with restaurants and delivery partners.

## 3. User Accounts
- You must provide accurate information when creating an account
- You are responsible for maintaining the confidentiality of your account
- You must be at least 18 years old to use our services

## 4. Orders and Payments
- All orders are subject to restaurant availability
- Prices are subject to change without notice
- Payment is processed through Cash on Delivery (COD)

## 5. Delivery
- Delivery times are estimates only
- Food Key is not responsible for delays beyond our control
- Customers must provide accurate delivery addresses

## 6. Cancellation and Refunds
- Orders can be cancelled before restaurant confirmation
- Refunds are processed within 5-7 business days

## 7. User Conduct
- Users must not misuse the platform
- Fraudulent activities will result in account termination

## 8. Limitation of Liability
Food Key is not liable for any indirect, incidental, or consequential damages.

## 9. Changes to Terms
We reserve the right to modify these terms at any time.

## 10. Contact
For questions, contact support@foodkey.com
        """
    }

@api_router.get("/pages/privacy")
async def get_privacy():
    """Get privacy policy"""
    return {
        "title": "Privacy Policy",
        "last_updated": "2024-01-01",
        "content": """
# Privacy Policy for Food Key

## 1. Information We Collect
- Personal information (name, phone number, email)
- Location data for delivery purposes
- Order history and preferences

## 2. How We Use Your Information
- To process and deliver your orders
- To improve our services
- To send order updates and promotional content (with consent)

## 3. Information Sharing
- With restaurants to fulfill your orders
- With delivery partners for delivery purposes
- We do not sell your personal information to third parties

## 4. Data Security
- We implement industry-standard security measures
- Your data is encrypted in transit and at rest

## 5. Cookies and Tracking
- We use cookies to enhance your experience
- You can manage cookie preferences in your browser

## 6. Your Rights
- Access your personal data
- Request data deletion
- Opt-out of marketing communications

## 7. Data Retention
- We retain data as long as your account is active
- Data is deleted upon account closure request

## 8. Children's Privacy
- Our services are not intended for users under 18

## 9. Changes to Policy
- We will notify users of significant changes

## 10. Contact
For privacy inquiries, contact privacy@foodkey.com
        """
    }

# ============== ROOT ENDPOINT ==============

@api_router.get("/")
async def root():
    return {"message": "Welcome to Food Key API", "version": "1.0.0"}

# ============== WEBSOCKET ENDPOINTS ==============

async def handle_websocket_connection(websocket: WebSocket, user_id: str, user_type: str = "customer"):
    """Common WebSocket handler for real-time notifications"""
    await ws_manager.connect(websocket, user_id, user_type)
    try:
        while True:
            # Wait for messages from the client (heartbeat/ping)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
    except Exception as e:
        logging.error(f"WebSocket error for {user_id}: {e}")
        ws_manager.disconnect(websocket, user_id)

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, user_type: str = "customer"):
    """WebSocket endpoint for real-time notifications (legacy path)"""
    await handle_websocket_connection(websocket, user_id, user_type)

@app.websocket("/api/ws/{user_id}")
async def websocket_endpoint_api(websocket: WebSocket, user_id: str, user_type: str = "customer"):
    """WebSocket endpoint for real-time notifications (routed via /api prefix)"""
    await handle_websocket_connection(websocket, user_id, user_type)

# Helper function to send real-time notification
async def send_realtime_notification(user_id: str, notification_type: str, title: str, message: str, data: dict = None):
    """Send a real-time notification via WebSocket and store in DB"""
    notification = {
        "id": str(uuid.uuid4()),
        "recipient_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "data": data or {},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Store in database
    await db.notifications.insert_one(notification)
    notification.pop("_id", None)
    
    # Send via WebSocket
    await ws_manager.send_to_user(user_id, {
        "type": "notification",
        "payload": notification
    })
    
    return notification

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
