/**
 * Bible Offline Cache — IndexedDB-backed storage for Bible translations.
 *
 * Two data stores:
 *   1. "bibles"  — Full public-domain Bibles (keyed by version code)
 *   2. "verses"  — Individual verse cache for any version (keyed by ref string)
 *
 * Background downloads:
 *   - BBE, ASV   → GitHub JSON (fast, single request per version)
 *   - WEB, YLT, DARBY → bible-api.com chapter by chapter (slower, ~7 min each)
 *
 * All copyrighted verse lookups are cached in "verses" as they happen,
 * building an ever-growing offline library from normal usage.
 */

const DB_NAME = 'creenly-bible-offline';
const DB_VERSION = 1;

// ── Types ──────────────────────────────────────────────────────────────────

type BibleBook = {
    abbrev: string;
    name?: string;
    chapters: string[][]; // chapters[chapterIndex][verseIndex] = verse text
};

type FullBible = BibleBook[];

type DownloadSource =
    | { type: 'thiagobodruk'; url: string }
    | { type: 'bibleapi'; url: string }
    | { type: 'bible-api-com'; apiSlug: string };

// ── Public domain sources ──────────────────────────────────────────────────

const DOWNLOADABLE: Record<string, DownloadSource> = {
    BBE: { type: 'thiagobodruk', url: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_bbe.json' },
    ASV: { type: 'bibleapi', url: 'https://raw.githubusercontent.com/bibleapi/bibleapi-bibles-json/master/asv.json' },
    WEB: { type: 'bible-api-com', apiSlug: 'web' },
    YLT: { type: 'bible-api-com', apiSlug: 'ylt' },
    DARBY: { type: 'bible-api-com', apiSlug: 'darby' },
};

// Book abbreviation mapping (same as bible.ts BOOK_MAP target codes)
const BOOK_ABBREVS: Record<string, string> = {
    "genesis": "gn", "exodus": "ex", "leviticus": "lv", "numbers": "nm", "deuteronomy": "dt",
    "joshua": "js", "judges": "jud", "ruth": "rt", "1 samuel": "1sm", "2 samuel": "2sm",
    "1 kings": "1kgs", "2 kings": "2kgs", "1 chronicles": "1ch", "2 chronicles": "2ch",
    "ezra": "ezr", "nehemiah": "ne", "esther": "et", "job": "job", "psalms": "ps",
    "proverbs": "prv", "ecclesiastes": "ec", "song of solomon": "so", "isaiah": "is",
    "jeremiah": "jr", "lamentations": "lm", "ezekiel": "ez", "daniel": "dn",
    "hosea": "ho", "joel": "jl", "amos": "am", "obadiah": "ob", "jonah": "jn",
    "micah": "mi", "nahum": "na", "habakkuk": "hk", "zephaniah": "zp", "haggai": "hg",
    "zechariah": "zc", "malachi": "ml", "matthew": "mt", "mark": "mk", "luke": "lk",
    "john": "jo", "acts": "act", "romans": "rm", "1 corinthians": "1co", "2 corinthians": "2co",
    "galatians": "gl", "ephesians": "eph", "philippians": "ph", "colossians": "cl",
    "1 thessalonians": "1ts", "2 thessalonians": "2ts", "1 timothy": "1tm", "2 timothy": "2tm",
    "titus": "tt", "philemon": "phm", "hebrews": "hb", "james": "jm", "1 peter": "1pe",
    "2 peter": "2pe", "1 john": "1jo", "2 john": "2jo", "3 john": "3jo", "jude": "jd",
    "revelation": "re"
};

// Ordered list of the 66 canonical book names (for bible-api.com downloads)
const BOOK_ORDER = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
    "Ezra", "Nehemiah", "Esther", "Job", "Psalms",
    "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah",
    "Jeremiah", "Lamentations", "Ezekiel", "Daniel",
    "Hosea", "Joel", "Amos", "Obadiah", "Jonah",
    "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai",
    "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians",
    "Galatians", "Ephesians", "Philippians", "Colossians",
    "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy",
    "Titus", "Philemon", "Hebrews", "James",
    "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
    "Jude", "Revelation"
];

// Chapter counts for each book (for bible-api.com chapter-by-chapter download)
const CHAPTER_COUNTS = [
    50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150,
    31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4,
    28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5,
    5, 3, 5, 3, 1, 1, 1, 22
];

// ── IndexedDB helpers ──────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB not available'));
            return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('bibles')) {
                db.createObjectStore('bibles'); // key = version code e.g. "WEB"
            }
            if (!db.objectStoreNames.contains('verses')) {
                db.createObjectStore('verses'); // key = "VERSION:book:ch:v"
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
    });
}

async function idbPut(store: string, key: string, value: any): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function idbGetAllKeys(store: string): Promise<string[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAllKeys();
        req.onsuccess = () => resolve(req.result as string[]);
        req.onerror = () => reject(req.error);
    });
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Look up a verse from an offline-downloaded full Bible.
 * Returns the verse text or undefined if not available offline.
 */
