"""
Food Key Maps Service
=====================
Ola Maps API integration with OpenStreetMap fallback.
"""

import logging
import aiohttp
from datetime import datetime, timezone, timedelta
from config import (
    OLA_MAPS_CLIENT_ID, OLA_MAPS_CLIENT_SECRET, OLA_MAPS_TOKEN_URL,
    OLA_MAPS_DIRECTIONS_URL, OLA_MAPS_AUTOCOMPLETE_URL, OLA_MAPS_REVERSE_GEOCODE_URL
)

# Cache for Ola Maps access token
ola_maps_token_cache = {
    "access_token": None,
    "expires_at": None
}


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
