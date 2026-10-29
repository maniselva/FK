import React from 'react';
import { ArrowLeft, RefreshCcw, AlertCircle, Clock, CheckCircle2, XCircle, Building, Phone, Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function RefundPolicyPage() {
    return (
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8" data-testid="refund-policy-page">
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
                        <RefreshCcw size={32} className="text-orange-500" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800">Refund and Cancellation Policy</h1>
                    <p className="text-muted-foreground mt-2">Last updated: December 2025</p>
                    <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200 inline-block">
                        <div className="flex items-center justify-center gap-2 text-orange-700">
                            <Building size={18} />
                            <span className="font-semibold">Foodkey by Areca Hub OPC Private Limited</span>
                        </div>
                    </div>
                </div>

                <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600 mb-6">
                        This refund and cancellation policy outlines how you can cancel or seek a refund for a product/service 
                        that you have purchased through the Platform. Under this policy:
                    </p>

                    <div className="space-y-6">
                        {/* Point 1 */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <Clock className="text-amber-600 mt-1 flex-shrink-0" size={20} />
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-2">1. Cancellation Window</h3>
                                    <p className="text-gray-600">
                                        Cancellations will only be considered if the request is made <span className="font-medium text-amber-700">within 1 day</span> of placing the order. 
                                        However, cancellation requests may not be entertained if the orders have been communicated to such sellers/merchant(s) 
                                        listed on the Platform and they have initiated the process of shipping them, or the product is out for delivery. 
                                        In such an event, you may choose to reject the product at the doorstep.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Point 2 */}
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <XCircle className="text-red-600 mt-1 flex-shrink-0" size={20} />
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-2">2. Perishable Items</h3>
                                    <p className="text-gray-600">
                                        Foodkey by Areca Hub OPC Private Limited <span className="font-medium text-red-700">does not accept cancellation requests for 
                                        perishable items</span> like flowers, eatables, etc. However, the refund/replacement can be made if the 
                                        user establishes that the quality of the product delivered is not good.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Point 3 */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="text-blue-600 mt-1 flex-shrink-0" size={20} />
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-2">3. Damaged or Defective Items</h3>
                                    <p className="text-gray-600">
                                        In case of receipt of damaged or defective items, please report to our customer service team. The 
                                        request would be entertained once the seller/merchant listed on the Platform has checked and 
                                        determined the same at its own end. This should be reported <span className="font-medium text-blue-700">within 1 day of receipt</span> of products. 
                                        In case you feel that the product received is not as shown on the site or as per your expectations, 
                                        you must bring it to the notice of our customer service within 1 day of receiving the product. The 
                                        customer service team after looking into your complaint will take an appropriate decision.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Point 4 */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="text-gray-600 mt-1 flex-shrink-0" size={20} />
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-2">4. Warranty Issues</h3>
                                    <p className="text-gray-600">
                                        In case of complaints regarding the products that come with a warranty from the manufacturers, 
                                        please refer the issue to them.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Point 5 */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <RefreshCcw className="text-green-600 mt-1 flex-shrink-0" size={20} />
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-2">5. Refund Processing Time</h3>
                                    <p className="text-gray-600">
                                        In case of any refunds approved by Foodkey by Areca Hub OPC Private Limited, it will take 
                                        <span className="font-medium text-green-700"> 2 days</span> for the refund to be processed to you.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact Section */}
                    <div className="mt-8 p-6 bg-gray-50 rounded-lg border">
                        <h3 className="font-semibold text-gray-800 mb-4">Need Help with a Refund?</h3>
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
