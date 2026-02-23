"use client";

import { useRef, useEffect, useState } from 'react';
import DeepgramRecognizer from './DeepgramRecognizer';
import NativeSpeechRecognizer from './NativeSpeechRecognizer';
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
    isLicensed?: boolean;
};

// Pulsating Voice Wave Component (Isolated)
const VoiceWave = ({ level, active }: { level: number, active: boolean }) => {
    const sensitivities = [0.4, 0.6, 0.8, 0.95, 1.0, 0.95, 0.8, 0.6, 0.4];

    return (
        <div className="flex items-center gap-[3px] h-8 px-1">
            {sensitivities.map((sensitivity, i) => {
                const scale = active ? Math.min(1, Math.max(0.15, level * sensitivity * 5)) : 0.05;
                const baseHeight = 32;
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

/**
 * 3-tier recognizer routing:
 *   1. Licensed + Online  → Deepgram (paid, best quality)
 *   2. Unlicensed + Online → webkitSpeechRecognition (free, good quality)
 *   3. Offline             → Whisper WASM (last resort fallback)
 */
type RecognizerMode = 'deepgram' | 'native' | 'whisper';

export default function TranscriptMonitor({
    isListening,
    onTranscript,
    onInterim,
    onStatusChange,
    voiceLevel,
    setVoiceLevel,
    transcript,
    interim,
    deepgramError,
    isLicensed = false
}: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isOnline, setIsOnline] = useState(true);
    const [mounted, setMounted] = useState(false);

    // Background Preload Status
    const [preloadPercent, setPreloadPercent] = useState<number | null>(null);
    const [isPreloadReady, setIsPreloadReady] = useState(false);
    const [preloadError, setPreloadError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
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

    // Determine which recognizer to use
    const mode: RecognizerMode = !isOnline
        ? 'whisper'                          // No internet → Whisper offline
        : isLicensed && !deepgramError
            ? 'deepgram'                     // Licensed + online → Deepgram
            : 'native';                      // Online but unlicensed (or Deepgram errored) → free Web Speech API

    // Auto-scroll transcript to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcript, interim]);

    // Badge label + offline readiness indicator
    const badgeEl = mounted ? (
        mode === 'deepgram' ? (
            <span
                className="w-2 h-2 rounded-full bg-emerald-500 inline-block shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                title="Deepgram AI — Premium Accuracy"
            />
        ) : mode === 'native' ? (
            <span
                className="w-2 h-2 rounded-full bg-blue-500 inline-block shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                title="Free Voice Recognition — Powered by Chrome"
            />
        ) : (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold normal-case tracking-normal">Offline</span>
        )
    ) : null;

    // Small dot: green = offline AI ready, amber = not yet downloaded
    const offlineDot = mounted && mode !== 'whisper' ? (
        isPreloadReady ? (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" title="Offline AI ready" />
        ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/50 inline-block" title={preloadPercent !== null ? `Downloading offline AI (${preloadPercent}%)` : 'Offline AI not ready'} />
        )
    ) : null;

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 dark:bg-white" /> Live Transcript
                    {badgeEl}
                    {offlineDot}
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
                <span className="text-zinc-900 dark:text-white animate-pulse block mt-1">{interim}</span>
            </div>

            {mode === 'deepgram' ? (
                <DeepgramRecognizer
                    isListening={isListening}
                    onTranscript={onTranscript}
                    onStatusChange={onStatusChange}
                    onVolume={setVoiceLevel}
                    onInterim={onInterim}
                />
            ) : mode === 'native' ? (
                <NativeSpeechRecognizer
                    isListening={isListening}
                    onTranscript={onTranscript}
                    onInterim={(text) => onInterim(text, false)}
                    onStatusChange={onStatusChange}
                    onVolume={setVoiceLevel}
                />
            ) : (
                <OfflineSpeechRecognizer
                    isListening={isListening}
                    onTranscript={onTranscript}
                    onInterim={(text) => onInterim(text, false)}
                    onStatusChange={onStatusChange}
                    onVolume={setVoiceLevel}
                />
            )}
        </div>
    );
}
