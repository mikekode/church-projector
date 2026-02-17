"use client";

import { useEffect, useState } from 'react';

import { ProjectorTheme } from '@/utils/themes';

interface VisualStackProps {
    background?: string | null; // URL to video or image
    theme?: ProjectorTheme | null;
    content: React.ReactNode;
    overlay?: React.ReactNode;  // Props layer (Corner logo, etc)
    alert?: string | null;      // Alert message
    fullBleed?: boolean;        // If true, ignore padding (for edge-to-edge media)
    style?: React.CSSProperties;
}

export default function VisualStack({ background, theme, content, overlay, alert, fullBleed, style }: VisualStackProps) {
    const [activeBg, setActiveBg] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    // Handle background transitions (cross-dissolve effect could be added here)
    // Handle background transitions (cross-dissolve effect could be added here)
    useEffect(() => {
        if (background) {
            if (typeof background === 'string') {
                setActiveBg(background);
            } else if (typeof background === 'object' && (background as any).value) {
                setActiveBg((background as any).value);
            }
        }
    }, [background]);

    return (
        <div className="fixed inset-0 bg-black overflow-hidden select-none cursor-none" style={style}>

            {/* LAYER 1: BACKGROUND (Z-0) */}
            <div className="absolute inset-0 z-0 bg-black transition-opacity duration-1000">
                {activeBg && typeof activeBg === 'string' ? (
                    activeBg.endsWith('.mp4') || activeBg.endsWith('.webm') ? (
                        <video
                            src={activeBg}
                            autoPlay
                            loop
                            muted
                            className="w-full h-full object-cover"
                            style={{ opacity: theme?.background?.brightness ?? 0.6 }}
                        />
                    ) : (activeBg.startsWith('/') || activeBg.startsWith('http') || activeBg.startsWith('data:')) ? (
                        <img
                            src={activeBg}
                            alt="bg"
                            className="w-full h-full object-cover"
                            style={{ opacity: theme?.background?.brightness ?? 0.6 }}
                        />
                    ) : (
                        <div className="w-full h-full opacity-100" style={{ background: activeBg }} />
                    )
                ) : (
                    // Fallback Gradient
                    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-black to-slate-900" />
                )}
            </div>

            {/* Ambient Effects (Between BG and Content) */}
            <div className="absolute inset-0 z-10 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px]" />
            </div>

            {/* LAYER 2: CONTENT (Z-20) */}
            <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center transition-all duration-500"
                style={{ padding: fullBleed ? 0 : `${theme?.layout?.contentPadding ?? 80}px` }}
            >
                {content}
            </div>

            {/* LAYER 3: PROPS/OVERLAY (Z-30) */}
            {overlay && (
                <div className="absolute inset-0 z-30 pointer-events-none p-10 flex flex-col justify-between">
                    {overlay}
                </div>
            )}

            {/* LAYER 4: ALERTS (Z-40) */}
            <div className={`absolute top-10 right-10 z-40 transition-all duration-300 transform ${alert ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
                {alert && (
                    <div className="bg-red-600 text-white font-bold px-6 py-3 rounded-lg shadow-2xl animate-pulse border border-red-400">
                        {alert}
                    </div>
                )}
            </div>

        </div>
    );
}
