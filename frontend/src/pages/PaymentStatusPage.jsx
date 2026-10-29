import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, RefreshCw, ArrowLeft, Home, Package } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useApp } from '../contexts/AppContext';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PaymentStatusPage() {
    const { orderId: paramOrderId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { clearCart } = useApp();
    const [status, setStatus] = useState('checking');
    const [paymentData, setPaymentData] = useState(null);
    const [checking, setChecking] = useState(true);
    
    // Get order ID from params or query string
    const orderId = paramOrderId || searchParams.get('order_id');

    useEffect(() => {
        if (orderId) {
            checkPaymentStatus();
        } else {
            setStatus('error');
            setChecking(false);
        }
    }, [orderId]);

    const checkPaymentStatus = async () => {
        setChecking(true);
        try {
            const response = await axios.get(`${API}/payments/cashfree/status/${orderId}`);
            setPaymentData(response.data);
            
            if (response.data.payment_status === 'paid') {
                setStatus('success');
                clearCart();
            } else if (response.data.payment_status === 'failed') {
                setStatus('failed');
            } else {
                setStatus('pending');
            }
        } catch (error) {
            console.error('Error checking payment status:', error);
            setStatus('error');
        } finally {
            setChecking(false);
        }
    };

    const renderContent = () => {
        switch (status) {
            case 'checking':
                return (
                    <div className="text-center" data-testid="payment-checking">
                        <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-6">
                            <RefreshCw size={40} className="text-blue-500 animate-spin" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Verifying Payment</h1>
                        <p className="text-muted-foreground">Please wait while we confirm your payment...</p>
                    </div>
                );
            
            case 'success':
                return (
                    <div className="text-center" data-testid="payment-success">
                        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                            <CheckCircle size={40} className="text-green-500" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2 text-green-500">Payment Successful!</h1>
                        <p className="text-muted-foreground mb-2">
                            {paymentData?.is_custom_order 
                                ? 'Your custom order payment has been received.' 
                                : 'Your order has been confirmed.'}
                        </p>
                        {paymentData && (
                            <div className="mb-6">
                                <p className="text-2xl font-bold text-green-500">₹{paymentData.amount}</p>
                                {paymentData.cf_order_id && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Transaction ID: {paymentData.cf_order_id}
                                    </p>
                                )}
                                {paymentData.breakdown && (
                                    <div className="text-sm text-muted-foreground mt-2 space-y-1">
                                        <p>Food: ₹{paymentData.breakdown.food_total}</p>
                                        <p>Delivery: ₹{paymentData.breakdown.delivery_fee}</p>
                                        {paymentData.breakdown.cod_fee > 0 && <p>COD Fee: ₹{paymentData.breakdown.cod_fee}</p>}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            {paymentData?.is_custom_order ? (
                                <Link to="/orders">
                                    <Button className="btn-primary w-full sm:w-auto" data-testid="view-orders-btn">
                                        <Package size={18} className="mr-2" />
                                        View My Orders
                                    </Button>
                                </Link>
                            ) : (
                                <Link to={`/track/${orderId}`}>
                                    <Button className="btn-primary w-full sm:w-auto" data-testid="track-order-btn">
                                        <Package size={18} className="mr-2" />
                                        Track Order
                                    </Button>
                                </Link>
                            )}
                            <Link to="/">
                                <Button variant="outline" className="w-full sm:w-auto">
                                    <Home size={18} className="mr-2" />
                                    Go Home
                                </Button>
                            </Link>
                        </div>
                    </div>
                );
            
            case 'failed':
                return (
                    <div className="text-center" data-testid="payment-failed">
                        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                            <XCircle size={40} className="text-red-500" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2 text-red-500">Payment Failed</h1>
                        <p className="text-muted-foreground mb-6">
                            Unfortunately, your payment could not be processed. Please try again.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button onClick={checkPaymentStatus} variant="outline" disabled={checking}>
                                <RefreshCw size={18} className={`mr-2 ${checking ? 'animate-spin' : ''}`} />
                                Retry Check
                            </Button>
                            <Link to="/cart">
                                <Button className="btn-primary w-full sm:w-auto">
                                    <ArrowLeft size={18} className="mr-2" />
                                    Back to Cart
                                </Button>
                            </Link>
                        </div>
                    </div>
                );
            
            case 'pending':
                return (
                    <div className="text-center" data-testid="payment-pending">
                        <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
                            <Clock size={40} className="text-yellow-500" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2 text-yellow-500">Payment Pending</h1>
                        <p className="text-muted-foreground mb-6">
                            Your payment is being processed. This may take a few moments.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button onClick={checkPaymentStatus} disabled={checking}>
                                <RefreshCw size={18} className={`mr-2 ${checking ? 'animate-spin' : ''}`} />
                                {checking ? 'Checking...' : 'Check Again'}
                            </Button>
                            <Link to="/">
                                <Button variant="outline">
                                    <Home size={18} className="mr-2" />
                                    Go Home
                                </Button>
                            </Link>
                        </div>
                        <p className="text-xs text-muted-foreground mt-4">
                            You will receive a notification once payment is confirmed.
                        </p>
                    </div>
                );
            
            case 'error':
                return (
                    <div className="text-center" data-testid="payment-error">
                        <div className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-6">
                            <XCircle size={40} className="text-orange-500" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2 text-orange-500">Something Went Wrong</h1>
                        <p className="text-muted-foreground mb-6">
                            We couldn't verify your payment status. Please contact support if the issue persists.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button onClick={checkPaymentStatus} disabled={checking}>
                                <RefreshCw size={18} className={`mr-2 ${checking ? 'animate-spin' : ''}`} />
                                Try Again
                            </Button>
                            <Link to="/">
                                <Button variant="outline">
                                    <Home size={18} className="mr-2" />
                                    Go Home
                                </Button>
                            </Link>
                        </div>
                    </div>
                );
            
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-16" data-testid="payment-status-page">
            <div className="max-w-md w-full bg-card rounded-2xl border border-border p-8 shadow-lg">
                {renderContent()}
                
                {/* Order Details */}
                {paymentData && status !== 'checking' && (
                    <div className="mt-8 pt-6 border-t border-border">
                        <h3 className="text-sm font-medium text-muted-foreground mb-3">Order Details</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Order ID</span>
                                <span className="font-mono">{orderId}</span>
                            </div>
                            {paymentData.transaction_id && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Transaction ID</span>
                                    <span className="font-mono text-xs">{paymentData.transaction_id}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Payment Method</span>
                                <span>Cashfree</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Status</span>
                                <span className={`capitalize ${
                                    paymentData.payment_status === 'paid' ? 'text-green-500' :
                                    paymentData.payment_status === 'failed' ? 'text-red-500' :
                                    'text-yellow-500'
                                }`}>
                                    {paymentData.payment_status}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
