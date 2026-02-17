"use client";

import { useRef, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import DeepgramRecognizer from './DeepgramRecognizer';
import OfflineSpeechRecognizer from './OfflineSpeechRecognizer';

type Props = {
    isListening: boolean;
    onTranscript: (text: string) => void;
    onInterim: (text: string, isFinal: boolean) => void;
    onStatusChange: (status: string, error?: string | null) => void;
    voiceLevel: number;
    setVoiceLevel: (level: number) => void;
    transcript: string;
    interim: string;
    deepgramError?: string | null;
};

// Pulsating Voice Wave Component (Isolated)
const VoiceWave = ({ level, active }: { level: number, active: boolean }) => {
    // 9 bars for a fuller, more professional wave look
    const sensitivities = [0.4, 0.6, 0.8, 0.95, 1.0, 0.95, 0.8, 0.6, 0.4];

    return (
        <div className="flex items-center gap-[3px] h-8 px-1">
            {sensitivities.map((sensitivity, i) => {
                // More energetic: higher multiplier (5x), more responsive, min 0.15 when active
                const scale = active ? Math.min(1, Math.max(0.15, level * sensitivity * 5)) : 0.05;
                const baseHeight = 32; // Taller bars

                const bgColor = 'bg-indigo-500 dark:bg-white';
                const glow = active ? 'shadow-sm shadow-indigo-500/50' : '';

                return (
                    <div
                        key={i}
                        className={`w-[5px] rounded-full transition-all duration-[50ms] ease-out ${bgColor} ${glow} ${active ? 'opacity-100' : 'opacity-20'}`}
                        style={{
                            height: `${baseHeight}px`,
                            transform: `scaleY(${scale})`,
                            transformOrigin: 'center'
                        }}
                    />
                );
            })}
        </div>
    );
};

export default function TranscriptMonitor({
    isListening,
    onTranscript,
    onInterim,
    onStatusChange,
    voiceLevel,
    setVoiceLevel,
    transcript,
    interim,
    deepgramError
}: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);
    // Default true to match SSR — useEffect corrects it after mount
    const [isOnline, setIsOnline] = useState(true);

    // Background Preload Status
    const [preloadPercent, setPreloadPercent] = useState<number | null>(null);
    const [isPreloadReady, setIsPreloadReady] = useState(false);
    const [preloadError, setPreloadError] = useState<string | null>(null);

    // Track connectivity changes and auto-switch recognizers
    useEffect(() => {
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const onProgress = (e: any) => {
            setPreloadError(null);
            setPreloadPercent(e.detail);
            setIsPreloadReady(false);
        };
        const onReady = () => {
            setPreloadError(null);
            setIsPreloadReady(true);
            setPreloadPercent(null);
        };
        const onError = (e: any) => {
            setPreloadError(e.detail);
            setPreloadPercent(null);
        };
        window.addEventListener('whisper-preload-progress', onProgress);
        window.addEventListener('whisper-preload-ready', onReady);
        window.addEventListener('whisper-preload-error', onError);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('whisper-preload-progress', onProgress);
            window.removeEventListener('whisper-preload-ready', onReady);
            window.removeEventListener('whisper-preload-error', onError);
        };
    }, []);

    // If Deepgram errors out, treat as offline and fall back to native
    const useNative = !isOnline || !!deepgramError;

    // Auto-scroll transcript to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcript, interim]);

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 dark:bg-white" /> Live Transcript
                    {useNative ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold normal-case tracking-normal">Offline Mode</span>
                    ) : isPreloadReady ? (
                        <span
                            className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500/70 border border-emerald-500/20 font-bold normal-case tracking-normal flex items-center gap-1"
                            title="150MB Offline Engine is fully cached. You can disconnect at any time."
                        >
                            <Check size={9} strokeWidth={3} /> Offline Ready
                        </span>
                    ) : null}
                </h3>
                <VoiceWave level={voiceLevel} active={isListening} />
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto font-mono text-[10px] text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap transcript-scroll pr-2"
                style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#71717a #27272a'
                }}
            >
                {transcript || <span className="text-zinc-600 italic">Waiting for speech...</span>}

                {/* PRELOAD PROGRESS (Visible while online or starting setup) */}
                {(preloadPercent !== null || (isOnline && !isPreloadReady) || preloadError) && (
                    <div className="mt-3 p-3 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${preloadError ? 'text-red-500' : 'text-zinc-500'}`}>
                                {preloadError ? 'Offline Sync Failed' :
                                    preloadPercent === null ? "Preparing Offline AI..." :
                                        `Syncing Offline AI (${preloadPercent}%)`}
                            </span>
                            {(preloadPercent === null && !preloadError) && <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
                        </div>
                        {preloadPercent !== null && !preloadError && (
                            <div className="w-full bg-zinc-200 dark:bg-white/10 rounded-full h-1 overflow-hidden">
                                <div
                                    className="bg-indigo-500 h-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                                    style={{ width: `${preloadPercent}%` }}
                                />
                            </div>
                        )}
                        <p className={`text-[9px] mt-1.5 leading-tight ${preloadError ? 'text-red-400 font-medium' : 'text-zinc-500'}`}>
                            {preloadError ? `${preloadError}. Check internet and refresh.` :
                                'Downloading ~150MB local model for offline use. Please stay online.'}
                        </p>
                    </div>
                )}

                {deepgramError ? (
                    <div className="mt-2 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-[10px] font-bold">
                        ERROR: {deepgramError}
                    </div>
                ) : !isOnline && isPreloadReady ? (
                    <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-amber-500 dark:text-amber-400 text-[10px] font-medium">
                        Working Offline — using local Whisper AI for voice recognition
                    </div>
                ) : !isOnline && !isPreloadReady ? (
                    <div className="mt-2 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-[10px] font-bold">
                        OFFLINE ERROR: Offline AI not downloaded. Please connect to internet.
                    </div>
                ) : null}
                <span className="text-zinc-900 dark:text-white animate-pulse block mt-1">{interim}</span>
            </div>

            {useNative ? (
                <OfflineSpeechRecognizer
                    isListening={isListening}
                    onTranscript={onTranscript}
                    onInterim={(text) => onInterim(text, false)}
                    onStatusChange={onStatusChange}
                    onVolume={setVoiceLevel}
                />
            ) : (
                <DeepgramRecognizer
                    isListening={isListening}
                    onTranscript={onTranscript}
                    onStatusChange={onStatusChange}
                    onVolume={setVoiceLevel}
                    onInterim={onInterim}
                />
            )}
        </div>
    );
}
