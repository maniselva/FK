import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { ChefHat, ArrowLeft, Lock, Eye, EyeOff, Phone, KeyRound, MapPin, Mail, FileText, Upload, CheckCircle, Clock, Image, Navigation, Loader2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import AddressSearch from '../components/AddressSearch';
import DetectedAddressChip from '../components/DetectedAddressChip';
import axios from 'axios';
import { useResendOTP } from '../hooks/useResendOTP';

const API = process.env.REACT_APP_BACKEND_URL;

// Indian states list
const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
    'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli and Daman and Diu', 'Lakshadweep'
];

// Validate FSSAI licence number
const validateFssaiNumber = (value) => {
    if (!value || value.length < 14) return { valid: false, message: 'FSSAI licence must be 14 digits' };
    const allSame = /^(\d)\1+$/.test(value);
    if (allSame) return { valid: false, message: 'Invalid licence - cannot be all same digits' };
    return { valid: true, message: '' };
};

export default function RestaurantPartnerLogin() {
    const navigate = useNavigate();
    const { sendOTP, verifyOTP, setUser, logout, detectLocation } = useApp();
    const [step, setStep] = useState('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [existingSession, setExistingSession] = useState(null);
    const [detectingLocation, setDetectingLocation] = useState(false);
    
    // Password fields
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [hasPassword, setHasPassword] = useState(false);
    const [needsDetails, setNeedsDetails] = useState(false);
    
    const { canResend, isResending, handleResendOTP, startTimer, formatTimer } = useResendOTP(sendOTP, phone);
    
    // Restaurant details - unified form
    const [restaurantData, setRestaurantData] = useState({
        // Restaurant details (Restaurant Name is the username)
        restaurantName: '',
        restaurantImage: '',
        ownedBy: '',
        ownerEmail: '',
        description: '',
        cuisines: '',
        // Location
        address: '',
        state: '',
        pincode: '',
        city: '',
        lat: null,
        lng: null,
        // FSSAI
        fssaiNumber: '',
        // Timings & Pricing
        openingTime: '09:00',
        closingTime: '22:00',
        priceForTwo: 300,
        isVeg: false
    });
    const [fssaiError, setFssaiError] = useState('');
    const [fetchingCity, setFetchingCity] = useState(false);
    
    // File upload
    const fileInputRef = useRef(null);
    const [fssaiFile, setFssaiFile] = useState(null);

    // Check for existing session
    const checkExistingSession = () => {
        const customerUser = localStorage.getItem('foodkey_user');
        const adminUser = localStorage.getItem('foodkey_admin');
        
        if (customerUser) {
            try {
                const user = JSON.parse(customerUser);
                if (user.role === 'customer' || (!user.role && !user.fssai_licence && !user.driving_licence)) {
                    return { type: 'customer', user };
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
        proceedWithLogin();
    };

    const proceedWithLogin = async () => {
        if (phone.length < 10) {
            toast.error('Please enter a valid phone number');
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
        
        const session = checkExistingSession();
        if (session) {
            setExistingSession(session);
            setStep('session_conflict');
            return;
        }
        
        await proceedWithLogin();
    };

    const handleSendOTP = async () => {
        if (phone.length < 10) {
            toast.error('Please enter a valid phone number');
            return;
        }
        setLoading(true);
        try {
            await sendOTP(phone);
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
        if (otp.length < 5) {
            toast.error('Please enter a valid 5-digit OTP');
            return;
        }
        setLoading(true);
        try {
            const response = await verifyOTP(phone, otp, 'restaurant');
            
            const user = response.user;
            user.role = 'restaurant';
            localStorage.removeItem('foodkey_admin');
            
            // Check if user already has a restaurant
            const dashboardResponse = await axios.get(`${API}/api/dashboard/restaurant/${user.id}`);
            
            if (dashboardResponse.data.restaurant) {
                // Existing restaurant owner - go to dashboard
                toast.success('Welcome back!');
                navigate('/dashboard/restaurant');
                return;
            }
            
            // New user or user without restaurant - needs details
            setNeedsDetails(true);
            
            if (!user?.is_password_set) {
                setStep('password_setup');
                toast.success('OTP verified! Please set a password for easier login');
            } else {
                setStep('details');
                toast.success('OTP verified! Please complete your restaurant registration');
            }
        } catch (error) {
            if (error.response?.status === 404) {
                // No restaurant found - proceed to registration
                setNeedsDetails(true);
                const userStr = localStorage.getItem('foodkey_user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    if (!user?.is_password_set) {
                        setStep('password_setup');
                        toast.success('OTP verified! Please set a password for easier login');
                    } else {
                        setStep('details');
                        toast.success('OTP verified! Please complete your restaurant registration');
                    }
                } else {
                    setStep('details');
                }
            } else {
                toast.error(error.detail || 'Invalid OTP');
            }
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
                role: 'restaurant'
            });
            toast.success('Password set successfully!');
            setStep('details');
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
            const response = await axios.post(`${API}/api/auth/login-password`, {
                phone,
                password,
                role: 'restaurant'
            });
            
            const userData = response.data.user;
            userData.role = 'restaurant';
            localStorage.removeItem('foodkey_admin');
            localStorage.setItem('foodkey_user', JSON.stringify(userData));
            setUser(userData);
            
            // Check if user has a restaurant
            try {
                const dashboardResponse = await axios.get(`${API}/api/dashboard/restaurant/${userData.id}`);
                if (dashboardResponse.data.restaurant) {
                    toast.success('Login successful!');
                    navigate('/dashboard/restaurant');
                    return;
                }
            } catch {}
            
            // No restaurant - go to details
            setNeedsDetails(true);
            setStep('details');
            toast.success('Please complete your restaurant registration');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Invalid password');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        setLoading(true);
        try {
            await axios.post(`${API}/api/auth/forgot-password`, { phone, role: 'restaurant' });
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
                phone, otp, new_password: password, confirm_password: confirmPassword, role: 'restaurant'
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

    const handleFssaiChange = (e) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 14);
        setRestaurantData(prev => ({ ...prev, fssaiNumber: value }));
        if (value.length === 14) {
            const validation = validateFssaiNumber(value);
            setFssaiError(validation.valid ? '' : validation.message);
        } else {
            setFssaiError('');
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error('File size must be less than 2MB');
            return;
        }
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Only JPEG, PNG, and PDF files are allowed');
            return;
        }
        setFssaiFile(file);
        toast.success('FSSAI certificate selected');
    };

    const fetchCityFromPincode = async (pin) => {
        if (pin.length !== 6) return;
        setFetchingCity(true);
        try {
            const response = await axios.get(`https://api.postalpincode.in/pincode/${pin}`);
            if (response.data && response.data[0]?.Status === 'Success' && response.data[0]?.PostOffice?.length > 0) {
                const postOffice = response.data[0].PostOffice[0];
                setRestaurantData(prev => ({
                    ...prev,
                    city: postOffice.District || postOffice.Division || '',
                    state: postOffice.State || prev.state
                }));
                toast.success(`City found: ${postOffice.District || postOffice.Division}`);
            } else {
                toast.error('Could not find city for this pincode');
            }
        } catch (error) {
            toast.error('Failed to fetch city. Please enter manually.');
        } finally {
            setFetchingCity(false);
        }
    };

    const handleDetectLocation = async () => {
        setDetectingLocation(true);
        try {
            const loc = await detectLocation();
            if (loc && loc.lat && loc.lng) {
                setRestaurantData(prev => ({
                    ...prev,
                    lat: loc.lat,
                    lng: loc.lng,
                    address: loc.address && !loc.address.startsWith('Lat:') ? loc.address : prev.address
                }));
                toast.success('📍 Location detected!');
            }
        } catch (error) {
            toast.error('Failed to detect location. Please enable GPS or enter address manually.');
        } finally {
            setDetectingLocation(false);
        }
    };

    // Auto-detect location once when user enters the details step
    const [autoDetectedOnDetails, setAutoDetectedOnDetails] = useState(false);
    const restaurantAddressSearchRef = useRef(null);
    useEffect(() => {
        if (step === 'details' && !autoDetectedOnDetails && !restaurantData.address) {
            setAutoDetectedOnDetails(true);
            handleDetectLocation();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    const handleRegister = async () => {
        // Validation
        if (!restaurantData.restaurantName.trim()) {
            toast.error('Please enter restaurant name');
            return;
        }
        if (!restaurantData.address.trim()) {
            toast.error('Please enter restaurant address');
            return;
        }
        if (!restaurantData.state) {
            toast.error('Please select a state');
            return;
        }
        if (!restaurantData.pincode || restaurantData.pincode.length !== 6) {
            toast.error('Please enter a valid 6-digit pincode');
            return;
        }
        if (restaurantData.fssaiNumber && restaurantData.fssaiNumber.length !== 14) {
            toast.error('Please enter valid 14-digit FSSAI licence number or leave empty');
            return;
        }
        if (restaurantData.fssaiNumber) {
            const validation = validateFssaiNumber(restaurantData.fssaiNumber);
            if (!validation.valid) {
                toast.error(validation.message);
                return;
            }
        }
        
        setLoading(true);
        try {
            const userStr = localStorage.getItem('foodkey_user');
            if (!userStr) {
                toast.error('Please login again');
                setStep('phone');
                return;
            }
            
            const user = JSON.parse(userStr);
            
            // Update user profile - Restaurant Name is the username
            await axios.put(`${API}/api/users/${user.id}`, {
                name: restaurantData.restaurantName,
                email: restaurantData.ownerEmail,
                role: 'restaurant'
            });
            
            // Create restaurant
            const restaurantPayload = {
                name: restaurantData.restaurantName,
                image: restaurantData.restaurantImage || '',
                cover_image: restaurantData.restaurantImage || '',
                owned_by: restaurantData.ownedBy || '',
                owner_email: restaurantData.ownerEmail || '',
                description: restaurantData.description,
                cuisine: restaurantData.cuisines.split(',').map(c => c.trim()).filter(c => c),
                address: restaurantData.address,
                state: restaurantData.state,
                pincode: restaurantData.pincode,
                city: restaurantData.city,
                lat: restaurantData.lat,
                lng: restaurantData.lng,
                fssai_number: restaurantData.fssaiNumber || null,
                opening_time: restaurantData.openingTime,
                closing_time: restaurantData.closingTime,
                price_for_two: restaurantData.priceForTwo,
                is_veg: restaurantData.isVeg,
                phone: phone
            };
            
            await axios.post(`${API}/api/restaurants?owner_id=${user.id}`, restaurantPayload);
            
            // Upload FSSAI certificate if provided
            if (fssaiFile) {
                const formData = new FormData();
                formData.append('file', fssaiFile);
                formData.append('user_id', user.id);
                await axios.post(`${API}/api/upload/fssai`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            
            // Update local storage - Restaurant Name is username
            user.name = restaurantData.restaurantName;
            user.email = restaurantData.ownerEmail;
            user.role = 'restaurant';
            localStorage.setItem('foodkey_user', JSON.stringify(user));
            setUser(user);
            
            toast.success('Registration submitted! Awaiting admin approval.');
            navigate('/dashboard/restaurant/pending');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to register restaurant');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="flex justify-center mb-4">
                            <Logo size="default" />
                        </div>
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <ChefHat className="text-orange-500" size={28} />
                            <h1 className="text-2xl font-bold text-gray-800">Restaurant Partner</h1>
                        </div>
                        <p className="text-gray-600 text-sm">
                            {step === 'details' ? 'Complete your restaurant registration' : 'Login or register your restaurant'}
                        </p>
                    </div>

                    {/* Phone Step */}
                    {step === 'phone' && (
                        <div className="space-y-6">
                            <div>
                                <Label className="text-gray-700 font-medium">Phone Number</Label>
                                <div className="flex gap-2 mt-1">
                                    <div className="flex items-center px-3 bg-gray-100 rounded-lg text-gray-600 font-medium">+91</div>
                                    <Input
                                        type="tel"
                                        placeholder="Enter your phone number"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        className="flex-1"
                                        data-testid="restaurant-phone-input"
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={handleContinue}
                                disabled={loading || phone.length < 10}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12"
                                data-testid="restaurant-continue-btn"
                            >
                                {loading ? 'Please wait...' : 'Continue'}
                            </Button>
                        </div>
                    )}

                    {/* Session Conflict */}
                    {step === 'session_conflict' && existingSession && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-semibold">Active Session Found</h2>
                                <p className="text-gray-500 mt-2">You're currently logged in as a <span className="font-semibold text-orange-600">{existingSession.type}</span>.</p>
                            </div>
                            <div className="space-y-3">
                                <Button onClick={handleLogoutAndContinue} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12">
                                    Logout & Continue as Restaurant
                                </Button>
                                <Button onClick={() => { setStep('phone'); setExistingSession(null); }} variant="outline" className="w-full h-12">
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Login Method Selection */}
                    {step === 'login_method' && (
                        <div className="space-y-6">
                            <button onClick={() => setStep('phone')} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
                                <ArrowLeft size={16} /> Change number
                            </button>
                            <div className="text-center">
                                <h2 className="text-lg font-semibold">Choose Login Method</h2>
                            </div>
                            <div className="space-y-3">
                                <Button onClick={() => setStep('password_login')} variant="outline" className="w-full h-14 justify-start gap-3">
                                    <Lock className="text-orange-500" size={20} />
                                    <div className="text-left">
                                        <p className="font-medium">Login with Password</p>
                                        <p className="text-xs text-gray-500">Use your saved password</p>
                                    </div>
                                </Button>
                                <Button onClick={handleSendOTP} variant="outline" className="w-full h-14 justify-start gap-3" disabled={loading}>
                                    <Phone className="text-blue-500" size={20} />
                                    <div className="text-left">
                                        <p className="font-medium">{loading ? 'Sending OTP...' : 'Login with OTP'}</p>
                                        <p className="text-xs text-gray-500">Get OTP on +91 {phone}</p>
                                    </div>
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Password Login */}
                    {step === 'password_login' && (
                        <div className="space-y-6">
                            <button onClick={() => setStep('login_method')} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
                                <ArrowLeft size={16} /> Back
                            </button>
                            <div className="text-center">
                                <h2 className="text-lg font-semibold">Login with Password</h2>
                                <p className="text-gray-500 text-sm">Enter password for +91 {phone}</p>
                            </div>
                            <div>
                                <Label className="text-gray-700 font-medium">Password</Label>
                                <div className="relative mt-1">
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pr-10"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <Button onClick={handlePasswordLogin} disabled={loading || !password} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12">
                                {loading ? 'Logging in...' : 'Login'}
                            </Button>
                            <div className="text-center">
                                <button onClick={handleForgotPassword} disabled={loading} className="text-sm text-orange-500 hover:underline">
                                    Forgot Password?
                                </button>
                            </div>
                        </div>
                    )}

                    {/* OTP Step */}
                    {step === 'otp' && (
                        <div className="space-y-6">
                            <button onClick={() => setStep('phone')} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
                                <ArrowLeft size={16} /> Back
                            </button>
                            <div>
                                <Label className="text-gray-700 font-medium">Enter OTP</Label>
                                <Input
                                    type="text"
                                    placeholder="Enter 5-digit OTP"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 5))}
                                    className="mt-1 text-center text-2xl tracking-widest"
                                    data-testid="restaurant-otp-input"
                                />
                            </div>
                            <Button onClick={handleVerifyOTP} disabled={loading || otp.length < 5} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12" data-testid="restaurant-verify-otp-btn">
                                {loading ? 'Verifying...' : 'Verify OTP'}
                            </Button>
                            <div className="text-center">
                                {!canResend ? (
                                    <p className="text-sm text-gray-500">Resend OTP in <span className="font-semibold text-orange-500">{formatTimer()}</span></p>
                                ) : (
                                    <button onClick={handleResendOTP} disabled={loading || isResending} className="text-sm text-orange-500 hover:underline font-medium">
                                        {isResending ? 'Sending...' : 'Resend OTP'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Password Setup */}
                    {step === 'password_setup' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <KeyRound className="mx-auto text-orange-500 mb-2" size={32} />
                                <h2 className="text-lg font-semibold">Set Your Password</h2>
                                <p className="text-gray-500 text-sm">Set a password for easier login next time</p>
                            </div>
                            <div>
                                <Label className="text-gray-700 font-medium">Password</Label>
                                <div className="relative mt-1">
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter password (min 8 chars, 1 number)"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pr-10"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <Label className="text-gray-700 font-medium">Confirm Password</Label>
                                <div className="relative mt-1">
                                    <Input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="Re-enter password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pr-10"
                                    />
                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <Button onClick={handleSetPassword} disabled={loading || !password || !confirmPassword} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12">
                                {loading ? 'Setting password...' : 'Set Password & Continue'}
                            </Button>
                            <button onClick={() => setStep('details')} className="w-full text-sm text-gray-500 hover:text-gray-700">
                                Skip for now
                            </button>
                        </div>
                    )}

                    {/* Reset Password */}
                    {step === 'reset_password' && (
                        <div className="space-y-6">
                            <button onClick={() => setStep('password_login')} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
                                <ArrowLeft size={16} /> Back to login
                            </button>
                            <div className="text-center">
                                <h2 className="text-lg font-semibold">Reset Password</h2>
                            </div>
                            <div>
                                <Label className="text-gray-700 font-medium">OTP</Label>
                                <Input type="text" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="Enter 5-digit OTP" className="mt-1 text-center text-xl tracking-widest" />
                            </div>
                            <div>
                                <Label className="text-gray-700 font-medium">New Password</Label>
                                <div className="relative mt-1">
                                    <Input type={showPassword ? 'text' : 'password'} placeholder="Enter new password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <Label className="text-gray-700 font-medium">Confirm Password</Label>
                                <div className="relative mt-1">
                                    <Input type={showConfirmPassword ? 'text' : 'password'} placeholder="Re-enter new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pr-10" />
                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <Button onClick={handleResetPassword} disabled={loading || otp.length < 5 || !password || !confirmPassword} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12">
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </Button>
                        </div>
                    )}

                    {/* Restaurant Details - Unified Registration Form */}
                    {step === 'details' && (
                        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
                            <button onClick={() => setStep('phone')} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
                                <ArrowLeft size={16} /> Back
                            </button>
                            
                            <div className="text-center mb-4">
                                <h2 className="text-lg font-semibold text-gray-800">Restaurant Registration</h2>
                                <p className="text-sm text-gray-500">Fill all details to register your restaurant</p>
                            </div>

                            {/* Restaurant Details Section - Restaurant Name at top */}
                            <div className="p-4 bg-orange-50 rounded-xl space-y-3">
                                <h3 className="font-medium text-orange-800 flex items-center gap-2">
                                    <ChefHat size={16} />
                                    Restaurant Details
                                </h3>
                                <div>
                                    <Label className="text-gray-700 text-sm">Restaurant Name * (This will be your username)</Label>
                                    <Input
                                        placeholder="Enter restaurant name"
                                        value={restaurantData.restaurantName}
                                        onChange={(e) => setRestaurantData(prev => ({ ...prev, restaurantName: e.target.value }))}
                                        className="mt-1"
                                        data-testid="restaurant-name-input"
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-700 text-sm">Restaurant Image URL</Label>
                                    <Input
                                        type="url"
                                        placeholder="https://... (Restaurant profile image)"
                                        value={restaurantData.restaurantImage}
                                        onChange={(e) => setRestaurantData(prev => ({ ...prev, restaurantImage: e.target.value }))}
                                        className="mt-1"
                                    />
                                    {restaurantData.restaurantImage && (
                                        <img src={restaurantData.restaurantImage} alt="Preview" className="mt-2 h-20 w-32 object-cover rounded" />
                                    )}
                                </div>
                                <div>
                                    <Label className="text-gray-700 text-sm">Owned By</Label>
                                    <Input
                                        placeholder="Owner/Proprietor name"
                                        value={restaurantData.ownedBy}
                                        onChange={(e) => setRestaurantData(prev => ({ ...prev, ownedBy: e.target.value }))}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-700 text-sm">Email</Label>
                                    <Input
                                        type="email"
                                        placeholder="Enter email address"
                                        value={restaurantData.ownerEmail}
                                        onChange={(e) => setRestaurantData(prev => ({ ...prev, ownerEmail: e.target.value }))}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-700 text-sm">Phone Number</Label>
                                    <Input value={`+91 ${phone}`} disabled className="mt-1 bg-gray-100" />
                                </div>
                                <div>
                                    <Label className="text-gray-700 text-sm">Description</Label>
                                    <Textarea
                                        placeholder="Tell customers about your restaurant"
                                        value={restaurantData.description}
                                        onChange={(e) => setRestaurantData(prev => ({ ...prev, description: e.target.value }))}
                                        className="mt-1"
                                        rows={2}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-700 text-sm">Cuisines (comma separated)</Label>
                                    <Input
                                        placeholder="e.g., Indian, Chinese, Italian"
                                        value={restaurantData.cuisines}
                                        onChange={(e) => setRestaurantData(prev => ({ ...prev, cuisines: e.target.value }))}
                                        className="mt-1"
                                    />
                                </div>
                            </div>

                            {/* Location Section */}
                            <div className="p-4 bg-blue-50 rounded-xl space-y-3">
                                <h3 className="font-medium text-blue-800 flex items-center gap-2">
                                    <MapPin size={16} />
                                    Location
                                </h3>
                                
                                {/* Detect Location Button */}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleDetectLocation}
                                    disabled={detectingLocation}
                                    className="w-full bg-white border-blue-300 text-blue-700 hover:bg-blue-100"
                                    data-testid="detect-location-btn"
                                >
                                    {detectingLocation ? (
                                        <>
                                            <Loader2 size={16} className="mr-2 animate-spin" />
                                            Detecting Location...
                                        </>
                                    ) : (
                                        <>
                                            <Navigation size={16} className="mr-2" />
                                            Detect My Location (GPS)
                                        </>
                                    )}
                                </Button>
                                
                                {/* Show detected coordinates */}
                                {restaurantData.lat && restaurantData.lng && (
                                    <div className="p-2 bg-green-100 border border-green-300 rounded-lg text-sm text-green-700 flex items-center gap-2">
                                        <CheckCircle size={16} />
                                        Location pinned on map
                                    </div>
                                )}
                                
                                <div>
                                    <Label className="text-gray-700 text-sm">Full Address *</Label>
                                    <p className="text-xs text-gray-500 mb-1">Auto-filled from your location. You can search for a different address or edit.</p>
                                    <DetectedAddressChip
                                        address={restaurantData.address}
                                        lat={restaurantData.lat}
                                        lng={restaurantData.lng}
                                        onLooksWrong={() => restaurantAddressSearchRef.current?.focus()}
                                    />
                                    <AddressSearch
                                        ref={restaurantAddressSearchRef}
                                        key={`addr-${restaurantData.address?.slice(0, 20)}`}
                                        placeholder="Search a different address..."
                                        showCurrentLocation={false}
                                        onSelect={(sel) => {
                                            if (!sel) return;
                                            setRestaurantData(prev => ({
                                                ...prev,
                                                address: sel.address || prev.address,
                                                lat: sel.lat ?? prev.lat,
                                                lng: sel.lng ?? prev.lng,
                                            }));
                                        }}
                                    />
                                    <Textarea
                                        placeholder="Edit the complete restaurant address with landmarks..."
                                        value={restaurantData.address}
                                        onChange={(e) => setRestaurantData(prev => ({ ...prev, address: e.target.value }))}
                                        className="mt-2"
                                        rows={2}
                                        data-testid="restaurant-address"
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-700 text-sm">State *</Label>
                                    <Select value={restaurantData.state} onValueChange={(value) => setRestaurantData(prev => ({ ...prev, state: value }))}>
                                        <SelectTrigger className="mt-1">
                                            <SelectValue placeholder="Select state" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60">
                                            {INDIAN_STATES.map(state => (
                                                <SelectItem key={state} value={state}>{state}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-gray-700 text-sm">Pincode *</Label>
                                        <Input
                                            placeholder="6-digit"
                                            value={restaurantData.pincode}
                                            onChange={(e) => {
                                                const pin = e.target.value.replace(/\D/g, '').slice(0, 6);
                                                setRestaurantData(prev => ({ ...prev, pincode: pin }));
                                                if (pin.length === 6) fetchCityFromPincode(pin);
                                            }}
                                            className="mt-1"
                                            maxLength={6}
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-gray-700 text-sm">City</Label>
                                        <Input
                                            placeholder="Auto-populated"
                                            value={fetchingCity ? 'Loading...' : restaurantData.city}
                                            onChange={(e) => setRestaurantData(prev => ({ ...prev, city: e.target.value }))}
                                            className="mt-1"
                                            disabled={fetchingCity}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* FSSAI Section */}
                            <div className="p-4 bg-green-50 rounded-xl space-y-3">
                                <h3 className="font-medium text-green-800 flex items-center gap-2">
                                    <FileText size={16} />
                                    FSSAI Details
                                </h3>
                                <div>
                                    <Label className="text-gray-700 text-sm">FSSAI Licence Number</Label>
                                    <Input
                                        placeholder="14-digit licence number (optional)"
                                        value={restaurantData.fssaiNumber}
                                        onChange={handleFssaiChange}
                                        className={`mt-1 ${fssaiError ? 'border-red-500' : ''}`}
                                        maxLength={14}
                                    />
                                    {fssaiError && <p className="text-sm text-red-500 mt-1">{fssaiError}</p>}
                                </div>
                                <div>
                                    <Label className="text-gray-700 text-sm">FSSAI Certificate Upload</Label>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept=".jpg,.jpeg,.png,.pdf"
                                        className="hidden"
                                    />
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`mt-1 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                                            fssaiFile ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-orange-500'
                                        }`}
                                    >
                                        {fssaiFile ? (
                                            <div className="flex items-center justify-center gap-2 text-green-600">
                                                <CheckCircle size={18} />
                                                <span className="text-sm">{fssaiFile.name}</span>
                                            </div>
                                        ) : (
                                            <div className="text-gray-500">
                                                <Upload size={20} className="mx-auto mb-1" />
                                                <p className="text-sm">Click to upload (JPG, PNG, PDF)</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Timings & Pricing Section */}
                            <div className="p-4 bg-purple-50 rounded-xl space-y-3">
                                <h3 className="font-medium text-purple-800 flex items-center gap-2">
                                    <Clock size={16} />
                                    Timings & Pricing
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-gray-700 text-sm">Opening Time</Label>
                                        <Input
                                            type="time"
                                            value={restaurantData.openingTime}
                                            onChange={(e) => setRestaurantData(prev => ({ ...prev, openingTime: e.target.value }))}
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-gray-700 text-sm">Closing Time</Label>
                                        <Input
                                            type="time"
                                            value={restaurantData.closingTime}
                                            onChange={(e) => setRestaurantData(prev => ({ ...prev, closingTime: e.target.value }))}
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-gray-700 text-sm">Price for Two (₹)</Label>
                                    <Input
                                        type="number"
                                        value={restaurantData.priceForTwo}
                                        onChange={(e) => setRestaurantData(prev => ({ ...prev, priceForTwo: parseInt(e.target.value) || 0 }))}
                                        className="mt-1"
                                    />
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                    <span className="text-sm text-gray-700">Pure Vegetarian Restaurant</span>
                                    <Switch
                                        checked={restaurantData.isVeg}
                                        onCheckedChange={(checked) => setRestaurantData(prev => ({ ...prev, isVeg: checked }))}
                                    />
                                </div>
                            </div>

                            {/* Submit Notice */}
                            <div className="p-3 bg-amber-100 border border-amber-300 rounded-lg">
                                <p className="text-sm text-amber-700 flex items-center gap-2">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    Your restaurant will be reviewed by admin before going live
                                </p>
                            </div>

                            <Button
                                onClick={handleRegister}
                                disabled={loading || !restaurantData.restaurantName || !restaurantData.address || !restaurantData.state || restaurantData.pincode.length !== 6}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12"
                                data-testid="restaurant-register-btn"
                            >
                                {loading ? 'Registering...' : 'Submit for Approval'}
                            </Button>
                        </div>
                    )}

                    {/* Footer Links */}
                    {step !== 'details' && (
                        <div className="mt-8 pt-6 border-t border-gray-200 text-center space-y-2">
                            <Link to="/" className="text-sm text-gray-600 hover:text-orange-500">
                                ← Back to Home
                            </Link>
                            <p className="text-sm text-gray-500">
                                Want to deliver?{' '}
                                <Link to="/partner/delivery" className="text-orange-500 hover:underline font-medium">
                                    Become a delivery partner
                                </Link>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
