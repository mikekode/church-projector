import { useRef, useCallback, useEffect } from 'react';
import { lookupVerse, lookupVerseAsync, detectVersesInText, getChapterVerseCount } from '@/utils/bible';
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
    theme?: string;                // Current sermon theme
    strictMode?: boolean;          // If true, commands require "Projector" or "Creenly" wake-word
};

// Word-to-number mapping for spoken numbers (Shared across all detection logic)
const WORD_NUMBERS: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'twenty one': 21, 'twenty two': 22, 'twenty three': 23, 'twenty four': 24, 'twenty five': 25,
    'twenty six': 26, 'twenty seven': 27, 'twenty eight': 28, 'twenty nine': 29, 'thirty': 30,
    'thirty one': 31, 'thirty two': 32, 'thirty three': 33, 'thirty four': 34, 'thirty five': 35,
    'thirty six': 36, 'thirty seven': 37, 'thirty eight': 38, 'thirty nine': 39,
    'forty': 40, 'forty one': 41, 'forty two': 42, 'forty three': 43, 'forty four': 44, 'forty five': 45,
    'forty six': 46, 'forty seven': 47, 'forty eight': 48, 'forty nine': 49,
    'fifty': 50, 'fifty one': 51, 'fifty two': 52, 'fifty three': 53, 'fifty four': 54, 'fifty five': 55,
    'fifty six': 56, 'fifty seven': 57, 'fifty eight': 58, 'fifty nine': 59,
    'sixty': 60, 'sixty one': 61, 'sixty two': 62, 'sixty three': 63, 'sixty four': 64, 'sixty five': 65,
    'sixty six': 66, 'sixty seven': 67, 'sixty eight': 68, 'sixty nine': 69,
    'seventy': 70, 'seventy one': 71, 'seventy two': 72, 'seventy three': 73, 'seventy four': 74, 'seventy five': 75,
    'seventy six': 76, 'seventy seven': 77, 'seventy eight': 78, 'seventy nine': 79,
    'eighty': 80, 'eighty one': 81, 'eighty two': 82, 'eighty three': 83, 'eighty four': 84, 'eighty five': 85,
    'eighty six': 86, 'eighty seven': 87, 'eighty eight': 88, 'eighty nine': 89,
    'ninety': 90, 'ninety one': 91, 'ninety two': 92, 'ninety three': 93, 'ninety four': 94, 'ninety five': 95,
    'ninety six': 96, 'ninety seven': 97, 'ninety eight': 98, 'ninety nine': 99,
    'one hundred': 100, 'hundred': 100,
    'one hundred and one': 101, 'one hundred one': 101,
    'one hundred and two': 102, 'one hundred two': 102,
    'one hundred and three': 103, 'one hundred three': 103,
    'one hundred and four': 104, 'one hundred four': 104,
    'one hundred and five': 105, 'one hundred five': 105,
    'one hundred and six': 106, 'one hundred six': 106,
    'one hundred and seven': 107, 'one hundred seven': 107,
    'one hundred and eight': 108, 'one hundred eight': 108,
    'one hundred and nine': 109, 'one hundred nine': 109,
    'one hundred and ten': 110, 'one hundred ten': 110,
    'one hundred and eleven': 111, 'one hundred eleven': 111,
    'one hundred and twelve': 112, 'one hundred twelve': 112,
    'one hundred and thirteen': 113, 'one hundred thirteen': 113,
    'one hundred and fourteen': 114, 'one hundred fourteen': 114,
    'one hundred and fifteen': 115, 'one hundred fifteen': 115,
    'one hundred and sixteen': 116, 'one hundred sixteen': 116,
    'one hundred and seventeen': 117, 'one hundred seventeen': 117,
    'one hundred and eighteen': 118, 'one hundred eighteen': 118,
    'one hundred and nineteen': 119, 'one hundred nineteen': 119,
    'one hundred and twenty': 120, 'one hundred twenty': 120,
    'one hundred and twenty one': 121, 'one hundred twenty one': 121,
    'one hundred and twenty two': 122, 'one hundred twenty two': 122,
    'one hundred and twenty three': 123, 'one hundred twenty three': 123,
    'one hundred and twenty four': 124, 'one hundred twenty four': 124,
    'one hundred and twenty five': 125, 'one hundred twenty five': 125,
    'one hundred and twenty six': 126, 'one hundred twenty six': 126,
    'one hundred and twenty seven': 127, 'one hundred twenty seven': 127,
    'one hundred and twenty eight': 128, 'one hundred twenty eight': 128,
    'one hundred and twenty nine': 129, 'one hundred twenty nine': 129,
    'one hundred and thirty': 130, 'one hundred thirty': 130,
    'one hundred and thirty one': 131, 'one hundred thirty one': 131,
    'one hundred and thirty two': 132, 'one hundred thirty two': 132,
    'one hundred and thirty three': 133, 'one hundred thirty three': 133,
    'one hundred and thirty four': 134, 'one hundred thirty four': 134,
    'one hundred and thirty five': 135, 'one hundred thirty five': 135,
    'one hundred and thirty six': 136, 'one hundred thirty six': 136,
    'one hundred and thirty seven': 137, 'one hundred thirty seven': 137,
    'one hundred and thirty eight': 138, 'one hundred thirty eight': 138,
    'one hundred and thirty nine': 139, 'one hundred thirty nine': 139,
    'one hundred and forty': 140, 'one hundred forty': 140,
    'one hundred and forty one': 141, 'one hundred forty one': 141,
    'one hundred and forty two': 142, 'one hundred forty two': 142,
    'one hundred and forty three': 143, 'one hundred forty three': 143,
    'one hundred and forty four': 144, 'one hundred forty four': 144,
    'one hundred and forty five': 145, 'one hundred forty five': 145,
    'one hundred and forty six': 146, 'one hundred forty six': 146,
    'one hundred and forty seven': 147, 'one hundred forty seven': 147,
    'one hundred and forty eight': 148, 'one hundred forty eight': 148,
    'one hundred and forty nine': 149, 'one hundred forty nine': 149,
    'one hundred and fifty': 150, 'one hundred fifty': 150,
    'one hundred and fifty one': 151, 'one hundred fifty one': 151,
    'one hundred and fifty two': 152, 'one hundred fifty two': 152,
    'one hundred and fifty three': 153, 'one hundred fifty three': 153,
    'one hundred and fifty four': 154, 'one hundred fifty four': 154,
    'one hundred and fifty five': 155, 'one hundred fifty five': 155,
    'one hundred and fifty six': 156, 'one hundred fifty six': 156,
    'one hundred and fifty seven': 157, 'one hundred fifty seven': 157,
    'one hundred and fifty eight': 158, 'one hundred fifty eight': 158,
    'one hundred and fifty nine': 159, 'one hundred fifty nine': 159,
    'one hundred and sixty': 160, 'one hundred sixty': 160,
    'one hundred and sixty one': 161, 'one hundred sixty one': 161,
    'one hundred and sixty two': 162, 'one hundred sixty two': 162,
    'one hundred and sixty three': 163, 'one hundred sixty three': 163,
    'one hundred and sixty four': 164, 'one hundred sixty four': 164,
    'one hundred and sixty five': 165, 'one hundred sixty five': 165,
    'one hundred and sixty six': 166, 'one hundred sixty six': 166,
    'one hundred and sixty seven': 167, 'one hundred sixty seven': 167,
    'one hundred and sixty eight': 168, 'one hundred sixty eight': 168,
    'one hundred and sixty nine': 169, 'one hundred sixty nine': 169,
    'one hundred and seventy': 170, 'one hundred seventy': 170,
    'one hundred and seventy one': 171, 'one hundred seventy one': 171,
    'one hundred and seventy two': 172, 'one hundred seventy two': 172,
    'one hundred and seventy three': 173, 'one hundred seventy three': 173,
    'one hundred and seventy four': 174, 'one hundred seventy four': 174,
    'one hundred and seventy five': 175, 'one hundred seventy five': 175,
    'one hundred and seventy six': 176, 'one hundred seventy six': 176
};

