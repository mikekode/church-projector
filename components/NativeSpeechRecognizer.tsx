"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

type Props = {
    isListening: boolean;
    onTranscript: (text: string) => void;
    onInterim?: (text: string) => void;
    onStatusChange?: (status: string, error?: string | null) => void;
    onVolume?: (level: number) => void;
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
    onaudiostart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
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

declare global {
    interface Window {
        SpeechRecognition: SpeechRecognitionConstructor;
        webkitSpeechRecognition: SpeechRecognitionConstructor;
    }
}

/**
 * NativeSpeechRecognizer — Free speech-to-text via Chrome's Web Speech API
 *
 * Uses webkitSpeechRecognition (built into Chrome/Electron).
 * Streams audio to Google's servers — requires internet, but no API key.
 * Shows interim results as you speak (zero perceived lag).
 *
 * Also captures mic audio for volume metering so the VoiceWave
 * component stays responsive.
 */
export default function NativeSpeechRecognizer({ isListening, onTranscript, onInterim, onStatusChange, onVolume }: Props) {
    const [status, setStatus] = useState<"idle" | "listening" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const onTranscriptRef = useRef(onTranscript);
    const onInterimRef = useRef(onInterim);
    const onStatusChangeRef = useRef(onStatusChange);
    const onVolumeRef = useRef(onVolume);
    const isListeningRef = useRef(isListening);

    // Volume metering refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);

    useEffect(() => {
        onTranscriptRef.current = onTranscript;
        onInterimRef.current = onInterim;
        onStatusChangeRef.current = onStatusChange;
        onVolumeRef.current = onVolume;
        isListeningRef.current = isListening;
    }, [onTranscript, onInterim, onStatusChange, onVolume, isListening]);

    // Report status to parent
    useEffect(() => {
        onStatusChangeRef.current?.(status === 'listening' ? 'listening' : status === 'error' ? 'error' : 'idle', errorMsg);
    }, [status, errorMsg]);

    // ─── Volume Metering ────────────────────────────────────────────────
    const startVolumeMeter = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
            });
            streamRef.current = stream;
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(2048, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                const data = e.inputBuffer.getChannelData(0);
                let sum = 0;
                for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
                const rms = Math.sqrt(sum / data.length);
                const level = Math.min(1, rms * 8);
                if (processorRef.current) {
                    const last = (processorRef.current as any)._lastLevel ?? 0;
                    if (Math.abs(level - last) > 0.01) {
                        (processorRef.current as any)._lastLevel = level;
                        onVolumeRef.current?.(level);
                    }
                }
            };

            source.connect(processor);
            processor.connect(audioContext.destination);
        } catch {
            // Volume metering is optional — don't block recognition
        }
    }, []);

    const stopVolumeMeter = useCallback(() => {
        processorRef.current?.disconnect();
        processorRef.current = null;
        audioContextRef.current?.close();
        audioContextRef.current = null;
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        onVolumeRef.current?.(0);
    }, []);

    // ─── Speech Recognition ─────────────────────────────────────────────
    const initRecognition = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setErrorMsg("Speech recognition not supported. Use Chrome or Edge.");
            setStatus("error");
            return null;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setStatus("listening");
            setErrorMsg(null);
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (interimTranscript && onInterimRef.current) {
                onInterimRef.current(interimTranscript);
            }

            if (finalTranscript) {
                onTranscriptRef.current(finalTranscript);
                if (onInterimRef.current) onInterimRef.current('');
            }
        };

        recognition.onerror = (event) => {
            console.error('[NativeSTT] Error:', event.error);

            if (event.error === 'not-allowed') {
                setErrorMsg("Microphone blocked. Allow access and reload.");
                setStatus("error");
                isListeningRef.current = false;
            } else if (event.error === 'no-speech') {
                // Normal pause — continue
            } else if (event.error === 'network') {
                setErrorMsg("Voice recognition requires internet.");
                setStatus("error");
                isListeningRef.current = false;
            } else if (event.error === 'aborted') {
                // User stopped — normal
            }
        };

        recognition.onend = () => {
            if (isListeningRef.current && recognitionRef.current) {
                try {
                    recognitionRef.current.start();
                } catch {
                    // Already started
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
            } catch {
                // May already be started
            }
        }
        startVolumeMeter();
    }, [initRecognition, startVolumeMeter]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch {
                // May already be stopped
            }
        }
        stopVolumeMeter();
        setStatus("idle");
    }, [stopVolumeMeter]);

    useEffect(() => {
        if (isListening) {
            startListening();
        } else {
            stopListening();
        }
        return () => stopListening();
    }, [isListening, startListening, stopListening]);

    // No visible UI — TranscriptMonitor handles all display
    return null;
}
