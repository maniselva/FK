import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Bike, ArrowLeft, CreditCard, Upload, CheckCircle, Lock, Eye, EyeOff, Phone, KeyRound, Mail, MapPin, Loader2, Navigation } from 'lucide-react';
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

// Validate licence number
const validateLicenceNumber = (value) => {
    if (!value || value.length < 15) return { valid: false, message: 'Driving licence must be 15 characters' };
    const cleanValue = value.replace(/\s/g, '').toUpperCase();
    const allSame = /^(.)\1+$/.test(cleanValue);
    if (allSame) return { valid: false, message: 'Invalid licence - cannot be all same characters' };
    const consecutivePattern = /(.)\1{5,}/;
    if (consecutivePattern.test(cleanValue)) {
        return { valid: false, message: 'Invalid licence - too many consecutive same characters' };
    }
    const numericPart = cleanValue.replace(/\D/g, '');
    if (numericPart.length >= 6) {
        const sequential = '0123456789012345';
        const reverseSeq = '9876543210987654';
        if (sequential.includes(numericPart.slice(0, 6)) || reverseSeq.includes(numericPart.slice(0, 6))) {
            return { valid: false, message: 'Invalid licence - cannot be sequential digits' };
        }
    }
    const dlPattern = /^[A-Z]{2}\d{2}\d{4}\d{7}$/;
    if (!dlPattern.test(cleanValue)) {
        return { valid: false, message: 'Invalid format. Use: SS00 0000 0000000 (State code + Year + Number)' };
    }
    return { valid: true, message: '' };
};

