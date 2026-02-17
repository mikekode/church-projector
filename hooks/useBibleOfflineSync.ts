"use client";

import { useEffect, useRef } from 'react';
import { downloadAllPublicDomain, getDownloadStatus } from '@/utils/bibleOfflineCache';

/**
 * Background-downloads all public-domain Bible translations, the
 * Whisper AI model, AND the sentence embeddings model + verse index
 * when online. Runs silently — no UI, no user-facing progress.
 * Triggers on mount AND whenever the device comes online.
 */
export function useBibleOfflineSync() {
    const abortRef = useRef<AbortController | null>(null);
    const hasRunRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const runSync = async () => {
            // Prevent concurrent runs
            if (hasRunRef.current) return;
            if (!navigator.onLine) return;

            hasRunRef.current = true;

            try {
                // Run all three preloads independently in parallel.
                // Each handles its own errors and caching — neither blocks the other.
                await Promise.allSettled([
                    syncBibles(),
                    preloadWhisperModel(),
                    preloadEmbeddingsModel(),
                ]);
            } catch (e: any) {
                if (e?.name !== 'AbortError') {
                    console.error('[BibleSync] Error:', e);
                }
            } finally {
                hasRunRef.current = false;
            }
        };

        // Delay 2s on mount so we don't compete with initial page load
        const timer = setTimeout(runSync, 2_000);

        // Also trigger when the device comes online
        const onOnline = () => {
            setTimeout(runSync, 2_000);
        };
        window.addEventListener('online', onOnline);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('online', onOnline);
            abortRef.current?.abort();
        };
    }, []);
}

/**
 * Downloads all public-domain Bible translations if not already cached.
 */
async function syncBibles() {
    const status = await getDownloadStatus();
    const allDone = Object.values(status).every(Boolean);
    if (allDone) {
        console.log('[BibleSync] All translations already cached ✓');
        return;
    }
    const abort = new AbortController();
    await downloadAllPublicDomain(
        (msg) => console.log(`[BibleSync] ${msg}`),
        abort.signal
    );
    console.log('[BibleSync] Background download complete');
}

/**
 * Silently pre-downloads the Whisper model into IndexedDB cache.
 * Once cached, subsequent loads by OfflineSpeechRecognizer are instant.
 */
function preloadWhisperModel(): Promise<void> {
    return new Promise((resolve) => {
        try {
            // Signal starting to UI
            window.dispatchEvent(new CustomEvent('whisper-preload-progress', { detail: 0 }));

            const worker = new Worker(
                new URL('../workers/whisper.worker.ts', import.meta.url),
                { type: 'module' }
            );

            let maxProgress = 0;
            worker.onmessage = (e) => {
                const msg = e.data;
                if (msg.type === 'progress') {
                    const status = msg.data?.status;
                    const pct = msg.data?.progress;

                    if (status === 'progress' && pct !== undefined) {
                        // Xenova downloads 7+ files sequentially. 
                        // We track the highest progress seen across any file to prevent resets.
                        const currentPct = Math.round(pct);
                        if (currentPct > maxProgress) {
                            maxProgress = currentPct;
                            window.dispatchEvent(new CustomEvent('whisper-preload-progress', { detail: maxProgress }));
                        }
                    } else if (status === 'initiate') {
                        // When a new file starts, give a tiny bump to show activity
                        if (maxProgress === 0) {
                            maxProgress = 2;
                            window.dispatchEvent(new CustomEvent('whisper-preload-progress', { detail: maxProgress }));
                        }
                    }
                } else if (msg.type === 'ready') {
                    console.log('[WhisperPreload] Model cached ✓');
                    window.dispatchEvent(new CustomEvent('whisper-preload-ready'));
                    worker.terminate();
                    resolve();
                } else if (msg.type === 'error') {
                    console.warn('[WhisperPreload] Error:', msg.message);
                    window.dispatchEvent(new CustomEvent('whisper-preload-error', { detail: msg.message }));
                    worker.terminate();
                    resolve();
                }
            };

            worker.postMessage({ type: 'load' });

            // Safety timeout: don't hang forever (5 min max for slow connections)
            setTimeout(() => {
                worker.terminate();
                resolve();
            }, 5 * 60 * 1000);
        } catch {
            console.warn('[WhisperPreload] Worker creation failed — will download on first use');
            resolve();
        }
    });
}

/**
 * Silently pre-downloads the all-MiniLM-L6-v2 sentence embeddings model
 * and builds the curated verse index if it doesn't already exist in IndexedDB.
 */
