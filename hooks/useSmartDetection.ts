import { useRef, useCallback, useEffect } from 'react';
import { lookupVerse, lookupVerseAsync, detectVersesInText } from '@/utils/bible';
import { getResources, ResourceItem } from '@/utils/resourceLibrary';
import {
    loadPastorProfile,
    savePastorProfile,
    recordVerseUsage,
    generateContextHint,
    PastorProfile,
} from '@/lib/pastorProfile';

export type DetectedScripture = {
    book: string;
    chapter: number;
    verse: number;
    verseEnd?: number;
    text: string;
    reference: string;
    confidence: number;
    matchType: 'exact' | 'partial' | 'paraphrase';
    version?: string; // Allow overriding version (e.g. 'SONG')
    songData?: any;
};

export type NavigationCommand = {
    type: 'next_verse' | 'prev_verse' | 'next_chapter' | 'prev_chapter' | 'clear' | 'jump_to_verse' | 'switch_translation';
    verse?: number;
    verseCount?: number;
    version?: string;
};

export type DetectionSignal = 'WAIT' | 'SWITCH' | 'HOLD';

export type OnDetectCallback = (
    scriptures: DetectedScripture[],
    commands: NavigationCommand[],
    signal: DetectionSignal,
    verseCount?: number
) => void;

type SmartDetectionOptions = {
    confidenceThreshold?: number;  // Minimum confidence to trigger (default: 70)
    windowSize?: number;           // Words per window (default: 15)
    debounceMs?: number;           // Debounce delay (default: 300)
    version?: string;              // Bible version (default: 'KJV')
};

/**
 * Smart Scripture Detection Hook (PersonaPlex-style)
 *
 * Key improvements over basic detection:
 * 1. Smaller text windows (5-15 words) for faster response
 * 2. Confidence scoring with thresholds
 * 3. Wait/Switch/Hold signals for intelligent switching
 * 4. Paraphrase recognition
 * 5. Pastor profile for context awareness
 */
