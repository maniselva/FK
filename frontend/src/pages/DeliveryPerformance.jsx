import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
    Bike, TrendingUp, IndianRupee, Clock, ArrowLeft, 
    BarChart3, Calendar, Star, Target, Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useApp } from '../contexts/AppContext';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DeliveryPerformance() {
    const { user, isAuthenticated } = useApp();
    const [analytics, setAnalytics] = useState(null);
    const [partnerId, setPartnerId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);

    const fetchPartner = useCallback(async () => {
        if (!user?.id) return;
        try {
            const response = await axios.get(`${API}/delivery-partners/user/${user.id}`);
            setPartnerId(response.data.id);
        } catch (error) {
            console.error('Failed to fetch partner:', error);
            setLoading(false);
        }
    }, [user?.id]);

    const fetchAnalytics = useCallback(async () => {
        if (!partnerId) return;
        try {
            const response = await axios.get(`${API}/analytics/delivery/${partnerId}?days=${days}`);
            setAnalytics(response.data);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    }, [partnerId, days]);

    useEffect(() => {
        fetchPartner();
    }, [fetchPartner]);

    useEffect(() => {
        if (partnerId) {
            fetchAnalytics();
        }
    }, [partnerId, fetchAnalytics]);

    if (!isAuthenticated || user?.role !== 'delivery') {
        return (
            <div className="max-w-3xl mx-auto px-4 py-16 text-center">
                <BarChart3 size={64} className="mx-auto text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold mb-2">Performance Analytics</h1>
                <p className="text-muted-foreground">Please login as a delivery partner to view performance</p>
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
                <p className="text-muted-foreground">No performance data available yet</p>
                <Link to="/delivery-dashboard">
                    <Button className="mt-4">Go to Dashboard</Button>
                </Link>
            </div>
        );
    }

    const { partner, summary, daily_trend, peak_hours, performance } = analytics;

    // Calculate max for chart scaling
    const maxDeliveries = Math.max(...daily_trend.map(d => d.deliveries), 1);

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8" data-testid="delivery-performance">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <Link to="/delivery-dashboard" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-2">
                        <ArrowLeft size={16} /> Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold">Performance Analytics</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-muted-foreground">{partner.name}</span>
                        <Badge variant="outline">{partner.vehicle}</Badge>
                        <div className="flex items-center gap-1">
                            <Star size={14} className="text-yellow-400 fill-yellow-400" />
                            <span>{partner.rating}</span>
                        </div>
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
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Bike size={24} className="text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{summary.deliveries_in_period}</p>
                            <p className="text-muted-foreground text-sm">Deliveries</p>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <IndianRupee size={24} className="text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold price-tag">₹{summary.earnings_in_period.toLocaleString()}</p>
                            <p className="text-muted-foreground text-sm">Earnings</p>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Target size={24} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{summary.avg_daily_deliveries}</p>
                            <p className="text-muted-foreground text-sm">Avg/Day</p>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                            <Zap size={24} className="text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold price-tag">₹{summary.avg_daily_earnings}</p>
                            <p className="text-muted-foreground text-sm">Avg Earning/Day</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid lg:grid-cols-2 gap-6 mb-8">
                {/* Daily Trend */}
                <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <BarChart3 size={20} className="text-primary" />
                        Daily Deliveries
                    </h3>
                    <div className="h-64 flex items-end gap-1">
                        {daily_trend.slice(-14).map((day, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                <div 
                                    className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                                    style={{ height: `${(day.deliveries / maxDeliveries) * 200}px`, minHeight: day.deliveries > 0 ? '4px' : '0' }}
                                    title={`${day.deliveries} deliveries - ₹${day.earnings}`}
                                />
                                <span className="text-[10px] text-muted-foreground rotate-45 origin-left">
                                    {format(new Date(day.date), 'dd')}
                                </span>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-4">Daily deliveries (last 14 days shown)</p>
                </div>

                {/* Peak Hours */}
                <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Clock size={20} className="text-orange-400" />
                        Your Peak Hours
                    </h3>
                    <div className="space-y-3">
                        {peak_hours.map((hour, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-sm font-bold text-orange-400">
                                        {idx + 1}
                                    </span>
                                    <span className="font-medium">{hour.hour}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-orange-400 rounded-full"
                                            style={{ width: `${(hour.deliveries / (peak_hours[0]?.deliveries || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium w-12 text-right">{hour.deliveries}</span>
                                </div>
                            </div>
                        ))}
                        {peak_hours.length === 0 && (
                            <p className="text-center text-muted-foreground py-8">Complete more deliveries to see your peak hours</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Performance Summary */}
            <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-semibold mb-4">Overall Stats</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Total Deliveries</span>
                            <span className="font-bold text-lg">{partner.total_deliveries}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Total Earnings</span>
                            <span className="font-bold text-lg price-tag">₹{partner.total_earnings.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Days Active</span>
                            <span className="font-bold text-lg">{summary.days_worked}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Restaurants Served</span>
                            <span className="font-bold text-lg">{summary.restaurants_served}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-semibold mb-4">Performance Rating</h3>
                    <div className="flex flex-col items-center justify-center h-32">
                        <div className="flex items-center gap-2 mb-2">
                            <Star size={32} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-4xl font-bold">{performance.rating}</span>
                        </div>
                        <p className="text-muted-foreground">Customer Rating</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Completion Rate</span>
                            <span className="font-bold text-green-400">{performance.completion_rate}%</span>
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-semibold mb-4">Quick Tips</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>Stay online during peak hours ({peak_hours[0]?.hour || '12:00'} - {peak_hours[1]?.hour || '14:00'}) for more orders</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>Maintain your rating above 4.5 for priority assignments</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>Complete {Math.max(10 - summary.avg_daily_deliveries, 0)} more deliveries per day to increase earnings</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
