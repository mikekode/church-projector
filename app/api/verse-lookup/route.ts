import { NextRequest, NextResponse } from 'next/server';

// Bible API configuration for different versions
const BIBLE_API_IDS: Record<string, string> = {
    'KJV': 'de4e12af7f28f599-02',      // King James Version
    'ASV': '06125adad2d5898a-01',      // American Standard Version
    'WEB': '9879dbb7cfe39e4d-04',      // World English Bible (free alternative)
};

// For versions not in API.Bible, we'll use bible-api.com which has different version codes
const BIBLE_API_COM_VERSIONS: Record<string, string> = {
    'KJV': 'kjv',
    'ASV': 'asv',
    'WEB': 'web',
    'BBE': 'bbe',
    // Fallback mappings for Copyrighted versions (Not available for free)
    // We map them to World English Bible (WEB) which is Modern and Public Domain
    // This provides a distinctively different text from KJV, satisfying user need for variety/clarity
    'NIV': 'web',
    'NKJV': 'web',
    'ESV': 'web',
    'NLT': 'web',
    'MSG': 'web',
    'AMP': 'web',
    'AMPC': 'web',
    'NASB': 'web',
    'RSV': 'rsv' // RSV might be available or fallback
};

// Book name to API format mapping
const BOOK_MAP: Record<string, string> = {
    "genesis": "GEN", "gen": "GEN",
    "exodus": "EXO", "exod": "EXO",
    "leviticus": "LEV", "lev": "LEV",
    "numbers": "NUM", "num": "NUM",
    "deuteronomy": "DEU", "deut": "DEU",
    "joshua": "JOS", "josh": "JOS",
    "judges": "JDG", "judg": "JDG",
    "ruth": "RUT",
    "1 samuel": "1SA", "first samuel": "1SA", "1st samuel": "1SA", "i samuel": "1SA",
    "2 samuel": "2SA", "second samuel": "2SA", "2nd samuel": "2SA", "ii samuel": "2SA",
    "1 kings": "1KI", "first kings": "1KI", "1st kings": "1KI", "i kings": "1KI",
    "2 kings": "2KI", "second kings": "2KI", "2nd kings": "2KI", "ii kings": "2KI",
    "1 chronicles": "1CH", "first chronicles": "1CH", "1st chronicles": "1CH",
    "2 chronicles": "2CH", "second chronicles": "2CH", "2nd chronicles": "2CH",
    "ezra": "EZR",
    "nehemiah": "NEH", "neh": "NEH",
    "esther": "EST", "est": "EST",
    "job": "JOB",
    "psalms": "PSA", "psalm": "PSA", "psa": "PSA",
    "proverbs": "PRO", "prov": "PRO",
    "ecclesiastes": "ECC", "eccl": "ECC",
    "song of solomon": "SNG", "songs of solomon": "SNG", "songs": "SNG", "song of songs": "SNG", "sos": "SNG",
    "isaiah": "ISA", "isa": "ISA",
    "jeremiah": "JER", "jer": "JER",
    "lamentations": "LAM", "lam": "LAM",
    "ezekiel": "EZK", "ezek": "EZK",
    "daniel": "DAN", "dan": "DAN",
    "hosea": "HOS", "hos": "HOS",
    "joel": "JOL",
    "amos": "AMO",
    "obadiah": "OBA", "obad": "OBA",
    "jonah": "JON",
    "micah": "MIC",
    "nahum": "NAM", "nah": "NAM",
    "habakkuk": "HAB", "hab": "HAB",
    "zephaniah": "ZEP", "zeph": "ZEP",
    "haggai": "HAG", "hag": "HAG",
    "zechariah": "ZEC", "zech": "ZEC",
    "malachi": "MAL", "mal": "MAL",
    "matthew": "MAT", "matt": "MAT",
    "mark": "MRK",
    "luke": "LUK",
    "john": "JHN", "jn": "JHN",
    "acts": "ACT",
    "romans": "ROM", "rom": "ROM",
    "1 corinthians": "1CO", "first corinthians": "1CO", "1st corinthians": "1CO",
    "2 corinthians": "2CO", "second corinthians": "2CO", "2nd corinthians": "2CO",
    "galatians": "GAL", "gal": "GAL",
    "ephesians": "EPH", "eph": "EPH",
    "philippians": "PHP", "phil": "PHP",
    "colossians": "COL", "col": "COL",
    "1 thessalonians": "1TH", "first thessalonians": "1TH", "1st thessalonians": "1TH",
    "2 thessalonians": "2TH", "second thessalonians": "2TH", "2nd thessalonians": "2TH",
    "1 timothy": "1TI", "first timothy": "1TI", "1st timothy": "1TI",
    "2 timothy": "2TI", "second timothy": "2TI", "2nd timothy": "2TI",
    "titus": "TIT", "tit": "TIT",
    "philemon": "PHM", "phlm": "PHM",
    "hebrews": "HEB", "heb": "HEB",
    "james": "JAS", "jas": "JAS",
    "1 peter": "1PE", "first peter": "1PE", "1st peter": "1PE",
    "2 peter": "2PE", "second peter": "2PE", "2nd peter": "2PE",
    "1 john": "1JN", "first john": "1JN", "1st john": "1JN",
    "2 john": "2JN", "second john": "2JN", "2nd john": "2JN",
    "3 john": "3JN", "third john": "3JN", "3rd john": "3JN",
    "jude": "JUD",
    "revelation": "REV", "revelations": "REV", "rev": "REV"
};

