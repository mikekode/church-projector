"use client";

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useBroadcastChannel } from '@/hooks/useBroadcast';
import { Clock, ChevronRight, Music, BookOpen, Image, AlertCircle } from 'lucide-react';
import { useLicense } from '@/hooks/useLicense';
import DemoWatermark from '@/components/DemoWatermark';
import { ProjectorTheme, DEFAULT_THEMES } from '@/utils/themes';
import LiveFeedStream from '@/components/projector/LiveFeedStream';

/**
 * Render formatted text with allowed HTML tags (b, i, font/span with color)
 */
function renderFormattedText(text: string | undefined): string {
    if (!text) return '';
    let safe = text
        .replace(/<b>/gi, '___BOLD_OPEN___')
        .replace(/<\/b>/gi, '___BOLD_CLOSE___')
        .replace(/<i>/gi, '___ITALIC_OPEN___')
        .replace(/<\/i>/gi, '___ITALIC_CLOSE___')
        .replace(/<font color="([^"]+)">/gi, (_, color) => '___FONT_' + color + '___')
        .replace(/<\/font>/gi, '___FONT_CLOSE___')
        .replace(/<span style="color:([^"]+)">/gi, (_, color) => '___SPAN_' + color + '___')
        .replace(/<\/span>/gi, '___SPAN_CLOSE___');

    safe = safe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    safe = safe
        .replace(/___BOLD_OPEN___/g, '<b>')
        .replace(/___BOLD_CLOSE___/g, '</b>')
        .replace(/___ITALIC_OPEN___/g, '<i>')
        .replace(/___ITALIC_CLOSE___/g, '</i>')
        .replace(/___FONT_([^_]+)___/g, '<span style="color:$1">')
        .replace(/___FONT_CLOSE___/g, '</span>')
        .replace(/___SPAN_([^_]+)___/g, '<span style="color:$1">')
        .replace(/___SPAN_CLOSE___/g, '</span>');

    safe = safe.replace(/\n/g, '<br>');
    return safe;
}

/**
 * Calculate optimal font size based on text length and optional verse count
 * Returns a multiplier to apply to the base font size
 */
function calculateFontScale(text: string | undefined, verseCount: number = 1): number {
    if (!text) return 1;
    const charCount = text.length;

    // Stage display scale thresholds (more generous than projector for visibility)
    let scale = 1;

    if (verseCount === 1) {
        if (charCount < 100) scale = 1;
        else if (charCount < 200) scale = 0.95;
        else if (charCount < 300) scale = 0.85;
        else if (charCount < 450) scale = 0.75;
        else if (charCount < 600) scale = 0.65;
        else if (charCount < 800) scale = 0.55;
        else scale = 0.45;
    } else if (verseCount === 2) {
        if (charCount < 250) scale = 0.9;
        else if (charCount < 400) scale = 0.8;
        else if (charCount < 600) scale = 0.7;
        else if (charCount < 800) scale = 0.6;
        else scale = 0.5;
    } else {
        // 3+ verses
        if (charCount < 350) scale = 0.8;
        else if (charCount < 550) scale = 0.7;
        else if (charCount < 750) scale = 0.6;
        else if (charCount < 1000) scale = 0.5;
        else scale = 0.42;
    }

    return scale;
}

interface StageContent {
    type: 'verse' | 'song' | 'media' | 'live_feed' | 'clear';
    reference?: string;
    text?: string;
    version?: string;
    title?: string;
    currentSlide?: string;
    nextSlide?: string;
    slideIndex?: number;
    totalSlides?: number;
    scale?: number;
    imageMode?: 'contain' | 'cover' | 'stretch';
    verses?: { verseNum: number; text: string }[];
    background?: string;
    isAudioOnly?: boolean;
}

