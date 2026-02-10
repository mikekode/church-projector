"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useBroadcastChannel } from '@/hooks/useBroadcast';
import VisualStack from '@/components/projector/VisualStack';
import { ProjectorTheme, DEFAULT_THEMES } from '@/utils/themes';
import { useLicense } from '@/hooks/useLicense';
import DemoWatermark from '@/components/DemoWatermark';
import LiveFeedStream from '@/components/projector/LiveFeedStream';

/**
 * Sanitize and render formatted text (allows only safe tags: b, i, span with style)
 * Converts newlines to <br> for proper display
 */
function renderFormattedText(text: string): string {
    // First, escape any potentially dangerous content except our allowed tags
    let safe = text
        // Preserve our allowed formatting tags
        .replace(/<b>/gi, '___BOLD_OPEN___')
        .replace(/<\/b>/gi, '___BOLD_CLOSE___')
        .replace(/<i>/gi, '___ITALIC_OPEN___')
        .replace(/<\/i>/gi, '___ITALIC_CLOSE___')
        .replace(/<span style="color:([^"]+)">/gi, (_, color) => '___SPAN_' + color + '___')
        .replace(/<\/span>/gi, '___SPAN_CLOSE___');

    // Escape remaining HTML
    safe = safe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Restore our allowed tags
    safe = safe
        .replace(/___BOLD_OPEN___/g, '<b>')
        .replace(/___BOLD_CLOSE___/g, '</b>')
        .replace(/___ITALIC_OPEN___/g, '<i>')
        .replace(/___ITALIC_CLOSE___/g, '</i>')
        .replace(/___SPAN_([^_]+)___/g, '<span style="color:$1">')
        .replace(/___SPAN_CLOSE___/g, '</span>');

    // Convert newlines to <br> for display
    safe = safe.replace(/\n/g, '<br>');

    return safe;
}



/**
 * Calculate optimal font size based on text length and verse count
 * Returns a multiplier to apply to the base font size
 */
function calculateFontScale(text: string, verseCount: number = 1, textScale?: number): number {
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

    return scale * (textScale || 1);
}

