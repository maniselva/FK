"""
Food Key Authentication Routes
==============================
Customer and password-based authentication endpoints.
"""

import logging
import random
import string
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import db
from models import (
    SendOTPRequest, VerifyOTPRequest, SetPasswordRequest,
    LoginWithPasswordRequest, ForgotPasswordRequest, ResetPasswordRequest, User
)
from services import send_sms_otp
from utils import validate_phone, sanitize_input, hash_password, verify_password, validate_password

router = APIRouter(prefix="/api", tags=["Auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/auth/send-otp")
@limiter.limit("5/minute")
async def send_otp(request: Request, otp_request: SendOTPRequest):
    """Send OTP to phone number via Ping4SMS"""
    if not validate_phone(otp_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    otp = ''.join(random.choices(string.digits, k=5))
    
    otp_record = {
        "phone": otp_request.phone,
        "otp": otp,
        "attempts": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    }
    
    await db.otps.delete_many({"phone": otp_request.phone})
    await db.otps.insert_one(otp_record)
    
    sms_sent = await send_sms_otp(otp_request.phone, otp)
    
    logging.info(f"OTP for {otp_request.phone}: {otp}")
    
    return {"message": "OTP sent successfully", "sms_sent": sms_sent}


@router.post("/auth/verify-otp")
@limiter.limit("10/minute")
async def verify_otp(request: Request, otp_request: VerifyOTPRequest):
    """Verify OTP and login/register user"""
    if not validate_phone(otp_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    otp_record = await db.otps.find_one({"phone": otp_request.phone}, {"_id": 0})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="OTP not found. Please request a new OTP.")
    
    expires_at = datetime.fromisoformat(otp_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.otps.delete_many({"phone": otp_request.phone})
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new OTP.")
    
    if otp_record.get("attempts", 0) >= 3:
        await db.otps.delete_many({"phone": otp_request.phone})
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please request a new OTP.")
    
    if otp_record["otp"] != otp_request.otp:
        await db.otps.update_one(
            {"phone": otp_request.phone},
            {"$inc": {"attempts": 1}}
        )
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    await db.otps.delete_many({"phone": otp_request.phone})
    
    user = await db.users.find_one({"phone": otp_request.phone}, {"_id": 0})
    
    if user:
        update_data = {"last_login": datetime.now(timezone.utc).isoformat()}
        if otp_request.role and user.get("role") != otp_request.role:
            update_data["role"] = otp_request.role
        
        await db.users.update_one(
            {"phone": otp_request.phone},
            {"$set": update_data}
        )
        user["role"] = otp_request.role if otp_request.role else user.get("role")
        user["last_login"] = update_data["last_login"]
        return {"message": "Login successful", "user": user, "is_new": False}
    
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
    user_dict.pop("_id", None)
    
    return {"message": "Registration successful", "user": user_dict, "is_new": True}


@router.post("/auth/set-password")
@limiter.limit("5/minute")
async def set_password(request: Request, pwd_request: SetPasswordRequest):
    """Set password after OTP verification"""
    if not validate_phone(pwd_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    if pwd_request.password != pwd_request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    is_valid, msg = validate_password(pwd_request.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)
    
    user = await db.users.find_one({"phone": pwd_request.phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please verify OTP first.")
    
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


@router.post("/auth/login-password")
@limiter.limit("10/minute")
async def login_with_password(request: Request, login_request: LoginWithPasswordRequest):
    """Login with phone and password"""
    if not validate_phone(login_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    user = await db.users.find_one({"phone": login_request.phone}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.get("is_password_set"):
        raise HTTPException(status_code=400, detail="Password not set. Please login with OTP first and set a password.")
    
    if not verify_password(login_request.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    await db.users.update_one(
        {"phone": login_request.phone},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    user.pop("password_hash", None)
    user["last_login"] = datetime.now(timezone.utc).isoformat()
    
    return {"message": "Login successful", "user": user}


@router.post("/auth/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, forgot_request: ForgotPasswordRequest):
    """Send OTP for password reset"""
    if not validate_phone(forgot_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    user = await db.users.find_one({"phone": forgot_request.phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    
    sms_sent = await send_sms_otp(forgot_request.phone, otp)
    
    logging.info(f"Password reset OTP for {forgot_request.phone}: {otp}")
    
    return {"message": "OTP sent for password reset", "sms_sent": sms_sent}


@router.post("/auth/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, reset_request: ResetPasswordRequest):
    """Reset password with OTP verification"""
    if not validate_phone(reset_request.phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    if reset_request.new_password != reset_request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    is_valid, msg = validate_password(reset_request.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)
    
    otp_record = await db.otps.find_one({"phone": reset_request.phone, "type": "password_reset"}, {"_id": 0})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="OTP not found. Please request a new one.")
    
    expires_at = datetime.fromisoformat(otp_record["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.otps.delete_many({"phone": reset_request.phone, "type": "password_reset"})
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new OTP.")
    
    if otp_record.get("attempts", 0) >= 3:
        await db.otps.delete_many({"phone": reset_request.phone, "type": "password_reset"})
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please request a new OTP.")
    
    if otp_record["otp"] != reset_request.otp:
        await db.otps.update_one(
            {"phone": reset_request.phone, "type": "password_reset"},
            {"$inc": {"attempts": 1}}
        )
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    await db.otps.delete_many({"phone": reset_request.phone, "type": "password_reset"})
    
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


@router.get("/auth/check-password-status/{phone}")
async def check_password_status(phone: str):
    """Check if user has password set"""
    if not validate_phone(phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    user = await db.users.find_one({"phone": phone}, {"_id": 0, "is_password_set": 1})
    
    if not user:
        return {"exists": False, "has_password": False}
    
    return {"exists": True, "has_password": user.get("is_password_set", False)}
