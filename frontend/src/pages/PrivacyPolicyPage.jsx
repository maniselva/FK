import React from 'react';
import { ArrowLeft, Shield, Database, Share2, Lock, Trash2, UserCheck, FileCheck, Building, Phone, Mail, MapPin, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicyPage() {
    return (
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8" data-testid="privacy-policy-page">
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
                        <Shield size={32} className="text-orange-500" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800">Privacy Policy</h1>
                    <p className="text-muted-foreground mt-2">Last updated: December 2025</p>
                    <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200 inline-block">
                        <div className="flex items-center justify-center gap-2 text-orange-700">
                            <Building size={18} />
                            <span className="font-semibold">Foodkey by Areca Hub OPC Private Limited</span>
                        </div>
                    </div>
                </div>

                <div className="prose prose-gray max-w-none space-y-6">
                    {/* Introduction */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <FileCheck size={20} className="text-orange-500" />
                            Introduction
                        </h2>
                        <p className="text-gray-600">
                            This Privacy Policy describes how Foodkey by Areca Hub OPC Private Limited and its affiliates 
                            (collectively "Foodkey by Areca Hub OPC Private Limited, we, our, us") collect, use, share, protect or 
                            otherwise process your information/personal data through our website foodkey.in (hereinafter referred 
                            to as Platform).
                        </p>
                        <p className="text-gray-600 mt-3">
                            Please note that you may be able to browse certain sections of the Platform without 
                            registering with us. We do not offer any product/service under this Platform outside India and your 
                            personal data will primarily be stored and processed in India.
                        </p>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                            <p className="text-amber-800">
                                By visiting this Platform, providing your information or availing any product/service offered on the Platform, 
                                you expressly agree to be bound by the terms and conditions of this Privacy Policy, the Terms of Use and the 
                                applicable service/product terms and conditions, and agree to be governed by the laws of India including but 
                                not limited to the laws applicable to data protection and privacy. <strong>If you do not agree please do not use or access our Platform.</strong>
                            </p>
                        </div>
                    </section>

                    {/* Collection */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <Database size={20} className="text-orange-500" />
                            Collection of Information
                        </h2>
                        <p className="text-gray-600 mb-3">
                            We collect your personal data when you use our Platform, services or otherwise interact with us during 
                            the course of our relationship. Some of the information that we may collect includes but is not limited to:
                        </p>
                        <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                            <li>Name, date of birth, address</li>
                            <li>Telephone/mobile number, email ID</li>
                            <li>Any information shared as proof of identity or address</li>
                            <li>Bank account or credit/debit card or other payment instrument information (with your consent)</li>
                            <li>Biometric information such as facial features or physiological information (for certain features, with consent)</li>
                        </ul>
                        <p className="text-gray-600 mt-3">
                            You always have the option to not provide information, by choosing not to use a particular service or 
                            feature on the Platform. We may track your behaviour, preferences, and other information that you 
                            choose to provide on our Platform.
                        </p>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="text-red-600 mt-1 flex-shrink-0" size={20} />
                                <p className="text-red-800">
                                    <strong>Important:</strong> If you receive an email, a call from a person/association claiming to be Foodkey 
                                    seeking any personal data like debit/credit card PIN, net-banking or mobile banking password, 
                                    <strong> never provide such information</strong>. If you have already revealed such information, report it 
                                    immediately to an appropriate law enforcement agency.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Usage */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <UserCheck size={20} className="text-orange-500" />
                            Usage of Information
                        </h2>
                        <p className="text-gray-600 mb-3">
                            We use personal data to provide the services you request. To the extent we use your personal data 
                            to market to you, we will provide you the ability to opt-out of such uses. We use your personal data to:
                        </p>
                        <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                            <li>Assist sellers and business partners in handling and fulfilling orders</li>
                            <li>Enhance customer experience</li>
                            <li>Resolve disputes and troubleshoot problems</li>
                            <li>Inform you about online and offline offers, products, services, and updates</li>
                            <li>Customise your experience</li>
                            <li>Detect and protect us against error, fraud and other criminal activity</li>
                            <li>Enforce our terms and conditions</li>
                            <li>Conduct marketing research, analysis and surveys</li>
                        </ul>
                    </section>

                    {/* Sharing */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <Share2 size={20} className="text-orange-500" />
                            Sharing of Information
                        </h2>
                        <p className="text-gray-600 mb-3">
                            We may share your personal data internally within our group entities, our other corporate entities, and 
                            affiliates to provide you access to the services and products offered by them. These entities and 
                            affiliates may market to you as a result of such sharing unless you explicitly opt-out.
                        </p>
                        <p className="text-gray-600 mb-3">
                            We may disclose personal data to third parties such as sellers, business partners, third party service 
                            providers including logistics partners, prepaid payment instrument issuers, third-party reward programs 
                            and other payment options. These disclosures may be required to:
                        </p>
                        <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                            <li>Provide you access to our services and products</li>
                            <li>Comply with our legal obligations</li>
                            <li>Enforce our user agreement</li>
                            <li>Facilitate our marketing and advertising activities</li>
                            <li>Prevent, detect, mitigate, and investigate fraudulent or illegal activities</li>
                        </ul>
                        <p className="text-gray-600 mt-3">
                            We may disclose personal and sensitive personal data to government agencies or other authorised law 
                            enforcement agencies if required to do so by law or in the good faith belief that such disclosure is 
                            reasonably necessary.
                        </p>
                    </section>

                    {/* Security */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <Lock size={20} className="text-orange-500" />
                            Security Precautions
                        </h2>
                        <p className="text-gray-600">
                            To protect your personal data from unauthorised access or disclosure, loss or misuse we adopt 
                            reasonable security practices and procedures. Once your information is in our possession or whenever 
                            you access your account information, we adhere to our security guidelines to protect it against 
                            unauthorised access and offer the use of a secure server.
                        </p>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                            <p className="text-gray-600">
                                However, the transmission of information is not completely secure for reasons beyond our control. 
                                Users are responsible for ensuring the protection of login and password records for their account.
                            </p>
                        </div>
                    </section>

                    {/* Data Deletion and Retention */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <Trash2 size={20} className="text-orange-500" />
                            Data Deletion and Retention
                        </h2>
                        <p className="text-gray-600 mb-3">
                            You have an option to delete your account by visiting your profile and settings on our Platform. This 
                            action would result in you losing all information related to your account. You may also write to us at 
                            the contact information provided below to assist you with these requests.
                        </p>
                        <p className="text-gray-600 mb-3">
                            We may in event of any pending grievance, claims, pending shipments or any other services refuse or 
                            delay deletion of the account. Once the account is deleted, you will lose access to the account.
                        </p>
                        <p className="text-gray-600">
                            We retain your personal data information for a period no longer than is required for the purpose for 
                            which it was collected or as required under any applicable law. However, we may retain data related 
                            to you if we believe it may be necessary to prevent fraud or future abuse or for other legitimate 
                            purposes. We may continue to retain your data in anonymised form for analytical and research purposes.
                        </p>
                    </section>

                    {/* Your Rights */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <UserCheck size={20} className="text-orange-500" />
                            Your Rights
                        </h2>
                        <p className="text-gray-600">
                            You may access, rectify, and update your personal data directly through the functionalities provided 
                            on the Platform.
                        </p>
                    </section>

                    {/* Consent */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <FileCheck size={20} className="text-orange-500" />
                            Consent
                        </h2>
                        <p className="text-gray-600 mb-3">
                            By visiting our Platform or by providing your information, you consent to the collection, use, storage, 
                            disclosure and otherwise processing of your information on the Platform in accordance with this 
                            Privacy Policy.
                        </p>
                        <p className="text-gray-600 mb-3">
                            You, while providing your personal data over the Platform or any partner platforms or establishments, 
                            consent to us (including our other corporate entities, affiliates, lending partners, technology partners, 
                            marketing channels, business partners and other third parties) to contact you through SMS, instant 
                            messaging apps, call and/or e-mail for the purposes specified in this Privacy Policy.
                        </p>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-blue-800">
                                <strong>Withdrawal of Consent:</strong> You have an option to withdraw your consent that you have already 
                                provided by writing to the Grievance Officer at the contact information provided below. Please mention 
                                "Withdrawal of consent for processing personal data" in your subject line. Your withdrawal of consent 
                                will not be retrospective and will be in accordance with the Terms of Use, this Privacy Policy, and 
                                applicable laws.
                            </p>
                        </div>
                    </section>

                    {/* Changes to Policy */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">Changes to this Privacy Policy</h2>
                        <p className="text-gray-600">
                            Please check our Privacy Policy periodically for changes. We may update this Privacy Policy to reflect 
                            changes to our information practices. We may alert/notify you about the significant changes to the 
                            Privacy Policy, in the manner as may be required under applicable laws.
                        </p>
                    </section>

                    {/* Grievance Officer */}
                    <section className="mt-8 p-6 bg-gray-50 rounded-lg border">
                        <h3 className="font-semibold text-gray-800 mb-4">Grievance Officer</h3>
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
                    </section>
                </div>
            </div>
        </div>
    );
}
