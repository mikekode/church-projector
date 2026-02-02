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
        const lowerText = textWindow.toLowerCase();

        try {
            // PRIORITY 1: Navigation Commands - Check FIRST before any fuzzy matching!
            // These patterns are SPECIFIC to avoid false positives on common speech
            // Navigation operates on what's currently on the LIVE OUTPUT (tracked by currentVerseRef/chapterContextRef)

            // Next verse patterns - require explicit navigation intent
            if (/\b(?:next verse|next one|go next|move forward|go forward|advance|the next)\b/.test(lowerText)) {
                console.log('[SmartDetect] FAST NAV: next_verse (context:', chapterContextRef.current, ')');
                onDetect([], [{ type: 'next_verse' }], 'SWITCH', undefined);
                wordBufferRef.current = [];
                processingRef.current = false;
                return;
            }

            // Previous verse patterns - require explicit navigation intent
            if (/\b(?:previous verse|previous one|go back|back up|last verse|go backward|step back|back one)\b/.test(lowerText)) {
                console.log('[SmartDetect] FAST NAV: prev_verse (context:', chapterContextRef.current, ')');
                onDetect([], [{ type: 'prev_verse' }], 'SWITCH', undefined);
                wordBufferRef.current = [];
                processingRef.current = false;
                return;
            }

            // Clear/black screen patterns - require explicit clear intent
            if (/\b(?:clear screen|clear it|black ?out|blank screen|black screen|take it down|clear the screen)\b/.test(lowerText)) {
                console.log('[SmartDetect] FAST NAV: clear');
                onDetect([], [{ type: 'clear' }], 'SWITCH', undefined);
                wordBufferRef.current = [];
                processingRef.current = false;
                chapterContextRef.current = null;
                return;
            }

            // PRIORITY 1B: Translation Switching - Check EARLY before song/scripture detection
            // Comprehensive aliases for all Bible translations including phonetic/speech variations
            const VERSION_ALIASES: Record<string, string> = {
                // NIV - New International Version
                "new international version": "NIV", "new international": "NIV", "niv": "NIV",
                "n i v": "NIV", "n.i.v": "NIV", "the niv": "NIV", "niv version": "NIV",
                "international version": "NIV",

                // KJV - King James Version
                "king james version": "KJV", "king james": "KJV", "kjv": "KJV",
                "k j v": "KJV", "k.j.v": "KJV", "the king james": "KJV", "kjv version": "KJV",
                "authorized version": "KJV", "authorised version": "KJV", "the authorized": "KJV",
                "original king james": "KJV", "old king james": "KJV", "the old king james": "KJV",
                "1611": "KJV", "sixteen eleven": "KJV",

                // NKJV - New King James Version
                "new king james version": "NKJV", "new king james": "NKJV", "nkjv": "NKJV",
                "n k j v": "NKJV", "n.k.j.v": "NKJV", "the new king james": "NKJV",
                "nkjv version": "NKJV", "modern king james": "NKJV",

                // ESV - English Standard Version
                "english standard version": "ESV", "english standard": "ESV", "esv": "ESV",
                "e s v": "ESV", "e.s.v": "ESV", "the esv": "ESV", "esv version": "ESV",

                // NASB - New American Standard Bible
                "new american standard bible": "NASB", "new american standard": "NASB", "nasb": "NASB",
                "n a s b": "NASB", "n.a.s.b": "NASB", "nas": "NASB", "n a s": "NASB",
                "the nasb": "NASB", "nasb version": "NASB", "american standard": "NASB",
                "nasb 95": "NASB", "nasb 2020": "NASB", "nasb twenty twenty": "NASB",

                // AMP - Amplified Bible
                "amplified bible": "AMP", "amplified version": "AMP", "amplified": "AMP", "amp": "AMP",
                "a m p": "AMP", "a.m.p": "AMP", "the amplified": "AMP", "amp version": "AMP",
                "amplified translation": "AMP",

                // AMPC - Amplified Bible Classic Edition
                "amplified classic": "AMPC", "classic amplified": "AMPC", "ampc": "AMPC",
                "a m p c": "AMPC", "amplified classic edition": "AMPC", "the classic amplified": "AMPC",
                "amp classic": "AMPC", "original amplified": "AMPC",

                // MSG - The Message
                "the message": "MSG", "message version": "MSG", "message": "MSG", "msg": "MSG",
                "m s g": "MSG", "message bible": "MSG", "the message bible": "MSG",
                "eugene peterson": "MSG", "peterson": "MSG", "message translation": "MSG",

                // CSB - Christian Standard Bible (formerly HCSB)
                "christian standard bible": "CSB", "christian standard": "CSB", "csb": "CSB",
                "c s b": "CSB", "c.s.b": "CSB", "the csb": "CSB", "csb version": "CSB",
                "holman christian standard": "CSB", "hcsb": "CSB", "h c s b": "CSB",
                "holman": "CSB", "holman bible": "CSB",

                // NLT - New Living Translation
                "new living translation": "NLT", "new living": "NLT", "nlt": "NLT",
                "n l t": "NLT", "n.l.t": "NLT", "the nlt": "NLT", "nlt version": "NLT",
                "living translation": "NLT",

                // GW - God's Word Translation
                "god's word": "GW", "gods word": "GW", "gw": "GW", "g w": "GW",
                "god's word translation": "GW", "gods word translation": "GW",
                "the god's word": "GW",

                // KJV21 - 21st Century King James Version
                "21st century king james": "KJV21", "21st century": "KJV21", "kjv21": "KJV21",
                "k j v 21": "KJV21", "twenty first century king james": "KJV21",
                "kjv 21": "KJV21", "king james 21": "KJV21",

                // TLB - The Living Bible
                "the living bible": "TLB", "living bible": "TLB", "tlb": "TLB",
                "t l b": "TLB", "t.l.b": "TLB",

                // CEV - Contemporary English Version
                "contemporary english version": "CEV", "contemporary english": "CEV", "cev": "CEV",
                "c e v": "CEV", "c.e.v": "CEV", "the cev": "CEV",

                // GNT/GNB - Good News Translation/Bible
                "good news translation": "GNT", "good news bible": "GNT", "good news": "GNT",
                "gnt": "GNT", "gnb": "GNT", "g n t": "GNT", "g n b": "GNT",
                "today's english version": "GNT", "tev": "GNT", "t e v": "GNT",

                // TPT - The Passion Translation
                "the passion translation": "TPT", "passion translation": "TPT", "passion": "TPT",
                "tpt": "TPT", "t p t": "TPT", "t.p.t": "TPT", "the passion": "TPT",

                // WEB - World English Bible
                "world english bible": "WEB", "world english": "WEB", "web": "WEB",
                "w e b": "WEB",

                // ASV - American Standard Version
                "american standard version": "ASV", "asv": "ASV", "a s v": "ASV",
                "a.s.v": "ASV", "the asv": "ASV",

                // RSV - Revised Standard Version
                "revised standard version": "RSV", "revised standard": "RSV", "rsv": "RSV",
                "r s v": "RSV", "r.s.v": "RSV",

                // NRSV - New Revised Standard Version
                "new revised standard version": "NRSV", "new revised standard": "NRSV", "nrsv": "NRSV",
                "n r s v": "NRSV", "n.r.s.v": "NRSV",

                // NET - New English Translation
                "new english translation": "NET", "net bible": "NET", "net": "NET",
                "n e t": "NET", "the net": "NET",

                // ISV - International Standard Version
                "international standard version": "ISV", "isv": "ISV", "i s v": "ISV",

                // ERV - Easy-to-Read Version
                "easy to read version": "ERV", "easy to read": "ERV", "erv": "ERV",
                "e r v": "ERV", "easy read": "ERV",

                // ICB - International Children's Bible
                "international children's bible": "ICB", "children's bible": "ICB", "icb": "ICB",
                "i c b": "ICB",

                // VOICE - The Voice
                "the voice": "VOICE", "voice bible": "VOICE", "voice": "VOICE",
                "voice translation": "VOICE"
            };

            // Sort aliases by length (longest first) to match specific phrases before shorter ones
            const sortedAliases = Object.keys(VERSION_ALIASES).sort((a, b) => b.length - a.length);
            const aliasPattern = sortedAliases.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

            // Expanded trigger patterns for natural speech:
            // - "in [version]", "to [version]", "use [version]"
            // - "let's have/read/see this in [version]"
            // - "give me [version]", "show me [version]", "can I have [version]"
            // - "switch to [version]", "change to [version]"
            // - "[version] version", "[version] please", "the [version]"
            const versionRegex = new RegExp(
                `(?:` +
                    `(?:in|to|use|read|switch to|change to|give me|show me|can i have|let's have|have this in|read this in|see this in)\\s+(?:the\\s+)?` +
                `|` +
                    `(?:the\\s+)` +  // "the Amplified"
                `)?(${aliasPattern})(?:\\s+(?:version|please|translation))?`,
                'i'
            );

            const versionMatch = lowerText.match(versionRegex);

            if (versionMatch && versionMatch[1]) {
                const matchedTerm = versionMatch[1].toLowerCase();
                const targetCode = VERSION_ALIASES[matchedTerm];

                if (targetCode) {
                    console.log('[SmartDetect] FAST TRANSLATION SWITCH:', targetCode, 'from:', matchedTerm);
                    onDetect([], [{ type: 'switch_translation', version: targetCode }], 'SWITCH', undefined);
                    wordBufferRef.current = [];
                    processingRef.current = false;
                    return;
                }
            }

            // PRIORITY 1C: Relative Verse Navigation ("verse 5", "verse five", "go to verse 10")
            // ONLY triggers when there's NO book name in the text (to avoid catching "John 3:5" as relative)
            // This enables instant navigation within the active chapter
            if (chapterContextRef.current) {
                // Check if text contains a Bible book name - if so, skip relative navigation
                // and let the full scripture detection handle it
                const BOOK_PATTERNS = /\b(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalms?|proverbs?|ecclesiastes|song of solomon|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation|gen|exo|lev|num|deut|josh|judg|sam|kgs|chr|neh|est|psa|prov|eccl|isa|jer|lam|ezek|dan|hos|amo|obad|mic|nah|hab|zeph|hag|zech|mal|matt|rom|cor|gal|eph|phil|col|thess|tim|heb|rev)\b/i;

                const hasBookName = BOOK_PATTERNS.test(lowerText);

                // Only do relative verse navigation if NO book name is found
                if (!hasBookName) {
                    // Word-to-number mapping for spoken numbers
                    const WORD_NUMBERS: Record<string, number> = {
                        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
                        'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
                        'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
                        'twenty one': 21, 'twenty two': 22, 'twenty three': 23, 'twenty four': 24, 'twenty five': 25,
                        'twenty six': 26, 'twenty seven': 27, 'twenty eight': 28, 'twenty nine': 29, 'thirty': 30,
                        'thirty one': 31, 'thirty two': 32, 'thirty three': 33, 'thirty four': 34, 'thirty five': 35,
                        'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
                        'hundred': 100, 'one hundred': 100
                    };

                    // Build pattern for word numbers
                    const wordNumberPattern = Object.keys(WORD_NUMBERS).sort((a, b) => b.length - a.length).join('|');

                    // Match: "verse 5", "verse five", "go to verse 10", "let's go to verse five"
                    // Also match ranges: "verse 16 to 17", "verse 16 through 18", "verses 16 and 17"
                    // But NOT "John verse 5" (which has a book name)

                    // First check for verse RANGE patterns (e.g., "verse 16 to 17", "verses 5 through 7", "verse 16 and 17")
                    const rangeNumericMatch = lowerText.match(/(?:verse|verses|go to verse|let's go to verse)\s*(\d+)\s*(?:to|through|and|-)\s*(\d+)/);
                    const rangeWordMatch = lowerText.match(new RegExp(
                        `(?:verse|verses|go to verse|let's go to verse)\\s+(${wordNumberPattern})\\s+(?:to|through|and)\\s+(${wordNumberPattern})`,
                        'i'
                    ));

                    let rangeStart: number | null = null;
                    let rangeEnd: number | null = null;

                    if (rangeNumericMatch) {
                        rangeStart = parseInt(rangeNumericMatch[1]);
                        rangeEnd = parseInt(rangeNumericMatch[2]);
                    } else if (rangeWordMatch) {
                        rangeStart = WORD_NUMBERS[rangeWordMatch[1].toLowerCase()] || null;
                        rangeEnd = WORD_NUMBERS[rangeWordMatch[2].toLowerCase()] || null;
                    }

                    // If we detected a range, handle it
                    if (rangeStart && rangeEnd && rangeStart > 0 && rangeEnd > rangeStart && rangeEnd < 177) {
                        const [book, chapterStr] = chapterContextRef.current.split(/ (\d+)$/);
                        const chapter = parseInt(chapterStr);
                        const verseCount = rangeEnd - rangeStart + 1;

                        // Check if this range is ALREADY detected recently to avoid loops
                        const key = `${book}-${chapter}-${rangeStart}-${rangeEnd}`;
                        const lastDetected = recentDetectionsRef.current.get(key);

                        if (!lastDetected || Date.now() - lastDetected > 2000) {
                            console.log('[SmartDetect] FAST RELATIVE RANGE:', book, chapter, `${rangeStart}-${rangeEnd}`, `(${verseCount} verses)`);

                            // Look up first verse text (dashboard will fetch additional verses)
                            let text = lookupVerse(book, chapter, rangeStart);
                            if (!text && version !== 'KJV') {
                                const asyncText = await lookupVerseAsync(book, chapter, rangeStart, version);
                                if (asyncText) text = asyncText;
                            }

                            if (text) {
                                const script: DetectedScripture = {
                                    book, chapter, verse: rangeStart,
                                    verseEnd: rangeEnd,
                                    text,
                                    reference: `${book} ${chapter}:${rangeStart}-${rangeEnd}`,
                                    confidence: 95,
                                    matchType: 'exact'
                                };

                                // Pass verseCount so dashboard can auto-switch tabs
                                onDetect([script], [], 'SWITCH', Math.min(verseCount, 3) as 1 | 2 | 3);
                                recentDetectionsRef.current.set(key, Date.now());
                                wordBufferRef.current = [];
                                processingRef.current = false;
                                return;
                            }
                        }
                    }

                    // Single verse patterns
                    const verseNumericMatch = lowerText.match(/(?:verse|go to verse|let's go to verse|jump to verse)\s*(\d+)/);
                    const verseWordMatch = lowerText.match(new RegExp(`(?:verse|go to verse|let's go to verse|jump to verse)\\s+(${wordNumberPattern})`, 'i'));

                    let targetVerse: number | null = null;

                    if (verseNumericMatch) {
                        targetVerse = parseInt(verseNumericMatch[1]);
                    } else if (verseWordMatch) {
                        const wordNum = verseWordMatch[1].toLowerCase();
                        targetVerse = WORD_NUMBERS[wordNum] || null;
                    }

                    if (targetVerse && targetVerse > 0 && targetVerse < 177) {
                        const [book, chapterStr] = chapterContextRef.current.split(/ (\d+)$/);
                        const chapter = parseInt(chapterStr);

                        // Check if this verse is ALREADY detected recently to avoid loops
                        const key = `${book}-${chapter}-${targetVerse}`;
                        const lastDetected = recentDetectionsRef.current.get(key);

                        if (!lastDetected || Date.now() - lastDetected > 2000) {
                            console.log('[SmartDetect] FAST RELATIVE MATCH:', book, chapter, targetVerse, '(from spoken text)');

                            // Look up text
                            let text = lookupVerse(book, chapter, targetVerse);
                            if (!text && version !== 'KJV') {
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

                                onDetect([script], [], 'SWITCH', 1);
                                recentDetectionsRef.current.set(key, Date.now());
                                wordBufferRef.current = [];
                                processingRef.current = false;
                                return;
                            }
                        }
                    }
                }
            }

            // PRIORITY 2: CHECK SONGS (Lyric Matching)
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
