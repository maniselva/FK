"""
Food Key Pydantic Models (Database Entities)
=============================================
All database entity models.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid


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
    password_hash: Optional[str] = None
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
    is_visible: bool = True
    available_after: Optional[str] = None


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
    approval_status: str = "pending"
    approval_notes: Optional[str] = None
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    opening_time: str = "09:00"
    closing_time: str = "22:00"
    pending_changes: Optional[dict] = None
    has_pending_changes: bool = False
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
    status: str = "pending"
    delivery_partner_id: Optional[str] = None
    delivery_partner_name: Optional[str] = None
    payment_method: str = "cod"
    payment_status: str = "pending"
    delivery_fee: float = 30.0
    cod_fee: float = 0.0
    is_first_order: bool = False
    notes: Optional[str] = None
    admin_approved: bool = False
    assigned_by_admin: bool = False
    restaurant_notified: bool = False
    delivery_notified: bool = False
    estimated_prep_time: Optional[int] = None
    estimated_delivery_time: Optional[int] = None
    confirmed_at: Optional[str] = None
    ready_at: Optional[str] = None
    picked_up_at: Optional[str] = None
    delivered_at: Optional[str] = None
    is_delayed: bool = False
    delay_reason: Optional[str] = None
    delay_minutes: int = 0
    restaurant_payout: Optional[float] = None
    restaurant_payout_status: str = "pending"
    restaurant_payout_date: Optional[str] = None
    delivery_partner_earning: Optional[float] = None
    delivery_partner_cod_collected: Optional[float] = None
    delivery_partner_settlement_status: str = "pending"
    delivery_partner_settlement_date: Optional[str] = None
    platform_commission: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DeliveryPartner(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    phone: str
    vehicle_number: str
    vehicle_type: str = "bike"
    is_available: bool = True
    is_online: bool = False
    current_location: Optional[dict] = None
    approval_status: str = "pending"
    approval_notes: Optional[str] = None
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    total_deliveries: int = 0
    total_earnings: float = 0
    today_deliveries: int = 0
    today_earnings: float = 0
    rating: float = 5.0
    id_proof: Optional[str] = None
    license_number: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    recipient_type: str
    recipient_id: str
    type: str
    title: str
    message: str
    data: Optional[dict] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PromoCode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    description: str
    discount_type: str = "percentage"
    discount_value: float
    min_order_amount: float = 0
    max_discount: Optional[float] = None
    valid_from: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    valid_until: Optional[datetime] = None
    usage_limit: Optional[int] = None
    per_user_limit: int = 1
    applicable_restaurants: List[str] = []
    is_active: bool = True
    usage_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PromoUsage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    promo_id: str
    promo_code: str
    user_id: str
    order_id: str
    discount_applied: float
    used_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrderTracking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    status: str
    location: Optional[dict] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    message: Optional[str] = None


class PushSubscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    endpoint: str
    keys: dict
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LocationUpdate(BaseModel):
    lat: float
    lng: float
    heading: Optional[float] = None
    speed: Optional[float] = None
    accuracy: Optional[float] = None


class Feedback(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str = "general"
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    subject: str
    message: str
    status: str = "pending"
    admin_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[str] = None


class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    user_id: str
    user_name: str
    restaurant_id: str
    food_rating: int = 5
    delivery_rating: int = 5
    overall_rating: int = 5
    comment: Optional[str] = None
    delivery_partner_id: Optional[str] = None
    delivery_partner_name: Optional[str] = None
    is_visible: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TShirtOrder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    phone: str
    name: str
    partner_type: str
    size: str
    quantity: int = 1
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
