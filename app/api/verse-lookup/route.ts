import { NextResponse } from 'next/server';

// Note: Removed 'force-dynamic' export as it's incompatible with static export for Electron
// The API still works dynamically on Vercel without this declaration

// Versions that require BibleGateway (not available on bible-api.com)
const BIBLEGATEWAY_VERSIONS = ['TPT', 'MSG', 'AMP', 'AMPC', 'NLT', 'CSB', 'NIV', 'NKJV', 'NASB', 'ESV', 'GW'];

// Version mapping for BibleGateway
const BG_VERSION_MAP: Record<string, string> = {
    'KJV21': 'KJ21',
    'TPT': 'TPT',
    'MSG': 'MSG',
    'AMP': 'AMP',
    'AMPC': 'AMPC',
    'NLT': 'NLT',
    'CSB': 'CSB',
    'NIV': 'NIV',
    'NKJV': 'NKJV',
    'NASB': 'NASB',
    'ESV': 'ESV',
    'GW': 'GW'
};

async function fetchFromBibleGateway(book: string, chapter: string, verse: string, version: string): Promise<string | null> {
    const bgVersion = BG_VERSION_MAP[version] || version;
    const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(book)}+${chapter}:${verse}&version=${bgVersion}`;

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });

        if (!res.ok) return null;

        const html = await res.text();

        // Helper to clean extracted text
        const cleanText = (text: string): string => {
            return text
                .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '')  // Remove footnote markers
                .replace(/<span class="chapternum">[\s\S]*?<\/span>/gi, '')  // Remove chapter numbers
                .replace(/<span class="versenum">[\s\S]*?<\/span>/gi, '')  // Remove verse numbers
                .replace(/<a[^>]*>[\s\S]*?<\/a>/gi, '')  // Remove links (footnotes)
                .replace(/<[^>]+>/g, '')  // Remove remaining HTML tags
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&#\d+;/g, '')  // Remove numeric entities
                .replace(/\[\w+\]/g, '')  // Remove bracketed references like [a], [b]
                .replace(/\s+/g, ' ')
                .trim();
        };

        // Method 1: Look for verse content in the result-text-style-normal class (most reliable)
        const resultMatch = html.match(/<div class="result-text-style-normal[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div class="passage-other/i);
        if (resultMatch) {
            const text = cleanText(resultMatch[1]);
            if (text && text.length > 10) return text;
        }

        // Method 2: Look for passage-text container and extract all text spans
        const passageTextMatch = html.match(/<div class="passage-text">([\s\S]*?)<\/div>\s*(?:<div class="passage-|<\/div>\s*<div class="publisher)/i);
        if (passageTextMatch) {
            const text = cleanText(passageTextMatch[1]);
            if (text && text.length > 10) return text;
        }

        // Method 3: Find all spans with class "text" and combine them
        const textSpans = html.match(/<span class="text [^"]*"[^>]*>([\s\S]*?)<\/span>/gi);
        if (textSpans && textSpans.length > 0) {
            const combinedText = textSpans
                .map(span => {
                    const match = span.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
                    return match ? cleanText(match[1]) : '';
                })
                .filter(t => t.length > 0)
                .join(' ');
            if (combinedText && combinedText.length > 10) return combinedText;
        }

        // Method 4: Look for the p tag inside passage-content
        const pMatch = html.match(/<p class="[^"]*"[^>]*><span[^>]*class="text[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
        if (pMatch) {
            const text = cleanText(pMatch[1]);
            if (text && text.length > 10) return text;
        }

        // Method 5: Broader search for any verse content
        const broadMatch = html.match(/class="text [A-Za-z]+-\d+-\d+"[^>]*>([\s\S]*?)<\/span>/i);
        if (broadMatch) {
            const text = cleanText(broadMatch[1]);
            if (text && text.length > 5) return text;
        }

        console.log('[BibleGateway] Could not extract verse text for', version, book, chapter, verse);
        return null;
    } catch (error) {
        console.error('BibleGateway fetch error:', error);
        return null;
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const book = searchParams.get('book');
    const chapter = searchParams.get('chapter');
    const verse = searchParams.get('verse');
    const version = searchParams.get('version') || 'KJV';

    if (!book || !chapter || !verse) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // For versions that need BibleGateway, try that first
    if (BIBLEGATEWAY_VERSIONS.includes(version.toUpperCase())) {
        const bgText = await fetchFromBibleGateway(book, chapter, verse, version.toUpperCase());
        if (bgText) {
            return NextResponse.json({ text: bgText });
        }
        // If BibleGateway fails, continue to bible-api.com as fallback
    }

    // Map internal keys to bible-api.com keys
    let apiVersion = version.toLowerCase();

    // Map some common variations if needed
    if (apiVersion === 'kjv21') apiVersion = 'kjv';

    // Construct API URL for bible-api.com
    const url = `https://bible-api.com/${encodeURIComponent(book)}+${chapter}:${verse}?translation=${apiVersion}`;

    try {
        const res = await fetch(url);

        if (!res.ok) {
            return NextResponse.json({ error: `Version ${version} not found online. Please add local JSON file.` }, { status: 404 });
        }

        const data = await res.json();

        // Clean text (remove excessive newlines)
        const cleanText = data.text ? data.text.replace(/[\n\r]+/g, ' ').trim() : '';

        return NextResponse.json({ text: cleanText });

    } catch (error) {
        console.error('API Lookup Error:', error);
        return NextResponse.json({ error: 'Failed to fetch from external API' }, { status: 500 });
    }
}