export async function getOfflineVerse(
    version: string,
    bookAbbrev: string,
    chapter: number,
    verse: number
): Promise<string | undefined> {
    try {
        // 1. Check full Bible download
        const bible = await idbGet<FullBible>('bibles', version);
        if (bible) {
            const book = bible.find(b => b.abbrev === bookAbbrev);
            if (book && book.chapters[chapter - 1] && book.chapters[chapter - 1][verse - 1]) {
                return book.chapters[chapter - 1][verse - 1];
            }
        }

        // 2. Check individual verse cache
        const key = `${version}:${bookAbbrev}:${chapter}:${verse}`;
        const cached = await idbGet<string>('verses', key);
        return cached;
    } catch {
        return undefined;
    }
}

/**
 * Cache a single verse (called after any successful API lookup).
 */
export async function cacheVerse(
    version: string,
    bookAbbrev: string,
    chapter: number,
    verse: number,
    text: string
): Promise<void> {
    try {
        const key = `${version}:${bookAbbrev}:${chapter}:${verse}`;
        await idbPut('verses', key, text);
    } catch {
        // Silent fail — caching is best-effort
    }
}

/**
 * Migrate existing localStorage cache to IndexedDB (run once).
 */
export async function migrateLocalStorageCache(): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    try {
        const raw = localStorage.getItem('bible_cache_v1');
        if (!raw) return;

        const cache = JSON.parse(raw) as Record<string, Record<string, Record<number, Record<number, string>>>>;
        let count = 0;

        for (const version of Object.keys(cache)) {
            for (const book of Object.keys(cache[version])) {
                for (const ch of Object.keys(cache[version][book])) {
                    for (const v of Object.keys((cache[version][book] as any)[ch])) {
                        const text = (cache[version][book] as any)[ch][v];
                        if (text) {
                            // We need the abbrev. The book key in the old cache is the canonical name.
                            // Look up the abbrev from the canonical name.
                            const abbrev = BOOK_ABBREVS[book.toLowerCase()] || book.toLowerCase();
                            await cacheVerse(version, abbrev, Number(ch), Number(v), text);
                            count++;
                        }
                    }
                }
            }
        }

        if (count > 0) {
            console.log(`[BibleCache] Migrated ${count} verses from localStorage to IndexedDB`);
            // Don't delete localStorage yet — keep as fallback for a while
            localStorage.setItem('bible_cache_migrated', 'true');
        }
    } catch (e) {
        console.error('[BibleCache] Migration error:', e);
    }
}

/**
 * Get download status for all downloadable versions.
 */
export async function getDownloadStatus(): Promise<Record<string, boolean>> {
    try {
        const keys = await idbGetAllKeys('bibles');
        const status: Record<string, boolean> = {};
        for (const version of Object.keys(DOWNLOADABLE)) {
            status[version] = keys.includes(version);
        }
        // KJV is always available (bundled)
        status['KJV'] = true;
        return status;
    } catch {
        return { KJV: true };
    }
}

// ── Download / conversion logic ────────────────────────────────────────────

/**
 * Convert thiagobodruk format → app format.
 * Input: [{ abbrev: "gn", name: "Genesis", chapters: [["verse", ...], ...] }, ...]
 * This is already the right format, just return it.
 */
function convertThiagobodruk(data: any[]): FullBible {
    return data.map(book => ({
        abbrev: book.abbrev,
        name: book.name,
        chapters: book.chapters,
    }));
}

/**
 * Convert bibleapi (resultset) format → app format.
 * Input: { resultset: { row: [{ field: [id, bookNum, chapter, verse, text] }, ...] } }
 */
function convertBibleapi(data: any): FullBible {
    const rows: { field: [number, number, number, number, string] }[] = data.resultset.row;
    const booksMap = new Map<number, { chapters: Map<number, string[]> }>();

    for (const row of rows) {
        const [, bookNum, ch, v, text] = row.field;
        if (!booksMap.has(bookNum)) {
            booksMap.set(bookNum, { chapters: new Map() });
        }
        const book = booksMap.get(bookNum)!;
        if (!book.chapters.has(ch)) {
            book.chapters.set(ch, []);
        }
        const chapterArr = book.chapters.get(ch)!;
        // Ensure array is long enough (verses may not be sequential)
        while (chapterArr.length < v) chapterArr.push('');
        chapterArr[v - 1] = text;
    }

    // Map book numbers to canonical names + abbrevs
    const result: FullBible = [];
    const bookNums = Array.from(booksMap.keys()).sort((a, b) => a - b);

    for (let i = 0; i < bookNums.length; i++) {
        const bookNum = bookNums[i];
        const bookData = booksMap.get(bookNum)!;
        const bookName = BOOK_ORDER[i] || `Book ${bookNum}`;
        const abbrev = BOOK_ABBREVS[bookName.toLowerCase()] || bookName.toLowerCase().slice(0, 3);

        const chapterNums = Array.from(bookData.chapters.keys()).sort((a, b) => a - b);
        const chapters: string[][] = chapterNums.map(ch => bookData.chapters.get(ch)!);

        result.push({ abbrev, name: bookName, chapters });
    }

    return result;
}