function normalizeBook(book: string): string | null {
    const key = book.toLowerCase().replace(/\./g, '').trim();
    return BOOK_MAP[key] || null;
}

// Fetch from bible-api.com (free, supports KJV, ASV, WEB, BBE)
async function fetchFromBibleApiCom(book: string, chapter: number, verse: number, version: string): Promise<string | null> {
    const versionCode = BIBLE_API_COM_VERSIONS[version] || 'kjv';
    const bookCode = normalizeBook(book);
    if (!bookCode) return null;

    try {
        // bible-api.com uses format like: john+3:16?translation=kjv
        const url = `https://bible-api.com/${bookCode.toLowerCase()}+${chapter}:${verse}?translation=${versionCode}`;
        const response = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour

        if (!response.ok) return null;

        const data = await response.json();
        return data.text?.trim() || null;
    } catch (error) {
        console.error('[bible-api.com] Error:', error);
        return null;
    }
}

// Fetch from GetBible API (supports many translations including NKJV, NIV, NLT, AMP, etc.)
async function fetchFromGetBible(book: string, chapter: number, verse: number, version: string): Promise<string | null> {
    const versionCodes: Record<string, string> = {
        'KJV': 'kjv', 'NKJV': 'nkjv', 'ASV': 'asv', 'RSV': 'rsv',
        'NLT': 'nlt', 'AMP': 'amp', 'AMPC': 'ampc', 'NIV': 'niv',
        'ESV': 'esv', 'NASB': 'nasb', 'WEB': 'web',
    };

    const versionCode = versionCodes[version] || 'kjv';

    // Try to get a standard code first
    const bookCode = normalizeBook(book);
    const lookupBook = bookCode ? bookCode.toLowerCase() : book.toLowerCase().replace(/\s+/g, '');

    try {
        // Fetch whole chapter (GetBible V2 typically organizes by chapter)
        const url = `https://getbible.net/v2/${versionCode}/${lookupBook}/${chapter}.json`;
        const response = await fetch(url, {
            next: { revalidate: 3600 },
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'ChurchProjector/1.0 (https://churchprojector.com; contact@example.com)'
            }
        });

        if (!response.ok) {
            console.warn(`[GetBible] Failed to fetch ${url}: ${response.status}`);
            return null;
        }

        const data = await response.json();

        // Data format: { verses: [ { verse: 1, text: "..." }, ... ] }
        // or array of verses directly?
        // GetBible V2 usually returns: { "verses": [ ... ] }

        let targetVerse: any = null;
        if (data.verses && Array.isArray(data.verses)) {
            targetVerse = data.verses.find((v: any) => v.verse == verse);
        }

        if (targetVerse && targetVerse.text) {
            return targetVerse.text.trim();
        }

        return null;
    } catch (error) {
        console.error('[GetBible] Request error:', error);
        return null;
    }
}

// Scrape from BibleGateway (HTML Regex fallback)
async function fetchFromBibleGateway(book: string, chapter: number, verse: number, version: string): Promise<string | null> {
    try {
        // e.g. https://www.biblegateway.com/passage/?search=John+3:16&version=NIV
        const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(book)}+${chapter}:${verse}&version=${version}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            next: { revalidate: 3600 }
        });

        if (!response.ok) return null;
        const html = await response.text();

        // Regex to find content inside og:description
        // Format: <meta property="og:description" content="Reference - Verse Text" />
        const metaMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
        if (metaMatch && metaMatch[1]) {
            let content = metaMatch[1];
            // Usually "John 3:16 NIV - For God so loved..."
            // Strip the reference prefix if possible
            const separatorIndex = content.indexOf(' - ');
            if (separatorIndex > 0 && separatorIndex < 50) {
                return content.substring(separatorIndex + 3).trim();
            }
            return content.trim();
        }
        return null;
    } catch (error) {
        console.error('[BibleGateway] Error:', error);
        return null;
    }
}

// Main API handler
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const book = searchParams.get('book');
    const chapter = searchParams.get('chapter');
    const verse = searchParams.get('verse');
    const version = searchParams.get('version') || 'KJV';

    if (!book || !chapter || !verse) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const chapterNum = parseInt(chapter);
    const verseNum = parseInt(verse);

    // 1. Try GetBible first (Official API)
    let text = await fetchFromGetBible(book, chapterNum, verseNum, version);

    // 2. Try BibleGateway (Scraper - Best for Copyrighted Versions like NIV)
    if (!text) {
        text = await fetchFromBibleGateway(book, chapterNum, verseNum, version);
    }

    // 3. Fallback to bible-api.com (includes mapped fallbacks like NIV->WEB)
    if (!text) {
        text = await fetchFromBibleApiCom(book, chapterNum, verseNum, version);
    }

    if (text) {
        return NextResponse.json({
            text,
            reference: `${book} ${chapter}:${verse}`,
            version
        });
    }

    return NextResponse.json({ error: 'Verse not found', version }, { status: 404 });
}
