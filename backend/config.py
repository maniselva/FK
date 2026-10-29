"""
Food Key Configuration
======================
All configuration constants and environment variables.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

load_dotenv(ROOT_DIR / '.env')

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

# Ping4SMS API Configuration - Read from environment
PING4SMS_API_KEY = os.environ.get("PING4SMS_API_KEY", "")
PING4SMS_SENDER = os.environ.get("PING4SMS_SENDER", "PNGOTP")
PING4SMS_TEMPLATE_ID = os.environ.get("PING4SMS_TEMPLATE_ID", "")

# Payment Structure Constants
PLATFORM_COMMISSION_RATE = 0.01  # 1% platform commission on food
DELIVERY_PARTNER_SHARE = 0.95  # 95% of delivery fee goes to partner
COD_FEE = 5  # ₹5 COD convenience fee

# MongoDB connection settings
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
