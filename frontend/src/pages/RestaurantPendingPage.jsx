import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, ArrowLeft, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Logo } from '../components/Logo';
import { useApp } from '../contexts/AppContext';

export default function RestaurantPendingPage() {
    const navigate = useNavigate();
    const { user, logout } = useApp();

    const handleLogout = () => {
        logout();
        navigate('/partner/restaurant');
    };

    const handleRefresh = () => {
        navigate('/dashboard/restaurant');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 text-center">
                    {/* Logo */}
                    <div className="flex justify-center mb-6">
                        <Logo size="default" />
                    </div>

                    {/* Pending Icon */}
                    <div className="w-20 h-20 mx-auto mb-6 bg-amber-100 rounded-full flex items-center justify-center">
                        <Clock className="w-10 h-10 text-amber-600" />
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">
                        Registration Submitted!
                    </h1>

                    {/* Message */}
                    <p className="text-gray-600 mb-6">
                        Thank you for registering your restaurant with <span className="font-semibold text-orange-600">FoodKey</span>.
                        Your application is currently under review.
                    </p>

                    {/* Status Card */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-center gap-2 text-amber-700 font-medium mb-2">
                            <Clock size={18} />
                            Pending Admin Approval
                        </div>
                        <p className="text-sm text-amber-600">
                            Our team will review your application and get back to you shortly. 
                            This usually takes 24-48 hours.
                        </p>
                    </div>

                    {/* What Happens Next */}
                    <div className="text-left bg-gray-50 rounded-xl p-4 mb-6">
                        <h3 className="font-semibold text-gray-700 mb-3">What happens next?</h3>
                        <ul className="space-y-3 text-sm text-gray-600">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Admin will review your restaurant details</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                                <span>You'll receive an SMS notification once approved</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Then you can add menu items and start receiving orders</span>
                            </li>
                        </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        <Button
                            onClick={handleRefresh}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12"
                            data-testid="check-status-btn"
                        >
                            <RefreshCw size={18} className="mr-2" />
                            Check Status
                        </Button>
                        
                        <Button
                            onClick={handleLogout}
                            variant="outline"
                            className="w-full h-12"
                            data-testid="logout-pending-btn"
                        >
                            <LogOut size={18} className="mr-2" />
                            Logout
                        </Button>
                    </div>

                    {/* Footer Link */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <Link to="/" className="text-sm text-gray-600 hover:text-orange-500 flex items-center justify-center gap-1">
                            <ArrowLeft size={16} />
                            Back to Home
                        </Link>
                    </div>

                    {/* User Info (if available) */}
                    {user?.name && (
                        <p className="text-xs text-gray-400 mt-4">
                            Logged in as: {user.name}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
