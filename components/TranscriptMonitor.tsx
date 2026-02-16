"use client";

import { useRef, useEffect } from 'react';
import DeepgramRecognizer from './DeepgramRecognizer';

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
                {deepgramError && (
                    <div className="mt-2 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-[10px] font-bold">
                        ERROR: {deepgramError}
                    </div>
                )}
                <span className="text-zinc-900 dark:text-white animate-pulse block mt-1">{interim}</span>
            </div>

            <DeepgramRecognizer
                isListening={isListening}
                onTranscript={onTranscript}
                onStatusChange={onStatusChange}
                onVolume={setVoiceLevel}
                onInterim={onInterim}
            />
        </div>
    );
}
