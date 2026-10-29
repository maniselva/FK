import React, { useState } from 'react';
import { ArrowLeft, Send, MessageSquare, Phone, User, AlertCircle, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function FeedbackPage() {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        message: '',
        type: 'complaint'
    });
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name || !formData.phone || !formData.message) {
            toast.error('Please fill in all fields');
            return;
        }

        if (formData.phone.length < 10) {
            toast.error('Please enter a valid phone number');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API}/feedback`, formData);
            toast.success(`Thank you for your ${formData.type}!`);
            setSubmitted(true);
            setFormData({ name: '', phone: '', message: '', type: 'complaint' });
        } catch (error) {
            toast.error('Failed to submit feedback. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-8" data-testid="feedback-page">
            <Link 
                to="/" 
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
            >
                <ArrowLeft size={20} />
                Back to Home
            </Link>

            <div className="bg-card rounded-2xl border border-border p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageSquare size={32} className="text-orange-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">Complaints & Suggestions</h1>
                    <p className="text-gray-600 mt-2">
                        We value your feedback! Help us improve our service.
                    </p>
                </div>

                {submitted ? (
                    <div className="text-center py-8">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Send size={40} className="text-green-500" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">Thank You!</h2>
                        <p className="text-gray-600 mb-6">
                            Your feedback has been submitted successfully. We will review it and get back to you if needed.
                        </p>
                        <Button onClick={() => setSubmitted(false)} variant="outline">
                            Submit Another Feedback
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <Label htmlFor="name" className="text-gray-700 flex items-center gap-2">
                                <User size={16} />
                                Your Name *
                            </Label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="Enter your full name"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                className="mt-1"
                                data-testid="feedback-name"
                            />
                        </div>

                        <div>
                            <Label htmlFor="phone" className="text-gray-700 flex items-center gap-2">
                                <Phone size={16} />
                                Phone Number *
                            </Label>
                            <div className="flex mt-1">
                                <div className="flex items-center px-3 bg-gray-100 border border-r-0 border-input rounded-l-md text-gray-600">
                                    +91
                                </div>
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="Enter your phone number"
                                    value={formData.phone}
                                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                                    className="rounded-l-none"
                                    data-testid="feedback-phone"
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="message" className="text-gray-700 flex items-center gap-2">
                                <MessageSquare size={16} />
                                Your Message *
                            </Label>
                            <Textarea
                                id="message"
                                placeholder="Please describe your complaint or suggestion in detail..."
                                value={formData.message}
                                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                                className="mt-1 min-h-[150px]"
                                data-testid="feedback-message"
                            />
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full btn-primary h-12"
                            disabled={loading}
                            data-testid="feedback-submit"
                        >
                            {loading ? 'Submitting...' : 'Submit Feedback'}
                        </Button>
                    </form>
                )}

                <div className="mt-8 pt-6 border-t border-border">
                    <p className="text-center text-sm text-gray-600">
                        For urgent matters, please call us at{' '}
                        <a href="tel:04292290979" className="text-orange-500 font-semibold">04292 290979</a>
                        {' '}or{' '}
                        <a href="tel:9566722970" className="text-orange-500 font-semibold">9566722970</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