export function useSmartDetection(
    onDetect: OnDetectCallback,
    currentVerse: string | null,
    options: SmartDetectionOptions = {}
) {
    const {
        confidenceThreshold = 70,
        windowSize = 15,
        debounceMs = 300,
        version = 'KJV',
    } = options;

    // State refs
    const wordBufferRef = useRef<string[]>([]);
    const contextRef = useRef<string>('');
    const processingRef = useRef<boolean>(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const recentDetectionsRef = useRef<Map<string, number>>(new Map());
    const pastorProfileRef = useRef<PastorProfile | null>(null);
    const currentVerseRef = useRef<string | null>(currentVerse);
    const chapterContextRef = useRef<string | null>(null);
    const pendingRetryRef = useRef<boolean>(false);
    const processWindowRef = useRef<() => Promise<void>>();
    const songLibraryRef = useRef<ResourceItem[]>([]);

    // Keep currentVerse ref in sync and update chapter anchor
    useEffect(() => {
        currentVerseRef.current = currentVerse;
        if (currentVerse) {
            // Extract Book and Chapter from "Book Chapter:Verse"
            const match = currentVerse.match(/^(.+?)\s+(\d+):/);
            if (match) {
                const newContext = `${match[1]} ${match[2]}`;
                if (chapterContextRef.current !== newContext) {
                    console.log('[SmartDetect] Updating anchor from active slide:', newContext);
                    chapterContextRef.current = newContext;
                }
            }
        }
    }, [currentVerse]);

    // Load pastor profile and Songs on mount
    useEffect(() => {
        pastorProfileRef.current = loadPastorProfile();
        getResources().then(resources => {
            // Filter only songs
            songLibraryRef.current = resources.filter(r => r.category === 'song');
            console.log(`[SmartDetect] Loaded ${songLibraryRef.current.length} songs for detection.`);
        });
    }, []);

    const processWindow = useCallback(async () => {
        if (processingRef.current) {
            pendingRetryRef.current = true;
            return;
        }

        if (wordBufferRef.current.length < 2) return;

        processingRef.current = true;

        // Get the text window (last N words)
        const textWindow = wordBufferRef.current.slice(-windowSize).join(' ');
        const context = contextRef.current;


        try {
            // 0. CHECK SONGS (Lyric Matching)
            // Strategy: Check if the textWindow matches any substring in the song library slides
            // 1. Normalized Substring (ignores spaces/punctuation)
            // 2. Token Overlap (Jaccard) for phrases (tolerates word errors)

            const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
            const tokenize = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2); // Words > 2 chars

            const reportMatch = (song: any, text: string, type: 'exact' | 'partial') => {
                console.log(`[SmartDetect] SONG MATCH (${type}):`, song.title);
                const songMatch: DetectedScripture = {
                    book: 'Song',
                    chapter: 0,
                    verse: 0,
                    text: text,
                    reference: song.title,
                    confidence: type === 'exact' ? 95 : 80,
                    matchType: type,
                    version: 'SONG',
                    songData: song
                };
                onDetect([songMatch], [], 'SWITCH', 1);
                wordBufferRef.current = [];
                processingRef.current = false;
            };

            const rawInput = textWindow;
            const normInput = normalize(rawInput);
            const inputTokens = tokenize(rawInput);

            if (rawInput.length > 3) {
                const getBigrams = (s: string) => { const b = new Set<string>(); for (let i = 0; i < s.length - 1; i++)b.add(s.substring(i, i + 2)); return b; };
                const dice = (s1: string, s2: string) => { if (!s1 || !s2) return 0; const a = s1.toLowerCase().replace(/[^a-z0-9]/g, ''), b = s2.toLowerCase().replace(/[^a-z0-9]/g, ''); if (a === b) return 1; const ba = getBigrams(a), bb = getBigrams(b); if (!ba.size || !bb.size) return 0; let i = 0; ba.forEach(x => { if (bb.has(x)) i++ }); return (2 * i) / (ba.size + bb.size); };

                let bestMatch = { song: null as any, slide: '', score: 0 };
                for (const song of songLibraryRef.current) {
                    for (const slide of song.slides) {
                        const score = dice(rawInput, slide.content);
                        const normSlide = normalize(slide.content);
                        // Boost exact substring
                        const exact = normSlide.length > 5 && (normSlide.includes(normInput) || normInput.includes(normSlide));
                        const finalScore = exact ? 1 : score;

                        if (finalScore > bestMatch.score) {
                            bestMatch = { song, slide: slide.content, score: finalScore };
                        }
                    }
                }

                if (bestMatch.score > 0.45 && bestMatch.song) {
                    reportMatch(bestMatch.song, bestMatch.slide, bestMatch.score >= 0.9 ? 'exact' : 'partial');
                    return;
                }
            }

            // FAST PATH: Check for explicit scripture references locally using Regex
            const localDetections = detectVersesInText(textWindow);

            if (localDetections.length > 0) {
                console.log('[SmartDetect] FAST PATH MATCH:', localDetections[0].reference);

                // Construct a result object similar to API response
                const fastScriptures: DetectedScripture[] = [];

                for (const d of localDetections) {
                    // Check if recently detected
                    const key = `${d.book}-${d.chapter}-${d.verse}`;
                    const lastDetected = recentDetectionsRef.current.get(key);
                    if (lastDetected && Date.now() - lastDetected < 3000) {
                        continue;
                    }

                    // Look up text (Async if needed)
                    let text = d.text;
                    if (version !== 'KJV') {
                        const asyncText = await lookupVerseAsync(d.book, d.chapter, d.verse, version);
                        if (asyncText) text = asyncText;
                    }

                    if (text) {
                        fastScriptures.push({
                            book: d.book,
                            chapter: d.chapter,
                            verse: d.verse,
                            text: text,
                            reference: d.reference,
                            confidence: 100, // Regex matches are 100% explicit
                            matchType: 'exact'
                        });
                        recentDetectionsRef.current.set(key, Date.now());

                        // Update Anchor context
                        chapterContextRef.current = `${d.book} ${d.chapter}`;
                    }
                }

                if (fastScriptures.length > 0) {
                    onDetect(fastScriptures, [], 'SWITCH', 1);
                    // CRITICAL: Clear buffer to prevent "Switching Back" or re-detecting old verses
                    wordBufferRef.current = [];
                    processingRef.current = false;
                    return;
                }
            }

            // FAST PATH: Relative Navigation ("Vertex 5", "Verse 10")
            // This enables instant navigation within the active chapter
            if (chapterContextRef.current) {
                // Check for "Verse X" pattern (or ": X" due to validation, but handle raw text too)
                // Matches: "verse 5", "v 5", ": 5"
                const relativeMatch = textWindow.toLowerCase().match(/(?:verse|v\.?|:)\s*(\d+)/);
                if (relativeMatch) {
                    const targetVerse = parseInt(relativeMatch[1]);
                    // Sanity check: Verse must be reasonable (1-200)
                    if (targetVerse > 0 && targetVerse < 177) {
                        const [book, chapterStr] = chapterContextRef.current.split(/ (\d+)$/);
                        const chapter = parseInt(chapterStr);

                        // Check if this verse is ALREADY detected recently to avoid loops
                        const key = `${book}-${chapter}-${targetVerse}`;
                        const lastDetected = recentDetectionsRef.current.get(key);

                        if (!lastDetected || Date.now() - lastDetected > 2000) {
                            console.log('[SmartDetect] FAST RELATIVE MATCH:', book, chapter, targetVerse);

                            // Look up text
                            let text = lookupVerse(book, chapter, targetVerse); // KJV sync verify first
                            if (!text && version !== 'KJV') {
                                // Async lookup
                                // We can't await easily here without blocking? processWindow IS async.
                                const asyncText = await lookupVerseAsync(book, chapter, targetVerse, version);
                                if (asyncText) text = asyncText;
                            }

                            if (text) {
                                const script: DetectedScripture = {
                                    book, chapter, verse: targetVerse,
                                    text,
                                    reference: `${book} ${chapter}:${targetVerse}`,
                                    confidence: 95,
                                    matchType: 'exact'
                                };

                                onDetect([script], [], 'SWITCH', 1); // FORCE verseCount 1
                                recentDetectionsRef.current.set(key, Date.now());
                                wordBufferRef.current = [];
                                processingRef.current = false;
                                return;
                            }
                        }
                    }
                }
            }

            // FAST PATH: Translation Switching ("in NIV", "use Amplified")
            const VERSION_ALIASES: Record<string, string> = {
                "new international version": "NIV", "new international": "NIV", "niv": "NIV",
                "king james version": "KJV", "king james": "KJV", "kjv": "KJV",
                "new king james version": "NKJV", "new king james": "NKJV", "nkjv": "NKJV",
                "english standard version": "ESV", "english standard": "ESV", "esv": "ESV",
                "new american standard bible": "NASB", "new american standard": "NASB", "nasb": "NASB",
                "amplified classic": "AMPC", "classic amplified": "AMPC", "ampc": "AMPC",
                "amplified bible": "AMP", "amplified": "AMP", "amp": "AMP",
                "the message": "MSG", "message": "MSG", "msg": "MSG",
                "christian standard bible": "CSB", "christian standard": "CSB", "csb": "CSB",
                "new living translation": "NLT", "new living": "NLT", "nlt": "NLT",
                "god's word": "GW", "gw": "GW",
                "21st century king james": "KJV21", "21st century": "KJV21", "kjv21": "KJV21"
            };

            // Generate regex from keys, sorted by length descending to catch specific phrases first ("Amplified Classic" before "Amplified")
            const sortedAliases = Object.keys(VERSION_ALIASES).sort((a, b) => b.length - a.length);
            const aliasPattern = sortedAliases.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'); // Escape regex chars just in case

            // Regex: Trigger words -> Optional "the" -> Alias
            const versionRegex = new RegExp(`(?:in|to|use|read|version|give me)\\s+(?:the\\s+)?(${aliasPattern})`, 'i');

            const versionMatch = textWindow.toLowerCase().match(versionRegex);

            if (versionMatch) {
                const matchedTerm = versionMatch[1].toLowerCase();
                // Direct lookup (since we matched the alias exactly)
                const targetCode = VERSION_ALIASES[matchedTerm];

                if (targetCode) {
                    console.log('[SmartDetect] FAST TRANSLATION SWITCH:', targetCode);
                    onDetect([], [{ type: 'switch_translation', version: targetCode }], 'SWITCH', undefined);
                    wordBufferRef.current = []; // Clear buffer
                    processingRef.current = false;
                    return;
                }
            }

            // FAST PATH: Navigation Commands ("next verse", "previous verse", "clear")
            const lowerText = textWindow.toLowerCase();

            // Next verse patterns
            if (/(?:next|forward|advance|continue|move on|go forward|next verse|the next|move forward)/.test(lowerText)) {
                console.log('[SmartDetect] FAST NAV: next_verse');
                onDetect([], [{ type: 'next_verse' }], 'SWITCH', undefined);
                wordBufferRef.current = [];
                processingRef.current = false;
                return;
            }

            // Previous verse patterns
            if (/(?:previous|go back|back up|last verse|prior|before|back one|step back|previous verse|go backward)/.test(lowerText)) {
                console.log('[SmartDetect] FAST NAV: prev_verse');
                onDetect([], [{ type: 'prev_verse' }], 'SWITCH', undefined);
                wordBufferRef.current = [];
                processingRef.current = false;
                return;
            }

            // Clear/black screen patterns
            if (/(?:clear|black ?out|blank|hide|remove|off|black screen|clear screen|take it down)/.test(lowerText)) {
                console.log('[SmartDetect] FAST NAV: clear');
                onDetect([], [{ type: 'clear' }], 'SWITCH', undefined);
                wordBufferRef.current = [];
                processingRef.current = false;
                chapterContextRef.current = null;
                return;
            }

            let data;

            // USE ELECTRON IPC IF AVAILABLE (OFFLINE / DESKTOP MODE)
            if ((window as any).electronAPI?.smartDetect) {
                console.log('[SmartDetect] Mode: Electron IPC');
                data = await (window as any).electronAPI.smartDetect({
                    text: textWindow,
                    context: context,
                    pastorHints: pastorProfileRef.current ? generateContextHint(pastorProfileRef.current) : undefined,
                    currentVerse: currentVerseRef.current,
                    chapterContext: chapterContextRef.current,
                });

                if (data.error) throw new Error(data.error);

            } else {
                // FALLBACK TO NEXT.JS API (WEB MODE)
                console.log('[SmartDetect] Processing window (API):', textWindow.slice(-50));
                const response = await fetch('/api/smart-detect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: textWindow,
                        context: context,
                        pastorHints: pastorProfileRef.current
                            ? generateContextHint(pastorProfileRef.current)
                            : undefined,
                        currentVerse: currentVerseRef.current,
                        chapterContext: chapterContextRef.current,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                data = await response.json();
            }

            console.log('[SmartDetect] Signal:', data.signal, '|', data.signalReason);

            const scriptures: DetectedScripture[] = [];
            const commands: NavigationCommand[] = data.commands || [];

            // Process scripture detections
            for (const s of data.scriptures || []) {
                // Check confidence threshold
                if (s.confidence < confidenceThreshold) {
                    console.log(`[SmartDetect] Below threshold (${s.confidence}):`, s.book, s.chapter, s.verse);
                    continue;
                }

                // Deduplicate (within 5 seconds - reduced for faster flow)
                const key = `${s.book}-${s.chapter}-${s.verse}`;
                const lastDetected = recentDetectionsRef.current.get(key);
                if (lastDetected && Date.now() - lastDetected < 5000) {
                    console.log('[SmartDetect] Skipping recent:', key);
                    continue;
                }

                // Look up verse text (use async for non-KJV versions)
                let verseText: string | null = null;

                if (version === 'KJV') {
                    // Use fast local lookup for KJV
                    verseText = lookupVerse(s.book, s.chapter, s.verse);

                    // Try variations if not found
                    if (!verseText) {
                        const variations = [
                            s.book.toLowerCase(),
                            s.book.replace(/\s+/g, ''),
                            s.book.replace(/(\d)\s+/, '$1 '),
                            s.book === 'Psalm' ? 'Psalms' : s.book,
                            s.book === 'Psalms' ? 'Psalm' : s.book,
                        ];
                        for (const v of variations) {
                            verseText = lookupVerse(v, s.chapter, s.verse);
                            if (verseText) break;
                        }
                    }
                } else {
                    // Use async API lookup for other versions
                    verseText = await lookupVerseAsync(s.book, s.chapter, s.verse, version);

                    // Try variations if not found
                    if (!verseText) {
                        const variations = [
                            s.book.toLowerCase(),
                            s.book === 'Psalm' ? 'Psalms' : s.book,
                            s.book === 'Psalms' ? 'Psalm' : s.book,
                            s.book.toLowerCase().includes('solomon') ? 'Song of Solomon' : s.book,
                        ];
                        for (const v of variations) {
                            verseText = await lookupVerseAsync(v, s.chapter, s.verse, version);
                            if (verseText) break;
                        }
                    }
                }

                if (verseText) {
                    const reference = s.verseEnd
                        ? `${s.book} ${s.chapter}:${s.verse}-${s.verseEnd}`
                        : `${s.book} ${s.chapter}:${s.verse}`;

                    scriptures.push({
                        book: s.book,
                        chapter: s.chapter,
                        verse: s.verse,
                        verseEnd: s.verseEnd,
                        text: verseText,
                        reference,
                        confidence: s.confidence,
                        matchType: s.matchType || 'exact',
                    });

                    // Mark as detected
                    recentDetectionsRef.current.set(key, Date.now());

                    // Update pastor profile
                    if (pastorProfileRef.current) {
                        pastorProfileRef.current = recordVerseUsage(
                            pastorProfileRef.current,
                            reference,
                            s.book
                        );
                        savePastorProfile(pastorProfileRef.current);
                    }

                    console.log(`[SmartDetect] ✓ ${s.matchType.toUpperCase()} (${s.confidence}%):`, reference);

                    // Anchor the context to this chapter
                    chapterContextRef.current = `${s.book} ${s.chapter}`;
                } else {
                    console.log('[SmartDetect] ✗ Verse not found:', s.book, s.chapter, s.verse);
                }
            }

            // Only callback if we have something to report
            if (scriptures.length > 0 || commands.length > 0 || data.signal === 'SWITCH') {
                onDetect(scriptures, commands, data.signal, data.verseCount);
                if (scriptures.length > 0) {
                    wordBufferRef.current = [];
                }
            }

            // Clear buffer and anchor context after successful command detection
            if (commands.length > 0) {
                wordBufferRef.current = [];
                const mainCmd = commands[0];
                if (mainCmd.type === 'clear') {
                    chapterContextRef.current = null;
                }
            }

            // Update rolling context
            contextRef.current = textWindow;

        } catch (error) {
            console.error('[SmartDetect] Error:', error);
        } finally {
            processingRef.current = false;
            if (pendingRetryRef.current) {
                pendingRetryRef.current = false;
                processWindowRef.current?.();
            }
        }
    }, [onDetect, confidenceThreshold, windowSize]);

    useEffect(() => {
        processWindowRef.current = processWindow;
    }, [processWindow]);

    /**
     * Add text from transcription
     * Splits into words and triggers detection when window is ready
     */
    const addText = useCallback((text: string) => {
        // Split into words and add to buffer
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        // Reduce buffer size to prevent old "ghost" detections from re-appearing
        wordBufferRef.current = [...wordBufferRef.current, ...words].slice(-15);

        // Debounce processing
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            processWindow();
        }, debounceMs);
    }, [processWindow, debounceMs]);

    /**
     * Reset detection state
     */
    const reset = useCallback(() => {
        wordBufferRef.current = [];
        contextRef.current = '';
        recentDetectionsRef.current.clear();
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    /**
     * Update pastor profile settings
     */
    const updateSermonContext = useCallback((context: {
        series?: string;
        theme?: string;
        focusBooks?: string[];
        focusVerses?: string[];
    }) => {
        if (pastorProfileRef.current) {
            pastorProfileRef.current.sermonContext = {
                ...pastorProfileRef.current.sermonContext,
                ...context,
            };
            savePastorProfile(pastorProfileRef.current);
        }
    }, []);

    /**
     * Get current pastor profile
     */
    const getPastorProfile = useCallback(() => {
        return pastorProfileRef.current;
    }, []);

    return {
        addText,
        reset,
        updateSermonContext,
        getPastorProfile,
    };
}
