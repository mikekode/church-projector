
import kjvData from './kjv.json';
import { textToNumbers } from './textNormalization';
import { getOfflineVerse, cacheVerse as idbCacheVerse, migrateLocalStorageCache } from './bibleOfflineCache';

/**
 * Fuzzy string matching using Sørensen–Dice coefficient
 * (Redefined here to avoid circular dependency with hooks)
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

// Type definitions for the JSON structure
type BibleData = {
    abbrev: string;
    chapters: string[][];
    name?: string;
}[];

// Expanded Book Map with more aliases
const BOOK_MAP: Record<string, string> = {
    "genesis": "gn", "gen": "gn",
    "exodus": "ex", "exod": "ex",
    "leviticus": "lv", "lev": "lv",
    "numbers": "nm", "num": "nm",
    "deuteronomy": "dt", "deut": "dt",
    "joshua": "js", "josh": "js",
    "judges": "jud", "judg": "jud",
    "ruth": "rt",
    "1 samuel": "1sm", "first samuel": "1sm", "1st samuel": "1sm", "i samuel": "1sm",
    "2 samuel": "2sm", "second samuel": "2sm", "2nd samuel": "2sm", "ii samuel": "2sm",
    "1 kings": "1kgs", "first kings": "1kgs", "1st kings": "1kgs", "i kings": "1kgs",
    "2 kings": "2kgs", "second kings": "2kgs", "2nd kings": "2kgs", "ii kings": "2kgs",
    "1 chronicles": "1ch", "first chronicles": "1ch", "1st chronicles": "1ch",
    "2 chronicles": "2ch", "second chronicles": "2ch", "2nd chronicles": "2ch",
    "ezra": "ezr",
    "nehemiah": "ne", "neh": "ne",
    "esther": "et", "est": "et",
    "job": "job",
    "psalms": "ps", "psalm": "ps", "psa": "ps",
    "proverbs": "prv", "prov": "prv",
    "ecclesiastes": "ec", "eccl": "ec",
    "song of solomon": "so", "songs of solomon": "so", "songs": "so", "song of songs": "so", "canticles": "so", "sos": "so",
    "isaiah": "is", "isa": "is",
    "jeremiah": "jr", "jer": "jr",
    "lamentations": "lm", "lam": "lm",
    "ezekiel": "ez", "ezek": "ez",
    "daniel": "dn", "dan": "dn",
    "hosea": "ho", "hos": "ho",
    "joel": "jl",
    "amos": "am",
    "obadiah": "ob", "obad": "ob",
    "jonah": "jn", "jon": "jn",
    "micah": "mi",
    "nahum": "na", "nah": "na",
    "habakkuk": "hk", "hab": "hk",
    "zephaniah": "zp", "zeph": "zp",
    "haggai": "hg", "hag": "hg",
    "zechariah": "zc", "zech": "zc",
    "malachi": "ml", "mal": "ml",
    "matthew": "mt", "matt": "mt",
    "mark": "mk",
    "luke": "lk",
    "john": "jo", "gospel of john": "jo",
    "acts": "act", "acts of the apostles": "act",
    "romans": "rm", "rom": "rm",
    "1 corinthians": "1co", "first corinthians": "1co", "1st corinthians": "1co", "i corinthians": "1co",
    "2 corinthians": "2co", "second corinthians": "2co", "2nd corinthians": "2co", "ii corinthians": "2co",
    "galatians": "gl", "gal": "gl",
    "ephesians": "eph", "eph": "eph",
    "philippians": "ph", "phil": "ph",
    "colossians": "cl", "col": "cl",
    "1 thessalonians": "1ts", "first thessalonians": "1ts", "1st thessalonians": "1ts", "i thessalonians": "1ts",
    "2 thessalonians": "2ts", "second thessalonians": "2ts", "2nd thessalonians": "2ts", "ii thessalonians": "2ts",
    "1 timothy": "1tm", "first timothy": "1tm", "1st timothy": "1tm", "i timothy": "1tm",
    "2 timothy": "2tm", "second timothy": "2tm", "2nd timothy": "2tm", "ii timothy": "2tm",
    "titus": "tt", "tit": "tt",
    "philemon": "phm", "phlm": "phm",
    "hebrews": "hb", "heb": "hb",
    "james": "jm", "jas": "jm",
    "1 peter": "1pe", "first peter": "1pe", "1st peter": "1pe", "i peter": "1pe", "peter": "1pe",
    "2 peter": "2pe", "second peter": "2pe", "2nd peter": "2pe", "ii peter": "2pe",
    "1 john": "1jo", "first john": "1jo", "1st john": "1jo", "i john": "1jo",
    "2 john": "2jo", "second john": "2jo", "2nd john": "2jo", "ii john": "2jo",
    "3 john": "3jo", "third john": "3jo", "3rd john": "3jo", "iii john": "3jo",
    "jude": "jd",
    "revelation": "re", "revelations": "re", "rev": "re"
};

const BIBLE: BibleData = kjvData as any;

/**
 * Checks if a string is a book name and returns the canonical key.
 * Handles loose matching and fuzzy lookups.
 */
