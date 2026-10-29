import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AppProvider, useApp } from "./contexts/AppContext";
import { AdminProvider } from "./contexts/AdminContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";
import ChatBot from "./components/ChatBot";

// Customer Pages
import HomePage from "./pages/HomePage";
import RestaurantsPage from "./pages/RestaurantsPage";
import RestaurantPage from "./pages/RestaurantPage";
import CartPage from "./pages/CartPage";
import OrdersPage from "./pages/OrdersPage";
import TrackOrderPage from "./pages/TrackOrderPage";
import SharedTrackingPage from "./pages/SharedTrackingPage";
import ProfilePage from "./pages/ProfilePage";
import TermsAndConditionsPage from "./pages/TermsAndConditionsPage";
import RefundPolicyPage from "./pages/RefundPolicyPage";
import ReturnPolicyPage from "./pages/ReturnPolicyPage";
import ShippingPolicyPage from "./pages/ShippingPolicyPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import FeedbackPage from "./pages/FeedbackPage";
import RestaurantDashboard from "./pages/RestaurantDashboard";
import RestaurantProfilePage from "./pages/RestaurantProfilePage";
import DeliveryDashboard from "./pages/DeliveryDashboard";
import RestaurantAnalytics from "./pages/RestaurantAnalytics";
import DeliveryPerformance from "./pages/DeliveryPerformance";
import PaymentStatusPage from "./pages/PaymentStatusPage";
import RestaurantPendingPage from "./pages/RestaurantPendingPage";
import DeliveryPendingPage from "./pages/DeliveryPendingPage";
import WriteOrderPage from "./pages/WriteOrderPage";

// Partner Login Pages
import RestaurantPartnerLogin from "./pages/RestaurantPartnerLogin";
import DeliveryPartnerLogin from "./pages/DeliveryPartnerLogin";

// Admin Pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminOrderHistory from "./pages/admin/AdminOrderHistory";
import AdminRestaurants from "./pages/admin/AdminRestaurants";
import AdminDeliveryPartners from "./pages/admin/AdminDeliveryPartners";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminPromos from "./pages/admin/AdminPromos";
import AdminFeedback from "./pages/admin/AdminFeedback";
import AdminTshirtOrders from "./pages/admin/AdminTshirtOrders";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminSlides from "./pages/admin/AdminSlides";
import AdminCustomOrders from "./pages/admin/AdminCustomOrders";

function CustomerApp() {
    const { showAuth, setShowAuth } = useApp();

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Navbar onAuthClick={() => setShowAuth(true)} />
            <main className="flex-1">
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/restaurants" element={<RestaurantsPage />} />
                    <Route path="/restaurant/:id" element={<RestaurantPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/track/:orderId" element={<TrackOrderPage />} />
                    <Route path="/track/share/:shareToken" element={<SharedTrackingPage />} />
                    <Route path="/payment/status/:orderId" element={<PaymentStatusPage />} />
                    <Route path="/payment-status" element={<PaymentStatusPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/terms" element={<TermsAndConditionsPage />} />
                    <Route path="/refund-policy" element={<RefundPolicyPage />} />
                    <Route path="/return-policy" element={<ReturnPolicyPage />} />
                    <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
                    <Route path="/privacy" element={<PrivacyPolicyPage />} />
                    <Route path="/feedback" element={<FeedbackPage />} />
                    <Route path="/dashboard/restaurant" element={<RestaurantDashboard />} />
                    <Route path="/dashboard/restaurant/pending" element={<RestaurantPendingPage />} />
                    <Route path="/dashboard/delivery" element={<DeliveryDashboard />} />
                    <Route path="/dashboard/delivery/pending" element={<DeliveryPendingPage />} />
                    <Route path="/restaurant-dashboard" element={<RestaurantDashboard />} />
                    <Route path="/restaurant-profile" element={<RestaurantProfilePage />} />
                    <Route path="/delivery-dashboard" element={<DeliveryDashboard />} />
                    <Route path="/analytics/restaurant/:restaurantId" element={<RestaurantAnalytics />} />
                    <Route path="/analytics/delivery" element={<DeliveryPerformance />} />
                    <Route path="/write-order" element={<WriteOrderPage />} />
                </Routes>
            </main>
            <Footer />
            <AuthModal open={showAuth} onOpenChange={setShowAuth} />
            <ChatBot />
        </div>
    );
}

// Partner pages - minimal layout without navbar/footer
function PartnerApp() {
    return (
        <Routes>
            <Route path="/restaurant" element={<RestaurantPartnerLogin />} />
            <Route path="/delivery" element={<DeliveryPartnerLogin />} />
        </Routes>
    );
}

function AdminApp() {
    return (
        <Routes>
            <Route path="/login" element={<AdminLogin />} />
            <Route element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="order-history" element={<AdminOrderHistory />} />
                <Route path="restaurants" element={<AdminRestaurants />} />
                <Route path="delivery" element={<AdminDeliveryPartners />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="promos" element={<AdminPromos />} />
                <Route path="slides" element={<AdminSlides />} />
                <Route path="feedback" element={<AdminFeedback />} />
                <Route path="tshirt-orders" element={<AdminTshirtOrders />} />
                <Route path="ratings" element={<AdminReviews />} />
                <Route path="custom-orders" element={<AdminCustomOrders />} />
                <Route path="settings" element={<AdminSettings />} />
            </Route>
        </Routes>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AppProvider>
                <WebSocketProvider>
                    <AdminProvider>
                        <Routes>
                            {/* Admin Routes */}
                            <Route path="/admin/*" element={<AdminApp />} />
                            
                            {/* Partner Routes - minimal layout */}
                            <Route path="/partner/*" element={<PartnerApp />} />
                            
                            {/* Customer Routes */}
                            <Route path="/*" element={<CustomerApp />} />
                        </Routes>
                        <Toaster 
                            position="top-center"
                            toastOptions={{
                                style: {
                                    background: 'hsl(var(--card))',
                                    color: 'hsl(var(--foreground))',
                                    border: '1px solid hsl(var(--border))',
                                },
                            }}
                        />
                    </AdminProvider>
                </WebSocketProvider>
            </AppProvider>
        </BrowserRouter>
    );
}

export default App;
