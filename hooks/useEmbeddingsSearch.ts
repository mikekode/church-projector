/**
 * useEmbeddingsSearch — React hook for managing the local semantic search worker
 *
 * Provides:
 *   - Automatic model loading and verse index management
 *   - `search(text)` function for finding semantically similar verses
 *   - `buildIndex()` function to generate verse embeddings from KJV data
 *   - Status tracking (idle, loading, ready, searching, error)
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export type EmbeddingsStatus = 'idle' | 'loading' | 'ready' | 'searching' | 'building' | 'error';

export interface SemanticResult {
    ref: string;
    text: string;
    confidence: number;
}

interface WorkerMessage {
    type: string;
    data?: any;
    results?: SemanticResult[];
    message?: string;
    indexLoaded?: boolean;
    verseCount?: number;
    processed?: number;
    total?: number;
    percent?: number;
}

interface UseEmbeddingsSearchOptions {
    /** Auto-load model on mount. Default: false (lazy load) */
    autoLoad?: boolean;
    /** Similarity threshold (0-1). Default: 0.50 */
    threshold?: number;
    /** Max results. Default: 3 */
    maxResults?: number;
}

export function useEmbeddingsSearch(options: UseEmbeddingsSearchOptions = {}) {
    const { autoLoad = false, threshold = 0.50, maxResults = 3 } = options;

    const [status, setStatus] = useState<EmbeddingsStatus>('idle');
    const [indexReady, setIndexReady] = useState(false);
    const [verseCount, setVerseCount] = useState(0);
    const [buildProgress, setBuildProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const workerRef = useRef<Worker | null>(null);
    const resolveRef = useRef<((results: SemanticResult[]) => void) | null>(null);
    const buildResolveRef = useRef<(() => void) | null>(null);

    // Initialize worker
    useEffect(() => {
        try {
            const worker = new Worker(
                new URL('../workers/embeddings.worker.ts', import.meta.url),
                { type: 'module' }
            );

            worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
                const msg = e.data;

                switch (msg.type) {
                    case 'progress':
                        // Model download progress
                        setStatus('loading');
                        break;

                    case 'ready':
                        setStatus('ready');
                        setIndexReady(msg.indexLoaded ?? false);
                        setVerseCount(msg.verseCount ?? 0);
                        console.log(`[Embeddings] Ready — index: ${msg.indexLoaded ? 'loaded' : 'empty'}, verses: ${msg.verseCount}`);
                        break;

                    case 'results':
                        setStatus('ready');
                        resolveRef.current?.(msg.results ?? []);
                        resolveRef.current = null;
                        break;

                    case 'build-progress':
                        setBuildProgress(msg.percent ?? 0);
                        break;

                    case 'build-complete':
                        setStatus('ready');
                        setIndexReady(true);
                        setVerseCount(msg.verseCount ?? 0);
                        setBuildProgress(null);
                        buildResolveRef.current?.();
                        buildResolveRef.current = null;
                        console.log(`[Embeddings] Index built: ${msg.verseCount} verses`);
                        break;

                    case 'error':
                        setStatus('error');
                        setError(msg.message ?? 'Unknown error');
                        resolveRef.current?.([]);
                        resolveRef.current = null;
                        buildResolveRef.current?.();
                        buildResolveRef.current = null;
                        console.error('[Embeddings] Error:', msg.message);
                        break;
                }
            };

            workerRef.current = worker;

            if (autoLoad) {
                setStatus('loading');
                worker.postMessage({ type: 'load' });
            }

            return () => {
                worker.terminate();
                workerRef.current = null;
            };
        } catch (err) {
            console.error('[Embeddings] Worker creation failed:', err);
            setStatus('error');
            setError(String(err));
        }
    }, [autoLoad]);

    // Load the model (if not auto-loaded)
    const load = useCallback(() => {
        if (workerRef.current && status === 'idle') {
            setStatus('loading');
            workerRef.current.postMessage({ type: 'load' });
        }
    }, [status]);

    // Search for similar verses
    const search = useCallback(async (text: string): Promise<SemanticResult[]> => {
        if (!workerRef.current || status !== 'ready' || !indexReady) {
            return [];
        }

        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setStatus('searching');
            workerRef.current!.postMessage({
                type: 'search',
                text,
                threshold,
                maxResults
            });

            // Timeout safety (5 seconds)
            setTimeout(() => {
                if (resolveRef.current === resolve) {
                    resolveRef.current = null;
                    setStatus('ready');
                    resolve([]);
                }
            }, 5000);
        });
    }, [status, indexReady, threshold, maxResults]);

    // Build the verse embeddings index
    const buildIndex = useCallback(async (verses: { ref: string; text: string }[]): Promise<void> => {
        if (!workerRef.current || (status !== 'ready' && status !== 'idle')) {
            return;
        }

        return new Promise((resolve) => {
            buildResolveRef.current = resolve;
            setStatus('building');
            setBuildProgress(0);
            workerRef.current!.postMessage({
                type: 'build-index',
                verses
            });
        });
    }, [status]);

    return {
        status,
        indexReady,
        verseCount,
        buildProgress,
        error,
        load,
        search,
        buildIndex
    };
}
