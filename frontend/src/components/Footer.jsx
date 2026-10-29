import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { Instagram, Twitter, Facebook, Mail, Phone, MapPin, MessageSquare } from 'lucide-react';

export const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-gray-900 text-white" data-testid="footer">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div className="md:col-span-1">
                        <div className="text-2xl font-bold">
                            <span className="text-orange-500">Food</span>
                            <span className="text-white">Key</span>
                        </div>
                        <p className="mt-4 text-gray-400 text-sm">
                            Unlock the Flavor. The Art of Delivery.
                        </p>
                        <div className="flex gap-4 mt-6">
                            <a href="#" className="text-gray-400 hover:text-orange-500 transition-colors" aria-label="Instagram">
                                <Instagram size={20} />
                            </a>
                            <a href="#" className="text-gray-400 hover:text-orange-500 transition-colors" aria-label="Twitter">
                                <Twitter size={20} />
                            </a>
                            <a href="#" className="text-gray-400 hover:text-orange-500 transition-colors" aria-label="Facebook">
                                <Facebook size={20} />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="font-semibold mb-4 text-white">Quick Links</h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link to="/" className="text-gray-400 hover:text-orange-500 transition-colors">
                                    Home
                                </Link>
                            </li>
                            <li>
                                <Link to="/restaurants" className="text-gray-400 hover:text-orange-500 transition-colors">
                                    Restaurants
                                </Link>
                            </li>
                            <li>
                                <Link to="/orders" className="text-gray-400 hover:text-orange-500 transition-colors">
                                    Track Order
                                </Link>
                            </li>
                            <li>
                                <Link to="/feedback" className="text-gray-400 hover:text-orange-500 transition-colors">
                                    <MessageSquare size={14} className="inline mr-1" />
                                    Complaints / Suggestions
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Partner With Us */}
                    <div>
                        <h3 className="font-semibold mb-4 text-white">Partner With Us</h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link to="/partner/restaurant" className="text-gray-400 hover:text-orange-500 transition-colors" data-testid="footer-restaurant-login">
                                    Restaurant Login
                                </Link>
                            </li>
                            <li>
                                <Link to="/partner/delivery" className="text-gray-400 hover:text-orange-500 transition-colors" data-testid="footer-delivery-login">
                                    Delivery Partner Login
                                </Link>
                            </li>
                            <li>
                                <Link to="/admin/login" className="text-gray-400 hover:text-orange-500 transition-colors" data-testid="admin-link">
                                    Admin Portal
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h3 className="font-semibold mb-4 text-white">Legal</h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link to="/terms" className="text-gray-400 hover:text-orange-500 transition-colors" data-testid="terms-link">
                                    Terms & Conditions
                                </Link>
                            </li>
                            <li>
                                <Link to="/refund-policy" className="text-gray-400 hover:text-orange-500 transition-colors" data-testid="refund-policy-link">
                                    Refund Policy
                                </Link>
                            </li>
                            <li>
                                <Link to="/return-policy" className="text-gray-400 hover:text-orange-500 transition-colors" data-testid="return-policy-link">
                                    Return Policy
                                </Link>
                            </li>
                            <li>
                                <Link to="/shipping-policy" className="text-gray-400 hover:text-orange-500 transition-colors" data-testid="shipping-policy-link">
                                    Shipping Policy
                                </Link>
                            </li>
                            <li>
                                <Link to="/privacy" className="text-gray-400 hover:text-orange-500 transition-colors" data-testid="privacy-link">
                                    Privacy Policy
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h3 className="font-semibold mb-4 text-white">Contact Us</h3>
                        <ul className="space-y-3 text-sm">
                            <li className="flex items-center gap-2">
                                <Phone size={16} className="text-orange-500" />
                                <a href="tel:04292290970" className="text-gray-300 hover:text-orange-500 transition-colors">04292 290970</a>
                            </li>
                            <li className="flex items-center gap-2">
                                <Phone size={16} className="text-orange-500" />
                                <a href="tel:9566722970" className="text-gray-300 hover:text-orange-500 transition-colors">9566722970</a>
                            </li>
                            <li className="flex items-center gap-2">
                                <Mail size={16} className="text-orange-500" />
                                <a href="mailto:support@foodkey.in" className="text-gray-300 hover:text-orange-500 transition-colors">support@foodkey.in</a>
                            </li>
                            <li className="flex items-start gap-2">
                                <MapPin size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-300">2/284-5, Nadar street, Singipuram, Vazhapadi, Salem, Tamilnadu - 636115</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Copyright */}
                <div className="mt-12 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
                    <p data-testid="copyright">
                        © {currentYear} Food Key. All rights reserved.
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                        Managed by <span className="text-gray-300 font-medium">Areca Hub OPC Private Limited</span>
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
