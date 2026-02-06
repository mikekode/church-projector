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
    return (
        <div className="flex items-center gap-1 h-4">
            {[0.5, 0.8, 1.0, 0.8, 0.5].map((sensitivity, i) => {
                const height = active ? Math.max(3, level * 24 * sensitivity) : 2;
                return (
                    <div
                        key={i}
                        className={`w-1 bg-indigo-500 rounded-full transition-all duration-75 ease-out ${active ? 'opacity-100' : 'opacity-20'}`}
                        style={{ height: `${height}px` }}
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
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Live Transcript
                </h3>
                <VoiceWave level={voiceLevel} active={isListening} />
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto font-mono text-[10px] text-zinc-400 leading-relaxed whitespace-pre-wrap transcript-scroll pr-2"
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
                <span className="text-indigo-400 animate-pulse block mt-1">{interim}</span>
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
