import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ADMIN_STORAGE_KEY = 'foodkey_admin';
const ADMIN_PENDING_KEY = 'foodkey_admin_pending';

const AdminContext = createContext(null);

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (!context) {
        throw new Error('useAdmin must be used within AdminProvider');
    }
    return context;
};

// Helper to safely parse JSON from localStorage
const getStoredAdmin = () => {
    try {
        const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Validate that the stored data has essential fields
            if (parsed && parsed.phone && parsed.role === 'admin') {
                return parsed;
            }
        }
    } catch (e) {
        console.error('Error parsing stored admin data:', e);
        localStorage.removeItem(ADMIN_STORAGE_KEY);
    }
    return null;
};

export const AdminProvider = ({ children }) => {
    const [admin, setAdmin] = useState(getStoredAdmin);
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!getStoredAdmin());
    const [requiresPasswordSetup, setRequiresPasswordSetup] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize auth state on mount
    useEffect(() => {
        const storedAdmin = getStoredAdmin();
        if (storedAdmin) {
            setAdmin(storedAdmin);
            setIsAuthenticated(true);
        }
        setIsLoading(false);
    }, []);

    // Persist admin state to localStorage
    useEffect(() => {
        if (admin && admin.phone && admin.role === 'admin') {
            localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(admin));
            setIsAuthenticated(true);
        } else if (admin === null) {
            localStorage.removeItem(ADMIN_STORAGE_KEY);
            setIsAuthenticated(false);
        }
    }, [admin]);

    // Send OTP for admin login
    const sendAdminOTP = async (phone) => {
        try {
            const response = await axios.post(`${API}/api/admin/send-otp`, { phone });
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    };

    // Verify OTP - direct login
    const verifyAdminOTP = async (phone, otp, name = null) => {
        try {
            const response = await axios.post(`${API}/api/admin/verify-otp`, { phone, otp, name });
            // Direct login after OTP verification
            const userData = response.data.user;
            setAdmin(userData);
            setIsAuthenticated(true);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    };

    // Login with password (kept for backwards compatibility)
    const loginWithPassword = async (phone, password) => {
        try {
            const response = await axios.post(`${API}/api/admin/login`, { phone, password });
            const userData = response.data.user;
            setAdmin(userData);
            setIsAuthenticated(true);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    };

    // Logout
    const logout = useCallback(() => {
        setAdmin(null);
        setIsAuthenticated(false);
        setRequiresPasswordSetup(false);
        localStorage.removeItem(ADMIN_STORAGE_KEY);
        localStorage.removeItem(ADMIN_PENDING_KEY);
    }, []);

    // Create new admin (super admin only)
    const createAdmin = async (data) => {
        try {
            const response = await axios.post(`${API}/api/admin/create-admin?creator_phone=${admin.phone}`, data);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    };

    // Delete admin (super admin only)
    const deleteAdmin = async (adminId) => {
        try {
            const response = await axios.delete(`${API}/api/admin/${adminId}?requester_phone=${admin.phone}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    };

    // Get all admins
    const getAdmins = async () => {
        try {
            const response = await axios.get(`${API}/api/admin/list?requester_phone=${admin.phone}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    };

    const value = {
        admin,
        setAdmin,
        isAuthenticated,
        isLoading,
        sendAdminOTP,
        verifyAdminOTP,
        loginWithPassword,
        logout,
        createAdmin,
        deleteAdmin,
        getAdmins,
        API
    };

    return (
        <AdminContext.Provider value={value}>
            {children}
        </AdminContext.Provider>
    );
};

export default AdminContext;
