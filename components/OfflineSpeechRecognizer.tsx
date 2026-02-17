"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

type Props = {
    isListening: boolean;
    onTranscript: (text: string) => void;
    onInterim?: (text: string) => void;
    onStatusChange?: (status: string, error?: string | null) => void;
    onVolume?: (level: number) => void;
};

type WorkerMsg =
    | { type: 'progress'; data: { status: string; name?: string; file?: string; loaded?: number; total?: number; progress?: number } }
    | { type: 'ready' }
    | { type: 'result'; text: string }
    | { type: 'error'; message: string };

type Status = 'idle' | 'loading' | 'ready' | 'recording' | 'transcribing' | 'error';

/**
 * OfflineSpeechRecognizer — 100% offline Whisper-base.en speech recognition
 *
 * Improvements over original:
 * - Upgraded model: whisper-tiny.en → whisper-base.en (much better accuracy)
 * - Voice Activity Detection (VAD): only sends audio when speech is detected
 * - Audio filtering: high-pass (400Hz) + low-pass (3500Hz) to isolate voice
 * - Reduced chunk size: 5s → 2s for lower latency
 * - Volume metering for UI feedback
 */
export default function OfflineSpeechRecognizer({ isListening, onTranscript, onInterim, onStatusChange, onVolume }: Props) {
    const [status, setStatus] = useState<Status>('idle');
    const [loadPercent, setLoadPercent] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Initial status report
    useEffect(() => {
        const uiStatus =
            status === 'recording' ? 'listening' :
                (status === 'loading' || status === 'ready') ? 'connecting' :
                    'idle';
        onStatusChange?.(uiStatus, errorMsg);
    }, [status, errorMsg, onStatusChange]);

    const workerRef = useRef<Worker | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);

    const isListeningRef = useRef(isListening);
    const busyRef = useRef(false);
    const statusRef = useRef<Status>('idle');
    const onTranscriptRef = useRef(onTranscript);
    const onInterimRef = useRef(onInterim);
    const onVolumeRef = useRef(onVolume);

    // Audio buffer for accumulating PCM samples
    const audioBufferRef = useRef<Float32Array[]>([]);
    const lastSpeechTimeRef = useRef<number>(0);
    const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
    useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
    useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
    useEffect(() => { onVolumeRef.current = onVolume; }, [onVolume]);
    useEffect(() => { statusRef.current = status; }, [status]);

    // ─── Constants ──────────────────────────────────────────────────────
    const SAMPLE_RATE = 16000;
    const CHUNK_INTERVAL_MS = 2000;     // Send every 2s (down from 5s)
    const SILENCE_THRESHOLD = 0.015;    // RMS below this = silence (increased slightly)
    const SILENCE_FLUSH_MS = 300;       // Flush 300ms after last speech
    const MIN_AUDIO_SAMPLES = SAMPLE_RATE * 0.3; // Min 0.3s of audio to send

    // Commonly mis-transcribed phrases by Whisper when given noise/silence
    const WHISPER_HALLUCINATIONS = [
        'Thanks for watching', 'Please subscribe', 'Thank you', 'Bye',
        'Go it', 'You', 'Subtitles by', 'Translated by', 'Amara.org',
        'Please share', 'Watching!', 'The end.', '[BLANK_AUDIO]'
    ];

    // ─── Worker ─────────────────────────────────────────────────────────
    const ensureWorker = useCallback(() => {
        if (workerRef.current) return workerRef.current;

        const worker = new Worker(
            new URL('../workers/whisper.worker.ts', import.meta.url),
            { type: 'module' }
        );

        worker.onmessage = (e: MessageEvent<WorkerMsg>) => {
            const msg = e.data;

            if (msg.type === 'progress') {
                // Reset timeout if we are making progress
                if (loadTimeoutRef.current) {
                    clearTimeout(loadTimeoutRef.current);
                    loadTimeoutRef.current = setTimeout(() => {
                        if (statusRef.current === 'loading') {
                            setErrorMsg("Offline AI took too long. Check your internet or refresh.");
                            setStatus('error');
                        }
                    }, 30000); // 30s more from last progress
                }

                const d = msg.data;
                if (d.progress !== undefined) {
                    setLoadPercent(Math.round(d.progress));
                } else if (d.loaded && d.total) {
                    setLoadPercent(Math.round((d.loaded / d.total) * 100));
                }
                if (statusRef.current !== 'loading') setStatus('loading');
            } else if (msg.type === 'ready') {
                if (loadTimeoutRef.current) {
                    clearTimeout(loadTimeoutRef.current);
                    loadTimeoutRef.current = null;
                }
                setStatus('ready');
                setLoadPercent(100);
                if (isListeningRef.current) {
                    startRecording();
                }
            } else if (msg.type === 'result') {
                busyRef.current = false;
                const text = (msg.text || '').trim().replace(/[.,!?]$/, "");

                // Hallucination Filter: Ignore common Whisper artifacts during noise
                const isHallucination = WHISPER_HALLUCINATIONS.some(h =>
                    text.toLowerCase().includes(h.toLowerCase())
                );

                if (text && !isHallucination) {
                    onTranscriptRef.current(text);
                }
                if (onInterimRef.current) onInterimRef.current('');
                if (isListeningRef.current) setStatus('recording');

                // Process any buffered audio immediately
                drainBuffer();
            } else if (msg.type === 'error') {
                busyRef.current = false;
                setErrorMsg(msg.message);
                setStatus('error');
            }
        };

        workerRef.current = worker;
        return worker;
    }, []);

    // ─── Audio Buffer → Worker ──────────────────────────────────────────
    const sendBufferToWorker = useCallback(() => {
        if (!workerRef.current || audioBufferRef.current.length === 0) return;

        // Concatenate all chunks into a single Float32Array
        const totalLength = audioBufferRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
        if (totalLength < MIN_AUDIO_SAMPLES) return; // Too short

        const combined = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of audioBufferRef.current) {
            combined.set(chunk, offset);
            offset += chunk.length;
        }
        audioBufferRef.current = [];

        busyRef.current = true;
        setStatus('transcribing');
        if (onInterimRef.current) onInterimRef.current('(transcribing...)');

        // Transfer buffer for zero-copy
        workerRef.current.postMessage(
            { type: 'transcribe', audio: combined },
            [combined.buffer]
        );
    }, []);

    const drainBuffer = useCallback(() => {
        if (busyRef.current || audioBufferRef.current.length === 0) return;
        sendBufferToWorker();
    }, [sendBufferToWorker]);

    // ─── Start / Stop Recording ─────────────────────────────────────────
    const startRecording = useCallback(async () => {
        if (processorRef.current) return; // already recording

        try {
            console.log("[OfflineSTT] Requesting microphone access...");
            const mediaTimeout = setTimeout(() => {
                console.warn("[OfflineSTT] Mic request timed out (5s)");
                setErrorMsg("Microphone request timed out. Check hardware.");
                setStatus('error');
            }, 5000);

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false, // Disable to prevent noise floor boosting
                    sampleRate: SAMPLE_RATE,
                    channelCount: 1,
                }
            });

            clearTimeout(mediaTimeout);
            console.log("[OfflineSTT] Microphone access granted ✓");
            streamRef.current = stream;

            const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
            audioContextRef.current = audioContext;

            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            const source = audioContext.createMediaStreamSource(stream);

            // ── Voice Guard: Frequency Isolation ──
            // High-pass: cut rumble but preserve voice (150Hz)
            const highPass = audioContext.createBiquadFilter();
            highPass.type = 'highpass';
            highPass.frequency.setValueAtTime(150, audioContext.currentTime);
            highPass.Q.setValueAtTime(0.7, audioContext.currentTime);

            // Low-pass: cut extreme high hiss but keep clarity (8000Hz)
            const lowPass = audioContext.createBiquadFilter();
            lowPass.type = 'lowpass';
            lowPass.frequency.setValueAtTime(8000, audioContext.currentTime);
            lowPass.Q.setValueAtTime(0.7, audioContext.currentTime);

            // Compressor: level out volume swings
            const compressor = audioContext.createDynamicsCompressor();
            compressor.threshold.setValueAtTime(-20, audioContext.currentTime);
            compressor.knee.setValueAtTime(20, audioContext.currentTime);
            compressor.ratio.setValueAtTime(16, audioContext.currentTime);
            compressor.attack.setValueAtTime(0.005, audioContext.currentTime);
            compressor.release.setValueAtTime(0.15, audioContext.currentTime);

            // ScriptProcessor to capture raw PCM (4096 samples = 256ms at 16kHz)
            // Increased from 1024 to be more resilient to jitter/lag
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);

                // ── Volume metering ──
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) {
                    sum += inputData[i] * inputData[i];
                }
                const rms = Math.sqrt(sum / inputData.length);
                const level = Math.min(1, rms * 8);

                if (processorRef.current) {
                    const lastLevel = (processorRef.current as any)._lastLevel ?? 0;
                    if (Math.abs(level - lastLevel) > 0.01) {
                        (processorRef.current as any)._lastLevel = level;
                        onVolumeRef.current?.(level);
                    }
                }

                // ── VAD: Only buffer when speech detected ──
                if (rms > SILENCE_THRESHOLD) {
                    lastSpeechTimeRef.current = Date.now();
                    // Copy the data (since the buffer is reused)
                    audioBufferRef.current.push(new Float32Array(inputData));
                } else {
                    // Keep buffering for SILENCE_FLUSH_MS after last speech
                    const timeSinceSpeech = Date.now() - lastSpeechTimeRef.current;
                    if (timeSinceSpeech < SILENCE_FLUSH_MS && lastSpeechTimeRef.current > 0) {
                        audioBufferRef.current.push(new Float32Array(inputData));
                    } else if (audioBufferRef.current.length > 0 && !busyRef.current) {
                        // Silence detected after speech — flush immediately
                        sendBufferToWorker();
                    }
                }
            };

            // Connect: source → highPass → lowPass → compressor → processor → destination
            source.connect(highPass);
            highPass.connect(lowPass);
            lowPass.connect(compressor);
            compressor.connect(processor);
            processor.connect(audioContext.destination);

            // Periodic flush: force send every CHUNK_INTERVAL_MS even during continuous speech
            chunkTimerRef.current = setInterval(() => {
                if (audioBufferRef.current.length > 0 && !busyRef.current) {
                    sendBufferToWorker();
                }
            }, CHUNK_INTERVAL_MS);

            setStatus('recording');
        } catch {
            setErrorMsg('Microphone access denied.');
            setStatus('error');
        }
    }, [sendBufferToWorker]);

    const stopRecording = useCallback(() => {
        // Flush remaining audio
        if (audioBufferRef.current.length > 0 && !busyRef.current) {
            sendBufferToWorker();
        }

        if (chunkTimerRef.current) {
            clearInterval(chunkTimerRef.current);
            chunkTimerRef.current = null;
        }

        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        audioBufferRef.current = [];
        lastSpeechTimeRef.current = 0;
        setStatus('idle');

        if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = null;
        }
    }, [sendBufferToWorker]);

    // ─── Lifecycle ──────────────────────────────────────────────────────
    useEffect(() => {
        if (isListening) {
            const worker = ensureWorker();
            if (statusRef.current === 'idle' || statusRef.current === 'error') {
                setStatus('loading');
                setErrorMsg(null);
                console.log("[OfflineSTT] Sending 'load' command to worker...");

                // Safety timeout for worker loading (60s initially)
                if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
                loadTimeoutRef.current = setTimeout(() => {
                    if (statusRef.current === 'loading') {
                        console.error("[OfflineSTT] Worker load timed out after 60s");
                        setErrorMsg("Offline AI took too long to load. Internet connection required for first-time setup.");
                        setStatus('error');
                    }
                }, 60000);

                worker.postMessage({ type: 'load' });
            } else if (statusRef.current === 'ready' || statusRef.current === 'recording') {
                // If already ready but recording stopped, restart it
                if (statusRef.current !== 'recording') {
                    startRecording();
                }
            }
        } else {
            stopRecording();
            if (statusRef.current !== 'loading' && statusRef.current !== 'idle') {
                setStatus('idle');
            }
        }
    }, [isListening, ensureWorker, startRecording, stopRecording]);

    // Auto-start recording once model is ready
    useEffect(() => {
        if (status === 'ready' && isListeningRef.current) {
            startRecording();
        }
    }, [status, startRecording]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopRecording();
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, [stopRecording]);

    // ─── Render ─────────────────────────────────────────────────────────
    // Model download happens silently in the background via useBibleOfflineSync.
    // Only show UI when the user is actively trying to listen or when there's an error.

    // Completely hidden when idle and not listening
    if (status === 'idle' && !isListening) {
        return null;
    }

    // Not listening and not in an active state — hide
    if (!isListening && status !== 'error' && status !== 'loading') {
        return null;
    }

    return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 shadow-inner">
            <div className="relative w-4 h-4 flex-shrink-0">
                <div className={`absolute inset-0 rounded-full transition-all duration-100 ${status === 'recording' ? 'bg-amber-500 opacity-100 animate-pulse' :
                    status === 'transcribing' ? 'bg-blue-500 opacity-100 animate-pulse' :
                        'bg-red-500 opacity-100'
                    }`} />
            </div>

            <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    {status === 'recording' ? 'Listening (Offline)' :
                        status === 'transcribing' ? 'Transcribing...' :
                            'Error'}
                </span>

                {status === 'recording' && (
                    <span className="text-[9px] text-amber-400 mt-0.5">
                        Smart VAD · sends on silence · fully offline
                    </span>
                )}

                {errorMsg && (
                    <span className="text-[9px] text-red-400 mt-0.5">{errorMsg}</span>
                )}
            </div>
        </div>
    );
}
