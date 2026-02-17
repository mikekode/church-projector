/**
 * Embeddings Web Worker — Local semantic Bible verse search
 *
 * Uses @xenova/transformers with all-MiniLM-L6-v2 (~22MB) to generate
 * 384-dim sentence embeddings entirely in the browser (WASM).
 *
 * Messages:
 *   → { type: 'load' }              — Download/cache model, load verse index
 *   → { type: 'search', text, threshold?, maxResults? }
 *                                     — Find similar verses by cosine similarity
 *
 *   ← { type: 'progress', data }    — Model download progress
 *   ← { type: 'ready' }             — Model + index loaded
 *   ← { type: 'results', results }  — Search results
 *   ← { type: 'error', message }    — Error
 */

import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers';

// Configure cache
env.useBrowserCache = true;
env.allowLocalModels = false;

let embedder: FeatureExtractionPipeline | null = null;

// Verse embeddings index: array of { ref, text, emb: Float32Array }
let verseIndex: { ref: string; text: string; emb: Float32Array }[] = [];

// ─── Cosine Similarity ──────────────────────────────────────────────────

function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── Verse Index (IndexedDB) ────────────────────────────────────────────

const DB_NAME = 'creenly_embeddings';
const STORE_NAME = 'verse_index';
const INDEX_KEY = 'bible_v1';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function loadVerseIndex(): Promise<boolean> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(INDEX_KEY);
            req.onsuccess = () => {
                if (req.result && Array.isArray(req.result)) {
                    verseIndex = req.result.map((v: any) => ({
                        ref: v.ref,
                        text: v.text,
                        emb: new Float32Array(v.emb)
                    }));
                    console.log(`[Embeddings] Loaded ${verseIndex.length} verse embeddings from IndexedDB`);
                    resolve(true);
                } else {
                    console.log('[Embeddings] No verse index in IndexedDB');
                    resolve(false);
                }
            };
            req.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}

async function saveVerseIndex(data: { ref: string; text: string; emb: number[] }[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(data, INDEX_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ─── Message Handler ────────────────────────────────────────────────────

self.addEventListener('message', async (e: MessageEvent) => {
    const { type, text, threshold = 0.50, maxResults = 3, verses } = e.data;

    if (type === 'load') {
        try {
            // Load the sentence embedding model
            embedder = await pipeline(
                'feature-extraction',
                'Xenova/all-MiniLM-L6-v2',
                {
                    progress_callback: (progress: any) => {
                        self.postMessage({ type: 'progress', data: progress });
                    }
                }
            ) as FeatureExtractionPipeline;

            // Load verse index from IndexedDB
            const loaded = await loadVerseIndex();

            self.postMessage({
                type: 'ready',
                indexLoaded: loaded,
                verseCount: verseIndex.length
            });

        } catch (err: any) {
            self.postMessage({ type: 'error', message: String(err?.message || err) });
        }

    } else if (type === 'search') {
        if (!embedder) {
            self.postMessage({ type: 'error', message: 'Model not loaded' });
            return;
        }
        if (!verseIndex.length) {
            self.postMessage({ type: 'results', results: [] });
            return;
        }

        try {
            // Generate embedding for the input text
            const output = await embedder(text, { pooling: 'mean', normalize: true });
            const queryEmb = output.data as Float32Array;

            // Find similar verses
            const scored = verseIndex.map(v => ({
                ref: v.ref,
                text: v.text,
                similarity: cosineSimilarity(queryEmb, v.emb)
            }));

            const results = scored
                .filter(v => v.similarity >= threshold)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, maxResults)
                .map(v => ({
                    ref: v.ref,
                    text: v.text,
                    confidence: Math.round(v.similarity * 100)
                }));

            self.postMessage({ type: 'results', results });

        } catch (err: any) {
            self.postMessage({ type: 'error', message: String(err?.message || err) });
        }

    } else if (type === 'build-index') {
        // Build verse embeddings index from provided verses
        // verses: Array<{ ref: string, text: string }>
        if (!embedder) {
            self.postMessage({ type: 'error', message: 'Model not loaded' });
            return;
        }
        if (!verses || !verses.length) {
            self.postMessage({ type: 'error', message: 'No verses provided' });
            return;
        }

        try {
            const indexData: { ref: string; text: string; emb: number[] }[] = [];
            const batchSize = 20;
            const total = verses.length;

            for (let i = 0; i < total; i += batchSize) {
                const batch = verses.slice(i, i + batchSize);
                const texts = batch.map((v: any) => v.text);

                // Process batch
                for (let j = 0; j < texts.length; j++) {
                    const output = await embedder(texts[j], { pooling: 'mean', normalize: true });
                    indexData.push({
                        ref: batch[j].ref,
                        text: batch[j].text,
                        emb: Array.from(output.data as Float32Array)
                    });
                }

                // Report progress
                const pct = Math.round(((i + batch.length) / total) * 100);
                self.postMessage({
                    type: 'build-progress',
                    processed: i + batch.length,
                    total,
                    percent: pct
                });
            }

            // Save to IndexedDB
            await saveVerseIndex(indexData);

            // Update in-memory index
            verseIndex = indexData.map(v => ({
                ref: v.ref,
                text: v.text,
                emb: new Float32Array(v.emb)
            }));

            self.postMessage({
                type: 'build-complete',
                verseCount: verseIndex.length
            });

        } catch (err: any) {
            self.postMessage({ type: 'error', message: String(err?.message || err) });
        }
    }
});
