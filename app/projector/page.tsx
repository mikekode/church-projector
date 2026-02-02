"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useBroadcastChannel } from '@/hooks/useBroadcast';
import VisualStack from '@/components/projector/VisualStack';
import { ProjectorTheme, DEFAULT_THEMES } from '@/utils/themes';
import { useLicense } from '@/hooks/useLicense';
import DemoWatermark from '@/components/DemoWatermark';

/**
 * Calculate optimal font size based on text length and verse count
 * Returns a multiplier to apply to the base font size
 */
function calculateFontScale(text: string, verseCount: number = 1): number {
    const charCount = text.length;

    // Base thresholds for single verse
    // Short text (< 150 chars): full size
    // Medium text (150-300 chars): scale down slightly
    // Long text (300-500 chars): scale down more
    // Very long text (500+ chars): scale down significantly

    let scale = 1;

    if (verseCount === 1) {
        if (charCount < 150) scale = 1;
        else if (charCount < 250) scale = 0.9;
        else if (charCount < 350) scale = 0.8;
        else if (charCount < 450) scale = 0.7;
        else if (charCount < 600) scale = 0.6;
        else if (charCount < 800) scale = 0.5;
        else scale = 0.4;
    } else if (verseCount === 2) {
        if (charCount < 300) scale = 0.85;
        else if (charCount < 450) scale = 0.75;
        else if (charCount < 600) scale = 0.65;
        else if (charCount < 800) scale = 0.55;
        else scale = 0.45;
    } else {
        // 3+ verses
        if (charCount < 400) scale = 0.7;
        else if (charCount < 600) scale = 0.6;
        else if (charCount < 800) scale = 0.5;
        else if (charCount < 1000) scale = 0.45;
        else scale = 0.38;
    }

    return scale;
}

// Generic Content Type
type ProjectorContent = {
    type: 'verse' | 'song' | 'media';
    title: string;          // e.g. "John 3:16" or "Amazing Grace"
    body: string;           // e.g. The text or lyrics
    meta?: string;          // e.g. "KJV" or "John Newton"
    footer?: string;        // Bottom text
    background?: string;    // URL for BG video/image
    verses?: { verseNum: number; text: string }[]; // Keep for multi-verse backward compat
    options?: {
        imageMode?: 'contain' | 'cover' | 'stretch';
    };
};