// Comprehensive Bible Book patterns for quick detection (Shared)
const BOOK_PATTERNS = /\b(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalms?|proverbs?|ecclesiastes|song of solomon|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation|gen|exo|lev|num|deut|josh|judg|sam|kgs|chr|neh|est|psa|prov|eccl|isa|jer|lam|ezek|dan|hos|amo|obad|mic|nah|hab|zeph|hag|zech|mal|matt|rom|cor|gal|eph|phil|col|thess|tim|heb|rev)\b/i;

// Build pattern for word numbers (longest first)
const WORD_NUMBER_PATTERN = Object.keys(WORD_NUMBERS).sort((a, b) => b.length - a.length).join('|');

/**
 * Fuzzy string matching using Sørensen–Dice coefficient
 */
const dice = (s1: string, s2: string) => {
    if (!s1 || !s2) return 0;
    const a = s1.toLowerCase().replace(/[^a-z0-9]/g, ''), b = s2.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (a === b) return 1;
    const getBigrams = (s: string) => {
        const b = new Set<string>();
        for (let i = 0; i < s.length - 1; i++) b.add(s.substring(i, i + 2));
        return b;
    };
    const ba = getBigrams(a), bb = getBigrams(b);
    if (!ba.size || !bb.size) return 0;
    let i = 0; ba.forEach(x => { if (bb.has(x)) i++ });
    return (2 * i) / (ba.size + bb.size);
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
        debounceMs = 200,
        version = 'KJV',
        theme = '',
        strictMode = false,
    } = options;

    // State refs
    const wordBufferRef = useRef<string[]>([]);
    const contextRef = useRef<string>('');
    const processingRef = useRef<boolean>(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const recentDetectionsRef = useRef<Map<string, number>>(new Map());
    const recentCommandsRef = useRef<Map<string, number>>(new Map()); // Command Cooldown (Deduplication)
    const pastorProfileRef = useRef<PastorProfile | null>(null);
    const currentVerseRef = useRef<string | null>(currentVerse);
    const chapterContextRef = useRef<string | null>(null);
    const pendingRetryRef = useRef<boolean>(false);
    const processWindowRef = useRef<() => Promise<void>>();
    const songLibraryRef = useRef<ResourceItem[]>([]);

    // Embeddings worker for local semantic search (Priority 3)
    const embeddingsWorkerRef = useRef<Worker | null>(null);
    const embeddingsReadyRef = useRef<boolean>(false);
    const embeddingsIndexReadyRef = useRef<boolean>(false);

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

    useEffect(() => {
        pastorProfileRef.current = loadPastorProfile();
        getResources().then(resources => {
            // Filter only songs
            songLibraryRef.current = resources.filter(r => r.category === 'song');
        });
    }, []);

    // Initialize embeddings worker for local semantic search
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const worker = new Worker(
                new URL('../workers/embeddings.worker.ts', import.meta.url),
                { type: 'module' }
            );
            worker.onmessage = (e) => {
                const msg = e.data;
                if (msg.type === 'ready') {
                    embeddingsReadyRef.current = true;
                    embeddingsIndexReadyRef.current = !!msg.indexLoaded;
                    console.log(`[SmartDetect] Embeddings ready (index: ${msg.indexLoaded ? msg.verseCount + ' verses' : 'empty'})`);
                } else if (msg.type === 'error') {
                    console.warn('[SmartDetect] Embeddings error:', msg.message);
                }
            };
            embeddingsWorkerRef.current = worker;
            // Lazy load — send load message after short delay to not compete with initial page activity
            setTimeout(() => worker.postMessage({ type: 'load' }), 5000);
            return () => { worker.terminate(); embeddingsWorkerRef.current = null; };
        } catch {
            console.warn('[SmartDetect] Embeddings worker unavailable');
        }
    }, []);

    /**
     * Check if a command is in cooldown (to prevent repetitive triggers for emphasis)
     * Returns true if it should be IGNORED.
     */
    const checkCommandCooldown = useCallback((type: string, payload?: any) => {
        const key = payload ? `${type}_${JSON.stringify(payload)}` : type;
        const lastExecuted = recentCommandsRef.current.get(key);
        const cooldownMs = 2500; // 2.5 seconds for emphasis/repetition protection

        if (lastExecuted && Date.now() - lastExecuted < cooldownMs) {
            console.log(`[SmartDetect] Cooldown active for: ${key}. Ignoring repetitive command.`);
            return true;
        }

        recentCommandsRef.current.set(key, Date.now());
        return false;
    }, []);

    const processWindow = useCallback(async () => {
        if (processingRef.current) {
            pendingRetryRef.current = true;
            return;
        }

        // REMOVED: wordBufferRef.current.length < 2 restriction to allow single-number verse jumping
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
            // Optimized to avoid false positives on common teaching phrases
            const nextPattern = strictMode
                ? /\b(?:projector|creenly)\b.*\b(?:next verse|next one|go next|move forward)\b/i
                : /\b(?:next verse|next one|go next|move forward|advance|the next)\b/i;

            if (nextPattern.test(lowerText)) {
                if (!checkCommandCooldown('next_verse')) {
                    console.log('[SmartDetect] FAST NAV: next_verse');
                    onDetect([], [{ type: 'next_verse' }], 'SWITCH', undefined);
                }
                wordBufferRef.current = [];
                processingRef.current = false;
                return;
            }

            // Previous verse patterns - require explicit navigation intent
            // Added negative lookahead/checks for "let me", "let's" to protect conversational speech
            const prevPattern = strictMode
                ? /\b(?:projector|creenly)\b.*\b(?:previous verse|go back|back up|last verse)\b/i
                : /(?<!let me |let's |let us )\b(?:previous verse|previous one|go back to (?:the )?(?:last|previous) verse|back up to the last|last verse|step back one)\b/i;

            // Manual check for "go back" since JS regex lookbehind is sometimes finicky across engines
            const isConversationalBack = /\b(?:let me|let's|let us|we will)\s+go back\b/.test(lowerText);

            if (prevPattern.test(lowerText) && (!isConversationalBack || strictMode)) {
                if (!checkCommandCooldown('prev_verse')) {
                    console.log('[SmartDetect] FAST NAV: prev_verse');
                    onDetect([], [{ type: 'prev_verse' }], 'SWITCH', undefined);
                }
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

            // REMOVED: PRIORITY 1C from Slow Path.
            // This was too broad and triggered on conversational numbers like "there were 7 of them".
            // Sequential jumping is now handled exclusively by the anchored Fast Path in addText.

            // PRIORITY 1B: Translation Switching - Check EARLY before song/scripture detection
            // Comprehensive aliases for all Bible translations including phonetic/speech variations
            const VERSION_ALIASES: Record<string, string> = {
                // NIV - New International Version
                "new international version": "NIV", "new international": "NIV", "niv": "NIV",
                "n i v": "NIV", "n.i.v": "NIV", "the niv": "NIV", "niv version": "NIV",
                "international version": "NIV", "any standard": "NIV",

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

                // CSB - Christian Standard Bible
                "christian standard bible": "CSB", "christian standard": "CSB", "csb": "CSB",
                "c s b": "CSB", "c.s.b": "CSB", "the csb": "CSB", "csb version": "CSB",
                "holman christian standard": "CSB", "hcsb": "CSB", "h c s b": "CSB",
                "holman": "CSB", "holman bible": "CSB",

                // NLT - New Living Translation
                "new living translation": "NLT", "new living": "NLT", "nlt": "NLT",
                "n l t": "NLT", "n.l.t": "NLT", "the nlt": "NLT", "nlt version": "NLT",
                "living translation": "NLT", "nl tea": "NLT", "en l t": "NLT",

                // VOICE - The Voice
                "the voice": "VOICE", "voice bible": "VOICE", "voice": "VOICE",
                "voice translation": "VOICE",

                // WEB - World English Bible
                "world english bible": "WEB", "world english": "WEB", "web": "WEB",
                "the web": "WEB", "web version": "WEB", "web translation": "WEB",

                // TPT - The Passion Translation
                "the passion translation": "TPT", "passion translation": "TPT", "the passion": "TPT",
                "the passion version": "TPT", "passion bible": "TPT", "passion": "TPT", "tpt": "TPT",
                "t p t": "TPT", "p t": "TPT", // "p t" is a common mis-transcript for "TPT"

                // GW - God's Word Translation
                "god's word translation": "GW", "god's word": "GW", "gw": "GW",

                // KJV21 - 21st Century King James
                "21st century king james": "KJV21", "kjv 21": "KJV21", "kjv 21st": "KJV21",

                // TLB - The Living Bible
                "the living bible": "TLB", "living bible": "TLB", "tlb": "TLB", "t l b": "TLB",

                // Other versions
                "asv": "ASV", "rsv": "RSV", "nrsv": "NRSV", "net": "NET", "isv": "ISV", "erv": "ERV", "icb": "ICB"
            };

            // RISKY ALIASES: Common words that MUST have command context to trigger a switch
            const RISKY_ALIASES = ["voice", "message", "original", "authorised", "authorized", "classic", "international", "standard", "living", "web", "passion", "net", "tlb"];

            const sortedAliases = Object.keys(VERSION_ALIASES).sort((a, b) => b.length - a.length);
            const aliasPattern = sortedAliases.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

            // Shared command patterns
            const commandPrefix = `(?:use|read|switch to|change to|give me|show me|can i have|let's have|have this in|read this in|see this in)\\s+(?:the|a)?\\s*`;
            const articlePrefix = `(?:the|a)\\s+`;
            const versionSuffix = `\\s+(?:version|please|translation|bible)`;

            // Combined pattern: (Prefix)? (Alias) (Suffix)?
            const versionRegex = new RegExp(
                `\\b(?:(${commandPrefix})|(${articlePrefix}))?(${aliasPattern})(?:(${versionSuffix}))?\\b`,
                'i'
            );

            const versionMatch = lowerText.match(versionRegex);

            if (versionMatch) {
                const prefixGroup = versionMatch[1] || versionMatch[2];
                const alias = versionMatch[3]?.toLowerCase();
                const suffix = versionMatch[4];
                const matchedVersion = VERSION_ALIASES[alias];

                if (matchedVersion) {
                    // Accuracy Guard: If it's a risky/common word, it MUST have a command prefix or a version suffix
                    // Articles (the/a) are in prefixGroup 2, while explicit commands are in prefixGroup 1.
                    // Risky words like "message" or "voice" should NOT trigger on just "the message" or "a voice".
                    const isRisky = RISKY_ALIASES.some(r => alias.includes(r));
                    const hasExplicitCommand = !!(versionMatch[1] || suffix);
                    const hasAnyContext = !!(prefixGroup || suffix);

                    if (!isRisky || hasExplicitCommand) {
                        if (!checkCommandCooldown('switch_translation', matchedVersion)) {
                            console.log('[AI] Translation switch detected via voice:', matchedVersion, `(Trigger: "${alias}")`);
                            onDetect([], [{ type: 'switch_translation', version: matchedVersion }], 'SWITCH', 1);
                        }
                        wordBufferRef.current = [];
                        processingRef.current = false;
                        return;
                    } else if (isRisky) {
                        console.log('[AI] Ignoring risky version alias without explicit command context:', alias);
                    }
                }
            }

            // PRIORITY 1C: Relative Verse Navigation ("verse 5", "verse five", "go to verse 10")
            // ONLY triggers when there's NO book name in the text (to avoid catching "John 3:5" as relative)
            // This enables instant navigation within the active chapter
            if (chapterContextRef.current) {
                // Check if text contains a Bible book name - if so, skip relative navigation
                // and let the full scripture detection handle it
                const hasBookName = BOOK_PATTERNS.test(lowerText);

                // Only do relative verse navigation if NO book name is found
                if (!hasBookName) {

                    // Match: "verse 5", "verse five", "go to verse 10", "let's go to verse five"
                    // Also match ranges: "verse 16 to 17", "verse 16 through 18", "verses 16 and 17"
                    // But NOT "John verse 5" (which has a book name)

                    // First check for verse RANGE patterns (e.g., "verse 16 to 17", "verses 5 through 7", "verse 16 and 17")
                    // Supports "Verse Number 16"
                    const rangeNumericMatch = lowerText.match(/(?:verse|verses|go to verse|let's go to verse)(?:\s+(?:number|num|no\.?))?\s*(\d+)\s*(?:to|through|and|-)\s*(\d+)/);
                    const rangeWordMatch = lowerText.match(new RegExp(
                        `(?:verse|verses|go to verse|let's go to verse)(?:\\s+(?:number|num|no\\.?))?\\s+(${WORD_NUMBER_PATTERN})\\s+(?:to|through|and)\\s+(${WORD_NUMBER_PATTERN})`,
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
                    // Supports "Verse Number 5"
                    const verseNumericMatch = lowerText.match(/(?:verse|go to verse|let's go to verse|jump to verse)(?:\s+(?:number|num|no\.?))?\s*(\d+)/);
                    const verseWordMatch = lowerText.match(new RegExp(`(?:verse|go to verse|let's go to verse|jump to verse)(?:\\s+(?:number|num|no\\.?))?\\s+(${WORD_NUMBER_PATTERN})`, 'i'));

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

            // Optimization: Only check songs if the input is significant (at least 20 chars)
            if (rawInput.length > 20) {
                const getBigrams = (s: string) => { const b = new Set<string>(); for (let i = 0; i < s.length - 1; i++)b.add(s.substring(i, i + 2)); return b; };
                const diceLocal = dice; // Use the global helper

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

            // PRIORITY 3: LOCAL SEMANTIC SEARCH — paraphrase detection via embeddings worker
            // Only runs if: worker is ready, index is loaded, and text is long enough
            if (
                embeddingsWorkerRef.current &&
                embeddingsReadyRef.current &&
                embeddingsIndexReadyRef.current &&
                textWindow.length >= 20
            ) {
                try {
                    const semanticResults = await semanticSearchLocal(embeddingsWorkerRef.current, textWindow);
                    if (semanticResults.length > 0) {
                        const semanticScriptures: DetectedScripture[] = [];

                        for (const sr of semanticResults) {
                            // Parse ref like "John 3:16" -> { book: "John", chapter: 3, verse: 16 }
                            const refMatch = sr.ref.match(/^(.+?)\s+(\d+):(\d+)$/);
                            if (!refMatch) continue;

                            const [, book, chStr, vStr] = refMatch;
                            const chapter = parseInt(chStr);
                            const verse = parseInt(vStr);

                            // Check recent detections
                            const key = `${book}-${chapter}-${verse}`;
                            const lastDetected = recentDetectionsRef.current.get(key);
                            if (lastDetected && Date.now() - lastDetected < 5000) continue;

                            // Look up text for the active version
                            let text = sr.text;
                            if (version !== 'KJV') {
                                const asyncText = await lookupVerseAsync(book, chapter, verse, version);
                                if (asyncText) text = asyncText;
                            }

                            if (text) {
                                semanticScriptures.push({
                                    book,
                                    chapter,
                                    verse,
                                    text,
                                    reference: sr.ref,
                                    confidence: sr.confidence,
                                    matchType: 'paraphrase',
                                });
                                recentDetectionsRef.current.set(key, Date.now());
                                chapterContextRef.current = `${book} ${chapter}`;
                            }
                        }

                        if (semanticScriptures.length > 0) {
                            console.log('[SmartDetect] LOCAL SEMANTIC MATCH:', semanticScriptures.map(s => s.reference).join(', '));
                            onDetect(semanticScriptures, [], 'SWITCH', 1);
                            wordBufferRef.current = [];
                            processingRef.current = false;
                            return;
                        }
                    }
                } catch (err) {
                    console.warn('[SmartDetect] Semantic search error:', err);
                    // Fall through to API
                }
            }

            let data;

            // Incorporate theme into hints
            let hints = pastorProfileRef.current ? generateContextHint(pastorProfileRef.current) : '';
            if (theme) {
                hints = `[ACTIVE SERMON THEME: ${theme}]\n${hints}`;
            }

            if ((window as any).electronAPI?.smartDetect) {
                console.log('[SmartDetect] Mode: Electron IPC');
                data = await (window as any).electronAPI.smartDetect({
                    text: textWindow,
                    context: context,
                    pastorHints: hints || undefined,
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
                        pastorHints: hints || undefined,
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
                // 1. Smart Anchor Weighting: Prioritize scriptures near current context
                let finalConfidence = s.confidence;
                if (chapterContextRef.current) {
                    const [anchorBook, anchorChapterStr] = chapterContextRef.current.split(/ (\d+)$/);
                    const anchorChapter = parseInt(anchorChapterStr);

                    // Boost if book matches
                    if (s.book.toLowerCase() === anchorBook.toLowerCase()) {
                        finalConfidence += 15; // Significant boost for same book

                        // Extra boost if chapter is close (within 2 chapters)
                        if (Math.abs(s.chapter - anchorChapter) <= 2) {
                            finalConfidence += 10;
                        }
                    }
                }

                // Check confidence threshold (using the boosted confidence)
                if (finalConfidence < confidenceThreshold) {
                    console.log(`[SmartDetect] Below threshold (${finalConfidence}):`, s.book, s.chapter, s.verse);
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
     * Handles cumulative interim results from Deepgram correctly.
     */
    const addText = useCallback((text: string, isFinal: boolean = false) => {
        if (!text.trim()) return;

        // Strip previous context if this is a continuation of an interim segment
        // Deepgram sends: "John", "John 3", "John 3 16"
        // We only want the FULL latest segment if it's interim, or append if it's final.

        let words: string[] = [];
        if (isFinal) {
            // If final, append these words permanently to buffer
            words = text.trim().split(/\s+/).filter(w => w.length > 0);
            wordBufferRef.current = [...wordBufferRef.current, ...words].slice(-20);
        } else {
            // If interim, we don't append to wordBufferRef yet (it's volatile)
            // Instead, we just use the current text for immediate detection
            words = text.trim().split(/\s+/).filter(w => w.length > 0);
        }

        const currentWindow = isFinal ? wordBufferRef.current : [...wordBufferRef.current, ...words];
        const lowerFullText = currentWindow.join(' ').toLowerCase();

        // Avoid re-processing if the text hasn't changed enough
        if (contextRef.current === lowerFullText) return;
        contextRef.current = lowerFullText;

        // 0. QUICK SEQUENTIAL VERSE JUMPING ("17", "now 18", "verse 19", "seventeen", "And 18.")
        // SAFETY: Only trigger if the ENTIRE text window is just the number/command.
        // Stripping punctuation like '.' or ',' which Deepgram often appends to short segments.
        if (chapterContextRef.current) {
            // Clean text: strip trailing punctuation and extra spaces
            const cleanFullText = lowerFullText.replace(/[.,!?]$/, '').trim();

            // Regex matches: "7", "now 7", "verse 7", "and 7", "the 7", "then 7", "seventeen"
            // Supported Segues: now, then, and, the, verse, go to, look at, page
            // SAFETY: In Strict Mode, even sequential jumps require the wake-word to prevent accidental triggers during teaching.
            const wakeWordPrefix = strictMode ? '(?:projector|creenly)\\s+.*?' : '';
            const seguePattern = `(?:now|then|and|the|verse|go to|look at|page|verses)`;
            const seqRegex = new RegExp(`^${wakeWordPrefix}(?:${seguePattern}\\s+)?(?:${seguePattern}\\s+)?(\\d{1,3}|${WORD_NUMBER_PATTERN})$`, 'i');

            const standaloneMatch = cleanFullText.match(seqRegex);
            if (standaloneMatch) {
                const matchedVal = standaloneMatch[1].toLowerCase();
                const targetVerse = WORD_NUMBERS[matchedVal] || parseInt(matchedVal);

                if (targetVerse > 0 && targetVerse <= 176) {
                    const [book, chapterStr] = chapterContextRef.current.split(/ (\d+)$/);
                    const chapter = parseInt(chapterStr);
                    const key = `${book}-${chapter}-${targetVerse}-fast-seq`;

                    if (!checkCommandCooldown('jump_to_verse', targetVerse)) {
                        console.log('[SmartDetect] ⚡ FAST SEQUENTIAL JUMP:', `${book} ${chapter}:${targetVerse} (from "${cleanFullText}")`);
                        const processFastSeq = async () => {
                            const currentVersion = options.version || 'KJV';
                            const text = await lookupVerseAsync(book, chapter, targetVerse, currentVersion);
                            if (text) {
                                onDetect([{
                                    book, chapter, verse: targetVerse,
                                    text,
                                    reference: `${book} ${chapter}:${targetVerse}`,
                                    confidence: 100,
                                    matchType: 'exact'
                                }], [], 'SWITCH', 1);
                                recentDetectionsRef.current.set(key, Date.now());

                                // CLEAR BUFFER IMMEDIATELY to prevent double-firing
                                wordBufferRef.current = [];
                                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                            }
                        };
                        processFastSeq();
                        return;
                    }
                }
            }
        }

        // 1. FAST NAVIGATION COMMANDS ("Next Verse", "Previous Verse")
        const nextRegex = strictMode
            ? /\b(?:projector|creenly)\b.*\b(?:next verse|next one|go next)\b/i
            : /\b(?:next verse|next one|go next)\b/i;

        if (nextRegex.test(lowerFullText)) {
            if (!checkCommandCooldown('next_verse')) {
                console.log('[SmartDetect] ⚡ ZERO LATENCY NAV: Next Verse');
                onDetect([], [{ type: 'next_verse' }], 'SWITCH', undefined);
            }
            wordBufferRef.current = [];
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            return;
        }

        const prevRegex = strictMode
            ? /\b(?:projector|creenly)\b.*\b(?:previous verse|previous one|go back|last verse)\b/i
            : /\b(?:previous verse|previous one|go back|last verse)\b/i;

        if (prevRegex.test(lowerFullText)) {
            if (!checkCommandCooldown('prev_verse')) {
                console.log('[SmartDetect] ⚡ ZERO LATENCY NAV: Prev Verse');
                onDetect([], [{ type: 'prev_verse' }], 'SWITCH', undefined);
            }
            wordBufferRef.current = [];
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            return;
        }

        // 2. FAST RELATIVE NAV (Chapter/Verse)
        // Only if we have an active chapter context AND NO EXPLICIT BOOK NAME
        const hasBookName = BOOK_PATTERNS.test(lowerFullText);

        if (chapterContextRef.current && !hasBookName) {

            // 2a. RELATIVE CHAPTER ("Chapter 5", "Chapter Number 5")
            // Supports "Chapter 5", "Chapter Number 5", "Chapter No. 5"
            // In Strict Mode, relative navigation ALSO requires the wake-word.
            const wakePrefix = strictMode ? '\\b(?:projector|creenly)\\b.*?\\b' : '\\b';

            let chapMatch = lowerFullText.match(new RegExp(`${wakePrefix}(?:chapter|go to chapter)(?:\\s+(?:number|num|no\\.?))?\\s*(\\d+)(?:\\s*(?:verse|v)?\\.?\\s*(\\d+))?`, 'i'));

            // Fallback: Check for word numbers ("chapter nine", "chapter number nine")
            if (!chapMatch) {
                const wordMatch = lowerFullText.match(new RegExp(
                    `${wakePrefix}(?:chapter|go to chapter)(?:\\s+(?:number|num|no\\.?))?\\s+(${WORD_NUMBER_PATTERN})(?:\\s*(?:verse|v)?\\.?\\s*(\\d+|${WORD_NUMBER_PATTERN}))?`,
                    'i'
                ));
                if (wordMatch) {
                    // Mock the match result structure for consistent processing
                    const cVal = WORD_NUMBERS[wordMatch[1].toLowerCase()] || parseInt(wordMatch[1]);
                    const vVal = wordMatch[2] ? (WORD_NUMBERS[wordMatch[2].toLowerCase()] || parseInt(wordMatch[2])) : undefined;
                    chapMatch = ['mock', String(cVal), String(vVal || '')] as RegExpMatchArray;
                }
            }

            if (chapMatch) {
                const targetChapter = parseInt(chapMatch[1]);
                const targetVerse = chapMatch[2] ? parseInt(chapMatch[2]) : 1;

                // Extract book from context or FALLBACK TO PASTOR PROFILE
                const bookMatch = chapterContextRef.current?.match(/^(.+?)\s+\d+$/);
                let book = bookMatch ? bookMatch[1] : null;

                // --- CONTEXT ENHANCEMENT ---
                // if no active context, check pastor's top focus books
                if (!book && pastorProfileRef.current) {
                    const topBooks = pastorProfileRef.current.sermonContext.focusBooks ||
                        Object.keys(pastorProfileRef.current.bookPreferences).sort((a, b) => pastorProfileRef.current!.bookPreferences[b] - pastorProfileRef.current!.bookPreferences[a]).slice(0, 1);
                    if (topBooks.length > 0) {
                        book = topBooks[0];
                        console.log('[SmartDetect] Auto-applying focus book context:', book);
                    }
                }

                if (book && targetChapter > 0 && targetChapter < 151) {
                    const key = `${book}-${targetChapter}-${targetVerse}-nav`;
                    const lastDetected = recentDetectionsRef.current.get(key);

                    if (!lastDetected || Date.now() - lastDetected > 3000) {
                        console.log('[SmartDetect] ⚡ ZERO LATENCY CHAPTER:', `${book} ${targetChapter}:${targetVerse}`);

                        const processChapterFast = async () => {
                            const currentVersion = options.version || 'KJV';
                            let text = await lookupVerseAsync(book, targetChapter, targetVerse, currentVersion);

                            if (text) {
                                onDetect([{
                                    book, chapter: targetChapter, verse: targetVerse,
                                    text,
                                    reference: `${book} ${targetChapter}:${targetVerse}`,
                                    confidence: 100,
                                    matchType: 'exact'
                                }], [], 'SWITCH', 1);

                                recentDetectionsRef.current.set(key, Date.now());
                                wordBufferRef.current = [];
                                if (timeoutRef.current) clearTimeout(timeoutRef.current);

                                // Update Context to new chapter
                                chapterContextRef.current = `${book} ${targetChapter}`;

                                // PREDICTIVE FETCH for the NEW Chapter
                                const count = getChapterVerseCount(book, targetChapter);
                                if (count > 0 && currentVersion !== 'KJV') {
                                    console.log(`[SmartDetect] 🔮 Prefetching NEW chapter: ${book} ${targetChapter}...`);
                                    for (let v = 1; v <= count; v++) {
                                        if (v === targetVerse) continue;
                                        lookupVerseAsync(book, targetChapter, v, currentVersion);
                                    }
                                }
                            }
                        };
                        processChapterFast();
                        return;
                    }
                }
            }

            // 2b. RELATIVE VERSE ("Verse 7", "Verse Number 7")
            const relativeMatch = lowerFullText.match(/(?:verse|go to verse|jump to verse)(?:\s+(?:number|num|no\.?))?\s*(\d+)/i);

            // Word-based number match
            const relativeWordMatch = !relativeMatch ? lowerFullText.match(new RegExp(`(?:verse|go to verse|jump to verse)(?:\\s+(?:number|num|no\\.?))?\\s+(${WORD_NUMBER_PATTERN})`, 'i')) : null;

            let targetVerse: number | null = null;
            if (relativeMatch) targetVerse = parseInt(relativeMatch[1]);
            if (relativeWordMatch) targetVerse = WORD_NUMBERS[relativeWordMatch[1].toLowerCase()] || null;

            if (targetVerse && targetVerse > 0 && targetVerse < 177) {
                const [book, chapterStr] = chapterContextRef.current.split(/ (\d+)$/);
                const chapter = parseInt(chapterStr);

                // Check if this verse is ALREADY detected recently to avoid loops
                const key = `${book}-${chapter}-${targetVerse}`;
                const lastDetected = recentDetectionsRef.current.get(key);

                if (!lastDetected || Date.now() - lastDetected > 2000) {
                    console.log('[SmartDetect] ⚡ ZERO LATENCY RELATIVE:', `${book} ${chapter}:${targetVerse}`);

                    const processRelativeFast = async () => {
                        const currentVersion = options.version || 'KJV';
                        let text = await lookupVerseAsync(book, chapter, targetVerse, currentVersion);

                        if (text) {
                            onDetect([{
                                book, chapter, verse: targetVerse,
                                text,
                                reference: `${book} ${chapter}:${targetVerse}`,
                                confidence: 100,
                                matchType: 'exact'
                            }], [], 'SWITCH', 1);

                            recentDetectionsRef.current.set(key, Date.now());
                            wordBufferRef.current = [];
                            if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        }
                    };
                    processRelativeFast();
                    return;
                }
            }
        }

        // 3. EXPLICIT FULL REFERENCES ("John 3:16")
        const fastDetections = detectVersesInText(lowerFullText);
        if (fastDetections.length > 0) {
            // Check if this is a "New" detection (not recently fired)
            const d = fastDetections[0]; // Take primary match
            const key = `${d.book}-${d.chapter}-${d.verse}`;
            const lastDetected = recentDetectionsRef.current.get(key);

            // If it's a new, unique detection, fire immediately
            if (!lastDetected || Date.now() - lastDetected > 3000) {
                console.log('[SmartDetect] ⚡ ZERO LATENCY MATCH:', d.reference);

                const processFastMatch = async () => {
                    let text = d.text;
                    const currentVersion = options.version || 'KJV';

                    // If local regex didn't find text (e.g. version mismatch or range), fetch it
                    if (!text || (currentVersion !== 'KJV')) {
                        const fetched = await lookupVerseAsync(d.book, d.chapter, d.verse, currentVersion);
                        if (fetched) text = fetched;
                    }

                    if (text) {
                        const script: DetectedScripture = {
                            book: d.book,
                            chapter: d.chapter,
                            verse: d.verse,
                            verseEnd: d.verseEnd,
                            text,
                            reference: d.reference,
                            confidence: 100,
                            matchType: 'exact'
                        };

                        onDetect([script], [], 'SWITCH', 1);
                        recentDetectionsRef.current.set(key, Date.now());
                        chapterContextRef.current = `${d.book} ${d.chapter}`;

                        // Clear buffer and cancel debounce to prevent double-processing
                        wordBufferRef.current = [];
                        if (timeoutRef.current) clearTimeout(timeoutRef.current);

                        // --- PREDICTIVE FETCHING ---
                        // Background fetch the rest of the chapter
                        const count = getChapterVerseCount(d.book, d.chapter);
                        if (count > 0 && currentVersion !== 'KJV') {
                            console.log(`[SmartDetect] 🔮 Prefetching ${d.book} ${d.chapter} (${count} verses)...`);
                            // Fetch in chunks or parallel to avoid jamming
                            for (let v = 1; v <= count; v++) {
                                if (v === d.verse) continue;
                                // Fire and forget (don't await)
                                lookupVerseAsync(d.book, d.chapter, v, currentVersion);
                            }
                        }
                    }
                };

                processFastMatch();
                return; // Skip the debounce logic entirely
            }
        }

        // Debounce processing (Slow Path)
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            processWindow();
        }, debounceMs);
    }, [processWindow, debounceMs, options.version, onDetect]);

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

// ─── Semantic Search Helper ───────────────────────────────────────────────────

interface SemanticResult {
    ref: string;
    text: string;
    confidence: number;
}

/**
 * Sends search text to the embeddings worker and returns semantic matches.
 * Returns an empty array if no results or timeout (3s).
 */
function semanticSearchLocal(
    worker: Worker,
    text: string,
    threshold = 0.50,
    maxResults = 3
): Promise<SemanticResult[]> {
    return new Promise((resolve) => {
        const handler = (e: MessageEvent) => {
            const msg = e.data;
            if (msg.type === 'results') {
                worker.removeEventListener('message', handler);
                clearTimeout(timer);
                resolve(msg.results || []);
            } else if (msg.type === 'error') {
                worker.removeEventListener('message', handler);
                clearTimeout(timer);
                resolve([]);
            }
        };

        worker.addEventListener('message', handler);
        worker.postMessage({ type: 'search', text, threshold, maxResults });

        // Safety timeout — don't block the detection pipeline
        const timer = setTimeout(() => {
            worker.removeEventListener('message', handler);
            resolve([]);
        }, 3000);
    });
}