function preloadEmbeddingsModel(): Promise<void> {
    return new Promise((resolve) => {
        try {
            const worker = new Worker(
                new URL('../workers/embeddings.worker.ts', import.meta.url),
                { type: 'module' }
            );

            worker.onmessage = async (e) => {
                const msg = e.data;

                if (msg.type === 'progress') {
                    // Model download progress
                    const pct = msg.data?.progress;
                    if (pct !== undefined && Math.round(pct) % 20 === 0) {
                        console.log(`[EmbeddingsPreload] Model: ${Math.round(pct)}%`);
                    }
                } else if (msg.type === 'ready') {
                    if (msg.indexLoaded) {
                        console.log(`[EmbeddingsPreload] Model + index cached ✓ (${msg.verseCount} verses)`);
                        worker.terminate();
                        resolve();
                    } else {
                        // Index not yet built
                        console.log('[EmbeddingsPreload] Building verse index...');
                        try {
                            const verses = await resolveVerseTexts();
                            worker.postMessage({ type: 'build-index', verses });
                        } catch (err) {
                            console.warn('[EmbeddingsPreload] Failed to resolve verses:', err);
                            worker.terminate();
                            resolve();
                        }
                    }
                } else if (msg.type === 'build-progress') {
                    const pct = msg.percent;
                    if (pct !== undefined && Math.round(pct) % 10 === 0) {
                        console.log(`[EmbeddingsPreload] Indexing: ${Math.round(pct)}%`);
                    }
                } else if (msg.type === 'build-complete') {
                    console.log(`[EmbeddingsPreload] Index built ✓ (${msg.verseCount} verses)`);
                    worker.terminate();
                    resolve();
                } else if (msg.type === 'error') {
                    console.warn('[EmbeddingsPreload] Error:', msg.message);
                    worker.terminate();
                    resolve();
                }
            };

            worker.postMessage({ type: 'load' });

            // Safety timeout
            setTimeout(() => {
                worker.terminate();
                resolve();
            }, 10 * 60 * 1000);
        } catch {
            console.warn('[EmbeddingsPreload] Worker creation failed');
            resolve();
        }
    });
}

/**
 * Lazily imports the curated verse list and KJV data, then resolves
 * each ref to { ref: string; text: string } format.
 */
async function resolveVerseTexts(): Promise<{ ref: string; text: string }[]> {
    const [{ getCuratedVerseRefs }, kjvModule] = await Promise.all([
        import('@/utils/curatedVerses'),
        import('@/utils/kjv.json')
    ]);

    const kjv: { abbrev: string; chapters: string[][] }[] = (kjvModule as any).default || kjvModule;
    const curatedRefs = getCuratedVerseRefs();

    const bookIndex = new Map<string, number>();
    kjv.forEach((book, idx) => bookIndex.set(book.abbrev, idx));

    const BOOK_NAMES: Record<string, string> = {
        gn: 'Genesis', ex: 'Exodus', lv: 'Leviticus', nm: 'Numbers', dt: 'Deuteronomy',
        js: 'Joshua', jud: 'Judges', rt: 'Ruth', '1sm': '1 Samuel', '2sm': '2 Samuel',
        '1kgs': '1 Kings', '2kgs': '2 Kings', '1ch': '1 Chronicles', '2ch': '2 Chronicles',
        ezr: 'Ezra', ne: 'Nehemiah', et: 'Esther', job: 'Job', ps: 'Psalms',
        prv: 'Proverbs', ec: 'Ecclesiastes', so: 'Song of Solomon',
        is: 'Isaiah', jr: 'Jeremiah', lm: 'Lamentations', ez: 'Ezekiel',
        dn: 'Daniel', ho: 'Hosea', jl: 'Joel', am: 'Amos', ob: 'Obadiah',
        jn: 'Jonah', mi: 'Micah', na: 'Nahum', hk: 'Habakkuk', zp: 'Zephaniah',
        hg: 'Haggai', zc: 'Zechariah', ml: 'Malachi',
        mt: 'Matthew', mk: 'Mark', lk: 'Luke', jo: 'John', act: 'Acts',
        rm: 'Romans', '1co': '1 Corinthians', '2co': '2 Corinthians', gl: 'Galatians',
        eph: 'Ephesians', ph: 'Philippians', cl: 'Colossians',
        '1ts': '1 Thessalonians', '2ts': '2 Thessalonians',
        '1tm': '1 Timothy', '2tm': '2 Timothy', tt: 'Titus', phm: 'Philemon',
        hb: 'Hebrews', jm: 'James', '1pe': '1 Peter', '2pe': '2 Peter',
        '1jo': '1 John', '2jo': '2 John', '3jo': '3 John', jd: 'Jude', re: 'Revelation'
    };

    const verses: { ref: string; text: string }[] = [];

    for (const cr of curatedRefs) {
        const bi = bookIndex.get(cr.book);
        if (bi === undefined) continue;

        const book = kjv[bi];
        const chapterIdx = cr.chapter - 1;
        const verseIdx = cr.verse - 1;

        if (!book.chapters[chapterIdx] || !book.chapters[chapterIdx][verseIdx]) continue;

        const text = book.chapters[chapterIdx][verseIdx];
        const bookName = BOOK_NAMES[cr.book] || cr.book;
        const ref = `${bookName} ${cr.chapter}:${cr.verse}`;

        verses.push({ ref, text });
    }

    return verses;
}
