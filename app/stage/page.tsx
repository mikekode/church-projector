"use client";

import { useState, useEffect, useRef } from 'react';
import { useBroadcastChannel } from '@/hooks/useBroadcast';
import { Clock, ChevronRight, Music, BookOpen, Image, AlertCircle } from 'lucide-react';

interface StageContent {
    type: 'verse' | 'song' | 'media' | 'clear';
    reference?: string;
    text?: string;
    version?: string;
    title?: string;
    currentSlide?: string;
    nextSlide?: string;
    slideIndex?: number;
    totalSlides?: number;
}

export default function StageDisplayPage() {
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
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Broadcast Subscription
    const { subscribe, broadcast } = useBroadcastChannel('projector_channel');

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
    }, [isRunning, pausedAt, broadcast]);

    // Clock Update (Time of Day)
    useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
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

    // Subscribe
    useEffect(() => {
        const unsubscribe = subscribe((message: any) => {
            if (message.type === 'SHOW_VERSE') {
                setContent({
                    type: 'verse',
                    reference: message.payload.reference,
                    text: message.payload.text,
                    version: message.payload.version,
                });
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
                    });
                } else if (payload.type === 'media') {
                    setContent({
                        type: 'media',
                        title: payload.title,
                        currentSlide: payload.body,
                    });
                }
            } else if (message.type === 'CLEAR') {
                setContent({ type: 'clear' });
            } else if (message.type === 'STAGE_NOTES') {
                setNotes(message.payload.notes || '');
            }
            // TIMER CONTROLS
            else if (message.type === 'TIMER_ACTION') {
                const { action, value, mode } = message.payload;
                if (action === 'set') {
                    setTimerMode(mode || 'countup');
                    setTargetSeconds(value || 0);
                    setElapsedTime(
                        new Date((value || 0) * 1000).toISOString().substr(11, 8)
                    );
                    setIsRunning(false);
                    setStartTime(null);
                    setPausedAt(null);
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
            }
        });
        return unsubscribe;
    }, [subscribe, isRunning, startTime, pausedAt, targetSeconds, timerMode]);

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

    return (
        <div
            className="min-h-screen bg-black text-white font-sans"
            onDoubleClick={toggleFullscreen}
        >
            {/* Top Bar - Clock & Timer */}
            <div className="fixed top-0 left-0 right-0 bg-zinc-900/90 backdrop-blur border-b border-white/10 px-6 py-4 flex justify-between items-center z-50">
                <div className="flex items-center gap-8">
                    {/* Current Time */}
                    <div className="text-center">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">Current Time</p>
                        <p className="text-3xl font-mono font-bold text-white">
                            {currentTime ? formatTime(currentTime) : '--:--:--'}
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
            <div className="pt-24 pb-8 px-8 min-h-screen flex flex-col">
                {/* Current Content - Large Display */}
                <div className="flex-1 flex items-center justify-center">
                    {content?.type === 'verse' && (
                        <div className="text-center max-w-5xl">
                            <p className="text-lg text-indigo-400 font-semibold mb-4 tracking-wide">
                                {content.reference} • {content.version}
                            </p>
                            <p className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
                                {content.text}
                            </p>
                        </div>
                    )}

                    {content?.type === 'song' && (
                        <div className="text-center max-w-5xl w-full">
                            <p className="text-lg text-purple-400 font-semibold mb-4 tracking-wide">
                                {content.title} • Slide {(content.slideIndex || 0) + 1}/{content.totalSlides || 1}
                            </p>
                            <p className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight whitespace-pre-line">
                                {content.currentSlide}
                            </p>

                            {/* Next Slide Preview */}
                            {content.nextSlide && (
                                <div className="mt-12 pt-8 border-t border-white/10">
                                    <div className="flex items-center justify-center gap-2 text-zinc-500 mb-4">
                                        <ChevronRight size={20} />
                                        <span className="text-sm uppercase tracking-wider">Next</span>
                                    </div>
                                    <p className="text-2xl text-zinc-400 whitespace-pre-line">
                                        {content.nextSlide}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {content?.type === 'media' && (
                        <div className="text-center">
                            <p className="text-xl text-amber-400 font-semibold">{content.title}</p>
                            <p className="text-3xl text-zinc-400 mt-4">Media displayed on projector</p>
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

            {/* Footer Hint */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-zinc-600 text-sm">
                Double-click to toggle fullscreen • Stage Display
            </div>
        </div>
    );
}