// Generic Content Type
type ProjectorContent = {
    type: 'verse' | 'song' | 'media' | 'live_feed';
    title: string;          // e.g. "John 3:16" or "Amazing Grace"
    body: string;           // e.g. The text or lyrics or sourceId for live_feed
    meta?: string;          // e.g. "KJV" or "John Newton"
    footer?: string;        // Bottom text
    background?: string;    // URL for BG video/image
    verses?: { verseNum: number; text: string }[]; // Keep for multi-verse backward compat
    options?: {
        imageMode?: 'contain' | 'cover' | 'stretch';
        scale?: number;
        isAudioOnly?: boolean;
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

    // Video References
    const videoRef = useRef<HTMLVideoElement>(null);
    const liveFeedRef = useRef<HTMLVideoElement>(null);

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
            console.log('[Projector] Applying theme:', newTheme.name, newTheme.layout);
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
        else if (msg.type === 'MEDIA_ACTION') {
            const { action, value } = msg.payload;
            if (videoRef.current) {
                switch (action) {
                    case 'play':
                        videoRef.current.play().catch(console.error);
                        break;
                    case 'pause':
                        videoRef.current.pause();
                        break;
                    case 'toggle_play':
                        if (videoRef.current.paused) videoRef.current.play().catch(console.error);
                        else videoRef.current.pause();
                        break;
                    case 'seek':
                        videoRef.current.currentTime += value;
                        break;
                    case 'set_time':
                        videoRef.current.currentTime = value;
                        break;
                    case 'rate':
                        videoRef.current.playbackRate = value;
                        break;
                    case 'set_mode':
                        setActiveContent(prev => {
                            if (prev && prev.type === 'media') {
                                return { ...prev, options: { ...prev.options, imageMode: value } };
                            }
                            return prev;
                        });
                        break;
                    case 'set_scale':
                        setActiveContent(prev => {
                            if (!prev) return null;
                            return {
                                ...prev,
                                options: {
                                    ...(prev.options || {}),
                                    scale: value
                                }
                            };
                        });
                        break;
                    case 'set_audio_only':
                        setActiveContent(prev => {
                            if (!prev) return null;
                            return {
                                ...prev,
                                options: {
                                    ...(prev.options || {}),
                                    isAudioOnly: value
                                }
                            };
                        });
                        break;
                }
            }

        }
    }, []);

    const { broadcast } = useBroadcastChannel('projector_channel', handleMessage);

    useEffect(() => {
        broadcast({ type: 'REQUEST_STATE' });
    }, [broadcast]);

    // Render the Content Layer components
    const renderContent = () => {
        if (!activeContent) return null;

        // Handle Media (Images)
        if (activeContent.type === 'media') {
            const mode = activeContent.options?.imageMode || 'contain';
            const scale = activeContent.options?.scale || 1;
            const isFillMode = mode === 'cover' || mode === 'stretch';
            const objectFitClass = mode === 'cover' ? 'object-cover' : mode === 'stretch' ? 'object-fill' : 'object-contain';

            const isVideo = activeContent.body?.match(/\.(mp4|webm|mov|ogg)(\?|$)/i) ||
                activeContent.body?.startsWith('data:video/') ||
                activeContent.body?.startsWith('blob:');

            return (
                <div className="z-10 w-full h-full flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-500 overflow-hidden relative">
                    {/* Audio Only Indicator */}
                    {activeContent.options?.isAudioOnly && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black gap-4">
                            <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center animate-pulse">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>
                            </div>
                            <span className="text-zinc-500 font-mono text-xs tracking-widest uppercase">Audio Playing</span>
                        </div>
                    )}

                    {isVideo ? (
                        <video
                            ref={videoRef}
                            src={activeContent.body}
                            className={`max-w-full max-h-full ${isFillMode ? 'w-full h-full' : ''} ${objectFitClass} transition-all duration-300 ${activeContent.options?.isAudioOnly ? 'opacity-0' : 'opacity-100'}`}
                            style={{ transform: `scale(${scale})` }}
                            autoPlay
                            loop
                            playsInline
                        />
                    ) : (
                        <img
                            src={activeContent.body}
                            alt={activeContent.title}
                            className={`max-w-full max-h-full ${isFillMode ? 'w-full h-full' : ''} ${objectFitClass} transition-all duration-300`}
                            style={{ transform: `scale(${scale})` }}
                        />
                    )}
                </div>
            );
        }

        // Handle Live Feed Routing (VLC, OBS, etc.)
        if (activeContent.type === 'live_feed') {
            const sourceId = activeContent.body;
            const mode = activeContent.options?.imageMode || 'contain';
            const scale = activeContent.options?.scale || 1;
            const isFillMode = mode === 'cover' || mode === 'stretch';
            const objectFitClass = mode === 'cover' ? 'object-cover' : mode === 'stretch' ? 'object-fill' : 'object-contain';

            return (
                <div className="z-10 w-full h-full flex items-center justify-center animate-in fade-in zoom-in-95 duration-700 overflow-hidden relative">
                    {/* Audio Only Indicator */}
                    {activeContent.options?.isAudioOnly && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black gap-4">
                            <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center animate-pulse">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>
                            </div>
                            <span className="text-zinc-500 font-mono text-xs tracking-widest uppercase">Audio Playing</span>
                        </div>
                    )}

                    <LiveFeedStream
                        sourceId={sourceId}
                        className={`max-w-full max-h-full ${isFillMode ? 'w-full h-full' : ''} ${objectFitClass} transition-all duration-300 ${activeContent.options?.isAudioOnly ? 'opacity-0' : 'opacity-100'}`}
                        style={{ transform: `scale(${scale})` }}
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
        const verseNumScale = layout.verseNumberScale || 0.5;

        const ReferenceComponent = (activeContent.title || activeContent.meta) ? (
            <div className="opacity-90 w-full mb-8 relative z-20" style={{
                textAlign: activeTheme.styles.textAlign,
                order: layout.referencePosition === 'top' ? -1 : 1,
                marginBottom: layout.referencePosition === 'top' ? '2rem' : 0,
                marginTop: layout.referencePosition === 'bottom' ? '2rem' : 0
            }}>
                <h2 className="uppercase tracking-wider font-bold mb-1" style={{
                    fontFamily: activeTheme.styles.fontFamily,
                    color: layout.referenceColor || activeTheme.styles.color,
                    fontSize: `${0.6 * refScale}em`, // Scalable
                    lineHeight: 1.1
                }}>{activeContent.title}</h2>
                {activeContent.meta && (
                    <p className="text-sm opacity-70" style={{ color: layout.versionColor || activeTheme.styles.color }}>
                        {activeContent.meta}
                    </p>
                )}
            </div>
        ) : null;

        return (
            <div
                className="z-10 w-full h-full animate-in fade-in zoom-in-95 duration-500"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: activeTheme.styles.alignItems || 'center',
                    justifyContent: activeTheme.styles.justifyContent || 'center',
                    fontSize: activeTheme.styles.fontSize // PARENT FONT SIZE SET HERE
                }}
            >
                {layout.referencePosition === 'top' && ReferenceComponent}

                {/* Body Text - with smart auto-sizing */}
                {activeContent.verses && activeContent.verses.length > 1 ? (
                    (() => {
                        // Calculate total text for auto-sizing
                        const totalText = activeContent.verses.map(v => v.text).join(' ');
                        const fontScale = calculateFontScale(totalText, activeContent.verses.length, activeTheme.layout?.textScale);

                        return (
                            <div className="space-y-2 w-full">
                                {activeContent.verses.map((v, idx) => (
                                    <div key={idx} className="flex items-start gap-4" style={{ justifyContent: activeTheme.styles.textAlign === 'center' ? 'center' : activeTheme.styles.textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
                                        {layout.showVerseNumbers && (
                                            <span className="opacity-60 font-mono mt-2 flex-shrink-0" style={{
                                                color: layout.verseNumberColor || activeTheme.styles.color,
                                                fontSize: `${verseNumScale * 100}%`,
                                                lineHeight: 1.5
                                            }}>{v.verseNum}</span>
                                        )}
                                        <p style={{
                                            ...themeStyle,
                                            // Dynamic font scaling based on total text length
                                            fontSize: `${fontScale}em`,
                                            textAlign: 'left',
                                            lineHeight: 1.25,
                                            transition: 'font-size 0.3s ease-out'
                                        }}
                                            dangerouslySetInnerHTML={{ __html: renderFormattedText(v.text) }}
                                        />
                                    </div>
                                ))}
                            </div>
                        );
                    })()
                ) : (
                    (() => {
                        // Calculate font scale for single verse
                        const fontScale = calculateFontScale(activeContent.body, 1, activeTheme.layout?.textScale);

                        return (
                            <div className="flex items-start gap-4 relative w-full" style={{ justifyContent: activeTheme.styles.textAlign === 'center' ? 'center' : activeTheme.styles.textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
                                {layout.showVerseNumbers && activeContent.verses && activeContent.verses[0] && (
                                    <span className="opacity-60 font-mono mt-[0.2em] flex-shrink-0 select-none" style={{
                                        color: layout.verseNumberColor || activeTheme.styles.color,
                                        fontSize: `${verseNumScale * 100}%`,
                                        lineHeight: 1.5
                                    }}>
                                        {activeContent.verses[0].verseNum}
                                    </span>
                                )}
                                <p style={{
                                    ...themeStyle,
                                    fontSize: `${fontScale}em`,
                                    lineHeight: 1.25,
                                    transition: 'font-size 0.3s ease-out'
                                }}
                                    dangerouslySetInnerHTML={{ __html: renderFormattedText(activeContent.body) }}
                                />
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
                theme={activeTheme}
                content={renderContent()}
                alert={activeAlert}
                fullBleed={activeContent?.type === 'media' || activeContent?.type === 'live_feed'}
            />
            {/* Show watermark for demo/unlicensed users */}
            {isDemo && !loading && <DemoWatermark />}
        </div>
    );
}
