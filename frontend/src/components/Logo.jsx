import React from 'react';

export const Logo = ({ size = 'default', showTagline = true }) => {
    const sizes = {
        small: { 
            container: 'gap-1',
            food: 'text-xl',
            key: 'text-xl',
            tagline: 'hidden'
        },
        default: { 
            container: 'gap-1.5',
            food: 'text-2xl md:text-3xl',
            key: 'text-2xl md:text-3xl',
            tagline: 'text-[9px] tracking-[0.25em]'
        },
        large: { 
            container: 'gap-2',
            food: 'text-4xl md:text-5xl',
            key: 'text-4xl md:text-5xl',
            tagline: 'text-xs tracking-[0.3em]'
        },
        hero: { 
            container: 'gap-2',
            food: 'text-5xl sm:text-6xl md:text-7xl',
            key: 'text-5xl sm:text-6xl md:text-7xl',
            tagline: 'text-sm tracking-[0.3em]'
        }
    };

    const s = sizes[size] || sizes.default;

    return (
        <div className={`flex items-center ${s.container} group cursor-pointer select-none`} data-testid="logo">
            {/* Logo Text */}
            <div className="flex flex-col items-start leading-none">
                <div className="flex items-baseline">
                    {/* Food text with gradient */}
                    <span 
                        className={`${s.food} font-black tracking-tight`}
                        style={{ 
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                            background: 'linear-gradient(135deg, #FF6B00 0%, #FF8C00 50%, #FFA500 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}
                    >
                        Food
                    </span>
                    {/* Key text in dark */}
                    <span 
                        className={`${s.key} font-black tracking-tight text-gray-800`}
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                        Key
                    </span>
                    {/* Stylish dot accent */}
                    <span 
                        className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 ml-0.5 mb-1 group-hover:scale-125 transition-transform"
                        style={{ boxShadow: '0 0 8px rgba(255, 140, 0, 0.5)' }}
                    />
                </div>
                {/* Tagline */}
                {showTagline && s.tagline !== 'hidden' && (
                    <span 
                        className={`${s.tagline} text-gray-500 font-semibold uppercase mt-0.5`}
                        style={{ fontFamily: "'Proxima Nova', sans-serif" }}
                    >
                        Unlock Delicious
                    </span>
                )}
            </div>
        </div>
    );
};

export default Logo;
