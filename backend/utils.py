"""
Food Key Utility Functions
==========================
Common helper functions used across the application.
"""

import re
import html
import math
import hashlib


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
    """Validate phone number format (Indian 10-digit)"""
    return bool(re.match(r'^[6-9]\d{9}$', phone))


def hash_password(password: str) -> str:
    """Hash password with SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed


def validate_password(password: str) -> tuple:
    """Validate password: 8+ chars with at least 1 number"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least 1 number"
    return True, ""


def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates in kilometers using Haversine formula"""
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def generate_google_maps_link(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> str:
    """Generate Google Maps directions URL"""
    return f"https://www.google.com/maps/dir/?api=1&origin={origin_lat},{origin_lng}&destination={dest_lat},{dest_lng}&travelmode=driving"
