import React, { useState } from 'react';
import { X, Phone, Sparkles, PartyPopper } from 'lucide-react';

/**
 * LaunchBanner — Simple, warm, local announcement banner.
 * Casual feel — like a friendly village notice board, not a premium SaaS strip.
 */
export default function LaunchBanner() {
    const [dismissed, setDismissed] = useState(() => {
        try {
            return localStorage.getItem('foodkey_launch_banner_dismissed') === '1';
        } catch {
            return false;
        }
    });

    const handleDismiss = () => {
        setDismissed(true);
        try {
            localStorage.setItem('foodkey_launch_banner_dismissed', '1');
        } catch {
            // ignore
        }
    };

    if (dismissed) return null;

    return (
        <div
            className="relative w-full bg-[#FFF7E8] border-b-2 border-dashed border-orange-300"
            data-testid="launch-banner"
        >
            {/* Subtle polka / dot pattern background */}
            <div
                className="absolute inset-0 opacity-40 pointer-events-none"
                style={{
                    backgroundImage:
                        'radial-gradient(circle, #FDBA74 1px, transparent 1px)',
                    backgroundSize: '18px 18px',
                }}
            />

            <button
                onClick={handleDismiss}
                aria-label="Dismiss banner"
                data-testid="launch-banner-dismiss"
                className="absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 rounded-full hover:bg-orange-100 transition-colors z-10"
            >
                <X size={16} className="text-orange-700" />
            </button>

            <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6 flex flex-col items-center text-center">
                {/* Small party badge */}
                <div className="flex items-center gap-2 mb-2">
                    <PartyPopper size={18} className="text-orange-600" />
                    <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-orange-700">
                        New Launch in Vazhapadi
                    </span>
                    <PartyPopper size={18} className="text-orange-600" />
                </div>

                {/* Friendly tagline */}
                <p className="text-sm sm:text-base text-gray-700 font-medium">
                    Just sit and order your favourite food from your home…
                </p>

                {/* Announcement */}
                <p className="mt-1 text-base sm:text-lg text-gray-800">
                    Yes! <span className="font-bold">Vazhapadi</span> got a new food delivery platform
                </p>

                {/* Brand */}
                <div className="mt-3 mb-1 flex items-baseline gap-1.5" data-testid="launch-banner-brand">
                    <Sparkles size={20} className="text-orange-500 self-center" />
                    <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-orange-600">
                        Food<span className="text-gray-900">Key</span>
                    </h2>
                    <span className="text-xl sm:text-2xl text-orange-500 font-bold">.</span>
                </div>
                <p className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-gray-600 mb-3">
                    Unlock Delicious
                </p>

                {/* Sub message */}
                <p className="text-sm sm:text-base text-gray-700">
                    Order your favourite from your favourite restaurant.
                </p>

                {/* Launch date sticker */}
                <div
                    className="inline-flex mt-3 items-center gap-2 px-4 py-1.5 bg-orange-500 text-white rounded-full shadow-sm text-sm sm:text-base font-semibold"
                    data-testid="launch-banner-date"
                >
                    <span className="text-yellow-200">★</span>
                    <span>Live from 18 May 2026</span>
                    <span className="text-yellow-200">★</span>
                </div>

                {/* Partner contact */}
                <div className="mt-4 pt-3 border-t border-dashed border-orange-300 w-full max-w-xl">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">
                        Delivery partners & restaurant partners, please contact
                    </p>
                    <a
                        href="tel:9566722970"
                        data-testid="launch-banner-phone"
                        className="inline-flex items-center gap-2 text-orange-700 hover:text-orange-800 font-bold text-base sm:text-lg"
                    >
                        <Phone size={16} />
                        9566722970
                    </a>
                </div>
            </div>
        </div>
    );
}
