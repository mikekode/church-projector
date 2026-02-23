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
 * Key design decisions:
 * - Raw audio pipeline: NO browser noiseSuppression/echoCancellation/filters/compressor.
 *   Whisper was trained on raw audio and handles noise internally. Browser processing
 *   destroys the spectral characteristics Whisper depends on.
 * - Manual resampling: AudioContext runs at native rate (48kHz), audio is resampled
 *   to 16kHz before sending to Whisper. This avoids browser bugs where requested
 *   sample rates are silently ignored, which causes Whisper to hear slowed-down
 *   gibberish (the root cause of *Inaudible* / [Music] / *clap* output).
 * - VAD with pre-roll buffer captures word onsets before threshold triggers.
 * - 5s chunk interval with 800ms silence flush for natural sentence boundaries.
 */
export default function OfflineSpeechRecognizer({ isListening, onTranscript, onInterim, onStatusChange, onVolume }: Props) {
    const [status, setStatus] = useState<Status>('idle');
    const [loadPercent, setLoadPercent] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Status → parent mapping. CRITICAL: 'error' must map to 'listening' (not 'idle')
    // so the parent button stays in the "LISTENING" state and doesn't reset.
    // 'transcribing' must also map to 'listening' for the same reason.
    useEffect(() => {
        const uiStatus =
            status === 'recording' ? 'listening' :
            status === 'transcribing' ? 'listening' :
            status === 'error' ? 'listening' :
            (status === 'loading' || status === 'ready') ? 'connecting' :
            'idle';
        onStatusChange?.(uiStatus, status === 'error' ? errorMsg : null);
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

    // Per-file byte tracking for accurate overall download progress
    const fileBytesRef = useRef(new Map<string, { loaded: number; total: number }>());

    // Audio buffer for accumulating PCM samples (at native rate, resampled on flush)
    const audioBufferRef = useRef<Float32Array[]>([]);
    // Ring buffer of recent "silent" frames so we capture word onsets
    const preRollRef = useRef<Float32Array[]>([]);
    // Track the actual sample rate of the AudioContext (may differ from requested)
    const nativeRateRef = useRef(48000);
    const lastSpeechTimeRef = useRef<number>(0);
    const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
    useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
    useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
    useEffect(() => { onVolumeRef.current = onVolume; }, [onVolume]);
    useEffect(() => { statusRef.current = status; }, [status]);

    // ─── Constants ──────────────────────────────────────────────────────
    const TARGET_RATE = 16000;            // Whisper expects 16kHz
    const CHUNK_INTERVAL_MS = 5000;       // Send every 5s — Whisper needs context
    const SILENCE_THRESHOLD = 0.02;       // RMS below this = silence. Normal speech is 0.03-0.15.
    const SILENCE_FLUSH_MS = 800;         // Wait 800ms of silence before flushing
    const MIN_AUDIO_DURATION_S = 1.5;     // Min 1.5s of audio (short clips = bad accuracy)
    const MIN_SPEECH_RMS = 0.03;          // Minimum average RMS to consider a buffer as speech
    const PRE_ROLL_FRAMES = 2;            // Keep 2 frames of pre-speech audio

    // Detect Whisper non-speech hallucinations / audio descriptions.
    // Matches patterns like: *Cue the sound of...*, [Music], *clap*, etc.
    const NON_SPEECH_RE = /(\*[^*]+\*|\[(?:music|laughter|applause|silence|noise|blank[_ ]?audio|unintelligible)[^\]]*\]|cue\s+the\s+sound)/i;

    // Exact-match hallucinations (common Whisper artifacts for near-silence)
    const HALLUCINATION_SET = new Set([
        'thanks for watching', 'please subscribe', 'thank you', 'bye',
        'go it', 'subtitles by', 'translated by', 'amara.org',
        'please share', 'watching', 'the end', 'you', 'bye bye',
        'so', 'okay', 'hmm', 'oh', 'uh', 'ah', 'um',
    ]);

    // ─── Resample to 16kHz ──────────────────────────────────────────────
    // Linear interpolation resampler. Simple but sufficient for speech.
    const resampleTo16kHz = useCallback((audio: Float32Array, fromRate: number): Float32Array => {
        if (fromRate === TARGET_RATE) return audio;
        const ratio = fromRate / TARGET_RATE;
        const newLength = Math.round(audio.length / ratio);
        const result = new Float32Array(newLength);
        for (let i = 0; i < newLength; i++) {
            const srcIdx = i * ratio;
            const idx = Math.floor(srcIdx);
            const frac = srcIdx - idx;
            result[i] = idx + 1 < audio.length
                ? audio[idx] * (1 - frac) + audio[idx + 1] * frac
                : audio[idx];
        }
        return result;
    }, []);

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
                    }, 30000);
                }

                const d = msg.data;
                const fb = fileBytesRef.current;

                if (d.status === 'initiate' && d.file) {
                    fb.set(d.file, { loaded: 0, total: 0 });
                } else if (d.status === 'progress' && d.file && d.loaded !== undefined && d.total !== undefined) {
                    fb.set(d.file, { loaded: d.loaded, total: d.total });
                    let totalSize = 0, totalLoaded = 0;
                    fb.forEach((fp) => { totalSize += fp.total; totalLoaded += fp.loaded; });
                    const pct = totalSize > 0 ? Math.round((totalLoaded / totalSize) * 100) : 0;
                    setLoadPercent(pct);
                } else if (d.status === 'done' && d.file) {
                    const existing = fb.get(d.file);
                    if (existing && existing.total > 0) fb.set(d.file, { loaded: existing.total, total: existing.total });
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
                const raw = (msg.text || '').trim();
                // Strip trailing punctuation for cleaner comparison
                const text = raw.replace(/[.,!?]+$/, '').trim();
                const lowerText = text.toLowerCase();

                // Filter: exact hallucination OR non-speech audio description pattern
                const isHallucination = HALLUCINATION_SET.has(lowerText)
                    || NON_SPEECH_RE.test(lowerText)
                    || text.length < 2;

                if (text && !isHallucination) {
                    console.log("[OfflineSTT] Transcribed:", text);
                    onTranscriptRef.current(text);
                } else if (text) {
                    console.log("[OfflineSTT] Filtered hallucination:", text);
                }
                if (onInterimRef.current) onInterimRef.current('');
                if (isListeningRef.current) setStatus('recording');

                // Process any buffered audio immediately
                drainBuffer();
            } else if (msg.type === 'error') {
                busyRef.current = false;
                console.error("[OfflineSTT] Worker error:", msg.message);
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

        // Concatenate all chunks into a single Float32Array (at native rate)
        const totalLength = audioBufferRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
        const nativeRate = nativeRateRef.current;
        const minSamples = Math.round(MIN_AUDIO_DURATION_S * nativeRate);
        if (totalLength < minSamples) {
            // Too short — discard (don't accumulate forever)
            audioBufferRef.current = [];
            return;
        }

        const combined = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of audioBufferRef.current) {
            combined.set(chunk, offset);
            offset += chunk.length;
        }
        audioBufferRef.current = [];

        // Energy gate: compute average RMS of the whole buffer.
        // If it's below MIN_SPEECH_RMS, it's just ambient noise — skip.
        let energySum = 0;
        for (let i = 0; i < combined.length; i++) {
            energySum += combined[i] * combined[i];
        }
        const avgRms = Math.sqrt(energySum / combined.length);
        if (avgRms < MIN_SPEECH_RMS) {
            console.log(`[OfflineSTT] Skipped — avg RMS ${avgRms.toFixed(4)} below speech threshold ${MIN_SPEECH_RMS}`);
            return;
        }

        // Resample from native rate to 16kHz for Whisper
        const resampled = resampleTo16kHz(combined, nativeRate);
        const durationS = (resampled.length / TARGET_RATE).toFixed(1);
        console.log(`[OfflineSTT] Sending ${durationS}s of audio (RMS=${avgRms.toFixed(3)}) to Whisper`);

        busyRef.current = true;
        setStatus('transcribing');
        if (onInterimRef.current) onInterimRef.current('(transcribing...)');

        // Transfer buffer for zero-copy
        workerRef.current.postMessage(
            { type: 'transcribe', audio: resampled },
            [resampled.buffer]
        );
    }, [resampleTo16kHz]);

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
                    // CRITICAL: Disable all browser audio processing.
                    // noiseSuppression and echoCancellation use WebRTC algorithms
                    // that destroy spectral characteristics Whisper depends on.
                    // Whisper was trained on raw, unprocessed audio.
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: true, // Only AGC — normalizes volume without distortion
                    channelCount: 1,
                }
            });

            clearTimeout(mediaTimeout);
            console.log("[OfflineSTT] Microphone access granted");
            streamRef.current = stream;

            // Use DEFAULT sample rate (native hardware rate, usually 48kHz).
            // DO NOT request 16kHz — some browsers/Electron silently ignore the
            // request but report 16kHz, causing Whisper to receive 48kHz audio
            // labeled as 16kHz. This makes speech sound 3x slowed down, which
            // Whisper interprets as [Music] / *Inaudible* / *clap*.
            // Instead, we capture at native rate and resample manually.
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;
            nativeRateRef.current = audioContext.sampleRate;
            console.log(`[OfflineSTT] AudioContext sample rate: ${audioContext.sampleRate}Hz`);

            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            const source = audioContext.createMediaStreamSource(stream);

            // Raw pipeline: source → processor → destination. No filters.
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);

                // ── Volume metering (with noise floor so fans/AC don't animate) ──
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) {
                    sum += inputData[i] * inputData[i];
                }
                const rms = Math.sqrt(sum / inputData.length);
                // Subtract noise floor before scaling — ambient noise below 0.015 RMS = zero visual
                const adjusted = Math.max(0, rms - 0.015);
                const level = Math.min(1, adjusted * 12);

                if (processorRef.current) {
                    const lastLevel = (processorRef.current as any)._lastLevel ?? 0;
                    if (Math.abs(level - lastLevel) > 0.02) {
                        (processorRef.current as any)._lastLevel = level;
                        onVolumeRef.current?.(level);
                    }
                }

                // ── VAD: Only buffer when speech detected ──
                const frame = new Float32Array(inputData);
                if (rms > SILENCE_THRESHOLD) {
                    // Speech detected — prepend pre-roll frames (captures word onset)
                    if (audioBufferRef.current.length === 0 && preRollRef.current.length > 0) {
                        audioBufferRef.current.push(...preRollRef.current);
                        preRollRef.current = [];
                    }
                    lastSpeechTimeRef.current = Date.now();
                    audioBufferRef.current.push(frame);
                } else {
                    const timeSinceSpeech = Date.now() - lastSpeechTimeRef.current;
                    if (timeSinceSpeech < SILENCE_FLUSH_MS && lastSpeechTimeRef.current > 0) {
                        audioBufferRef.current.push(frame);
                    } else if (audioBufferRef.current.length > 0 && !busyRef.current) {
                        sendBufferToWorker();
                    }
                    // Maintain rolling pre-roll buffer
                    preRollRef.current.push(frame);
                    if (preRollRef.current.length > PRE_ROLL_FRAMES) {
                        preRollRef.current.shift();
                    }
                }
            };

            source.connect(processor);
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
        preRollRef.current = [];
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
    if (status === 'idle' && !isListening) return null;
    if (!isListening && status !== 'error' && status !== 'loading') return null;

    return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 shadow-inner">
            <div className="relative w-4 h-4 flex-shrink-0">
                <div className={`absolute inset-0 rounded-full transition-all duration-100 ${
                    status === 'recording' ? 'bg-amber-500 opacity-100 animate-pulse' :
                    status === 'transcribing' ? 'bg-blue-500 opacity-100 animate-pulse' :
                    status === 'loading' ? 'bg-yellow-500 opacity-100 animate-pulse' :
                    status === 'ready' ? 'bg-green-500 opacity-100' :
                    status === 'error' ? 'bg-red-500 opacity-100' :
                    'bg-zinc-500 opacity-50'
                }`} />
            </div>

            <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    {status === 'recording' ? 'Listening (Offline)' :
                     status === 'transcribing' ? 'Transcribing...' :
                     status === 'loading' ? `Loading AI${loadPercent > 0 ? ` (${loadPercent}%)` : '...'}` :
                     status === 'ready' ? 'Ready' :
                     status === 'error' ? 'Error — Retrying...' :
                     'Idle'}
                </span>

                {errorMsg && (
                    <span className="text-[9px] text-red-400 mt-0.5">{errorMsg}</span>
                )}
            </div>
        </div>
    );
}
