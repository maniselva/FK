"""
Food Key Request/Response Models
================================
All API request and response models.
"""

from pydantic import BaseModel
from typing import List, Optional
from models.schemas import OrderItem, Address


# Auth Request Models
class SendOTPRequest(BaseModel):
    phone: str


class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str
    role: str = "customer"
    name: Optional[str] = None


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


# Profile Request Models
class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    fssai_licence: Optional[str] = None
    driving_licence: Optional[str] = None


class AddAddressRequest(BaseModel):
    label: str
    full_address: str
    lat: Optional[float] = None
    lng: Optional[float] = None


# Order Request Models
class CreateOrderRequest(BaseModel):
    restaurant_id: str
    items: List[OrderItem]
    delivery_address: Address
    payment_method: str = "cod"
    promo_code: Optional[str] = None
    notes: Optional[str] = None
    delivery_fee: Optional[float] = None
    cod_fee: Optional[float] = None
    is_first_order: Optional[bool] = False


class UpdateOrderStatusRequest(BaseModel):
    status: str
    delivery_partner_id: Optional[str] = None


class CancelOrderRequest(BaseModel):
    reason: str
    cancelled_by: str = "restaurant"


class ConfirmOrderRequest(BaseModel):
    estimated_prep_time: int = 15


class UpdateDeliveryRequest(BaseModel):
    delay_reason: Optional[str] = None
    delay_minutes: int = 0


# Restaurant Request Models
class CreateRestaurantRequest(BaseModel):
    name: str
    description: str
    cuisine: List[str]
    image: str
    cover_image: str
    address: str
    price_for_two: int = 300
    is_veg: bool = False
    rating: float = 4.0
    delivery_time: str = "30-40 min"
    opening_time: str = "09:00"
    closing_time: str = "22:00"
    lat: Optional[float] = None
    lng: Optional[float] = None


class AddMenuItemRequest(BaseModel):
    name: str
    description: str
    price: float
    image: str
    category: str
    is_veg: bool = True


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
    menu_changes: Optional[List[dict]] = None


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


class AdminApprovalRequest(BaseModel):
    action: str
    notes: Optional[str] = None


class AdminApproveChangesRequest(BaseModel):
    approve: bool
    notes: Optional[str] = None


# Delivery Partner Request Models
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


# Promo Code Request Models
class CreatePromoRequest(BaseModel):
    code: str
    description: str
    discount_type: str = "percentage"
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


# Chat Request Model
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


# Payment Request Models
class InitiatePaymentRequest(BaseModel):
    order_id: str
    amount: float
    user_phone: str
    user_id: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    origin_url: Optional[str] = None


# Maps Request Models
class DirectionsRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float


# Feedback Request Models
class SubmitFeedbackRequest(BaseModel):
    type: str = "general"
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    subject: str
    message: str


# Review Request Models
class SubmitReviewRequest(BaseModel):
    order_id: str
    food_rating: int = 5
    delivery_rating: int = 5
    overall_rating: int = 5
    comment: Optional[str] = None


# Share Order Request Models
class ShareOrderRequest(BaseModel):
    order_id: str
    user_id: str


# T-Shirt Order Request Models
class TShirtOrderRequest(BaseModel):
    phone: str
    name: str
    partner_type: str
    size: str
    quantity: int = 1
