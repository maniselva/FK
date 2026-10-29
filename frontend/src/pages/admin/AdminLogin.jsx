import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdmin } from '../../contexts/AdminContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { Shield, Phone, ArrowLeft, Lock, Eye, EyeOff, UserPlus, LogIn } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminLogin() {
    const navigate = useNavigate();
    const { admin, setAdmin } = useAdmin();
    
    // Main modes: 'choose', 'login', 'signup'
    // Login steps: 'phone', 'login_method', 'otp', 'password_login', 'forgot_password', 'forgot_otp', 'reset_password'
    // Signup steps: 'phone', 'otp', 'password_setup'
    const [mode, setMode] = useState('choose');
    const [step, setStep] = useState('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [hasPassword, setHasPassword] = useState(false);
    const [adminCount, setAdminCount] = useState({ current: 0, max: 10, can_signup: true });
    const [timer, setTimer] = useState(0);

    useEffect(() => {
        if (admin) {
            navigate('/admin');
        }
        fetchAdminCount();
    }, [admin, navigate]);

    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => setTimer(t => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const fetchAdminCount = async () => {
        try {
            const response = await axios.get(`${API}/api/admin/count`);
            setAdminCount(response.data);
        } catch (error) {
            console.error('Failed to fetch admin count');
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

    // ========== LOGIN FLOW ==========
    const handleLoginContinue = async () => {
        if (phone.length !== 10) {
            toast.error('Please enter a valid 10-digit phone number');
            return;
        }

        setLoading(true);
        try {
            // Check if admin exists first
            const checkResponse = await axios.get(`${API}/api/admin/check-status/${phone}`);
            if (!checkResponse.data.exists) {
                toast.error('Admin not found. Please sign up first.');
                setLoading(false);
                return;
            }
            // Admin exists - always show login method choice
            setHasPassword(checkResponse.data.has_password);
            setStep('login_method');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Admin not found. Please sign up first.');
        } finally {
            setLoading(false);
        }
    };

    const handleLoginWithOTP = async () => {
        setLoading(true);
        try {
            await axios.post(`${API}/api/admin/send-otp`, { phone });
            toast.success('OTP sent to master phone!');
            setStep('otp');
            setTimer(60);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleLoginVerifyOTP = async () => {
        if (otp.length !== 5) {
            toast.error('Please enter 5-digit OTP');
            return;
        }

        setLoading(true);
        try {
            localStorage.removeItem('foodkey_user');
            const response = await axios.post(`${API}/api/admin/verify-otp`, { phone, otp });
            setAdmin(response.data.user);
            toast.success('Login successful!');
            navigate('/admin');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleLoginWithPassword = async () => {
        if (!password) {
            toast.error('Please enter your password');
            return;
        }

        setLoading(true);
        try {
            localStorage.removeItem('foodkey_user');
            const response = await axios.post(`${API}/api/admin/login`, { phone, password });
            setAdmin(response.data.user);
            toast.success('Login successful!');
            navigate('/admin');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Invalid password');
        } finally {
            setLoading(false);
        }
    };

    // ========== FORGOT PASSWORD FLOW ==========
    const handleForgotPasswordSendOTP = async () => {
        setLoading(true);
        try {
            await axios.post(`${API}/api/admin/forgot-password/send-otp`, { phone });
            toast.success('OTP sent to master phone!');
            setStep('forgot_otp');
            setTimer(60);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotVerifyOTP = async () => {
        if (otp.length !== 5) {
            toast.error('Please enter 5-digit OTP');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API}/api/admin/forgot-password/verify-otp`, { phone, otp });
            toast.success('OTP verified! Set your new password.');
            setStep('reset_password');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API}/api/admin/forgot-password/reset`, { phone, password });
            toast.success('Password reset successfully! Please login.');
            setMode('login');
            setStep('phone');
            setPassword('');
            setConfirmPassword('');
            setOtp('');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    // ========== SIGNUP FLOW ==========
    const handleSignupSendOTP = async () => {
        if (phone.length !== 10) {
            toast.error('Please enter a valid 10-digit phone number');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API}/api/admin/signup/send-otp`, { phone });
            toast.success('OTP sent to master phone!');
            setStep('otp');
            setTimer(60);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleSignupVerifyOTP = async () => {
        if (otp.length !== 5) {
            toast.error('Please enter 5-digit OTP');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API}/api/admin/signup/verify-otp`, { phone, otp });
            toast.success('OTP verified! Set your password.');
            setStep('password_setup');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleSignupSetPassword = async () => {
        if (password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            localStorage.removeItem('foodkey_user');
            const response = await axios.post(`${API}/api/admin/signup/set-password`, { 
                phone, 
                password,
                name: name || undefined
            });
            setAdmin(response.data.user);
            toast.success('Account created successfully!');
            navigate('/admin');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        if (timer > 0) return;
        
        setLoading(true);
        try {
            if (mode === 'signup') {
                await axios.post(`${API}/api/admin/signup/send-otp`, { phone });
            } else if (step === 'forgot_otp') {
                await axios.post(`${API}/api/admin/forgot-password/send-otp`, { phone });
            } else {
                await axios.post(`${API}/api/admin/send-otp`, { phone });
            }
            toast.success('OTP resent to master phone!');
            setTimer(60);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to resend OTP');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setStep('phone');
        setPhone('');
        setOtp('');
        setPassword('');
        setConfirmPassword('');
        setName('');
        setTimer(0);
    };

    // ========== RENDER CHOOSE MODE ==========
    if (mode === 'choose') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-center">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Shield className="w-8 h-8 text-white" />
                            </div>
                            <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
                            <p className="text-orange-100 mt-1">FoodKey Management System</p>
                        </div>
                        
                        <div className="p-8 space-y-4">
                            <Button
                                onClick={() => { setMode('login'); resetForm(); }}
                                className="w-full h-14 text-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                                data-testid="admin-login-btn"
                            >
                                <LogIn className="w-5 h-5 mr-2" />
                                Login
                            </Button>
                            
                            <Button
                                onClick={() => { setMode('signup'); resetForm(); }}
                                variant="outline"
                                className="w-full h-14 text-lg border-2"
                                disabled={!adminCount.can_signup}
                                data-testid="admin-signup-btn"
                            >
                                <UserPlus className="w-5 h-5 mr-2" />
                                Sign Up
                            </Button>
                            
                            <p className="text-center text-sm text-muted-foreground">
                                {adminCount.current}/{adminCount.max} admin slots used
                            </p>
                            
                            <div className="pt-4 border-t">
                                <Link 
                                    to="/" 
                                    className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                                >
                                    <ArrowLeft size={16} className="mr-2" />
                                    Back to Food Key
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ========== RENDER LOGIN MODE ==========
    if (mode === 'login') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-center">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Shield className="w-8 h-8 text-white" />
                            </div>
                            <h1 className="text-2xl font-bold text-white">Admin Login</h1>
                            <p className="text-orange-100 mt-1">FoodKey Management System</p>
                        </div>
                        
                        <div className="p-8">
                            <button
                                onClick={() => setMode('choose')}
                                className="flex items-center text-muted-foreground hover:text-foreground mb-6"
                            >
                                <ArrowLeft size={16} className="mr-2" />
                                Back
                            </button>

                            {/* Phone Entry Step */}
                            {step === 'phone' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-xl font-semibold">Welcome Back</h2>
                                        <p className="text-muted-foreground">Enter your admin phone number</p>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label>Phone Number</Label>
                                        <div className="flex">
                                            <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-input bg-muted text-muted-foreground">
                                                +91
                                            </span>
                                            <Input
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                placeholder="Enter phone number"
                                                className="rounded-l-none"
                                                maxLength={10}
                                                data-testid="admin-phone-input"
                                            />
                                        </div>
                                    </div>
                                    
                                    <Button 
                                        onClick={handleLoginContinue} 
                                        className="w-full btn-primary"
                                        disabled={loading || phone.length !== 10}
                                        data-testid="admin-continue-btn"
                                    >
                                        {loading ? 'Please wait...' : 'Continue'}
                                    </Button>
                                </div>
                            )}

                            {/* Login Method Selection */}
                            {step === 'login_method' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-xl font-semibold">Choose Login Method</h2>
                                        <p className="text-muted-foreground">How would you like to login?</p>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <Button
                                            onClick={() => setStep('password_login')}
                                            variant="outline"
                                            className="w-full h-14 justify-start px-4"
                                            data-testid="login-with-password-btn"
                                        >
                                            <Lock className="w-5 h-5 mr-3" />
                                            <div className="text-left">
                                                <p className="font-medium">Login with Password</p>
                                                <p className="text-xs text-muted-foreground">Use your saved password</p>
                                            </div>
                                        </Button>
                                        
                                        <Button
                                            onClick={handleLoginWithOTP}
                                            className="w-full h-14 justify-start px-4 bg-green-500 hover:bg-green-600"
                                            disabled={loading}
                                            data-testid="login-with-otp-btn"
                                        >
                                            <Phone className="w-5 h-5 mr-3" />
                                            <div className="text-left">
                                                <p className="font-medium">Login with OTP</p>
                                                <p className="text-xs text-green-100">OTP sent to master phone</p>
                                            </div>
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Password Login */}
                            {step === 'password_login' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-xl font-semibold">Login with Password</h2>
                                        <p className="text-muted-foreground">Enter password for +91 {phone}</p>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label>Password</Label>
                                        <div className="relative">
                                            <Input
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Enter your password"
                                                data-testid="admin-password-input"
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
                                        onClick={handleLoginWithPassword} 
                                        className="w-full btn-primary"
                                        disabled={loading || !password}
                                        data-testid="admin-login-submit-btn"
                                    >
                                        {loading ? 'Logging in...' : 'Login'}
                                    </Button>
                                    
                                    <button
                                        onClick={() => { setStep('forgot_password'); setOtp(''); }}
                                        className="w-full text-center text-sm text-orange-500 hover:underline"
                                    >
                                        Forgot Password?
                                    </button>
                                </div>
                            )}

                            {/* OTP Verification for Login */}
                            {step === 'otp' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-xl font-semibold">Enter OTP</h2>
                                        <p className="text-muted-foreground">OTP sent to master phone (******2970)</p>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label>OTP Code</Label>
                                        <Input
                                            type="text"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 5))}
                                            placeholder="Enter 5-digit OTP"
                                            className="text-center text-2xl tracking-widest"
                                            maxLength={5}
                                            data-testid="admin-otp-input"
                                        />
                                    </div>
                                    
                                    <Button 
                                        onClick={handleLoginVerifyOTP} 
                                        className="w-full btn-primary"
                                        disabled={loading || otp.length !== 5}
                                        data-testid="admin-verify-otp-btn"
                                    >
                                        {loading ? 'Verifying...' : 'Verify & Login'}
                                    </Button>
                                    
                                    <button
                                        onClick={handleResendOTP}
                                        disabled={timer > 0 || loading}
                                        className="w-full text-center text-sm text-muted-foreground hover:text-primary disabled:opacity-50"
                                    >
                                        {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
                                    </button>
                                </div>
                            )}

                            {/* Forgot Password - Send OTP */}
                            {step === 'forgot_password' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-xl font-semibold">Forgot Password</h2>
                                        <p className="text-muted-foreground">We'll send OTP to master phone</p>
                                    </div>
                                    
                                    <Button 
                                        onClick={handleForgotPasswordSendOTP} 
                                        className="w-full btn-primary"
                                        disabled={loading}
                                    >
                                        {loading ? 'Sending...' : 'Send OTP'}
                                    </Button>
                                    
                                    <button
                                        onClick={() => setStep('password_login')}
                                        className="w-full text-center text-sm text-muted-foreground hover:text-primary"
                                    >
                                        Back to Login
                                    </button>
                                </div>
                            )}

                            {/* Forgot Password - Verify OTP */}
                            {step === 'forgot_otp' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-xl font-semibold">Enter OTP</h2>
                                        <p className="text-muted-foreground">OTP sent to master phone (******2970)</p>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label>OTP Code</Label>
                                        <Input
                                            type="text"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 5))}
                                            placeholder="Enter 5-digit OTP"
                                            className="text-center text-2xl tracking-widest"
                                            maxLength={5}
                                        />
                                    </div>
                                    
                                    <Button 
                                        onClick={handleForgotVerifyOTP} 
                                        className="w-full btn-primary"
                                        disabled={loading || otp.length !== 5}
                                    >
                                        {loading ? 'Verifying...' : 'Verify OTP'}
                                    </Button>
                                    
                                    <button
                                        onClick={handleResendOTP}
                                        disabled={timer > 0 || loading}
                                        className="w-full text-center text-sm text-muted-foreground hover:text-primary disabled:opacity-50"
                                    >
                                        {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
                                    </button>
                                </div>
                            )}

                            {/* Reset Password */}
                            {step === 'reset_password' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-xl font-semibold">Set New Password</h2>
                                        <p className="text-muted-foreground">Minimum 8 characters required</p>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>New Password</Label>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="Enter new password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                                >
                                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">{password.length}/8 characters</p>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label>Confirm Password</Label>
                                            <div className="relative">
                                                <Input
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder="Re-enter password"
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
                                    </div>
                                    
                                    <Button 
                                        onClick={handleResetPassword} 
                                        className="w-full btn-primary"
                                        disabled={loading || password.length < 8 || password !== confirmPassword}
                                    >
                                        {loading ? 'Resetting...' : 'Reset Password'}
                                    </Button>
                                </div>
                            )}

                            <div className="pt-4 border-t mt-6">
                                <Link 
                                    to="/" 
                                    className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                                >
                                    <ArrowLeft size={16} className="mr-2" />
                                    Back to Food Key
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ========== RENDER SIGNUP MODE ==========
    if (mode === 'signup') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-8 text-center">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <UserPlus className="w-8 h-8 text-white" />
                            </div>
                            <h1 className="text-2xl font-bold text-white">Admin Sign Up</h1>
                            <p className="text-green-100 mt-1">{adminCount.current}/{adminCount.max} slots used</p>
                        </div>
                        
                        <div className="p-8">
                            <button
                                onClick={() => setMode('choose')}
                                className="flex items-center text-muted-foreground hover:text-foreground mb-6"
                            >
                                <ArrowLeft size={16} className="mr-2" />
                                Back
                            </button>

                            {/* Phone Entry Step */}
                            {step === 'phone' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-xl font-semibold">Create Admin Account</h2>
                                        <p className="text-muted-foreground">Enter your phone number to get started</p>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label>Phone Number</Label>
                                        <div className="flex">
                                            <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-input bg-muted text-muted-foreground">
                                                +91
                                            </span>
                                            <Input
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                placeholder="Enter phone number"
                                                className="rounded-l-none"
                                                maxLength={10}
                                                data-testid="signup-phone-input"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <p className="text-sm text-amber-800">
                                            <strong>Note:</strong> OTP will be sent to master phone (******2970) for verification.
                                        </p>
                                    </div>
                                    
                                    <Button 
                                        onClick={handleSignupSendOTP} 
                                        className="w-full bg-green-500 hover:bg-green-600"
                                        disabled={loading || phone.length !== 10}
                                        data-testid="signup-send-otp-btn"
                                    >
                                        {loading ? 'Sending OTP...' : 'Send OTP'}
                                    </Button>
                                </div>
                            )}

                            {/* OTP Verification */}
                            {step === 'otp' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-xl font-semibold">Enter OTP</h2>
                                        <p className="text-muted-foreground">OTP sent to master phone (******2970)</p>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label>OTP Code</Label>
                                        <Input
                                            type="text"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 5))}
                                            placeholder="Enter 5-digit OTP"
                                            className="text-center text-2xl tracking-widest"
                                            maxLength={5}
                                            data-testid="signup-otp-input"
                                        />
                                    </div>
                                    
                                    <Button 
                                        onClick={handleSignupVerifyOTP} 
                                        className="w-full bg-green-500 hover:bg-green-600"
                                        disabled={loading || otp.length !== 5}
                                        data-testid="signup-verify-otp-btn"
                                    >
                                        {loading ? 'Verifying...' : 'Verify OTP'}
                                    </Button>
                                    
                                    <button
                                        onClick={handleResendOTP}
                                        disabled={timer > 0 || loading}
                                        className="w-full text-center text-sm text-muted-foreground hover:text-primary disabled:opacity-50"
                                    >
                                        {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
                                    </button>
                                </div>
                            )}

                            {/* Password Setup */}
                            {step === 'password_setup' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-xl font-semibold">Set Your Password</h2>
                                        <p className="text-muted-foreground">Minimum 8 characters required</p>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Your Name (Optional)</Label>
                                            <Input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="Enter your name"
                                            />
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label>Password</Label>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="Create a password"
                                                    data-testid="signup-password-input"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                                >
                                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">{password.length}/8 characters</p>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label>Confirm Password</Label>
                                            <div className="relative">
                                                <Input
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder="Re-enter password"
                                                    data-testid="signup-confirm-password-input"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                                >
                                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                            {confirmPassword && password !== confirmPassword && (
                                                <p className="text-xs text-red-500">Passwords do not match</p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <Button 
                                        onClick={handleSignupSetPassword} 
                                        className="w-full bg-green-500 hover:bg-green-600"
                                        disabled={loading || password.length < 8 || password !== confirmPassword}
                                        data-testid="signup-complete-btn"
                                    >
                                        {loading ? 'Creating Account...' : 'Create Account'}
                                    </Button>
                                </div>
                            )}

                            <div className="pt-4 border-t mt-6">
                                <Link 
                                    to="/" 
                                    className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                                >
                                    <ArrowLeft size={16} className="mr-2" />
                                    Back to Food Key
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