export default function StageDisplayPage() {
    const { isDemo, loading } = useLicense();
    const [content, setContent] = useState<StageContent | null>(null);
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const [timerMode, setTimerMode] = useState<'countup' | 'countdown'>('countup');
    const [targetSeconds, setTargetSeconds] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [pausedAt, setPausedAt] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState('00:00:00');
    // RESTORED STATE
    const [notes, setNotes] = useState('');
    const [timerAlert, setTimerAlert] = useState<string | null>(null);
    const [showHint, setShowHint] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [activeTheme, setActiveTheme] = useState<ProjectorTheme>(DEFAULT_THEMES[0]);

    // Video and Layout References
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [fitScale, setFitScale] = useState(1);

    // Broadcast Subscription
    const { broadcast } = useBroadcastChannel('projector_channel');
    useEffect(() => {
        broadcast({ type: 'REQUEST_STATE' });
    }, [broadcast]);
    const { subscribe } = useBroadcastChannel('projector_channel', (message: any) => {
        if (message.type === 'SHOW_VERSE') {
            setContent({
                type: 'verse',
                reference: message.payload.reference,
                text: message.payload.text,
                version: message.payload.version,
                verses: message.payload.verses,
            });
            setFitScale(1); // Reset scale on new content
        } else if (message.type === 'SHOW_CONTENT') {
            const payload = message.payload;
            if (payload.type === 'song') {
                setContent({
                    type: 'song',
                    title: payload.title,
                    currentSlide: payload.body,
                    nextSlide: payload.nextSlide,
                    slideIndex: payload.slideIndex,
                    totalSlides: payload.totalSlides,
                    background: payload.background,
                });
                setFitScale(1); // Reset scale on new content
            } else if (payload.type === 'media') {
                setContent({
                    type: 'media',
                    title: payload.title,
                    currentSlide: payload.body,
                    scale: payload.options?.scale || 1,
                    imageMode: payload.options?.imageMode || 'contain',
                    isAudioOnly: payload.options?.isAudioOnly
                });
                setFitScale(1); // Reset scale on new content
            } else if (payload.type === 'live_feed') {
                setContent({
                    type: 'live_feed',
                    title: payload.title,
                    currentSlide: payload.body, // Source ID
                    scale: payload.options?.scale || 1,
                    imageMode: payload.options?.imageMode || 'contain',
                    isAudioOnly: payload.options?.isAudioOnly
                });
                setFitScale(1);
            }
        } else if (message.type === 'APPLY_THEME') {
            setActiveTheme(message.payload);
        } else if (message.type === 'CLEAR') {
            setContent({ type: 'clear' });
        } else if (message.type === 'STAGE_NOTES') {
            setNotes(message.payload.notes || '');
        } else if (message.type === 'MEDIA_ACTION') {
            // Sync Media Controls
            const { action, value } = message.payload;

            // Handle content state updates (works for images AND videos)
            if (action === 'set_mode') {
                setContent(prev => {
                    if (prev && (prev.type === 'media' || prev.type === 'live_feed')) {
                        return { ...prev, imageMode: value };
                    }
                    return prev;
                });
            } else if (action === 'set_scale') {
                setContent(prev => {
                    if (prev && (prev.type === 'media' || prev.type === 'live_feed')) {
                        return { ...prev, scale: value };
                    }
                    return prev;
                });
            } else if (action === 'set_audio_only') {
                setContent(prev => {
                    if (prev && (prev.type === 'media' || prev.type === 'live_feed')) {
                        return { ...prev, isAudioOnly: value };
                    }
                    return prev;
                });
            }

            // Handle video-specific controls
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
                }
            }
        }
        // TIMER CONTROLS
        else if (message.type === 'TIMER_ACTION') {
            const { action, value, mode, alert } = message.payload;
            if (action === 'set') {
                setTimerMode(mode || 'countup');
                setTargetSeconds(value || 0);
                setElapsedTime(
                    new Date((value || 0) * 1000).toISOString().substr(11, 8)
                );
                setIsRunning(false);
                setStartTime(null);
                setPausedAt(null);
                setTimerAlert(alert || null);
            } else if (action === 'start') {
                if (!isRunning) {
                    const now = Date.now();
                    // Resume or Start
                    if (pausedAt && startTime) {
                        // Shift start time forward by pause duration
                        const pauseDuration = now - pausedAt;
                        setStartTime(startTime + pauseDuration);
                    } else {
                        setStartTime(now);
                    }
                    setIsRunning(true);
                    setPausedAt(null);
                }
            } else if (action === 'pause') {
                if (isRunning) {
                    setIsRunning(false);
                    setPausedAt(Date.now());
                }
            } else if (action === 'reset') {
                setIsRunning(false);
                setStartTime(null);
                setPausedAt(null);
                setElapsedTime('00:00:00');
                if (timerMode === 'countdown') {
                    const total = targetSeconds;
                    const h = Math.floor(total / 3600);
                    const m = Math.floor((total % 3600) / 60);
                    const s = total % 60;
                    setElapsedTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
                }
            }
        } else if (message.type === 'APPLY_THEME') {
            console.log('[Stage] Applying new theme:', message.payload.name);
            setActiveTheme(message.payload);
        }
    });

    // Sync Status to Dashboard
    useEffect(() => {
        broadcast({
            type: 'TIMER_STATUS',
            payload: {
                isRunning,
                isPaused: !!pausedAt,
                elapsedTime // Optional sync
            }
        });
    }, [isRunning, pausedAt, broadcast, elapsedTime]);

    // Clock Update (Time of Day)
    useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Auto-hide footer hint after 5 seconds
    useEffect(() => {
        const timer = setTimeout(() => setShowHint(false), 5000);
        return () => clearTimeout(timer);
    }, []);

    // Timer Interval
    useEffect(() => {
        if (!isRunning || !startTime) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const totalElapsedSeconds = Math.floor((now - startTime) / 1000);

            let displaySeconds = 0;
            if (timerMode === 'countup') {
                displaySeconds = totalElapsedSeconds;
            } else {
                displaySeconds = Math.max(0, targetSeconds - totalElapsedSeconds);
            }

            const h = Math.floor(displaySeconds / 3600);
            const m = Math.floor((displaySeconds % 3600) / 60);
            const s = displaySeconds % 60;
            setElapsedTime(
                `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
            );
        }, 200);

        return () => clearInterval(interval);
    }, [isRunning, startTime, targetSeconds, timerMode]);

    // Cleanup interval just in case

    // Fullscreen toggle
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    // Resilient Auto-Fitting Logic
    useLayoutEffect(() => {
        if (!containerRef.current || !contentRef.current || !content) return;

        // BYPASS FOR MEDIA & LIVE FEED - Always 1:1 scale unless user manually scales
        if (content.type === 'media' || content.type === 'live_feed') {
            setFitScale(1);
            return;
        }

        const checkFit = () => {
            const container = containerRef.current!;
            const contentEl = contentRef.current!;

            // Allow small buffer (20px) to prevent scroll flickering
            const isOverflowing = contentEl.scrollHeight > container.clientHeight - 20;

            if (isOverflowing && fitScale > 0.2) {
                // Iteratively shrink by a larger step if way off, smaller if close
                const overflowArea = contentEl.scrollHeight / container.clientHeight;
                const step = overflowArea > 1.3 ? 0.08 : 0.03;
                setFitScale(prev => Math.max(0.2, prev - step));
            }
        };

        // Small delay to ensure styles are applied
        const timer = setTimeout(checkFit, 30);
        return () => clearTimeout(timer);
    }, [content, fitScale, activeTheme]);

    return (
        <div
            className="h-screen w-screen text-white font-sans overflow-hidden select-none relative"
            onDoubleClick={toggleFullscreen}
            style={{
                backgroundColor: activeTheme.background?.type === 'color' ? activeTheme.background.value : 'black',
                backgroundImage: activeTheme.background?.type === 'image' ? `url(${activeTheme.background.value})` :
                    activeTheme.background?.type === 'gradient' ? activeTheme.background.value : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                transition: 'all 0.5s ease-in-out'
            }}
        >
            {/* Background Overlay */}
            {activeTheme.background?.overlayOpacity > 0 && (
                <div
                    className="absolute inset-0 z-0"
                    style={{
                        backgroundColor: `rgba(0,0,0,${activeTheme.background.overlayOpacity})`,
                        backdropFilter: activeTheme.background.blur ? `blur(${activeTheme.background.blur}px)` : 'none'
                    }}
                />
            )}

            {/* Media Content - Outside transform to allow full screen */}
            {content?.type === 'media' && (
                <div className="fixed left-0 right-0 bottom-0 top-[5rem] z-[40] bg-black flex items-center justify-center">
                    {content.isAudioOnly ? (
                        <div className="flex flex-col items-center justify-center text-zinc-500 gap-4">
                            <div className="w-24 h-24 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                                <Music size={48} />
                            </div>
                            <div className="text-xl font-bold tracking-widest uppercase">Audio Only</div>
                        </div>
                    ) : (
                        (() => {
                            const mediaUrl = content.text || content.currentSlide;
                            const isVideo = mediaUrl?.match(/\.(mp4|webm|mov|ogg)(\?|$)/i) ||
                                mediaUrl?.startsWith('data:video/') ||
                                mediaUrl?.startsWith('blob:');

                            const mode = content.imageMode || 'contain';
                            const objectFitClass = mode === 'cover' ? 'object-cover' : mode === 'stretch' ? 'object-fill' : 'object-contain';

                            return isVideo ? (
                                <video
                                    key={mediaUrl}
                                    ref={videoRef}
                                    src={mediaUrl}
                                    className={`w-full h-full ${objectFitClass} transition-all duration-300`}
                                    style={{ transform: `scale(${content.scale || 1})` }}
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                />
                            ) : (
                                <img
                                    src={mediaUrl}
                                    alt={content.title}
                                    className={`w-full h-full ${objectFitClass} transition-all duration-300`}
                                    style={{ transform: `scale(${content.scale || 1})` }}
                                />
                            );
                        })()
                    )}
                </div>
            )}

            {content?.type === 'live_feed' && (
                <div className="fixed left-0 right-0 bottom-0 top-[5rem] z-[40] bg-black flex items-center justify-center">
                    {content.isAudioOnly ? (
                        <div className="flex flex-col items-center justify-center text-zinc-500 gap-4">
                            <div className="w-24 h-24 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                                <Music size={48} />
                            </div>
                            <div className="text-xl font-bold tracking-widest uppercase">Audio Only</div>
                        </div>
                    ) : (
                        <LiveFeedStream
                            sourceId={content.currentSlide || ''}
                            className={`w-full h-full ${content.imageMode === 'stretch' ? 'object-fill' : content.imageMode === 'cover' ? 'object-cover' : 'object-contain'}`}
                        />
                    )}
                </div>
            )}
            {/* Top Bar - Clock & Timer */}
            <div className="fixed top-0 left-0 right-0 bg-zinc-900/80 backdrop-blur-md border-b border-white/10 px-6 py-4 flex justify-between items-center z-50">
                <div className="flex items-center gap-8">
                    {/* Current Time */}
                    <div className="text-center">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">Current Time</p>
                        <p className="text-3xl font-mono font-bold text-white">
                            {currentTime ? formatTime(currentTime) : '--:----'}
                        </p>
                    </div>

                    {/* Service Timer */}
                    <div className="text-center">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">Service Timer</p>
                        <p className={`text-3xl font-mono font-bold ${isRunning ? 'text-green-400' : pausedAt ? 'text-amber-400' : 'text-zinc-600'}`}>
                            {elapsedTime}
                        </p>
                    </div>
                </div>

                {/* Content Type Indicator */}
                <div className="flex items-center gap-3">
                    {content?.type === 'verse' && (
                        <div className="flex items-center gap-2 bg-blue-600/20 text-blue-400 px-4 py-2 rounded-full">
                            <BookOpen size={18} />
                            <span className="font-semibold">SCRIPTURE</span>
                        </div>
                    )}
                    {content?.type === 'song' && (
                        <div className="flex items-center gap-2 bg-purple-600/20 text-purple-400 px-4 py-2 rounded-full">
                            <Music size={18} />
                            <span className="font-semibold">LYRICS</span>
                        </div>
                    )}
                    {content?.type === 'media' && (
                        <div className="flex items-center gap-2 bg-amber-600/20 text-amber-400 px-4 py-2 rounded-full">
                            <Image size={18} />
                            <span className="font-semibold">MEDIA</span>
                        </div>
                    )}
                    {(!content || content.type === 'clear') && (
                        <div className="flex items-center gap-2 bg-zinc-800 text-zinc-500 px-4 py-2 rounded-full">
                            <AlertCircle size={18} />
                            <span className="font-semibold">STANDBY</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div
                ref={containerRef}
                className="flex-1 h-full flex flex-col overflow-hidden relative z-10 transition-all duration-300"
                style={{
                    paddingTop: activeTheme.layout?.contentPadding !== undefined ?
                        (content?.type === 'media' || content?.type === 'live_feed' ? `${activeTheme.layout.contentPadding}px` : `${Math.max(activeTheme.layout.contentPadding, 96)}px`) : '6rem',
                    paddingBottom: activeTheme.layout?.contentPadding !== undefined ?
                        (content?.type === 'media' || content?.type === 'live_feed' ? `${activeTheme.layout.contentPadding}px` : `${Math.max(activeTheme.layout.contentPadding, 80)}px`) : '5rem',
                    paddingLeft: activeTheme.layout?.contentPadding !== undefined ? `${activeTheme.layout.contentPadding}px` : '2rem',
                    paddingRight: activeTheme.layout?.contentPadding !== undefined ? `${activeTheme.layout.contentPadding}px` : '2rem',
                }}
            >
                {/* Current Content - Large Display */}
                <div
                    ref={contentRef}
                    className="flex-1 flex items-center justify-center w-full"
                    style={{
                        fontSize: activeTheme.styles.fontSize,
                        transform: `scale(${fitScale})`,
                        transformOrigin: 'center center',
                    }}
                >
                    {content?.type === 'verse' && (
                        <div
                            className="text-center w-full flex flex-col"
                            style={{
                                alignItems: activeTheme.styles.alignItems || 'center',
                                justifyContent: activeTheme.styles.justifyContent || 'center',
                            }}
                        >
                            <p
                                className="font-bold mb-4 tracking-wide uppercase"
                                style={{
                                    fontFamily: activeTheme.styles.fontFamily,
                                    color: activeTheme.layout?.referenceColor || activeTheme.styles.color,
                                    fontSize: `${0.6 * (activeTheme.layout?.referenceScale || 1)}em`,
                                    textAlign: activeTheme.styles.textAlign
                                }}
                            >
                                {content.reference}
                                {content.version && (
                                    <span className="ml-2 opacity-70" style={{ color: activeTheme.layout?.versionColor || activeTheme.layout?.referenceColor || activeTheme.styles.color }}>
                                        [{content.version}]
                                    </span>
                                )}
                            </p>
                            <div
                                className={`font-bold leading-tight transition-all duration-300 w-full`}
                                style={{
                                    fontFamily: activeTheme.styles.fontFamily,
                                    color: activeTheme.styles.color === '#ffffff' ? 'white' : activeTheme.styles.color,
                                    textShadow: activeTheme.styles.textShadow || '0 2px 4px rgba(0,0,0,0.5)',
                                    textTransform: activeTheme.styles.textTransform,
                                    letterSpacing: activeTheme.styles.letterSpacing,
                                }}
                            >
                                {content.verses && content.verses.length > 1 ? (
                                    (() => {
                                        const totalText = content.verses.map(v => v.text).join(' ');
                                        const fontScale = calculateFontScale(totalText, content.verses.length);
                                        return (
                                            <div className="space-y-4 w-full">
                                                {content.verses.map((v, idx) => (
                                                    <div key={idx} className="flex items-start gap-4" style={{ justifyContent: activeTheme.styles.textAlign === 'center' ? 'center' : activeTheme.styles.textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
                                                        {(activeTheme.layout?.showVerseNumbers !== false) && (
                                                            <span className="opacity-60 font-mono mt-1 flex-shrink-0" style={{
                                                                color: activeTheme.layout?.verseNumberColor || activeTheme.styles.color,
                                                                fontSize: `${(activeTheme.layout?.verseNumberScale || 0.5) * 100}%`
                                                            }}>
                                                                {v.verseNum}
                                                            </span>
                                                        )}
                                                        <div
                                                            className="text-left transition-all duration-300"
                                                            style={{ fontSize: `${fontScale}em` }}
                                                            dangerouslySetInnerHTML={{ __html: renderFormattedText(v.text) }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()
                                ) : (
                                    (() => {
                                        const fontScale = calculateFontScale(content.text, 1);
                                        return (
                                            <div className="flex items-start gap-4" style={{ justifyContent: activeTheme.styles.textAlign === 'center' ? 'center' : activeTheme.styles.textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
                                                {(activeTheme.layout?.showVerseNumbers !== false) && content.reference && (
                                                    <span className="opacity-60 font-mono mt-2 flex-shrink-0" style={{
                                                        color: activeTheme.layout?.verseNumberColor || activeTheme.styles.color,
                                                        fontSize: `${(activeTheme.layout?.verseNumberScale || 0.5) * 100}%`
                                                    }}>
                                                        {content.reference.split(':').pop()?.trim()}
                                                    </span>
                                                )}
                                                <div
                                                    className="transition-all duration-300"
                                                    style={{ fontSize: `${fontScale}em` }}
                                                    dangerouslySetInnerHTML={{ __html: renderFormattedText(content.text) }}
                                                />
                                            </div>
                                        );
                                    })()
                                )}
                            </div>
                        </div>
                    )}

                    {content?.type === 'song' && (
                        <div
                            className="text-center w-full"
                            style={{
                                alignItems: activeTheme.styles.alignItems || 'center',
                                justifyContent: activeTheme.styles.justifyContent || 'center',
                            }}
                        >
                            <p
                                className="font-semibold mb-4 tracking-wide uppercase"
                                style={{
                                    color: activeTheme.layout?.referenceColor || 'rgb(192 132 252)' /* purple-400 fallback */,
                                    fontSize: `${0.6 * (activeTheme.layout?.referenceScale || 1)}em`
                                }}
                            >
                                {content.title} • Slide {(content.slideIndex || 0) + 1}/{content.totalSlides || 1}
                            </p>
                            <p
                                className={`font-bold leading-tight transition-all duration-300`}
                                style={{
                                    fontFamily: activeTheme.styles.fontFamily,
                                    color: activeTheme.styles.color === '#ffffff' ? 'white' : activeTheme.styles.color,
                                    textShadow: activeTheme.styles.textShadow || '0 2px 4px rgba(0,0,0,0.5)',
                                    textTransform: activeTheme.styles.textTransform,
                                    letterSpacing: activeTheme.styles.letterSpacing,
                                    textAlign: activeTheme.styles.textAlign,
                                    fontSize: `${calculateFontScale(content.currentSlide, 1)}em`
                                }}
                                dangerouslySetInnerHTML={{ __html: renderFormattedText(content.currentSlide) }}
                            />
                        </div>
                    )}



                    {(!content || content.type === 'clear') && (
                        <div className="text-center">
                            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
                                <Clock size={48} className="text-zinc-600" />
                            </div>
                            <p className="text-3xl text-zinc-500 font-medium">Waiting for content...</p>
                            <p className="text-zinc-600 mt-2">Content will appear here when projected</p>
                        </div>
                    )}


                </div>

                {/* Pastor Notes Panel */}
                {notes && (
                    <div className="mt-8 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6">
                        <p className="text-xs text-amber-500 uppercase tracking-wider mb-2 font-semibold">
                            📝 Pastor Notes
                        </p>
                        <p className="text-xl text-amber-100 whitespace-pre-line">{notes}</p>
                    </div>
                )}
            </div>

            {/* Next Slide Footer (For Songs) */}
            {content?.type === 'song' && content.nextSlide && (
                <div className="fixed bottom-0 left-0 right-0 bg-black/60 backdrop-blur-xl border-t border-white/10 px-12 py-6 z-[60] animate-in slide-in-from-bottom-full duration-500">
                    <div className="max-w-7xl mx-auto flex items-start gap-8">
                        <div className="flex items-center gap-2 text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
                            <ChevronRight size={18} strokeWidth={3} />
                            <span className="text-xs font-black uppercase tracking-[0.2em]">Next</span>
                        </div>
                        <p
                            className="text-2xl text-zinc-400 font-medium line-clamp-2 leading-tight"
                            dangerouslySetInnerHTML={{ __html: renderFormattedText(content.nextSlide) }}
                        />
                    </div>
                </div>
            )}

            {/* Footer Hint - auto-hides after 5 seconds */}
            <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 text-zinc-600 text-sm transition-opacity duration-1000 ${showHint ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                Double-click to toggle fullscreen • Stage Display
            </div>

            {/* Demo Watermark if unlicensed */}
            {isDemo && !loading && <DemoWatermark />}
        </div>
    );
}