function findBookKey(input: string): string | null {
    const raw = input.toLowerCase().replace(/\./g, '').trim();

    // BLACKLIST: Common words that should never match a book via short abbrev
    // This must happen BEFORE exact matches to prevent 'is' -> Isaiah or 'at' -> Acts
    const RISKY_WORDS = ['is', 'am', 'so', 'at', 'on', 'by', 'to', 'if', 'it', 'the', 'was', 'as', 'number', 'point', 'item', 'step', 'part', 'page', 'nine', 'ten', 'now'];
    if (RISKY_WORDS.includes(raw)) return null;

    // 1. Exact or alias match
    if (BOOK_MAP[raw]) return BOOK_MAP[raw];

    // 2. Exact abbrev match
    const abbrevMatch = BIBLE.find(b => b.abbrev === raw);
    if (abbrevMatch) return raw;

    // 3. Fuzzy match using Dice coefficient (High typo tolerance)
    const books = Object.keys(BOOK_MAP);

    let bestMatch = { key: null as string | null, score: 0 };
    for (const b of books) {
        const score = dice(raw, b);
        // Boost startsWith (e.g., "matti" -> "matthew")
        // Only boost if raw is at least 3 chars to avoid "is" -> "isaiah"
        const finalScore = (raw.length >= 3 && b.startsWith(raw)) ? score + 0.2 : score;

        if (finalScore > bestMatch.score) {
            bestMatch = { key: b, score: finalScore };
        }
    }

    // Threshold of 0.6 allows for significant typos while avoiding random words
    if (bestMatch.score > 0.6 && bestMatch.key) {
        console.log(`[Bible] Fuzzy Match: "${input}" -> "${bestMatch.key}" (Score: ${bestMatch.score.toFixed(2)})`);
        return BOOK_MAP[bestMatch.key];
    }

    return null;
}

export type DetectedVerse = {
    book: string;
    chapter: number;
    verse: number;
    verseEnd?: number;  // For verse ranges like 3:16-17
    text: string;
    reference: string;
};

/**
 * Main Detection Logic.
 * Takes raw transcript (speech), normalizes it, runs regex, and validates existence.
 * Supports verse ranges like "John 3:16-17", "John 3:16 to 17", "John 3:16 through 18", "John 3:16 and 17"
 */
