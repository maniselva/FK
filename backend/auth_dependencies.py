"""
backend/auth_dependencies.py
----------------------------
Reusable FastAPI auth guards extracted from server.py.

server.py imports these dependencies and uses them on protected routes. Keeping
them in a dedicated module is the first step towards modularising the 10k+ line
server.py monolith — additional resource routes (admin, custom-orders, delivery)
will be extracted into their own files in subsequent iterations.
"""
from fastapi import HTTPException, Request


async def require_admin(db, request: Request):
    """Guard that ensures caller is an admin (looked up in users collection)."""
    user_id = request.headers.get("x-user-id")
    user_phone = request.headers.get("x-user-phone")
    if not user_id and not user_phone:
        raise HTTPException(status_code=401, detail="Authentication required")

    query = {}
    if user_id:
        query["id"] = user_id
    elif user_phone:
        query["phone"] = user_phone

    admin = await db.users.find_one(
        {**query, "role": "admin"}, {"_id": 0, "password_hash": 0}
    )
    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return admin


async def require_delivery_partner_self_or_admin(
    db, request: Request, user_id: str = None, partner_id: str = None
):
    """
    Guard for delivery-partner-scoped endpoints.
    Allows access if the caller is:
      • the same delivery partner (matches user_id or partner_id in path), or
      • an admin.
    """
    caller_id = request.headers.get("x-user-id")
    caller_phone = request.headers.get("x-user-phone")
    if not caller_id and not caller_phone:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_query = {"id": caller_id} if caller_id else {"phone": caller_phone}
    caller = await db.users.find_one(user_query, {"_id": 0, "password_hash": 0})
    if not caller:
        raise HTTPException(status_code=401, detail="Invalid session")

    if caller.get("role") == "admin":
        return caller

    if user_id and caller.get("id") == user_id:
        return caller

    if partner_id:
        partner = await db.delivery_partners.find_one(
            {"id": partner_id}, {"_id": 0, "user_id": 1}
        )
        if partner and partner.get("user_id") == caller.get("id"):
            return caller

    raise HTTPException(status_code=403, detail="Forbidden")
