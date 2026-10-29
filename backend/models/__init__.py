"""
Food Key Models Package
=======================
"""

from models.schemas import (
    Address, User, OTPRecord, MenuItem, Restaurant, OrderItem, Order,
    DeliveryPartner, Notification, PromoCode, PromoUsage, OrderTracking,
    PushSubscription, LocationUpdate, Feedback, Review, TShirtOrder
)

from models.requests import (
    SendOTPRequest, VerifyOTPRequest, RegisterWithPasswordRequest,
    LoginWithPasswordRequest, SetPasswordRequest, ForgotPasswordRequest,
    ResetPasswordRequest, UpdateProfileRequest, AddAddressRequest,
    CreateOrderRequest, UpdateOrderStatusRequest, CancelOrderRequest,
    ConfirmOrderRequest, UpdateDeliveryRequest, CreateRestaurantRequest,
    AddMenuItemRequest, RestaurantPendingChangesRequest, AdminLoginRequest,
    AdminSetPasswordRequest, CreateAdminRequest, AdminAssignDeliveryRequest,
    AdminUpdateRestaurantRequest, AdminApprovalRequest, AdminApproveChangesRequest,
    RegisterDeliveryPartnerRequest, UpdateDeliveryLocationRequest,
    CreatePromoRequest, ApplyPromoRequest, PushSubscriptionRequest,
    UpdateTrackingRequest, ChatRequest, InitiatePaymentRequest, DirectionsRequest,
    SubmitFeedbackRequest, SubmitReviewRequest, ShareOrderRequest, TShirtOrderRequest
)

__all__ = [
    # Schemas
    'Address', 'User', 'OTPRecord', 'MenuItem', 'Restaurant', 'OrderItem', 'Order',
    'DeliveryPartner', 'Notification', 'PromoCode', 'PromoUsage', 'OrderTracking',
    'PushSubscription', 'LocationUpdate', 'Feedback', 'Review', 'TShirtOrder',
    # Requests
    'SendOTPRequest', 'VerifyOTPRequest', 'RegisterWithPasswordRequest',
    'LoginWithPasswordRequest', 'SetPasswordRequest', 'ForgotPasswordRequest',
    'ResetPasswordRequest', 'UpdateProfileRequest', 'AddAddressRequest',
    'CreateOrderRequest', 'UpdateOrderStatusRequest', 'CancelOrderRequest',
    'ConfirmOrderRequest', 'UpdateDeliveryRequest', 'CreateRestaurantRequest',
    'AddMenuItemRequest', 'RestaurantPendingChangesRequest', 'AdminLoginRequest',
    'AdminSetPasswordRequest', 'CreateAdminRequest', 'AdminAssignDeliveryRequest',
    'AdminUpdateRestaurantRequest', 'AdminApprovalRequest', 'AdminApproveChangesRequest',
    'RegisterDeliveryPartnerRequest', 'UpdateDeliveryLocationRequest',
    'CreatePromoRequest', 'ApplyPromoRequest', 'PushSubscriptionRequest',
    'UpdateTrackingRequest', 'ChatRequest', 'InitiatePaymentRequest', 'DirectionsRequest',
    'SubmitFeedbackRequest', 'SubmitReviewRequest', 'ShareOrderRequest', 'TShirtOrderRequest'
]
