import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Custom hook for OTP resend functionality with timer
 * @param {Function} sendOtpFn - The function to call to send OTP (e.g., sendOTP, sendAdminOTP)
 * @param {string} phone - The phone number to send OTP to
 * @param {number} cooldownSeconds - Cooldown period in seconds (default: 120)
 * @returns {Object} - { resendTimer, canResend, handleResendOTP, startTimer, formatTimer }
 */
export function useResendOTP(sendOtpFn, phone, cooldownSeconds = 120) {
    const [resendTimer, setResendTimer] = useState(0);
    const [isResending, setIsResending] = useState(false);

    // Countdown timer effect
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    // Start the timer (call after successful OTP send)
    const startTimer = useCallback(() => {
        setResendTimer(cooldownSeconds);
    }, [cooldownSeconds]);

    // Check if resend is allowed
    const canResend = resendTimer === 0;

    // Format timer for display (MM:SS)
    const formatTimer = useCallback(() => {
        const minutes = Math.floor(resendTimer / 60);
        const seconds = resendTimer % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, [resendTimer]);

    // Handle resend OTP
    const handleResendOTP = useCallback(async () => {
        if (!canResend || isResending) return;
        
        if (!phone || phone.length < 10) {
            toast.error('Invalid phone number');
            return;
        }

        setIsResending(true);
        try {
            await sendOtpFn(phone);
            toast.success('OTP resent to your phone!');
            startTimer();
        } catch (error) {
            toast.error(error?.detail || error?.message || 'Failed to resend OTP');
        } finally {
            setIsResending(false);
        }
    }, [canResend, isResending, phone, sendOtpFn, startTimer]);

    return {
        resendTimer,
        canResend,
        isResending,
        handleResendOTP,
        startTimer,
        formatTimer
    };
}

export default useResendOTP;
