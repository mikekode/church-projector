"use client";

import React from 'react';

interface AnnouncementTickerProps {
    text: string;
    isActive: boolean;
    bgColor?: string;
    textColor?: string;
    speed?: number; // seconds for one full loop
    fontSize?: number; // base font size in pixels
}

export default function AnnouncementTicker({
    text,
    isActive,
    bgColor = '#ef4444', // red-500
    textColor = '#ffffff',
    speed = 20,
    fontSize = 48
}: AnnouncementTickerProps) {
    if (!isActive || !text) return null;

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-[100] flex items-center overflow-hidden border-t border-white/10 py-4 shadow-2xl"
            style={{
                backgroundColor: bgColor,
                fontSize: `${fontSize}px`,
                lineHeight: 1
            }}
        >
            <div className="relative flex whitespace-nowrap overflow-hidden w-full">
                <div
                    className="flex animate-marquee shrink-0"
                    style={{
                        animationDuration: `${speed}s`,
                        color: textColor
                    }}
                >
                    <span className="font-bold px-12 tracking-wider">
                        {text}
                    </span>
                    <span className="font-bold px-12 tracking-wider">
                        {text}
                    </span>
                    <span className="font-bold px-12 tracking-wider">
                        {text}
                    </span>
                    <span className="font-bold px-12 tracking-wider">
                        {text}
                    </span>
                </div>

                {/* Second copy for seamless loop */}
                <div
                    className="flex animate-marquee shrink-0"
                    style={{
                        animationDuration: `${speed}s`,
                        color: textColor
                    }}
                    aria-hidden="true"
                >
                    <span className="font-bold px-12 tracking-wider">
                        {text}
                    </span>
                    <span className="font-bold px-12 tracking-wider">
                        {text}
                    </span>
                    <span className="font-bold px-12 tracking-wider">
                        {text}
                    </span>
                    <span className="font-bold px-12 tracking-wider">
                        {text}
                    </span>
                </div>
            </div>

            <style jsx>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    animation: marquee linear infinite;
                }
            `}</style>
        </div>
    );
}
