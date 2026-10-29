"""
Food Key SMS Service
====================
OTP sending via Ping4SMS API.
"""

import logging
import asyncio
import aiohttp
from config import PING4SMS_API_KEY, PING4SMS_SENDER, PING4SMS_TEMPLATE_ID


async def send_sms_otp(phone: str, otp: str) -> bool:
    """Send OTP via Ping4SMS API"""
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
