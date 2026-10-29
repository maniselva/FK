import React from 'react';
import { ArrowLeft, FileText, Building, Phone, Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermsAndConditionsPage() {
    return (
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8" data-testid="terms-conditions-page">
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
                        <FileText size={32} className="text-orange-500" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800">Terms & Conditions</h1>
                    <p className="text-muted-foreground mt-2">Last updated: December 2025</p>
                    <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200 inline-block">
                        <div className="flex items-center justify-center gap-2 text-orange-700">
                            <Building size={18} />
                            <span className="font-semibold">Foodkey by Areca Hub OPC Private Limited</span>
                        </div>
                    </div>
                </div>

                <div className="prose prose-gray max-w-none space-y-6 text-gray-600">
                    <p>
                        1. This document is an electronic record in terms of Information Technology Act, 2000 and rules 
                        there under as applicable and the amended provisions pertaining to electronic records in various 
                        statutes as amended by the Information Technology Act, 2000. This electronic record is generated 
                        by a computer system and does not require any physical or digital signatures.
                    </p>

                    <p>
                        2. This document is published in accordance with the provisions of Rule 3 (1) of the Information 
                        Technology (Intermediaries guidelines) Rules, 2011 that require publishing the rules and 
                        regulations, privacy policy and Terms of Use for access or usage of domain name foodkey.in 
                        ('Website'), including the related mobile site and mobile application (hereinafter referred to as 
                        'Platform').
                    </p>

                    <p>
                        3. The Platform is owned by Foodkey by Areca Hub OPC Private Limited, a company 
                        incorporated under the Companies Act, 1956 with its registered office at 2/284-5 Nadar street, 
                        Singipuram, Vazhapadi, Salem, Tamilnadu - 636115 (hereinafter referred to as 'Platform 
                        Owner', 'we', 'us', 'our').
                    </p>

                    <p>
                        4. Your use of the Platform and services and tools are governed by the following terms and 
                        conditions ("Terms of Use") as applicable to the Platform including the applicable policies which 
                        are incorporated herein by way of reference. If You transact on the Platform, You shall be subject 
                        to the policies that are applicable to the Platform for such transaction. By mere use of the Platform, 
                        You shall be contracting with the Platform Owner and these terms and conditions including the 
                        policies constitute Your binding obligations, with Platform Owner. These Terms of Use relate to 
                        your use of our website, goods (as applicable) or services (as applicable) (collectively, 'Services'). 
                        Any terms and conditions proposed by You which are in addition to or which conflict with these 
                        Terms of Use are expressly rejected by the Platform Owner and shall be of no force or effect. 
                        These Terms of Use can be modified at any time without assigning any reason. It is your 
                        responsibility to periodically review these Terms of Use to stay informed of updates.
                    </p>

                    <p>
                        5. For the purpose of these Terms of Use, wherever the context so requires 'you', 'your' or 'user' shall 
                        mean any natural or legal person who has agreed to become a user/buyer on the Platform.
                    </p>

                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <p className="text-orange-800 font-medium">
                            6. ACCESSING, BROWSING OR OTHERWISE USING THE PLATFORM INDICATES YOUR 
                            AGREEMENT TO ALL THE TERMS AND CONDITIONS UNDER THESE TERMS OF USE, 
                            SO PLEASE READ THE TERMS OF USE CAREFULLY BEFORE PROCEEDING.
                        </p>
                    </div>

                    <div className="mt-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">7. Terms of Use</h2>
                        <p className="mb-4">The use of Platform and/or availing of our Services is subject to the following Terms of Use:</p>
                        
                        <ol className="list-decimal list-inside space-y-4 pl-4">
                            <li>
                                To access and use the Services, you agree to provide true, accurate and complete information 
                                to us during and after registration, and you shall be responsible for all acts done through the 
                                use of your registered account on the Platform.
                            </li>
                            <li>
                                Neither we nor any third parties provide any warranty or guarantee as to the accuracy, 
                                timeliness, performance, completeness or suitability of the information and materials offered 
                                on this website or through the Services, for any specific purpose. You acknowledge that such 
                                information and materials may contain inaccuracies or errors and we expressly exclude 
                                liability for any such inaccuracies or errors to the fullest extent permitted by law.
                            </li>
                            <li>
                                Your use of our Services and the Platform is solely and entirely at your own risk and 
                                discretion for which we shall not be liable to you in any manner. You are required to 
                                independently assess and ensure that the Services meet your requirements.
                            </li>
                            <li>
                                The contents of the Platform and the Services are proprietary to us and are licensed to us. 
                                You will not have any authority to claim any intellectual property rights, title, or interest in 
                                its contents. The contents includes and is not limited to the design, layout, look and graphics.
                            </li>
                            <li>
                                You acknowledge that unauthorized use of the Platform and/or the Services may lead to 
                                action against you as per these Terms of Use and/or applicable laws.
                            </li>
                            <li>
                                You agree to pay us the charges associated with availing the Services.
                            </li>
                            <li>
                                You agree not to use the Platform and/or Services for any purpose that is unlawful, illegal or 
                                forbidden by these Terms, or Indian or local laws that might apply to you.
                            </li>
                            <li>
                                You agree and acknowledge that website and the Services may contain links to other third 
                                party websites. On accessing these links, you will be governed by the terms of use, privacy 
                                policy and such other policies of such third party websites. These links are provided for your 
                                convenience for provide further information.
                            </li>
                            <li>
                                You understand that upon initiating a transaction for availing the Services you are entering 
                                into a legally binding and enforceable contract with the Platform Owner for the Services.
                            </li>
                            <li>
                                You shall indemnify and hold harmless Platform Owner, its affiliates, group companies (as 
                                applicable) and their respective officers, directors, agents, and employees, from any claim or 
                                demand, or actions including reasonable attorney's fees, made by any third party or penalty 
                                imposed due to or arising out of Your breach of this Terms of Use, privacy Policy and other 
                                Policies, or Your violation of any law, rules or regulations or the rights (including 
                                infringement of intellectual property rights) of a third party.
                            </li>
                            <li>
                                Notwithstanding anything contained in these Terms of Use, the parties shall not be liable for 
                                any failure to perform an obligation under these Terms if performance is prevented or 
                                delayed by a force majeure event.
                            </li>
                            <li>
                                These Terms and any dispute or claim relating to it, or its enforceability, shall be governed 
                                by and construed in accordance with the laws of India.
                            </li>
                            <li>
                                All disputes arising out of or in connection with these Terms shall be subject to the exclusive 
                                jurisdiction of the courts in Salem, Tamil Nadu.
                            </li>
                            <li>
                                All concerns or communications relating to these Terms must be communicated to us using 
                                the contact information provided on this website.
                            </li>
                        </ol>
                    </div>

                    {/* Contact Section */}
                    <div className="mt-8 p-6 bg-gray-50 rounded-lg border">
                        <h3 className="font-semibold text-gray-800 mb-4">Contact Us</h3>
                        <div className="space-y-2">
                            <p className="font-medium text-gray-800">Foodkey by Areca Hub OPC Private Limited</p>
                            <p className="text-sm flex items-start gap-2">
                                <MapPin size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                                2/284-5, Nadar street, Singipuram, Vazhapadi, Salem, Tamilnadu - 636115
                            </p>
                            <p className="text-sm flex items-center gap-2">
                                <Phone size={16} className="text-orange-500" />
                                <a href="tel:04292290979" className="hover:text-orange-500">04292 290979</a> | 
                                <a href="tel:9566722970" className="hover:text-orange-500 ml-1">9566722970</a>
                            </p>
                            <p className="text-sm flex items-center gap-2">
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
