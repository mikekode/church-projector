"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

type Props = {
    isListening: boolean;
    onTranscript: (text: string) => void;
    onInterim?: (text: string) => void;
};

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
    length: number;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
    onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
    onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
    onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

interface SpeechRecognitionConstructor {
    new(): SpeechRecognitionInstance;
}

// Extend window for SpeechRecognition
declare global {
    interface Window {
        SpeechRecognition: SpeechRecognitionConstructor;
        webkitSpeechRecognition: SpeechRecognitionConstructor;
    }
}

/**
 * NativeSpeechRecognizer - ZERO LAG speech-to-text
 *
 * Uses the browser's native Web Speech API with interimResults enabled.
 * Words appear on screen AS you speak them - no network latency.
 *
 * Requires Chrome or Edge for best results.
 */
export default function NativeSpeechRecognizer({ isListening, onTranscript, onInterim }: Props) {
    const [status, setStatus] = useState<"idle" | "listening" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const onTranscriptRef = useRef(onTranscript);
    const onInterimRef = useRef(onInterim);
    const isListeningRef = useRef(isListening);

    // Keep refs updated
    useEffect(() => {
        onTranscriptRef.current = onTranscript;
        onInterimRef.current = onInterim;
        isListeningRef.current = isListening;
    }, [onTranscript, onInterim, isListening]);

    const initRecognition = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setErrorMsg("Speech recognition not supported. Use Chrome or Edge.");
            setStatus("error");
            return null;
        }

        const recognition = new SpeechRecognition();

        // KEY SETTINGS FOR ZERO LAG
        recognition.continuous = true;          // Don't stop after one phrase
        recognition.interimResults = true;      // THIS IS THE KEY - shows words as you speak
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setStatus("listening");
            setErrorMsg(null);
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            // Process all results
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // IMMEDIATELY show interim results - this creates the zero-lag feel
            if (interimTranscript && onInterimRef.current) {
                onInterimRef.current(interimTranscript);
            }

            // Send finalized text for verse detection
            if (finalTranscript) {
                onTranscriptRef.current(finalTranscript);
                // Clear interim when we get final
                if (onInterimRef.current) {
                    onInterimRef.current('');
                }
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);

            if (event.error === 'not-allowed') {
                setErrorMsg("Microphone blocked. Allow access and reload.");
                setStatus("error");
                // Stop retrying — user must fix permissions
                isListeningRef.current = false;
            } else if (event.error === 'no-speech') {
                // Normal - user paused, just continue
            } else if (event.error === 'network') {
                // Chrome's Web Speech API requires internet — it's cloud-based even in Electron
                setErrorMsg("Voice recognition requires internet. Connect and restart.");
                setStatus("error");
                // Stop retrying to avoid infinite loop
                isListeningRef.current = false;
            } else if (event.error === 'aborted') {
                // User stopped - normal
            }
        };

        recognition.onend = () => {
            // Auto-restart if we're still supposed to be listening (and not in an error state)
            if (isListeningRef.current && recognitionRef.current) {
                try {
                    recognitionRef.current.start();
                } catch (e) {
                    // Already started or other issue - ignore
                }
            } else {
                setStatus("idle");
            }
        };

        return recognition;
    }, []);

    const startListening = useCallback(() => {
        if (!recognitionRef.current) {
            recognitionRef.current = initRecognition();
        }

        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                // May already be started
            }
        }
    }, [initRecognition]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                // May already be stopped
            }
        }
        setStatus("idle");
    }, []);

    // Handle listening state changes
    useEffect(() => {
        if (isListening) {
            startListening();
        } else {
            stopListening();
        }

        return () => {
            stopListening();
        };
    }, [isListening, startListening, stopListening]);

    return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 shadow-inner">
            <div className="relative w-4 h-4 flex items-center justify-center">
                <div className={`absolute inset-0 rounded-full transition-all duration-100 ${
                    status === 'listening'
                        ? 'bg-green-500 opacity-100 animate-pulse'
                        : status === 'error'
                            ? 'bg-red-500 opacity-100'
                            : 'bg-zinc-600 opacity-20'
                }`} />
            </div>

            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    {status === 'listening' ? 'LIVE' : status === 'error' ? 'ERROR' : 'Mic Off'}
                </span>
                {errorMsg && (
                    <span className="text-[9px] text-red-400 mt-0.5">{errorMsg}</span>
                )}
                {status === 'listening' && (
                    <span className="text-[9px] text-green-400 mt-0.5">Words appear as you speak</span>
                )}
            </div>
        </div>
    );
}
