import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
    TrendingUp, IndianRupee, Package, Clock, ArrowLeft, 
    BarChart3, PieChart, Calendar, Star, ShoppingBag
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useApp } from '../contexts/AppContext';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RestaurantAnalytics() {
    const { restaurantId } = useParams();
    const { user, isAuthenticated } = useApp();
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);

    const fetchAnalytics = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/analytics/restaurant/${restaurantId}?days=${days}`);
            setAnalytics(response.data);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    }, [restaurantId, days]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    if (!isAuthenticated || user?.role !== 'restaurant') {
        return (
            <div className="max-w-3xl mx-auto px-4 py-16 text-center">
                <BarChart3 size={64} className="mx-auto text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold mb-2">Restaurant Analytics</h1>
                <p className="text-muted-foreground">Please login as a restaurant owner to view analytics</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                <div className="skeleton h-8 w-1/3 mb-8" />
                <div className="grid md:grid-cols-4 gap-6 mb-8">
                    {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}
                </div>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-16 text-center">
                <BarChart3 size={64} className="mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Failed to load analytics</p>
            </div>
        );
    }

    const { restaurant, summary, revenue_trend, popular_items, status_breakdown, peak_hours, payment_methods } = analytics;

    // Calculate max revenue for chart scaling
    const maxRevenue = Math.max(...revenue_trend.map(d => d.revenue), 1);

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8" data-testid="restaurant-analytics">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <Link to="/restaurant-dashboard" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-2">
                        <ArrowLeft size={16} /> Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold">{restaurant.name} Analytics</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <Star size={16} className="text-yellow-400 fill-yellow-400" />
                        <span>{restaurant.rating}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        className="px-3 py-2 rounded-lg border border-border bg-background"
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                    </select>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <IndianRupee size={24} className="text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold price-tag">₹{summary.total_revenue.toLocaleString()}</p>
                            <p className="text-muted-foreground text-sm">Total Revenue</p>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Package size={24} className="text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{summary.total_orders}</p>
                            <p className="text-muted-foreground text-sm">Total Orders</p>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <ShoppingBag size={24} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold price-tag">₹{summary.avg_order_value}</p>
                            <p className="text-muted-foreground text-sm">Avg Order Value</p>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                            <TrendingUp size={24} className="text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{summary.completion_rate}%</p>
                            <p className="text-muted-foreground text-sm">Completion Rate</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid lg:grid-cols-2 gap-6 mb-8">
                {/* Revenue Trend */}
                <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <BarChart3 size={20} className="text-primary" />
                        Revenue Trend
                    </h3>
                    <div className="h-64 flex items-end gap-1">
                        {revenue_trend.slice(-14).map((day, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                <div 
                                    className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                                    style={{ height: `${(day.revenue / maxRevenue) * 200}px`, minHeight: day.revenue > 0 ? '4px' : '0' }}
                                    title={`₹${day.revenue}`}
                                />
                                <span className="text-[10px] text-muted-foreground rotate-45 origin-left">
                                    {format(new Date(day.date), 'dd')}
                                </span>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-4">Daily revenue (last 14 days shown)</p>
                </div>

                {/* Popular Items */}
                <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Star size={20} className="text-yellow-400" />
                        Top Selling Items
                    </h3>
                    <div className="space-y-3">
                        {popular_items.slice(0, 5).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                                        {idx + 1}
                                    </span>
                                    <span className="font-medium">{item.name}</span>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold">{item.orders} orders</p>
                                    <p className="text-xs text-muted-foreground price-tag">₹{item.revenue}</p>
                                </div>
                            </div>
                        ))}
                        {popular_items.length === 0 && (
                            <p className="text-center text-muted-foreground py-8">No order data yet</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Additional Stats */}
            <div className="grid md:grid-cols-3 gap-6">
                {/* Order Status */}
                <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <PieChart size={20} className="text-blue-400" />
                        Order Status
                    </h3>
                    <div className="space-y-2">
                        {Object.entries(status_breakdown).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between">
                                <Badge variant="outline" className="capitalize">{status.replace('_', ' ')}</Badge>
                                <span className="font-semibold">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Peak Hours */}
                <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Clock size={20} className="text-orange-400" />
                        Peak Hours
                    </h3>
                    <div className="space-y-2">
                        {peak_hours.map((hour, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <span>{hour.hour}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-orange-400 rounded-full"
                                            style={{ width: `${(hour.orders / (peak_hours[0]?.orders || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium w-8">{hour.orders}</span>
                                </div>
                            </div>
                        ))}
                        {peak_hours.length === 0 && (
                            <p className="text-center text-muted-foreground py-4">No data yet</p>
                        )}
                    </div>
                </div>

                {/* Payment Methods */}
                <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <IndianRupee size={20} className="text-green-400" />
                        Payment Methods
                    </h3>
                    <div className="space-y-4">
                        {Object.entries(payment_methods).map(([method, count]) => {
                            const total = Object.values(payment_methods).reduce((a, b) => a + b, 0);
                            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                            return (
                                <div key={method}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="capitalize">{method === 'cod' ? 'Cash on Delivery' : 'Prepaid'}</span>
                                        <span>{percent}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full ${method === 'cod' ? 'bg-yellow-400' : 'bg-green-400'}`}
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
