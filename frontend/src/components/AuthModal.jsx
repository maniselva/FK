import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { Phone, User, MapPin, ArrowLeft, Navigation, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';
import axios from 'axios';
import AddressSearch from './AddressSearch';
import DetectedAddressChip from './DetectedAddressChip';
import { useResendOTP } from '../hooks/useResendOTP';

const API = process.env.REACT_APP_BACKEND_URL;

export const AuthModal = ({ open, onOpenChange }) => {
    const navigate = useNavigate();
    const { sendOTP, verifyOTP, user, updateUserProfile, detectLocation, setUser, logout } = useApp();
    // Steps: phone, otp, password_setup, profile, login_method, password_login, forgot_password, reset_password, session_conflict
    const [step, setStep] = useState('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [locating, setLocating] = useState(false);
    const [existingSession, setExistingSession] = useState(null);
    
    // Password fields
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [hasPassword, setHasPassword] = useState(false);
    
    // Use the resend OTP hook
    const { canResend, isResending, handleResendOTP, startTimer, formatTimer } = useResendOTP(sendOTP, phone);
    
    // Profile fields
    const [profileData, setProfileData] = useState({
        name: '',
        email: '',
        address: '',
        landmark: ''
    });
    // Detected location (lat/lng cached) for the chip indicator
    const [detectedLoc, setDetectedLoc] = useState({ lat: null, lng: null, address: '' });
    const addressSearchRef = useRef(null);

    // Check if this is a new user who needs profile setup
    const [needsProfile, setNeedsProfile] = useState(false);

    // Handle redirect after login
    const handleSuccessfulLogin = () => {
        onOpenChange(false);
        const redirectPath = sessionStorage.getItem('redirect_after_login');
        if (redirectPath) {
            sessionStorage.removeItem('redirect_after_login');
            navigate(redirectPath);
        }
    };

    // Check for existing non-customer session
    const checkExistingSession = () => {
        const userStr = localStorage.getItem('foodkey_user');
        const adminUser = localStorage.getItem('foodkey_admin');
        
        if (userStr) {
            try {
                const existingUser = JSON.parse(userStr);
                // Check if logged in as restaurant or delivery
                if (existingUser.fssai_licence || existingUser.role === 'restaurant') {
                    return { type: 'restaurant', user: existingUser };
                }
                if (existingUser.driving_licence || existingUser.role === 'delivery') {
                    return { type: 'delivery partner', user: existingUser };
                }
            } catch {}
        }
        if (adminUser) {
            return { type: 'admin', user: JSON.parse(adminUser) };
        }
        return null;
    };

    const handleLogoutAndContinue = () => {
        localStorage.removeItem('foodkey_user');
        localStorage.removeItem('foodkey_admin');
        if (logout) logout();
        setExistingSession(null);
        toast.success('Previous session logged out');
        proceedWithSendOTP();
    };

    const proceedWithSendOTP = async () => {
        setLoading(true);
        try {
            const status = await checkPasswordStatus();
            if (status.has_password) {
                setStep('login_method');
            } else {
                await sendOTP(phone);
                toast.success('OTP sent to your phone!');
                setStep('otp');
                startTimer();
            }
        } catch (error) {
            toast.error(error.detail || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleSendOTP = async () => {
        if (phone.length < 10) {
            toast.error('Please enter a valid phone number');
            return;
        }

        setLoading(true);
        try {
            const response = await sendOTP(phone);
            toast.success('OTP sent to your phone!');
            setStep('otp');
            startTimer();
        } catch (error) {
            toast.error(error.detail || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (otp.length !== 5) {
            toast.error('Please enter 5-digit OTP');
            return;
        }

        setLoading(true);
        try {
            // Clear admin session when logging in as customer
            localStorage.removeItem('foodkey_admin');
            
            const response = await verifyOTP(phone, otp, 'customer', null);
            
            // Check if user is new or doesn't have profile set
            if (response.is_new || !response.user?.name || !response.user?.addresses?.length) {
                setNeedsProfile(true);
                // Check if user has password set
                if (!response.user?.is_password_set) {
                    setStep('password_setup');
                    toast.success('OTP verified! Please set your password');
                } else {
                    setStep('profile');
                    toast.success('OTP verified! Please complete your profile');
                }
            } else {
                // Existing user - check if they have password
                if (!response.user?.is_password_set) {
                    setStep('password_setup');
                    toast.success('Welcome back! Please set a password for easier login');
                } else {
                    toast.success('Welcome back!');
                    handleSuccessfulLogin();
                    resetForm();
                }
            }
        } catch (error) {
            toast.error(error.detail || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    const validatePassword = (pwd) => {
        if (pwd.length < 8) return 'Password must be at least 8 characters';
        if (!/\d/.test(pwd)) return 'Password must contain at least 1 number';
        return '';
    };

    const handleSetPassword = async () => {
        const pwdError = validatePassword(password);
        if (pwdError) {
            toast.error(pwdError);
            return;
        }
        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API}/api/auth/set-password`, {
                phone,
                password,
                confirm_password: confirmPassword,
                role: 'customer'
            });
            toast.success('Password set successfully!');
            
            if (needsProfile) {
                setStep('profile');
            } else {
                toast.success('You can now login with password');
                handleSuccessfulLogin();
                resetForm();
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to set password');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordLogin = async () => {
        if (!password) {
            toast.error('Please enter your password');
            return;
        }

        setLoading(true);
        try {
            // Clear admin session when logging in as customer
            localStorage.removeItem('foodkey_admin');
            
            const response = await axios.post(`${API}/api/auth/login-password`, {
                phone,
                password,
                role: 'customer'
            });
            
            const userData = response.data.user;
            // Ensure role is set to customer
            userData.role = 'customer';
            localStorage.setItem('foodkey_user', JSON.stringify(userData));
            setUser(userData);
            
            toast.success('Login successful!');
            handleSuccessfulLogin();
            resetForm();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Invalid password');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        setLoading(true);
        try {
            await axios.post(`${API}/api/auth/forgot-password`, {
                phone,
                role: 'customer'
            });
            toast.success('OTP sent for password reset!');
            setStep('reset_password');
            startTimer();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (otp.length !== 5) {
            toast.error('Please enter 5-digit OTP');
            return;
        }
        const pwdError = validatePassword(password);
        if (pwdError) {
            toast.error(pwdError);
            return;
        }
        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API}/api/auth/reset-password`, {
                phone,
                otp,
                new_password: password,
                confirm_password: confirmPassword,
                role: 'customer'
            });
            toast.success('Password reset successfully! Please login');
            setStep('password_login');
            setOtp('');
            setPassword('');
            setConfirmPassword('');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    const checkPasswordStatus = async () => {
        try {
            const response = await axios.get(`${API}/api/auth/check-password-status/${phone}`);
            setHasPassword(response.data.has_password);
            return response.data;
        } catch {
            return { exists: false, has_password: false };
        }
    };

    const handleContinue = async () => {
        if (phone.length < 10) {
            toast.error('Please enter a valid phone number');
            return;
        }
        
        // Check for existing non-customer session
        const session = checkExistingSession();
        if (session) {
            setExistingSession(session);
            setStep('session_conflict');
            return;
        }
        
        setLoading(true);
        const status = await checkPasswordStatus();
        setLoading(false);
        
        if (status.has_password) {
            setStep('login_method');
        } else {
            handleSendOTP();
        }
    };

    const handleSaveProfile = async () => {
        if (!profileData.name.trim()) {
            toast.error('Please enter your name');
            return;
        }
        if (!profileData.address.trim()) {
            toast.error('Please enter your address');
            return;
        }

        setLoading(true);
        try {
            // Update user profile with name and email
            await updateUserProfile({ 
                name: profileData.name,
                email: profileData.email || null
            });
            
            const addressResponse = await axios.post(`${API}/api/users/${user.id}/addresses`, {
                label: 'Home',
                full_address: profileData.address + (profileData.landmark ? `, ${profileData.landmark}` : '')
            });
            
            setUser(addressResponse.data);
            
            toast.success('Profile saved! Welcome to Food Key');
            handleSuccessfulLogin();
            resetForm();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save profile');
        } finally {
            setLoading(false);
        }
    };

    const handleDetectLocation = async () => {
        setLocating(true);
        try {
            const location = await detectLocation();
            if (location?.address) {
                setProfileData(prev => ({
                    ...prev,
                    address: location.address
                }));
                setDetectedLoc({
                    lat: location.lat,
                    lng: location.lng,
                    address: location.address
                });
                toast.success('📍 Location detected!');
            }
        } catch (error) {
            toast.error('Could not detect location');
        } finally {
            setLocating(false);
        }
    };

    // Auto-detect customer's address once when they reach the profile step
    const [autoDetected, setAutoDetected] = useState(false);
    useEffect(() => {
        if (step === 'profile' && !autoDetected && !profileData.address) {
            setAutoDetected(true);
            handleDetectLocation();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    const resetForm = () => {
        setStep('phone');
        setPhone('');
        setOtp('');
        setPassword('');
        setConfirmPassword('');
        setNeedsProfile(false);
        setHasPassword(false);
        setExistingSession(null);
        setProfileData({ name: '', email: '', address: '', landmark: '' });
    };

    return (
        <Dialog open={open} onOpenChange={(open) => { onOpenChange(open); if (!open) resetForm(); }}>
            <DialogContent className="sm:max-w-md" data-testid="auth-modal">
                <DialogHeader>
                    <DialogTitle className="text-center text-2xl">
                        {step === 'phone' && 'Welcome to Food Key'}
                        {step === 'login_method' && 'Choose Login Method'}
                        {step === 'otp' && 'Enter OTP'}
                        {step === 'password_login' && 'Login with Password'}
                        {step === 'password_setup' && 'Set Your Password'}
                        {step === 'forgot_password' && 'Forgot Password'}
                        {step === 'reset_password' && 'Reset Password'}
                        {step === 'profile' && 'Complete Your Profile'}
                        {step === 'session_conflict' && 'Session Conflict'}
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-4">
                    {/* Phone Step */}
                    {step === 'phone' && (
                        <div className="space-y-4">
                            <p className="text-center text-muted-foreground text-sm">
                                Enter your phone number to continue
                            </p>
                            
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <div className="flex gap-2">
                                    <div className="flex items-center px-3 bg-secondary rounded-lg text-muted-foreground">
                                        +91
                                    </div>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="Enter your phone number"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        className="flex-1"
                                        data-testid="phone-input"
                                    />
                                </div>
                            </div>

                            <Button 
                                onClick={handleContinue} 
                                disabled={loading || phone.length < 10}
                                className="w-full btn-primary"
                                data-testid="continue-btn"
                            >
                                {loading ? 'Please wait...' : 'Continue'}
                            </Button>

                            <div className="pt-2 border-t border-border">
                                <p className="text-center text-sm text-muted-foreground mb-2">
                                    Are you a partner?
                                </p>
                                <div className="flex gap-2">
                                    <a 
                                        href="/partner/restaurant" 
                                        className="flex-1 text-center text-sm py-2 px-3 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors"
                                    >
                                        Restaurant Login
                                    </a>
                                    <a 
                                        href="/partner/delivery" 
                                        className="flex-1 text-center text-sm py-2 px-3 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition-colors"
                                    >
                                        Delivery Partner
                                    </a>
                                </div>
                            </div>

                            <p className="text-center text-xs text-muted-foreground">
                                By continuing, you agree to our{' '}
                                <a href="/terms" className="text-primary hover:underline">Terms</a>
                                {' '}and{' '}
                                <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
                            </p>
                        </div>
                    )}

                    {/* Session Conflict Step */}
                    {step === 'session_conflict' && existingSession && (
                        <div className="space-y-4">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-semibold">Active Session Found</h2>
                                <p className="text-muted-foreground mt-2">
                                    You're currently logged in as a <span className="font-semibold text-primary">{existingSession.type}</span>.
                                </p>
                                <p className="text-muted-foreground text-sm mt-1">
                                    To login as a Customer, you need to logout from the current session.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <Button 
                                    onClick={handleLogoutAndContinue}
                                    className="w-full btn-primary"
                                    data-testid="logout-and-continue-btn"
                                >
                                    Logout & Continue as Customer
                                </Button>
                                <Button 
                                    onClick={() => {
                                        setStep('phone');
                                        setExistingSession(null);
                                    }}
                                    variant="outline"
                                    className="w-full"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Login Method Selection */}
                    {step === 'login_method' && (
                        <div className="space-y-4">
                            <button 
                                onClick={() => setStep('phone')} 
                                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                            >
                                <ArrowLeft size={16} />
                                Change number
                            </button>

                            <p className="text-center text-muted-foreground">
                                How would you like to login?
                            </p>

                            <div className="space-y-3">
                                <Button 
                                    onClick={() => setStep('password_login')}
                                    variant="outline"
                                    className="w-full h-14 justify-start gap-3"
                                    data-testid="login-password-btn"
                                >
                                    <Lock className="text-primary" size={20} />
                                    <div className="text-left">
                                        <p className="font-medium">Login with Password</p>
                                        <p className="text-xs text-muted-foreground">Use your saved password</p>
                                    </div>
                                </Button>

                                <Button 
                                    onClick={handleSendOTP}
                                    variant="outline"
                                    className="w-full h-14 justify-start gap-3"
                                    disabled={loading}
                                    data-testid="login-otp-btn"
                                >
                                    <Phone className="text-green-500" size={20} />
                                    <div className="text-left">
                                        <p className="font-medium">{loading ? 'Sending OTP...' : 'Login with OTP'}</p>
                                        <p className="text-xs text-muted-foreground">Get OTP on +91 {phone}</p>
                                    </div>
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Password Login */}
                    {step === 'password_login' && (
                        <div className="space-y-4">
                            <button 
                                onClick={() => setStep('login_method')} 
                                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>

                            <p className="text-center text-muted-foreground">
                                Enter password for +91 {phone}
                            </p>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pr-10"
                                        data-testid="password-input"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <Button 
                                onClick={handlePasswordLogin} 
                                disabled={loading || !password}
                                className="w-full btn-primary"
                                data-testid="login-btn"
                            >
                                {loading ? 'Logging in...' : 'Login'}
                            </Button>

                            <div className="text-center">
                                <button
                                    onClick={handleForgotPassword}
                                    disabled={loading}
                                    className="text-sm text-primary hover:underline"
                                    data-testid="forgot-password-btn"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        </div>
                    )}

                    {/* OTP Step */}
                    {step === 'otp' && (
                        <div className="space-y-4">
                            <button 
                                onClick={() => setStep('phone')} 
                                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                            >
                                <ArrowLeft size={16} />
                                Change number
                            </button>

                            <p className="text-center text-muted-foreground">
                                Enter the 5-digit code sent to +91 {phone}
                            </p>

                            <div className="flex justify-center">
                                <Input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 5))}
                                    placeholder="Enter 5-digit OTP"
                                    className="text-center text-2xl tracking-widest font-mono w-48"
                                    maxLength={5}
                                    data-testid="otp-input"
                                />
                            </div>

                            <Button 
                                onClick={handleVerifyOTP} 
                                disabled={loading || otp.length < 5}
                                className="w-full btn-primary"
                                data-testid="verify-btn"
                            >
                                {loading ? 'Verifying...' : 'Verify & Continue'}
                            </Button>

                            <div className="text-center">
                                {!canResend ? (
                                    <p className="text-sm text-muted-foreground">
                                        Resend OTP in <span className="font-semibold text-primary">{formatTimer()}</span>
                                    </p>
                                ) : (
                                    <button
                                        onClick={handleResendOTP}
                                        disabled={loading || isResending}
                                        className="text-sm text-primary hover:underline font-medium"
                                        data-testid="resend-otp-btn"
                                    >
                                        {isResending ? 'Sending...' : 'Resend OTP'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Password Setup Step */}
                    {step === 'password_setup' && (
                        <div className="space-y-4">
                            <div className="text-center">
                                <KeyRound className="mx-auto text-primary mb-2" size={32} />
                                <p className="text-muted-foreground text-sm">
                                    Set a password for easier login next time
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="new-password">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="new-password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter password (min 8 chars, 1 number)"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pr-10"
                                        data-testid="new-password-input"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm Password</Label>
                                <div className="relative">
                                    <Input
                                        id="confirm-password"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="Re-enter password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pr-10"
                                        data-testid="confirm-password-input"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <Button 
                                onClick={handleSetPassword} 
                                disabled={loading || !password || !confirmPassword}
                                className="w-full btn-primary"
                                data-testid="set-password-btn"
                            >
                                {loading ? 'Setting password...' : 'Set Password & Continue'}
                            </Button>

                            <button
                                onClick={() => needsProfile ? setStep('profile') : (onOpenChange(false), resetForm())}
                                className="w-full text-sm text-muted-foreground hover:text-foreground"
                            >
                                Skip for now
                            </button>
                        </div>
                    )}

                    {/* Reset Password Step */}
                    {step === 'reset_password' && (
                        <div className="space-y-4">
                            <button 
                                onClick={() => setStep('password_login')} 
                                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                            >
                                <ArrowLeft size={16} />
                                Back to login
                            </button>

                            <p className="text-center text-muted-foreground text-sm">
                                Enter the OTP sent to +91 {phone} and your new password
                            </p>

                            <div className="space-y-2">
                                <Label>OTP</Label>
                                <Input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 5))}
                                    placeholder="Enter 5-digit OTP"
                                    className="text-center text-xl tracking-widest"
                                    maxLength={5}
                                    data-testid="reset-otp-input"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>New Password</Label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter new password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pr-10"
                                        data-testid="reset-password-input"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Confirm Password</Label>
                                <div className="relative">
                                    <Input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="Re-enter new password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pr-10"
                                        data-testid="reset-confirm-password-input"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <Button 
                                onClick={handleResetPassword} 
                                disabled={loading || otp.length < 5 || !password || !confirmPassword}
                                className="w-full btn-primary"
                                data-testid="reset-password-btn"
                            >
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </Button>

                            <div className="text-center">
                                {!canResend ? (
                                    <p className="text-sm text-muted-foreground">
                                        Resend OTP in <span className="font-semibold text-primary">{formatTimer()}</span>
                                    </p>
                                ) : (
                                    <button
                                        onClick={handleForgotPassword}
                                        disabled={loading}
                                        className="text-sm text-primary hover:underline font-medium"
                                    >
                                        Resend OTP
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Profile Step */}
                    {step === 'profile' && (
                        <div className="space-y-4">
                            <p className="text-center text-muted-foreground text-sm">
                                Please provide your details for delivery
                            </p>

                            <div className="space-y-2">
                                <Label htmlFor="name">
                                    <User size={14} className="inline mr-1" />
                                    Your Name *
                                </Label>
                                <Input
                                    id="name"
                                    placeholder="Enter your full name"
                                    value={profileData.name}
                                    onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                                    data-testid="profile-name-input"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">
                                    Email ID (Optional)
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="Enter your email address"
                                    value={profileData.email}
                                    onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                                    data-testid="profile-email-input"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="address">
                                        <MapPin size={14} className="inline mr-1" />
                                        Delivery Address *
                                    </Label>
                                    <button
                                        onClick={handleDetectLocation}
                                        disabled={locating}
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                    >
                                        <Navigation size={12} className={locating ? 'animate-spin' : ''} />
                                        {locating ? 'Detecting...' : 'Use my location'}
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Auto-filled from your location. Search a different one or edit below.
                                </p>
                                <DetectedAddressChip
                                    address={detectedLoc.address}
                                    lat={detectedLoc.lat}
                                    lng={detectedLoc.lng}
                                    onLooksWrong={() => addressSearchRef.current?.focus()}
                                />
                                <AddressSearch
                                    ref={addressSearchRef}
                                    placeholder="Search a different address..."
                                    showCurrentLocation={false}
                                    onSelect={(sel) => {
                                        if (!sel) return;
                                        setProfileData(prev => ({
                                            ...prev,
                                            address: sel.address || prev.address,
                                        }));
                                        setDetectedLoc({
                                            lat: sel.lat,
                                            lng: sel.lng,
                                            address: sel.address,
                                        });
                                    }}
                                />
                                <Textarea
                                    id="address"
                                    placeholder="Edit your full address (House no, Street, Area, City)"
                                    value={profileData.address}
                                    onChange={(e) => setProfileData(prev => ({ ...prev, address: e.target.value }))}
                                    rows={3}
                                    data-testid="profile-address-input"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="landmark">
                                    Landmark (Optional)
                                </Label>
                                <Input
                                    id="landmark"
                                    placeholder="Nearby landmark for easy delivery"
                                    value={profileData.landmark}
                                    onChange={(e) => setProfileData(prev => ({ ...prev, landmark: e.target.value }))}
                                    data-testid="profile-landmark-input"
                                />
                            </div>

                            <Button 
                                onClick={handleSaveProfile} 
                                disabled={loading || !profileData.name || !profileData.address}
                                className="w-full btn-primary"
                                data-testid="save-profile-btn"
                            >
                                {loading ? 'Saving...' : 'Save & Continue'}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default AuthModal;
