import React from 'react';
import { ArrowLeft, Truck, Clock, MapPin, AlertCircle, Mail as MailIcon, Building, Phone, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ShippingPolicyPage() {
    return (
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8" data-testid="shipping-policy-page">
            <Link 
                to="/" 
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
            >
                <ArrowLeft size={20} />
                Back to Home
            </Link>

            <div className="bg-card rounded-2xl border border-border p-6 md:p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
                        <Truck size={32} className="text-orange-500" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800">Shipping Policy</h1>
                    <p className="text-muted-foreground mt-2">Last updated: December 2025</p>
                    <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200 inline-block">
                        <div className="flex items-center justify-center gap-2 text-orange-700">
                            <Building size={18} />
                            <span className="font-semibold">Foodkey by Areca Hub OPC Private Limited</span>
                        </div>
                    </div>
                </div>

                <div className="prose prose-gray max-w-none">
                    {/* Shipping Methods */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <Truck className="text-blue-600 mt-1 flex-shrink-0" size={20} />
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-2">Shipping Methods</h3>
                                <p className="text-gray-600">
                                    The orders for the user are shipped through registered domestic courier companies and/or speed post only.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Shipping Timeline */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <Clock className="text-green-600 mt-1 flex-shrink-0" size={20} />
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-2">Shipping Timeline</h3>
                                <p className="text-gray-600">
                                    Orders are shipped within <span className="font-medium text-green-700">1 day</span> from the date of the order and/or payment 
                                    or as per the delivery date agreed at the time of order confirmation and delivering of the shipment, 
                                    subject to courier company/post office norms.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Liability Notice */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="text-amber-600 mt-1 flex-shrink-0" size={20} />
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-2">Liability Disclaimer</h3>
                                <p className="text-gray-600">
                                    Platform Owner shall <span className="font-medium text-amber-700">not be liable</span> for any delay in delivery by the courier company/postal authority.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Delivery Address */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <MapPin className="text-purple-600 mt-1 flex-shrink-0" size={20} />
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-2">Delivery Address</h3>
                                <p className="text-gray-600">
                                    Delivery of all orders will be made to the address provided by the buyer at the time of purchase.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Confirmation */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <MailIcon className="text-blue-600 mt-1 flex-shrink-0" size={20} />
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-2">Delivery Confirmation</h3>
                                <p className="text-gray-600">
                                    Delivery of our services will be confirmed on your email ID as specified at the time of registration.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Shipping Costs */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="text-red-600 mt-1 flex-shrink-0" size={20} />
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-2">Shipping Costs</h3>
                                <p className="text-gray-600">
                                    If there are any shipping cost(s) levied by the seller or the Platform Owner (as the case may be), 
                                    the same is <span className="font-medium text-red-700">not refundable</span>.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Contact Section */}
                    <div className="mt-8 p-6 bg-gray-50 rounded-lg border">
                        <h3 className="font-semibold text-gray-800 mb-4">Shipping Queries?</h3>
                        <div className="space-y-2">
                            <p className="font-medium text-gray-800">Foodkey by Areca Hub OPC Private Limited</p>
                            <p className="text-sm flex items-start gap-2 text-gray-600">
                                <MapPin size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                                2/284-5, Nadar street, Singipuram, Vazhapadi, Salem, Tamilnadu - 636115
                            </p>
                            <p className="text-sm flex items-center gap-2 text-gray-600">
                                <Phone size={16} className="text-orange-500" />
                                <a href="tel:04292290979" className="hover:text-orange-500">04292 290979</a> | 
                                <a href="tel:9566722970" className="hover:text-orange-500 ml-1">9566722970</a>
                            </p>
                            <p className="text-sm flex items-center gap-2 text-gray-600">
                                <Mail size={16} className="text-orange-500" />
                                <a href="mailto:support@foodkey.in" className="hover:text-orange-500">support@foodkey.in</a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
