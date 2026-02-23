/**
 * Whisper Web Worker — runs speech recognition 100% offline
 *
 * Uses @xenova/transformers to run the Whisper-base.en model
 * in WebAssembly. First run downloads ~150 MB (cached in IndexedDB).
 * Every subsequent run works fully offline.
 *
 * Model upgrade: tiny.en → base.en for significantly better accuracy
 * (closes gap with PewBeam's Faster Whisper approach).
 *
 * NOTE: The `window` polyfill for Web Workers is injected by
 * webpack BannerPlugin in next.config.js — no inline polyfill needed.
 */

import { pipeline, env } from '@xenova/transformers';

// Cache models in browser IndexedDB
env.allowLocalModels = false;
env.useBrowserCache = true;
// Always allow remote — when offline, useBrowserCache loads from IndexedDB cache.
// Setting this to false when offline causes "both local and remote disabled" error.
env.allowRemoteModels = true;

let transcriber: ReturnType<typeof pipeline> extends Promise<infer T> ? T : never;

self.addEventListener('message', async (e: MessageEvent) => {
    const { type, audio } = e.data;

    if (type === 'load') {
        console.log("[WhisperWorker] Received 'load' command. Initializing pipeline...");

        // Prevent download if offline and allowRemoteModels is false
        if (!navigator.onLine && !env.useBrowserCache) {
            self.postMessage({ type: 'error', message: 'Offline: Cannot download AI model. Please connect to the internet once.' });
            return;
        }

        try {
            transcriber = await pipeline(
                'automatic-speech-recognition',
                'Xenova/whisper-small.en',
                {
                    progress_callback: (progress: any) => {
                        // Forward ALL events (initiate, progress, done) so the
                        // preloader can track per-file bytes for accurate overall %
                        if (progress.status === 'progress' && Math.round(progress.progress) % 20 === 0) {
                            console.log(`[WhisperWorker] ${progress.file || ''} ${Math.round(progress.progress)}%`);
                        }
                        self.postMessage({ type: 'progress', data: progress });
                    }
                }
            ) as any;
            console.log("[WhisperWorker] Pipeline ready ✓");
            self.postMessage({ type: 'ready' });
        } catch (err: any) {
            console.error("[WhisperWorker] Load error:", err);
            let message = String(err?.message || err);

            // Helpful hint for offline setup
            if (!navigator.onLine && (message.includes('fetch') || message.includes('network'))) {
                message = "Offline AI model not found in cache. Please connect to the internet once to download (~150MB).";
            }

            self.postMessage({ type: 'error', message });
        }
    } else if (type === 'transcribe') {
        if (!transcriber) {
            self.postMessage({ type: 'error', message: 'Model not loaded yet' });
            return;
        }
        try {
            const result = await (transcriber as any)(audio, {
                language: 'english',
                task: 'transcribe',
                return_timestamps: false,
                chunk_length_s: 10,
                stride_length_s: 2,
            });
            self.postMessage({ type: 'result', text: (result as any).text });
        } catch (err: any) {
            self.postMessage({ type: 'error', message: String(err?.message || err) });
        }
    }
});