export function detectVersesInText(rawText: string): DetectedVerse[] {
    const results: DetectedVerse[] = [];

    // 1. Normalize (Convert "three" -> "3", "First John" -> "1 John")
    const normalized = textToNumbers(rawText);

    // 2. Regex with verse range support
    // Matches: "1 John 3 16" or "John 3:16" or "John 3:16-17"
    // Also handles "chapter 5 is 10" as "chapter 5 verse 10" (common transcription error)
    const regex = /((?:1|2|3|I|II|III)\s+)?([A-Za-z][A-Za-z\s]+?)\s+(\d+)(?:\s?(?:[:\s]|verse|is)\s?(\d+)(?:\s?(?:-|to|through|and)\s?(\d+))?)?/gi;

    const matches = Array.from(normalized.matchAll(regex));

    for (const match of matches) {
        const prefix = match[1] ? match[1].trim() : "";
        const bookName = match[2].trim();
        const chapter = parseInt(match[3]);
        const verse = match[4] ? parseInt(match[4]) : 1;
        const verseEnd = match[5] ? parseInt(match[5]) : undefined;

        const fullBookStr = prefix ? `${prefix} ${bookName}` : bookName;
        const bookKey = findBookKey(fullBookStr);

        if (bookKey) {
            // For ranges, get all verses; for single, get one
            let verseText: string | null;
            if (verseEnd && verseEnd > verse) {
                verseText = lookupVerseRangeBase(bookKey, chapter, verse, verseEnd);
            } else {
                verseText = lookupVerseBase(bookKey, chapter, verse);
            }

            if (verseText) {
                // Use a canonical name for display
                const canonicalName = getCanonicalBookName(bookKey);

                // Build reference string (with range if applicable)
                const reference = verseEnd && verseEnd > verse
                    ? `${canonicalName} ${chapter}:${verse}-${verseEnd}`
                    : `${canonicalName} ${chapter}:${verse}`;

                results.push({
                    book: canonicalName,
                    chapter,
                    verse,
                    verseEnd: verseEnd && verseEnd > verse ? verseEnd : undefined,
                    text: verseText,
                    reference
                });
            }
        }
    }

    return results;
}

/**
 * Internal helper for looking up verse ranges (returns combined text)
 */
function lookupVerseRangeBase(bookKey: string, chapter: number, start: number, end: number): string | null {
    const bookData = BIBLE.find(b => b.abbrev === bookKey);
    if (!bookData) return null;

    const chapterData = bookData.chapters[chapter - 1];
    if (!chapterData) return null;

    const verses: string[] = [];
    for (let i = start; i <= Math.min(end, chapterData.length); i++) {
        if (chapterData[i - 1]) {
            verses.push(chapterData[i - 1]);
        }
    }

    return verses.length ? verses.join(' ') : null;
}

function lookupVerseBase(bookKey: string, chapter: number, verse: number): string | null {
    const bookData = BIBLE.find(b => b.abbrev === bookKey);
    if (!bookData) return null;

    const chapterData = bookData.chapters[chapter - 1];
    if (!chapterData) return null;

    // Boundary check: if verse is too high, return the last verse or null
    // (Helps with transcription errors or pastor slightly overshooting)
    const verseIndex = verse - 1;
    if (verseIndex >= chapterData.length) {
        return chapterData[chapterData.length - 1];
    }

    return chapterData[verseIndex] || null;
}

/**
 * Public Lookup API (Legacy compatibility + new robustness)
 */
export function lookupVerse(bookStr: string, chapter: number | string, verse: number | string): string | null {
    const bookKey = findBookKey(bookStr);
    if (!bookKey) return null;
    return lookupVerseBase(bookKey, Number(chapter), Number(verse));
}

// Persistent Cache with LocalStorage support
let VERSE_CACHE: Record<string, Record<string, Record<number, Record<number, string>>>> = {};

// Initialize Cache from Storage (Client-side only)
if (typeof window !== 'undefined') {
    try {
        const saved = localStorage.getItem('bible_cache_v1');
        if (saved) {
            VERSE_CACHE = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Failed to load bible cache', e);
    }
    // Migrate localStorage cache to IndexedDB (one-time, non-blocking)
    migrateLocalStorageCache().catch(() => { });
}

const saveCache = () => {
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem('bible_cache_v1', JSON.stringify(VERSE_CACHE));
        } catch (e) {
            // Quota exceeded or disabled
        }
    }
};

/**
 * Async verse lookup with version support
 * Falls back to local KJV if API fails or version is KJV
 * Implement caching for faster repeated lookups
 */
/**
 * Async verse lookup with version support
 * Falls back to local KJV if API fails or version is KJV
 * Implement caching for faster repeated lookups
 */
