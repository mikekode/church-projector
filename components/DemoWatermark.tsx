"use client";

/**
 * CREENLY DEMO Watermark
 * Displays an obstructive watermark for unlicensed users
 */
export default function DemoWatermark() {
    return (
        <div
            className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center overflow-hidden"
            style={{
                background: 'repeating-linear-gradient(45deg, transparent, transparent 100px, rgba(255,0,0,0.03) 100px, rgba(255,0,0,0.03) 200px)'
            }}
        >
            {/* Main center watermark */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div
                    className="text-center select-none"
                    style={{
                        transform: 'rotate(-25deg)',
                    }}
                >
                    <div
                        className="font-black tracking-widest"
                        style={{
                            fontSize: 'clamp(80px, 20vw, 250px)',
                            color: 'rgba(255, 50, 50, 0.4)',
                            textShadow: '0 0 40px rgba(255,0,0,0.3), 0 0 80px rgba(255,0,0,0.2)',
                            letterSpacing: '0.2em',
                            lineHeight: 1,
                        }}
                    >
                        CREENLY
                    </div>
                    <div
                        className="font-bold tracking-[0.5em] mt-4"
                        style={{
                            fontSize: 'clamp(30px, 6vw, 80px)',
                            color: 'rgba(255, 100, 100, 0.5)',
                        }}
                    >
                        DEMO
                    </div>
                </div>
            </div>

            {/* Repeated pattern across screen */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0">
                {[...Array(4)].map((_, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-center opacity-20"
                        style={{ transform: 'rotate(-25deg)' }}
                    >
                        <span
                            className="font-black text-red-500 whitespace-nowrap"
                            style={{ fontSize: 'clamp(40px, 10vw, 100px)' }}
                        >
                            CREENLY DEMO
                        </span>
                    </div>
                ))}
            </div>

            {/* Bottom banner */}
            <div
                className="absolute bottom-0 left-0 right-0 bg-red-600/90 text-white py-4 text-center pointer-events-auto"
            >
                <p className="font-bold text-lg md:text-2xl tracking-wide">
                    ⚠️ UNLICENSED DEMO VERSION — Subscribe at creenly.com to remove watermark
                </p>
            </div>
        </div>
    );
}
