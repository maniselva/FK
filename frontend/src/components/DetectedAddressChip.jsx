/**
 * DetectedAddressChip
 * -------------------
 * Tiny indicator that confirms a location was auto-filled from the user's GPS,
 * with a "Looks wrong?" link that focuses the address search input.
 *
 * Props:
 *   - address: string (the detected human-readable address)
 *   - lat, lng: optional numbers (only the truthy combo enables the chip)
 *   - onLooksWrong: () => void  — called when user taps "Looks wrong?"
 */
import React from 'react';
import { CheckCircle, MapPin } from 'lucide-react';

export default function DetectedAddressChip({ address, lat, lng, onLooksWrong }) {
    if (!address || !lat || !lng) return null;
    if (typeof address !== 'string' || address.startsWith('Lat:')) return null;

    return (
        <div
            className="flex items-start gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm"
            data-testid="detected-address-chip"
        >
            <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-green-700 font-medium">
                    <MapPin size={12} />
                    <span>Detected location</span>
                </div>
                <p className="text-gray-700 text-xs mt-0.5 break-words" data-testid="detected-address-text">
                    {address}
                </p>
            </div>
            {onLooksWrong && (
                <button
                    type="button"
                    onClick={onLooksWrong}
                    className="text-xs text-orange-600 hover:text-orange-700 font-medium whitespace-nowrap underline-offset-2 hover:underline"
                    data-testid="looks-wrong-link"
                >
                    Looks wrong?
                </button>
            )}
        </div>
    );
}