export async function lookupVerseAsync(
    bookStr: string,
    chapter: number | string,
    verse: number | string,
    version: string = 'KJV'
): Promise<string | null> {
    const c = Number(chapter);
    const v = Number(verse);

    // 0. Normalize Book Key
    const bookKey = findBookKey(bookStr);
    if (!bookKey) return null; // Can't look up if we don't know the book
    const canonicalBook = getCanonicalBookName(bookKey); // Use canonical for Cache Key consistency

    // 0.5. Check IndexedDB offline cache (full Bibles + cached verses)
    try {
        const offlineResult = await getOfflineVerse(version, bookKey, c, v);
        if (offlineResult) {
            console.log(`[IndexedDB] Hit: ${version} ${canonicalBook} ${c}:${v}`);
            return offlineResult;
        }
    } catch { /* IndexedDB unavailable — continue */ }

    // 1. Check Electron IPC (Offline functionality via Main Process)
    if (typeof window !== 'undefined' && (window as any).electronAPI?.getVerse) {
        console.log(`[Electron] Lookup ${version} ${canonicalBook} ${c}:${v}`);
        try {
            const result = await (window as any).electronAPI.getVerse({
                book: canonicalBook,
                chapter: c,
                verse: v,
                version
            });
            if (result && result.text) return result.text;
            if (result && result.error) console.warn("[Electron] Error:", result.error);
        } catch (e) {
            console.error("[Electron] IPC Failed", e);
        }
    }

    // 2. Local Bundle Fallback (KJV Only)
    // This is useful if Electron is not available (web mode) or IPC fails
    if (version === 'KJV') {
        const local = lookupVerse(bookStr, c, v);
        if (local) return local;
    }

    // 3. Check Cache
    if (VERSE_CACHE[version]?.[canonicalBook]?.[c]?.[v]) {
        console.log(`[Cache Hit] ${version} ${canonicalBook} ${c}:${v}`);
        return VERSE_CACHE[version][canonicalBook][c][v];
    }

    // 3.5. Electron Online Scraper (Fallback for NIV, MSG, AMP)
    if (typeof window !== 'undefined' && (window as any).electronAPI?.getVerseOnline) {
        try {
            console.log(`[OnlineScraper] Lookup ${version} ${canonicalBook} ${c}:${v}`);
            const result = await (window as any).electronAPI.getVerseOnline({
                book: canonicalBook,
                chapter: c,
                verse: v,
                version
            });
            if (result && result.text) {
                // Update Cache
                if (!VERSE_CACHE[version]) VERSE_CACHE[version] = {};
                if (!VERSE_CACHE[version][canonicalBook]) VERSE_CACHE[version][canonicalBook] = {};
                if (!VERSE_CACHE[version][canonicalBook][c]) VERSE_CACHE[version][canonicalBook][c] = {};
                VERSE_CACHE[version][canonicalBook][c][v] = result.text;
                saveCache();
                // Also persist to IndexedDB
                idbCacheVerse(version, bookKey, c, v, result.text).catch(() => { });
                return result.text;
            }
        } catch (e) {
            console.error("[Electron] Online IPC Failed", e);
        }
    }

    // 4. Direct fetch from bible-api.com (no API route needed)
    try {
        let apiVersion = version.toLowerCase();
        if (apiVersion === 'kjv21') apiVersion = 'kjv';
        console.time(`API-${version}-${canonicalBook}-${c}-${v}`);
        const response = await fetch(
            `https://bible-api.com/${encodeURIComponent(bookStr)}+${c}:${v}?translation=${apiVersion}`
        );
        console.timeEnd(`API-${version}-${canonicalBook}-${c}-${v}`);

        if (response.ok) {
            const data = await response.json();
            const text = data.text ? data.text.replace(/[\n\r]+/g, ' ').trim() : '';
            if (text) {
                // Save to Cache
                if (!VERSE_CACHE[version]) VERSE_CACHE[version] = {};
                if (!VERSE_CACHE[version][canonicalBook]) VERSE_CACHE[version][canonicalBook] = {};
                if (!VERSE_CACHE[version][canonicalBook][c]) VERSE_CACHE[version][canonicalBook][c] = {};

                VERSE_CACHE[version][canonicalBook][c][v] = text;
                saveCache();
                // Also persist to IndexedDB
                idbCacheVerse(version, bookKey, c, v, text).catch(() => { });
                return text;
            }
        }
    } catch (error) {
        console.error('[lookupVerseAsync] bible-api.com error:', error);
    }

    // Fallback to KJV if API fails
    console.log(`[lookupVerseAsync] Falling back to KJV for ${bookStr} ${chapter}:${verse}`);
    return lookupVerse(bookStr, c, v);
}