export default function DeliveryPartnerLogin() {
    const navigate = useNavigate();
    const { sendOTP, verifyOTP, setUser, logout, detectLocation } = useApp();
    // Steps: phone, login_method, otp, password_login, password_setup, forgot_password, reset_password, details, session_conflict
    const [step, setStep] = useState('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState('');
    const [existingSession, setExistingSession] = useState(null);
    
    // Password fields
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [hasPassword, setHasPassword] = useState(false);
    const [needsDetails, setNeedsDetails] = useState(false);
    
    const { canResend, isResending, handleResendOTP, startTimer, formatTimer } = useResendOTP(sendOTP, phone);
    
    // Delivery partner details
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [addressLat, setAddressLat] = useState(null);
    const [addressLng, setAddressLng] = useState(null);
    const [detectingAddress, setDetectingAddress] = useState(false);
    const [autoDetected, setAutoDetected] = useState(false);
    const [state, setState] = useState('');
    const [pincode, setPincode] = useState('');
    const [city, setCity] = useState('');
    const [fetchingCity, setFetchingCity] = useState(false);
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [vehicleType, setVehicleType] = useState('bike');
    const [drivingLicence, setDrivingLicence] = useState('');
    const [licenceError, setLicenceError] = useState('');
    
    // File upload
    const fileInputRef = useRef(null);
    const [licenceFile, setLicenceFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Ref to focus AddressSearch when user clicks "Looks wrong?"
    const deliveryAddressSearchRef = useRef(null);

    // Auto-detect delivery partner's address when they reach the details step.
    const detectMyAddress = async () => {
        setDetectingAddress(true);
        try {
            const loc = await detectLocation();
            if (loc && loc.lat && loc.lng) {
                setAddressLat(loc.lat);
                setAddressLng(loc.lng);
                if (loc.address && !loc.address.startsWith('Lat:')) {
                    setAddress(loc.address);
                }
                toast.success('📍 Address detected!');
            }
        } catch (err) {
            toast.error('Could not detect location. Please enter address manually.');
        } finally {
            setDetectingAddress(false);
        }
    };

    useEffect(() => {
        if (step === 'details' && !autoDetected && !address) {
            setAutoDetected(true);
            detectMyAddress();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    // Fetch city from pincode
    const fetchCityFromPincode = async (pin) => {
        if (pin.length !== 6) return;
        setFetchingCity(true);
        try {
            const response = await axios.get(`https://api.postalpincode.in/pincode/${pin}`);
            if (response.data && response.data[0]?.Status === 'Success' && response.data[0]?.PostOffice?.length > 0) {
                const postOffice = response.data[0].PostOffice[0];
                setCity(postOffice.District || postOffice.Division || '');
                if (postOffice.State) {
                    setState(postOffice.State);
                }
                toast.success(`City found: ${postOffice.District || postOffice.Division}`);
            } else {
                toast.error('Could not find city for this pincode');
            }
        } catch (error) {
            console.error('Error fetching city:', error);
            toast.error('Failed to fetch city. Please enter manually.');
        } finally {
            setFetchingCity(false);
        }
    };

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
                if (user.fssai_licence || user.role === 'restaurant') {
                    return { type: 'restaurant', user };
                }
            } catch {}
        }
        if (adminUser) {
            return { type: 'admin', user: JSON.parse(adminUser) };
        }
        return null;
    };

    const handleLogoutAndContinue = () => {
        // Clear all sessions
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
        setLicenceFile(file);
        toast.success('Driving licence document selected');
    };

    const uploadLicenceFile = async (userId) => {
        if (!licenceFile) return null;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', licenceFile);
            formData.append('user_id', userId);
            const response = await axios.post(`${API}/api/upload/licence`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data.file_url || response.data.url || null;
        } catch (error) {
            console.error('Failed to upload licence:', error);
            return null;
        } finally {
            setUploading(false);
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
        
        // Check for existing session
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
            const response = await verifyOTP(phone, otp, 'delivery');
            setUserId(response.user?.id);
            
            const user = response.user;
            // Ensure role is set to delivery
            user.role = 'delivery';
            // Clear admin session when logging in as delivery partner
            localStorage.removeItem('foodkey_admin');
            
            const needsDeliveryDetails = response.is_new || !user.driving_licence;
            setNeedsDetails(needsDeliveryDetails);
            
            // Check if user has password set
            if (!user?.is_password_set) {
                setStep('password_setup');
                toast.success('OTP verified! Please set a password for easier login');
            } else if (needsDeliveryDetails) {
                setStep('details');
                toast.success('OTP verified! Please complete registration');
            } else {
                toast.success('Login successful!');
                navigate('/dashboard/delivery');
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
                role: 'delivery'
            });
            toast.success('Password set successfully!');
            
            if (needsDetails) {
                setStep('details');
            } else {
                navigate('/dashboard/delivery');
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
            const response = await axios.post(`${API}/api/auth/login-password`, {
                phone,
                password,
                role: 'delivery'
            });
            
            const userData = response.data.user;
            // Ensure role is set to delivery
            userData.role = 'delivery';
            // Clear admin session when logging in as delivery partner
            localStorage.removeItem('foodkey_admin');
            localStorage.setItem('foodkey_user', JSON.stringify(userData));
            setUser(userData);
            
            // Check if user needs to complete delivery partner details
            if (!userData.driving_licence) {
                setNeedsDetails(true);
                setStep('details');
                toast.success('Please complete your delivery partner registration');
            } else {
                toast.success('Login successful!');
                navigate('/dashboard/delivery');
            }
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
                role: 'delivery'
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
                role: 'delivery'
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

    const handleLicenceChange = (e) => {
        const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
        setDrivingLicence(value);
        if (value.length === 15) {
            const validation = validateLicenceNumber(value);
            setLicenceError(validation.valid ? '' : validation.message);
        } else {
            setLicenceError('');
        }
    };

    const handleRegister = async () => {
        if (!name.trim()) {
            toast.error('Please enter your full name');
            return;
        }
        if (!address.trim()) {
            toast.error('Please enter your address');
            return;
        }
        if (!state) {
            toast.error('Please select a state');
            return;
        }
        if (!pincode || pincode.length !== 6) {
            toast.error('Please enter a valid 6-digit pincode');
            return;
        }
        if (!vehicleNumber.trim()) {
            toast.error('Please enter vehicle number');
            return;
        }
        // Make driving license mandatory
        if (!drivingLicence || drivingLicence.length !== 15) {
            toast.error('Please enter a valid 15-character driving licence number');
            return;
        }
        const licenceValidation = validateLicenceNumber(drivingLicence);
        if (!licenceValidation.valid) {
            toast.error(licenceValidation.message);
            return;
        }
        if (!licenceFile) {
            toast.error('Please upload your driving licence document');
            return;
        }
        
        setLoading(true);
        try {
            const userStr = localStorage.getItem('foodkey_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                
                // Upload licence file first
                const licenceImageUrl = await uploadLicenceFile(user.id);
                
                await axios.put(`${API}/api/users/${user.id}`, {
                    name: name,
                    email: email,
                    address: address,
                    state: state,
                    pincode: pincode,
                    city: city,
                    vehicle_number: vehicleNumber,
                    vehicle_type: vehicleType,
                    driving_licence: drivingLicence,
                    license_image: licenceImageUrl,
                    role: 'delivery'
                });
                
                user.name = name;
                user.email = email;
                user.address = address;
                user.state = state;
                user.pincode = pincode;
                user.city = city;
                user.vehicle_number = vehicleNumber;
                user.vehicle_type = vehicleType;
                user.driving_licence = drivingLicence;
                user.license_image = licenceImageUrl;
                localStorage.setItem('foodkey_user', JSON.stringify(user));
                setUser(user);
            }
            
            toast.success('Registration submitted! Awaiting admin approval.');
            navigate('/dashboard/delivery/pending');
        } catch (error) {
            if (error.response?.data?.detail?.includes('already registered')) {
                toast.error(error.response.data.detail);
            } else {
                toast.error('Failed to save details');
            }
        } finally {
            setLoading(false);
        }
    };

    const formatLicence = (value) => {
        const clean = value.replace(/\s/g, '');
        if (clean.length <= 4) return clean;
        if (clean.length <= 8) return `${clean.slice(0, 4)} ${clean.slice(4)}`;
        return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8)}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <Logo size="default" />
                        </div>
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <Bike className="text-green-500" size={28} />
                            <h1 className="text-2xl font-bold text-gray-800">Delivery Partner</h1>
                        </div>
                        <p className="text-gray-600">
                            {step === 'details' ? 'Complete your registration' : 'Login or register as delivery partner'}
                        </p>
                    </div>

                    {/* Phone Step */}
                    {step === 'phone' && (
                        <div className="space-y-6">
                            <div>
                                <Label htmlFor="phone" className="text-gray-700 font-medium">Phone Number</Label>
                                <div className="flex gap-2 mt-1">
                                    <div className="flex items-center px-3 bg-gray-100 rounded-lg text-gray-600 font-medium">
                                        +91
                                    </div>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="Enter your phone number"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        className="flex-1"
                                        data-testid="delivery-phone-input"
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={handleContinue}
                                disabled={loading || phone.length < 10}
                                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold h-12"
                                data-testid="delivery-continue-btn"
                            >
                                {loading ? 'Please wait...' : 'Continue'}
                            </Button>
                        </div>
                    )}

                    {/* Session Conflict Step */}
                    {step === 'session_conflict' && existingSession && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-semibold text-gray-800">Active Session Found</h2>
                                <p className="text-gray-500 mt-2">
                                    You're currently logged in as a <span className="font-semibold text-green-600">{existingSession.type}</span>.
                                </p>
                                <p className="text-gray-500 text-sm mt-1">
                                    To login as a Delivery Partner, you need to logout from the current session.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <Button 
                                    onClick={handleLogoutAndContinue}
                                    className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold h-12"
                                    data-testid="logout-and-continue-btn"
                                >
                                    Logout & Continue as Delivery Partner
                                </Button>
                                <Button 
                                    onClick={() => {
                                        setStep('phone');
                                        setExistingSession(null);
                                    }}
                                    variant="outline"
                                    className="w-full h-12"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Login Method Selection */}
                    {step === 'login_method' && (
                        <div className="space-y-6">
                            <button
                                onClick={() => setStep('phone')}
                                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
                            >
                                <ArrowLeft size={16} />
                                Change number
                            </button>

                            <div className="text-center">
                                <h2 className="text-lg font-semibold text-gray-800">Choose Login Method</h2>
                                <p className="text-gray-500 text-sm">How would you like to login?</p>
                            </div>

                            <div className="space-y-3">
                                <Button 
                                    onClick={() => setStep('password_login')}
                                    variant="outline"
                                    className="w-full h-14 justify-start gap-3"
                                    data-testid="delivery-login-password-btn"
                                >
                                    <Lock className="text-green-500" size={20} />
                                    <div className="text-left">
                                        <p className="font-medium">Login with Password</p>
                                        <p className="text-xs text-gray-500">Use your saved password</p>
                                    </div>
                                </Button>

                                <Button 
                                    onClick={handleSendOTP}
                                    variant="outline"
                                    className="w-full h-14 justify-start gap-3"
                                    disabled={loading}
                                    data-testid="delivery-login-otp-btn"
                                >
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
                            <button
                                onClick={() => setStep('login_method')}
                                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>

                            <div className="text-center">
                                <h2 className="text-lg font-semibold text-gray-800">Login with Password</h2>
                                <p className="text-gray-500 text-sm">Enter password for +91 {phone}</p>
                            </div>

                            <div>
                                <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
                                <div className="relative mt-1">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pr-10"
                                        data-testid="delivery-password-input"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <Button 
                                onClick={handlePasswordLogin} 
                                disabled={loading || !password}
                                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold h-12"
                                data-testid="delivery-login-btn"
                            >
                                {loading ? 'Logging in...' : 'Login'}
                            </Button>

                            <div className="text-center">
                                <button
                                    onClick={handleForgotPassword}
                                    disabled={loading}
                                    className="text-sm text-green-500 hover:underline"
                                    data-testid="delivery-forgot-password-btn"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        </div>
                    )}

                    {/* OTP Step */}
                    {step === 'otp' && (
                        <div className="space-y-6">
                            <button
                                onClick={() => setStep('phone')}
                                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>
                            <div>
                                <Label htmlFor="otp" className="text-gray-700 font-medium">Enter OTP</Label>
                                <Input
                                    id="otp"
                                    type="text"
                                    placeholder="Enter 5-digit OTP"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 5))}
                                    className="mt-1 text-center text-2xl tracking-widest"
                                    data-testid="delivery-otp-input"
                                />
                            </div>
                            <Button
                                onClick={handleVerifyOTP}
                                disabled={loading || otp.length < 5}
                                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold h-12"
                                data-testid="delivery-verify-otp-btn"
                            >
                                {loading ? 'Verifying...' : 'Verify OTP'}
                            </Button>
                            
                            <div className="text-center">
                                {!canResend ? (
                                    <p className="text-sm text-gray-500">
                                        Resend OTP in <span className="font-semibold text-green-500">{formatTimer()}</span>
                                    </p>
                                ) : (
                                    <button
                                        onClick={handleResendOTP}
                                        disabled={loading || isResending}
                                        className="text-sm text-green-500 hover:underline font-medium"
                                        data-testid="delivery-resend-otp-btn"
                                    >
                                        {isResending ? 'Sending...' : 'Resend OTP'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Password Setup Step */}
                    {step === 'password_setup' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <KeyRound className="mx-auto text-green-500 mb-2" size={32} />
                                <h2 className="text-lg font-semibold text-gray-800">Set Your Password</h2>
                                <p className="text-gray-500 text-sm">Set a password for easier login next time</p>
                            </div>

                            <div>
                                <Label htmlFor="new-password" className="text-gray-700 font-medium">Password</Label>
                                <div className="relative mt-1">
                                    <Input
                                        id="new-password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter password (min 8 chars, 1 number)"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pr-10"
                                        data-testid="delivery-new-password-input"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="confirm-password" className="text-gray-700 font-medium">Confirm Password</Label>
                                <div className="relative mt-1">
                                    <Input
                                        id="confirm-password"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="Re-enter password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pr-10"
                                        data-testid="delivery-confirm-password-input"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <Button 
                                onClick={handleSetPassword} 
                                disabled={loading || !password || !confirmPassword}
                                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold h-12"
                                data-testid="delivery-set-password-btn"
                            >
                                {loading ? 'Setting password...' : 'Set Password & Continue'}
                            </Button>

                            <button
                                onClick={() => needsDetails ? setStep('details') : navigate('/dashboard/delivery')}
                                className="w-full text-sm text-gray-500 hover:text-gray-700"
                            >
                                Skip for now
                            </button>
                        </div>
                    )}

                    {/* Reset Password Step */}
                    {step === 'reset_password' && (
                        <div className="space-y-6">
                            <button
                                onClick={() => setStep('password_login')}
                                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
                            >
                                <ArrowLeft size={16} />
                                Back to login
                            </button>

                            <div className="text-center">
                                <h2 className="text-lg font-semibold text-gray-800">Reset Password</h2>
                                <p className="text-gray-500 text-sm">Enter OTP and new password</p>
                            </div>

                            <div>
                                <Label className="text-gray-700 font-medium">OTP</Label>
                                <Input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 5))}
                                    placeholder="Enter 5-digit OTP"
                                    className="mt-1 text-center text-xl tracking-widest"
                                    data-testid="delivery-reset-otp-input"
                                />
                            </div>

                            <div>
                                <Label className="text-gray-700 font-medium">New Password</Label>
                                <div className="relative mt-1">
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter new password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pr-10"
                                        data-testid="delivery-reset-password-input"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <Label className="text-gray-700 font-medium">Confirm Password</Label>
                                <div className="relative mt-1">
                                    <Input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="Re-enter new password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pr-10"
                                        data-testid="delivery-reset-confirm-password-input"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <Button 
                                onClick={handleResetPassword} 
                                disabled={loading || otp.length < 5 || !password || !confirmPassword}
                                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold h-12"
                                data-testid="delivery-reset-password-btn"
                            >
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </Button>

                            <div className="text-center">
                                {!canResend ? (
                                    <p className="text-sm text-gray-500">
                                        Resend OTP in <span className="font-semibold text-green-500">{formatTimer()}</span>
                                    </p>
                                ) : (
                                    <button
                                        onClick={handleForgotPassword}
                                        disabled={loading}
                                        className="text-sm text-green-500 hover:underline font-medium"
                                    >
                                        Resend OTP
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Details Step */}
                    {step === 'details' && (
                        <div className="space-y-5">
                            <button
                                onClick={() => setStep('phone')}
                                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>
                            
                            <div className="text-center mb-4">
                                <h2 className="text-lg font-semibold text-gray-800">Delivery Partner Registration</h2>
                                <p className="text-sm text-gray-500">Please provide your information</p>
                            </div>

                            {/* Name Field - At the top */}
                            <div>
                                <Label className="text-gray-700 font-medium">Full Name *</Label>
                                <Input
                                    type="text"
                                    placeholder="Enter your full name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="mt-1"
                                    data-testid="delivery-name-input"
                                />
                            </div>

                            <div>
                                <Label className="text-gray-700 font-medium flex items-center gap-2">
                                    <Mail size={16} />
                                    Email
                                </Label>
                                <Input
                                    type="email"
                                    placeholder="Enter your email (optional)"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="mt-1"
                                    data-testid="delivery-email-input"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between">
                                    <Label className="text-gray-700 font-medium flex items-center gap-2">
                                        <MapPin size={16} />
                                        Address *
                                    </Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={detectMyAddress}
                                        disabled={detectingAddress}
                                        className="text-orange-600 hover:text-orange-700 h-7 px-2"
                                    >
                                        {detectingAddress ? (
                                            <><Loader2 size={14} className="mr-1 animate-spin" />Detecting…</>
                                        ) : (
                                            <><Navigation size={14} className="mr-1" />Use current location</>
                                        )}
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500 mb-1">
                                    {addressLat && addressLng
                                        ? 'Auto-filled from your location. You can search or edit below.'
                                        : 'Search for your address or edit manually.'}
                                </p>
                                <DetectedAddressChip
                                    address={address}
                                    lat={addressLat}
                                    lng={addressLng}
                                    onLooksWrong={() => deliveryAddressSearchRef.current?.focus()}
                                />
                                <AddressSearch
                                    ref={deliveryAddressSearchRef}
                                    placeholder="Search a different address..."
                                    showCurrentLocation={false}
                                    onSelect={(sel) => {
                                        if (!sel) return;
                                        setAddress(sel.address || '');
                                        if (sel.lat) setAddressLat(sel.lat);
                                        if (sel.lng) setAddressLng(sel.lng);
                                    }}
                                />
                                <Textarea
                                    placeholder="Edit your full address..."
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    className="mt-2"
                                    rows={2}
                                    data-testid="delivery-address-input"
                                />
                            </div>

                            <div>
                                <Label className="text-gray-700 font-medium">State *</Label>
                                <Select value={state} onValueChange={setState}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Select state" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60">
                                        {INDIAN_STATES.map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-gray-700 font-medium">Pincode *</Label>
                                    <Input
                                        type="text"
                                        placeholder="6-digit pincode"
                                        value={pincode}
                                        onChange={(e) => {
                                            const pin = e.target.value.replace(/\D/g, '').slice(0, 6);
                                            setPincode(pin);
                                            if (pin.length === 6) {
                                                fetchCityFromPincode(pin);
                                            }
                                        }}
                                        className="mt-1"
                                        maxLength={6}
                                        data-testid="delivery-pincode-input"
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-700 font-medium">City</Label>
                                    <Input
                                        type="text"
                                        placeholder="Auto-populated"
                                        value={fetchingCity ? 'Loading...' : city}
                                        onChange={(e) => setCity(e.target.value)}
                                        className="mt-1"
                                        disabled={fetchingCity}
                                        data-testid="delivery-city-input"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label className="text-gray-700 font-medium">Vehicle Number *</Label>
                                <Input
                                    type="text"
                                    placeholder="e.g., DL-01-AB-1234"
                                    value={vehicleNumber}
                                    onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                                    className="mt-1"
                                    data-testid="delivery-vehicle-input"
                                />
                            </div>

                            <div>
                                <Label className="text-gray-700 font-medium">Vehicle Type</Label>
                                <Select value={vehicleType} onValueChange={setVehicleType}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bike">Bike</SelectItem>
                                        <SelectItem value="scooter">Scooter</SelectItem>
                                        <SelectItem value="bicycle">Bicycle</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-gray-700 font-medium flex items-center gap-2">
                                    <CreditCard size={16} />
                                    Driving License Number *
                                </Label>
                                <Input
                                    type="text"
                                    placeholder="e.g., DL01 2020 0001234"
                                    value={formatLicence(drivingLicence)}
                                    onChange={handleLicenceChange}
                                    className={`mt-1 uppercase tracking-wider ${licenceError ? 'border-red-500' : ''}`}
                                    data-testid="driving-licence-input"
                                />
                                {licenceError && (
                                    <p className="text-sm text-red-500 mt-1">{licenceError}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">Format: State Code + Year + 7-digit Number (e.g., DL01 2020 0001234)</p>
                            </div>

                            {/* Driving License Upload */}
                            <div>
                                <Label className="text-gray-700 font-medium flex items-center gap-2">
                                    <Upload size={16} />
                                    Upload Driving License *
                                </Label>
                                <div 
                                    className={`mt-2 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                                        licenceFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400'
                                    }`}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        data-testid="licence-file-input"
                                    />
                                    {licenceFile ? (
                                        <div className="flex items-center justify-center gap-2 text-green-600">
                                            <CheckCircle size={20} />
                                            <span className="font-medium">{licenceFile.name}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                                            <p className="text-sm text-gray-600">Click to upload licence image</p>
                                            <p className="text-xs text-gray-400 mt-1">JPEG, PNG or PDF (max 2MB)</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-sm text-amber-700 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    Your registration will be reviewed by admin before you can start delivering
                                </p>
                            </div>

                            <Button
                                onClick={handleRegister}
                                disabled={loading || uploading || !name.trim() || !address.trim() || !state || pincode.length !== 6 || !vehicleNumber.trim() || drivingLicence.length !== 15 || !licenceFile}
                                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold h-12"
                                data-testid="delivery-register-btn"
                            >
                                {loading || uploading ? 'Submitting...' : 'Submit for Approval'}
                            </Button>
                        </div>
                    )}

                    {/* Footer Links */}
                    <div className="mt-8 pt-6 border-t border-gray-200 text-center space-y-2">
                        <Link to="/" className="text-sm text-gray-600 hover:text-green-500">
                            ← Back to Home
                        </Link>
                        <p className="text-sm text-gray-500">
                            Own a restaurant?{' '}
                            <Link to="/partner/restaurant" className="text-green-500 hover:underline font-medium">
                                Register here
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
