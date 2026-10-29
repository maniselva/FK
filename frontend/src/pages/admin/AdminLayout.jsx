import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useAdmin } from '../../contexts/AdminContext';
import { 
    Key, LayoutDashboard, Users, ShoppingBag, Store, Bike, 
    Settings, LogOut, Menu, X, ChevronDown, Bell, Tag, MessageSquare, Shirt, Star, IndianRupee, History, Image, FileText
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

const navItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/orders', label: 'Orders', icon: ShoppingBag },
    { path: '/admin/order-history', label: 'Order History', icon: History },
    { path: '/admin/custom-orders', label: 'Custom Orders', icon: FileText },
    { path: '/admin/restaurants', label: 'Restaurants', icon: Store },
    { path: '/admin/delivery', label: 'Delivery Partners', icon: Bike },
    { path: '/admin/payments', label: 'Payments', icon: IndianRupee },
    { path: '/admin/ratings', label: 'Ratings & Reviews', icon: Star },
    { path: '/admin/promos', label: 'Promos', icon: Tag },
    { path: '/admin/slides', label: 'Promo Slides', icon: Image },
    { path: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
    { path: '/admin/tshirt-orders', label: 'T-Shirt Orders', icon: Shirt },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { admin, isAuthenticated, isLoading, logout } = useAdmin();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        // Only redirect after loading is complete
        if (!isLoading && !isAuthenticated) {
            navigate('/admin/login');
        }
    }, [isAuthenticated, isLoading, navigate]);

    // Show loading state while checking authentication
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading admin panel...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    const isActive = (path, exact = false) => {
        if (exact) return location.pathname === path;
        return location.pathname.startsWith(path);
    };

    return (
        <div className="min-h-screen bg-background flex" data-testid="admin-layout">
            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border 
                transform transition-transform duration-300 lg:translate-x-0
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-border">
                    <Link to="/admin" className="flex items-center gap-2">
                        <Key size={24} className="text-primary transform -rotate-45" />
                        <span className="font-bold text-lg">
                            <span className="text-gradient">Food</span>Key
                        </span>
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Admin</span>
                    </Link>
                    <button 
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden text-muted-foreground hover:text-foreground"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setSidebarOpen(false)}
                            className={`
                                flex items-center gap-3 px-4 py-3 rounded-xl transition-colors
                                ${isActive(item.path, item.exact) 
                                    ? 'bg-primary text-black' 
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                                }
                            `}
                        >
                            <item.icon size={20} />
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                {/* Footer */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
                    <Button 
                        variant="ghost" 
                        onClick={handleLogout}
                        className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
                    >
                        <LogOut size={20} />
                        Logout
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 lg:ml-64">
                {/* Top Bar */}
                <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden text-muted-foreground hover:text-foreground"
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-lg font-semibold hidden sm:block">
                            {navItems.find(item => isActive(item.path, item.exact))?.label || 'Admin'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Notifications */}
                        <Button variant="ghost" size="icon" className="relative">
                            <Bell size={20} />
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white text-xs rounded-full flex items-center justify-center">
                                3
                            </span>
                        </Button>

                        {/* User Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                        <span className="text-primary font-semibold text-sm">
                                            {admin?.name?.charAt(0) || 'A'}
                                        </span>
                                    </div>
                                    <span className="hidden sm:block">{admin?.name || 'Admin'}</span>
                                    <ChevronDown size={16} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <div className="px-2 py-1.5">
                                    <p className="font-medium">{admin?.name}</p>
                                    <p className="text-xs text-muted-foreground">{admin?.phone}</p>
                                    {admin?.is_super_admin && (
                                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded mt-1 inline-block">
                                            Super Admin
                                        </span>
                                    )}
                                </div>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link to="/admin/settings">Settings</Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                                    <LogOut size={16} className="mr-2" />
                                    Logout
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                {/* Page Content */}
                <main className="p-4 lg:p-8">
                    <Outlet />
                </main>
            </div>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
        </div>
    );
}