export function lookupVerseRange(bookStr: string, chapter: number | string, start: number | string, end: number | string): string | null {
    const bookKey = findBookKey(bookStr);
    if (!bookKey) return null;

    const c = Number(chapter);
    const s = Number(start);
    const e = Number(end);

    const bookData = BIBLE.find(b => b.abbrev === bookKey);
    if (!bookData) return null;
    const chapterData = bookData.chapters[c - 1];
    if (!chapterData) return null;

    const verses: string[] = [];
    for (let i = s; i <= Math.min(e, chapterData.length); i++) {
        verses.push(chapterData[i - 1]);
    }

    return verses.length ? verses.join(' ') : null;
}
export function getCanonicalBookName(key: string): string {
    const names: Record<string, string> = {
        "gn": "Genesis", "ex": "Exodus", "lv": "Leviticus", "nm": "Numbers", "dt": "Deuteronomy",
        "js": "Joshua", "jud": "Judges", "rt": "Ruth", "1sm": "1 Samuel", "2sm": "2 Samuel",
        "1kgs": "1 Kings", "2kgs": "2 Kings", "1ch": "1 Chronicles", "2ch": "2 Chronicles",
        "ezr": "Ezra", "ne": "Nehemiah", "et": "Esther", "job": "Job", "ps": "Psalms",
        "prv": "Proverbs", "ec": "Ecclesiastes", "so": "Song of Solomon", "is": "Isaiah",
        "jr": "Jeremiah", "lm": "Lamentations", "ez": "Ezekiel", "dn": "Daniel", "ho": "Hosea",
        "jl": "Joel", "am": "Amos", "ob": "Obadiah", "jn": "Jonah", "mi": "Micah",
        "na": "Nahum", "hk": "Habakkuk", "zp": "Zephaniah", "hg": "Haggai", "zc": "Zechariah",
        "ml": "Malachi", "mt": "Matthew", "mk": "Mark", "lk": "Luke", "jo": "John",
        "act": "Acts", "rm": "Romans", "1co": "1 Corinthians", "2co": "2 Corinthians",
        "gl": "Galatians", "eph": "Ephesians", "ph": "Philippians", "cl": "Colossians",
        "1ts": "1 Thessalonians", "2ts": "2 Thessalonians", "1tm": "1 Timothy", "2tm": "2 Timothy",
        "tt": "Titus", "phm": "Philemon", "hb": "Hebrews", "jm": "James", "1pe": "1 Peter",
        "2pe": "2 Peter", "1jo": "1 John", "2jo": "2 John", "3jo": "3 John", "jd": "Jude", "re": "Revelation"
    };
    return names[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

export function getBibleBooks() {
    return BIBLE.map(b => ({
        key: b.abbrev,
        name: b.name || getCanonicalBookName(b.abbrev),
        chapters: b.chapters.length
    }));
}

export function getChapterVerseCount(bookKey: string, chapter: number): number {
    const book = BIBLE.find(b => b.abbrev === bookKey);
    if (!book || !book.chapters[chapter - 1]) return 0;
    return book.chapters[chapter - 1].length;
}

export const SUPPORTED_VERSIONS = [
    'KJV', 'NKJV', 'ESV', 'NIV', 'NASB', 'CSB', 'NLT', 'TLB',
    'ASV', 'RSV', 'AMP', 'AMPC', 'MSG', 'WEB', 'GW', 'KJV21', 'TPT'
] as const;
