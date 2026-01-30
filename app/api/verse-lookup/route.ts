import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const book = searchParams.get('book');
    const chapter = searchParams.get('chapter');
    const verse = searchParams.get('verse');
    const version = searchParams.get('version') || 'KJV';

    if (!book || !chapter || !verse) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Map internal keys to bible-api.com keys
    // Detailed list of supported free versions on bible-api.com:
    // kjv, web, asv, ylt, bbe, dby, dra, weymouth, oeb-us, oeb-cw, web-be
    let apiVersion = version.toLowerCase();

    // Map some common variations if needed (e.g. RSV -> ? not supported)
    if (apiVersion === 'kjv21') apiVersion = 'kjv'; // Fallback closest

    // Construct API URL
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
