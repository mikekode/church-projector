"use client";

import { useEffect, useRef, useState } from 'react';

type Props = {
    isListening: boolean;
    onTranscript: (text: string) => void;
    onInterim?: (text: string) => void;
};

export default function WhisperRecognizer({ isListening, onTranscript, onInterim }: Props) {
    const [status, setStatus] = useState<"idle" | "listening" | "processing">("idle");
    const [volume, setVolume] = useState(0);

    const onTranscriptRef = useRef(onTranscript);
    const onInterimRef = useRef(onInterim);

    useEffect(() => {
        onTranscriptRef.current = onTranscript;
        onInterimRef.current = onInterim;
    }, [onTranscript, onInterim]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const processingQueueRef = useRef<Blob[]>([]);
    const isProcessingRef = useRef(false);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSpeakingTimeRef = useRef<number>(Date.now());

    // Settings (Optimized for Speed)
    const SILENCE_THRESHOLD = 10;
    const SILENCE_DURATION = 200; // Send almost immediately after a pause
    const MAX_CHUNK_DURATION = 1500; // Force send every 1.5s to keep transcript flowing

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // 1. Audio Analysis (VAD) setup
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = audioCtx;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            sourceRef.current = source;

            // 2. MediaRecorder setup
            // Use WebM Opus for efficiency
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            // 3. Continuous Data Handling
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            // Start with 200ms timeslices so we get data frequently
            recorder.start(200);
            setStatus("listening");

            // Start loops
            monitorAudio();
            resetMaxDurationTimer();

        } catch (err) {
            console.error("Mic Error:", err);
            setStatus("idle");
        }
    };

    const stopRecording = () => {
        // Send whatever is left
        if (chunksRef.current.length > 0) flushAndUpload();

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
        if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        setStatus("idle");
    };

    // --- VAD LOGIC ---
    const monitorAudio = () => {
        if (!analyserRef.current || !isListening) return;

        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);

        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVolume(avg);

        if (avg > SILENCE_THRESHOLD) {
            // Speaking
            lastSpeakingTimeRef.current = Date.now();
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
        } else {
            // Silence
            const timeSinceSpeaking = Date.now() - lastSpeakingTimeRef.current;

            // If silence persists and we have data
            if (timeSinceSpeaking > SILENCE_DURATION && !silenceTimerRef.current && chunksRef.current.length > 0) {
                silenceTimerRef.current = setTimeout(() => {
                    flushAndUpload();
                }, 100); // Short buffer before flush
            }
        }

        if (isListening) requestAnimationFrame(monitorAudio);
    };

    const resetMaxDurationTimer = () => {
        if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
        maxDurationTimerRef.current = setInterval(() => {
            if (chunksRef.current.length > 0) {
                flushAndUpload();
            }
        }, MAX_CHUNK_DURATION);
    };

    // --- UPLOAD LOGIC ---
    const flushAndUpload = async () => {
        if (chunksRef.current.length === 0) return;

        // 1. Snapshot current chunks & clear ref immediately (so recording continues seamlessly)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];

        // Reset timers
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        // Force restart max duration to avoid double send
        resetMaxDurationTimer();

        if (blob.size < 1000) return; // Too small noise

        // 2. Add to queue
        processingQueueRef.current.push(blob);
        processQueue();
    };

    const processQueue = async () => {
        if (isProcessingRef.current || processingQueueRef.current.length === 0) return;

        isProcessingRef.current = true;
        setStatus("processing");
        if (onInterimRef.current) onInterimRef.current("Transcribing...");

        const audioBlob = processingQueueRef.current.shift(); // Take first
        if (!audioBlob) {
            isProcessingRef.current = false;
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', audioBlob);

            const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
            const data = await res.json();

            if (data.text) {
                onTranscriptRef.current(data.text);
            }
        } catch (e) {
            console.error("Upload failed", e);
        } finally {
            if (processingQueueRef.current.length === 0) {
                setStatus("listening");
                if (onInterimRef.current) onInterimRef.current("");
            }
            isProcessingRef.current = false;
            // Process next if any
            if (processingQueueRef.current.length > 0) processQueue();
        }
    };


    useEffect(() => {
        if (isListening) startRecording();
        else stopRecording();
        return () => stopRecording();
    }, [isListening]);

    return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 shadow-inner">
            <div className="relative w-4 h-4 flex items-center justify-center">
                <div className={`absolute inset-0 rounded-full transition-all duration-100 ${status === 'listening' ? 'bg-indigo-500 opacity-100' : status === 'processing' ? 'bg-purple-500 opacity-100' : 'bg-zinc-600 opacity-20'}`} />
                {status === 'processing' && <div className="absolute inset-0 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            </div>

            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    {status === 'listening' ? 'Listening...' : status === 'processing' ? 'Processing...' : 'Mic Off'}
                </span>
                {/* Volume Meter */}
                <div className="flex gap-0.5 items-end h-2 mt-1">
                    {[...Array(5)].map((_, i) => (
                        <div
                            key={i}
                            className={`w-1 rounded-sm transition-all duration-75 ${volume > (i * 10 + 5) ? 'bg-indigo-500 h-full' : 'bg-zinc-800 h-full'}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
