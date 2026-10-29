import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Users, ShoppingBag, Store, IndianRupee, TrendingUp, 
    Clock, CheckCircle, XCircle, Bike, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import { format } from 'date-fns';

export default function AdminDashboard() {
    const { API } = useAdmin();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await axios.get(`${API}/admin/dashboard/stats`);
            setStats(response.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton h-32 rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    const statCards = [
        {
            title: 'Total Revenue',
            value: `₹${stats?.revenue?.total?.toLocaleString() || 0}`,
            change: stats?.revenue?.this_week || 0,
            changeLabel: 'This week',
            icon: IndianRupee,
            color: 'text-green-400',
            bgColor: 'bg-green-500/20'
        },
        {
            title: 'Total Orders',
            value: stats?.orders?.total || 0,
            change: stats?.today?.orders || 0,
            changeLabel: 'Today',
            icon: ShoppingBag,
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/20'
        },
        {
            title: 'Total Users',
            value: stats?.users?.total || 0,
            change: stats?.users?.customers || 0,
            changeLabel: 'Customers',
            icon: Users,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/20'
        },
        {
            title: 'Restaurants',
            value: stats?.restaurants?.total || 0,
            change: stats?.restaurants?.active || 0,
            changeLabel: 'Active',
            icon: Store,
            color: 'text-orange-400',
            bgColor: 'bg-orange-500/20'
        }
    ];

    const orderStatusCards = [
        { label: 'Pending', value: stats?.orders?.pending || 0, color: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
        { label: 'Active', value: stats?.orders?.active || 0, color: 'bg-blue-500/20 text-blue-400', icon: TrendingUp },
        { label: 'Delivered', value: stats?.orders?.delivered || 0, color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
        { label: 'Cancelled', value: stats?.orders?.cancelled || 0, color: 'bg-red-500/20 text-red-400', icon: XCircle }
    ];

    return (
        <div className="space-y-8" data-testid="admin-dashboard">
            <div>
                <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
                <p className="text-muted-foreground">Overview of Food Key performance</p>
            </div>

            {/* Main Stats */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((card, idx) => (
                    <div key={idx} className="stat-card">
                        <div className="flex items-start justify-between">
                            <div className={`w-12 h-12 rounded-xl ${card.bgColor} flex items-center justify-center`}>
                                <card.icon size={24} className={card.color} />
                            </div>
                            <span className="text-xs text-muted-foreground">{card.changeLabel}</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-2xl font-bold">{card.value}</p>
                            <p className="text-muted-foreground text-sm">{card.title}</p>
                        </div>
                        {card.change > 0 && (
                            <div className="mt-2 flex items-center gap-1 text-green-400 text-sm">
                                <ArrowUpRight size={14} />
                                <span>{card.change.toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Order Status */}
            <div>
                <h2 className="text-xl font-bold mb-4">Order Status</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {orderStatusCards.map((card, idx) => (
                        <div key={idx} className={`rounded-xl p-4 ${card.color.split(' ')[0]}`}>
                            <div className="flex items-center gap-2">
                                <card.icon size={20} className={card.color.split(' ')[1]} />
                                <span className="font-medium">{card.label}</span>
                            </div>
                            <p className="text-3xl font-bold mt-2">{card.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Revenue Stats */}
            <div className="grid lg:grid-cols-3 gap-6">
                <div className="stat-card">
                    <h3 className="font-semibold mb-4">Today's Performance</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Orders</span>
                            <span className="font-semibold">{stats?.today?.orders || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Revenue</span>
                            <span className="font-semibold price-tag">₹{stats?.today?.revenue?.toLocaleString() || 0}</span>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <h3 className="font-semibold mb-4">This Week</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Orders</span>
                            <span className="font-semibold">{stats?.this_week?.orders || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Revenue</span>
                            <span className="font-semibold price-tag">₹{stats?.this_week?.revenue?.toLocaleString() || 0}</span>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <h3 className="font-semibold mb-4">This Month</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Orders</span>
                            <span className="font-semibold">{stats?.this_month?.orders || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Revenue</span>
                            <span className="font-semibold price-tag">₹{stats?.this_month?.revenue?.toLocaleString() || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Popular Items & Restaurants */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Popular Restaurants */}
                <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-semibold mb-4">Popular Restaurants</h3>
                    {stats?.popular_restaurants?.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No data yet</p>
                    ) : (
                        <div className="space-y-3">
                            {stats?.popular_restaurants?.map((restaurant, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <span className="text-muted-foreground w-6">{idx + 1}.</span>
                                    <img 
                                        src={restaurant.image} 
                                        alt={restaurant.name}
                                        className="w-10 h-10 rounded-lg object-cover"
                                    />
                                    <div className="flex-1">
                                        <p className="font-medium">{restaurant.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {restaurant.order_count} orders • ₹{restaurant.revenue?.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Popular Items */}
                <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-semibold mb-4">Popular Items</h3>
                    {stats?.popular_items?.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No data yet</p>
                    ) : (
                        <div className="space-y-3">
                            {stats?.popular_items?.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <span className="text-muted-foreground w-6">{idx + 1}.</span>
                                    <img 
                                        src={item.image} 
                                        alt={item._id}
                                        className="w-10 h-10 rounded-lg object-cover"
                                    />
                                    <div className="flex-1">
                                        <p className="font-medium">{item._id}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {item.order_count} orders
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* User Breakdown */}
            <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-semibold mb-4">User Breakdown</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-xl bg-secondary">
                        <Users size={24} className="mx-auto text-blue-400 mb-2" />
                        <p className="text-2xl font-bold">{stats?.users?.customers || 0}</p>
                        <p className="text-sm text-muted-foreground">Customers</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-secondary">
                        <Store size={24} className="mx-auto text-orange-400 mb-2" />
                        <p className="text-2xl font-bold">{stats?.users?.restaurant_owners || 0}</p>
                        <p className="text-sm text-muted-foreground">Restaurant Owners</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-secondary">
                        <Bike size={24} className="mx-auto text-green-400 mb-2" />
                        <p className="text-2xl font-bold">{stats?.users?.delivery_partners || 0}</p>
                        <p className="text-sm text-muted-foreground">Delivery Partners</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-secondary">
                        <Users size={24} className="mx-auto text-purple-400 mb-2" />
                        <p className="text-2xl font-bold">{stats?.users?.total || 0}</p>
                        <p className="text-sm text-muted-foreground">Total Users</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
