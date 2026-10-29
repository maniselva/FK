import React from 'react';
import { ArrowLeft, RotateCcw, Package, CheckCircle, XCircle, AlertTriangle, Building, Phone, Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ReturnPolicyPage() {
    return (
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8" data-testid="return-policy-page">
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
                        <RotateCcw size={32} className="text-orange-500" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800">Return Policy</h1>
                    <p className="text-muted-foreground mt-2">Last updated: December 2025</p>
                    <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200 inline-block">
                        <div className="flex items-center justify-center gap-2 text-orange-700">
                            <Building size={18} />
                            <span className="font-semibold">Foodkey by Areca Hub OPC Private Limited</span>
                        </div>
                    </div>
                </div>

                <div className="prose prose-gray max-w-none">
                    {/* Return Window Notice */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-amber-600 mt-1 flex-shrink-0" size={20} />
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-2">Return/Exchange Window</h3>
                                <p className="text-gray-600">
                                    We offer refund/exchange within first <span className="font-medium text-amber-700">1 day</span> from the date of your purchase. 
                                    If 1 day has passed since your purchase, you will not be offered a return, exchange or refund of any kind.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Eligibility Criteria */}
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Eligibility Criteria</h2>
                    <p className="text-gray-600 mb-4">
                        In order to become eligible for a return or an exchange:
                    </p>

                    <div className="grid gap-4 mb-6">
                        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <CheckCircle className="text-green-600 mt-0.5 flex-shrink-0" size={20} />
                            <div>
                                <p className="font-medium text-gray-800">Unused Condition</p>
                                <p className="text-sm text-gray-600">The purchased item should be unused and in the same condition as you received it.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <Package className="text-green-600 mt-0.5 flex-shrink-0" size={20} />
                            <div>
                                <p className="font-medium text-gray-800">Original Packaging</p>
                                <p className="text-sm text-gray-600">The item must have original packaging intact.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <XCircle className="text-red-600 mt-0.5 flex-shrink-0" size={20} />
                            <div>
                                <p className="font-medium text-gray-800">Sale Items</p>
                                <p className="text-sm text-gray-600">If the item that you purchased was on sale, then the item may not be eligible for a return/exchange.</p>
                            </div>
                        </div>
                    </div>

                    {/* Replacement Policy */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <h3 className="font-semibold text-gray-800 mb-2">Replacement Policy</h3>
                        <p className="text-gray-600">
                            Only such items are replaced by us (based on an exchange request), if such items are found 
                            <span className="font-medium text-blue-700"> defective or damaged</span>.
                        </p>
                    </div>

                    {/* Exempted Categories */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                        <h3 className="font-semibold text-gray-800 mb-2">Exempted Categories</h3>
                        <p className="text-gray-600">
                            You agree that there may be a certain category of products/items that are exempted from returns or 
                            refunds. Such categories of products would be identified to you at the time of purchase.
                        </p>
                    </div>

                    {/* Process */}
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Return/Exchange Process</h2>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                        <p className="text-gray-600">
                            For exchange/return accepted request(s) (as applicable), once your returned product/item is received 
                            and inspected by us, we will send you an email to notify you about receipt of the returned/exchanged 
                            product. Further, if the same has been approved after the quality check at our end, your request 
                            (i.e. return/exchange) will be processed in accordance with our policies.
                        </p>
                    </div>

                    {/* Contact Section */}
                    <div className="mt-8 p-6 bg-gray-50 rounded-lg border">
                        <h3 className="font-semibold text-gray-800 mb-4">Need to Return an Item?</h3>
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