/**
 * Download a full Bible from bible-api.com, chapter by chapter.
 * Slow (~7 min per version) but runs in the background.
 */
async function downloadFromBibleApiCom(
    apiSlug: string,
    onProgress?: (bookIndex: number, totalBooks: number, bookName: string) => void,
    signal?: AbortSignal
): Promise<FullBible> {
    const bible: FullBible = [];

    for (let b = 0; b < BOOK_ORDER.length; b++) {
        if (signal?.aborted) throw new Error('Aborted');

        const bookName = BOOK_ORDER[b];
        const abbrev = BOOK_ABBREVS[bookName.toLowerCase()] || bookName.toLowerCase().slice(0, 3);
        const chapterCount = CHAPTER_COUNTS[b];
        const chapters: string[][] = [];

        onProgress?.(b, BOOK_ORDER.length, bookName);

        for (let ch = 1; ch <= chapterCount; ch++) {
            if (signal?.aborted) throw new Error('Aborted');

            // bible-api.com uses the format: "genesis+1" or "1+john+3"
            const bookSlug = bookName.toLowerCase().replace(/\s+/g, '+');
            const url = `https://bible-api.com/${bookSlug}+${ch}?translation=${apiSlug}`;

            try {
                const resp = await fetch(url);
                if (!resp.ok) {
                    chapters.push([]);
                    continue;
                }

                const data = await resp.json();
                if (data.verses && Array.isArray(data.verses)) {
                    const verseTexts: string[] = [];
                    for (const v of data.verses) {
                        const idx = (v.verse || 1) - 1;
                        while (verseTexts.length <= idx) verseTexts.push('');
                        verseTexts[idx] = (v.text || '').trim();
                    }
                    chapters.push(verseTexts);
                } else {
                    chapters.push([]);
                }
            } catch {
                chapters.push([]);
            }

            // Rate limit: ~3 requests per second
            await new Promise(r => setTimeout(r, 350));
        }

        bible.push({ abbrev, name: bookName, chapters });
    }

    return bible;
}

/**
 * Download a single public-domain version and store in IndexedDB.
 * Returns true on success.
 */
async function downloadVersion(
    version: string,
    onProgress?: (msg: string) => void,
    signal?: AbortSignal
): Promise<boolean> {
    const source = DOWNLOADABLE[version];
    if (!source) return false;

    try {
        let bible: FullBible;

        if (source.type === 'thiagobodruk') {
            onProgress?.(`Downloading ${version}...`);
            const resp = await fetch(source.url, { signal });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            bible = convertThiagobodruk(data);
        } else if (source.type === 'bibleapi') {
            onProgress?.(`Downloading ${version}...`);
            const resp = await fetch(source.url, { signal });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            bible = convertBibleapi(data);
        } else {
            // bible-api.com — chapter by chapter
            bible = await downloadFromBibleApiCom(
                source.apiSlug,
                (bookIdx, total, bookName) => {
                    onProgress?.(`${version}: ${bookName} (${bookIdx + 1}/${total})`);
                },
                signal
            );
        }

        // Validate: should have 66 books with chapters
        if (bible.length < 60) {
            throw new Error(`Only got ${bible.length} books — incomplete`);
        }

        await idbPut('bibles', version, bible);
        onProgress?.(`${version} complete ✓`);
        return true;
    } catch (e: any) {
        if (e.name !== 'AbortError') {
            console.error(`[BibleCache] Failed to download ${version}:`, e);
            onProgress?.(`${version} failed: ${e.message}`);
        }
        return false;
    }
}

/**
 * Background-download all available public-domain Bibles.
 * Skips versions already in IndexedDB. Safe to call multiple times.
 *
 * Downloads fast sources first (GitHub JSON), then slow ones (bible-api.com).
 */
export async function downloadAllPublicDomain(
    onProgress?: (msg: string) => void,
    signal?: AbortSignal
): Promise<void> {
    const status = await getDownloadStatus();

    // Fast downloads first (single JSON file from GitHub)
    const fast = ['BBE', 'ASV'];
    const slow = ['WEB', 'YLT', 'DARBY'];

    for (const version of [...fast, ...slow]) {
        if (signal?.aborted) break;
        if (status[version]) {
            onProgress?.(`${version} already downloaded ✓`);
            continue;
        }
        await downloadVersion(version, onProgress, signal);
    }

    onProgress?.('All downloads complete');
}

/**
 * Get list of versions available for download and their status.
 */
export function getDownloadableVersions(): string[] {
    return Object.keys(DOWNLOADABLE);
}