export default function ProjectorPage() {
    // License check
    const { isDemo, loading } = useLicense();

    // Separate State (The "Layers")
    const [activeContent, setActiveContent] = useState<ProjectorContent | null>(null);
    const [activeBackground, setActiveBackground] = useState<string | null>(null);
    const [activeTheme, setActiveTheme] = useState<ProjectorTheme>(DEFAULT_THEMES[0]);
    const [activeAlert, setActiveAlert] = useState<string | null>(null);

    const handleMessage = useCallback((msg: any) => {
        // Handle Legacy SHOW_VERSE -> Convert to Layered Content
        if (msg.type === 'SHOW_VERSE') {
            setActiveContent({
                type: 'verse',
                title: msg.payload.reference,
                body: msg.payload.text,
                meta: msg.payload.version,
                verses: msg.payload.verses
            });
        }
        // Handle Generic SHOW_CONTENT
        else if (msg.type === 'SHOW_CONTENT') {
            setActiveContent(msg.payload);
            if (msg.payload.background) {
                setActiveBackground(msg.payload.background);
            }
        }
        // Clear Content Only (Keep BG running)
        else if (msg.type === 'CLEAR') {
            setActiveContent(null);
        }
        // Blackout (Clear Everything)
        else if (msg.type === 'BLACKOUT') {
            setActiveContent(null);
            setActiveBackground(null);
        }
        // Helper to apply theme background
        else if (msg.type === 'APPLY_THEME') {
            const newTheme = msg.payload as ProjectorTheme;
            setActiveTheme(newTheme);
            // Apply background if needed (ProjectorView usually layers Background separately)
            // VisualStack probably handles the background state??
            // Currently activeBackground is simple string.
            // If theme.background.type is image/gradient/color, we pass it.
            // Depending on VisualStack implementation.
            // Let's assume activeBackground string is CSS background value or URL.
            // If theme has image, value is URL.
            // If theme has gradient/color, value is that.
            // We set it to trigger VisualStack Update.
            if (newTheme.background) {
                // We need to differentiate URL vs CSS value?
                // VisualStack probably decides.
                // Let's look at VisualStack later.
                // For now set it.
                setActiveBackground(newTheme.background.value);
            }
        }
        else if (msg.type === 'ALERT') {
            setActiveAlert(msg.payload.text);
            setTimeout(() => setActiveAlert(null), msg.payload.duration || 5000);
        }
    }, []);

    useBroadcastChannel('projector_channel', handleMessage);

    // Render the Content Layer components
    const renderContent = () => {
        if (!activeContent) return null;

        // Handle Media (Images)
        if (activeContent.type === 'media') {
            const mode = activeContent.options?.imageMode || 'contain';
            const objectFitClass = mode === 'cover' ? 'object-cover' : mode === 'stretch' ? 'object-fill' : 'object-contain';

            return (
                <div className="z-10 w-full h-full flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-500">
                    <img
                        src={activeContent.body}
                        alt={activeContent.title}
                        className={`max-w-full max-h-full ${mode === 'cover' ? 'w-full h-full' : 'max-h-[85vh]'} ${objectFitClass} drop-shadow-2xl rounded-lg`}
                    />
                </div>
            );
        }

        const themeStyle = {
            fontFamily: activeTheme.styles.fontFamily,
            color: activeTheme.styles.color,
            textShadow: activeTheme.styles.textShadow,
            fontWeight: activeTheme.styles.fontWeight,
            textAlign: activeTheme.styles.textAlign || 'center',
            fontSize: activeTheme.styles.fontSize,
            textTransform: activeTheme.styles.textTransform || 'none'
        };

        const layout = activeTheme.layout || { referencePosition: 'bottom', referenceScale: 1, showVerseNumbers: true };
        const refScale = layout.referenceScale || 1;
        const ReferenceComponent = (activeContent.title || activeContent.meta) ? (
            <div className="opacity-90 w-full mb-8 relative z-20" style={{
                textAlign: activeTheme.styles.textAlign,
                order: layout.referencePosition === 'top' ? -1 : 1,
                marginBottom: layout.referencePosition === 'top' ? '2rem' : 0,
                marginTop: layout.referencePosition === 'bottom' ? '2rem' : 0
            }}>
                <h2 className="uppercase tracking-wider font-bold mb-1" style={{
                    fontFamily: activeTheme.styles.fontFamily,
                    color: activeTheme.styles.color,
                    fontSize: `${0.6 * refScale}em`, // Scalable
                    lineHeight: 1.1
                }}>{activeContent.title}</h2>
                {activeContent.meta && <p className="text-sm opacity-70" style={{ color: activeTheme.styles.color }}>{activeContent.meta}</p>}
            </div>
        ) : null;

        return (
            <div
                className="z-10 w-full h-[100vh] animate-in fade-in zoom-in-95 duration-500 px-4"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: activeTheme.styles.alignItems || 'center',
                    justifyContent: activeTheme.styles.justifyContent || 'center',
                    height: '100vh',
                    fontSize: activeTheme.styles.fontSize // PARENT FONT SIZE SET HERE
                }}
            >
                {layout.referencePosition === 'top' && ReferenceComponent}

                {/* Body Text - with smart auto-sizing */}
                {activeContent.verses && activeContent.verses.length > 1 ? (
                    (() => {
                        // Calculate total text for auto-sizing
                        const totalText = activeContent.verses.map(v => v.text).join(' ');
                        const fontScale = calculateFontScale(totalText, activeContent.verses.length);

                        return (
                            <div className="space-y-2 w-full">
                                {activeContent.verses.map((v, idx) => (
                                    <div key={idx} className="flex items-start gap-4" style={{ justifyContent: activeTheme.styles.textAlign === 'center' ? 'center' : activeTheme.styles.textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
                                        {layout.showVerseNumbers && (
                                            <span className="text-[50%] opacity-60 font-mono mt-2 flex-shrink-0" style={{ color: activeTheme.styles.color }}>{v.verseNum}</span>
                                        )}
                                        <p style={{
                                            ...themeStyle,
                                            // Dynamic font scaling based on total text length
                                            fontSize: `${fontScale}em`,
                                            textAlign: 'left',
                                            lineHeight: 1.25,
                                            transition: 'font-size 0.3s ease-out'
                                        }}>
                                            {v.text}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        );
                    })()
                ) : (
                    (() => {
                        // Calculate font scale for single verse
                        const fontScale = calculateFontScale(activeContent.body, 1);

                        return (
                            <div className="flex items-start gap-4 relative w-full" style={{ justifyContent: activeTheme.styles.textAlign === 'center' ? 'center' : activeTheme.styles.textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
                                {layout.showVerseNumbers && activeContent.verses && activeContent.verses[0] && (
                                    <span className="text-[50%] opacity-60 font-mono mt-[0.2em] flex-shrink-0 select-none" style={{ color: activeTheme.styles.color }}>
                                        {activeContent.verses[0].verseNum}
                                    </span>
                                )}
                                <p style={{
                                    ...themeStyle,
                                    fontSize: `${fontScale}em`,
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: 1.25,
                                    transition: 'font-size 0.3s ease-out'
                                }}>
                                    {activeContent.body}
                                </p>
                            </div>
                        );
                    })()
                )}

                {layout.referencePosition === 'bottom' && ReferenceComponent}
            </div>
        );
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    return (
        <div onDoubleClick={toggleFullscreen} className="h-full w-full">
            <VisualStack
                background={activeBackground}
                content={renderContent()}
                alert={activeAlert}
            />
            {/* Show watermark for demo/unlicensed users */}
            {isDemo && !loading && <DemoWatermark />}
        </div>
    );
}
