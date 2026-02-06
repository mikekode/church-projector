"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

type Props = {
    isListening: boolean;
    onTranscript: (text: string) => void;
    onInterim?: (text: string, isFinal: boolean) => void;
    onVolume?: (level: number) => void;
};

/**
 * DeepgramRecognizer - High accuracy streaming speech-to-text
 * Uses Deepgram's WebSocket API with Web Audio API for reliable audio capture.
 */
export default function DeepgramRecognizer({ isListening, onTranscript, onInterim, onStatusChange, onVolume }: Props & { onStatusChange?: (status: string, error?: string | null) => void }) {
    const [status, setStatus] = useState<"idle" | "connecting" | "listening" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const onTranscriptRef = useRef(onTranscript);
    const onInterimRef = useRef(onInterim);
    const onVolumeRef = useRef(onVolume);
    const isListeningRef = useRef(isListening);
    const lastFinalStartRef = useRef<number>(-1);

    // Propagate status changes
    useEffect(() => {
        onStatusChange?.(status, errorMsg);
    }, [status, errorMsg, onStatusChange]);

    useEffect(() => {
        onTranscriptRef.current = onTranscript;
        onInterimRef.current = onInterim;
        onVolumeRef.current = onVolume;
        isListeningRef.current = isListening;
    }, [onTranscript, onInterim, onVolume, isListening]);

    // ... (logic remains the same) ...
    // Note: I am NOT copying the whole logic block in this tool call to avoid huge token usage and truncation risk.
    // I need to use 'multi_replace' or just update the Signature and Return mainly.
    // Actually, simply replacing the render and the signature is safer.

    // I will use specific Search/Replace blocks to minimize context.
    const floatTo16BitPCM = (float32Array: Float32Array): ArrayBuffer => {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return buffer;
    };

    const startListening = useCallback(async () => {
        try {
            setStatus("connecting");
            setErrorMsg(null);

            console.log("Starting Deepgram...");

            // 1. Get microphone
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            console.log("Got microphone access");

            // 2. Fetch Deepgram token from secure API proxy
            // Hardcoded for production - env vars don't work reliably in static export
            const API_PROXY_URL = 'https://creenly-api-proxy.vercel.app';
            let apiKey: string;

            try {
                const tokenResponse = await fetch(`${API_PROXY_URL}/api/deepgram-token`);
                if (!tokenResponse.ok) {
                    throw new Error('Failed to fetch Deepgram token');
                }
                const tokenData = await tokenResponse.json();
                apiKey = tokenData.token;
            } catch (fetchError) {
                console.warn("Could not fetch token from proxy, using fallback");
                // Fallback to env var for development
                apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || '';
            }

            if (!apiKey) {
                throw new Error("Missing Deepgram API Key - configure API proxy or NEXT_PUBLIC_DEEPGRAM_API_KEY");
            }

            const wsUrl = `wss://api.deepgram.com/v1/listen?` +
                `encoding=linear16&sample_rate=16000&channels=1&` +
                `model=nova-2&language=en&` +
                `interim_results=true&punctuate=true&smart_format=true`;

            console.log("Connecting to Deepgram...");
            const ws = new WebSocket(wsUrl, ["token", apiKey]);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("Deepgram WebSocket connected!");
                setStatus("listening");

                // 3. Set up Web Audio API for raw PCM capture
                const audioContext = new AudioContext({ sampleRate: 16000 });
                audioContextRef.current = audioContext;

                const source = audioContext.createMediaStreamSource(stream);
                // Lower buffer size (1024) significantly reduces latency (64ms vs 256ms)
                const processor = audioContext.createScriptProcessor(1024, 1, 1);
                processorRef.current = processor;

                processor.onaudioprocess = (e) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        const inputData = e.inputBuffer.getChannelData(0);

                        // Calculate Volume (RMS) for visualization
                        let sum = 0;
                        for (let i = 0; i < inputData.length; i++) {
                            sum += inputData[i] * inputData[i];
                        }
                        const rms = Math.sqrt(sum / inputData.length);
                        // Normalize (0 to 1 scaling, boosted)
                        const level = Math.min(1, rms * 8);

                        // Optimization: Only update if change is significant (> 0.02)
                        // This prevents excessive re-renders of the entire dashboard
                        if (Math.abs(level - (processorRef.current as any)._lastLevel || 0) > 0.02) {
                            (processorRef.current as any)._lastLevel = level;
                            onVolumeRef.current?.(level);
                        }

                        const pcmData = floatTo16BitPCM(inputData);
                        ws.send(pcmData);
                    }
                };

                source.connect(processor);
                processor.connect(audioContext.destination);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'Results' && data.channel?.alternatives?.[0]) {
                        const transcript = data.channel.alternatives[0].transcript;

                        if (transcript && transcript.trim()) {
                            if (data.is_final) {
                                // Deduplicate: skip if same start time as last final result
                                const startTime = data.start ?? -1;
                                if (startTime === lastFinalStartRef.current) return;
                                lastFinalStartRef.current = startTime;

                                onTranscriptRef.current(transcript);
                                if (onInterimRef.current) onInterimRef.current('', true);
                            } else {
                                if (onInterimRef.current) onInterimRef.current(transcript, false);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Parse error:", e);
                }
            };

            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                setErrorMsg("Connection failed - check API key");
                setStatus("error");
            };

            ws.onclose = (event) => {
                console.log("WebSocket closed:", event.code, event.reason);
                if (event.code !== 1000 && isListeningRef.current) {
                    setErrorMsg(`Disconnected (${event.code})`);
                    setStatus("error");
                } else {
                    setStatus("idle");
                }
            };

        } catch (err: any) {
            console.error("Start error:", err);
            setErrorMsg(err.message || "Failed to start");
            setStatus("error");
        }
    }, []);

    const stopListening = useCallback(() => {
        console.log("Stopping Deepgram...");

        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        if (wsRef.current) {
            if (wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
            }
            wsRef.current.close();
            wsRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        setStatus("idle");
    }, []);

    useEffect(() => {
        if (isListening) {
            startListening();
        } else {
            stopListening();
        }
        return () => stopListening();
    }, [isListening, startListening, stopListening]);

    return null;
}
