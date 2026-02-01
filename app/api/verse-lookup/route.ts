import { NextResponse } from 'next/server';

// Skip static generation for this route - only works on Vercel (server)
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const book = searchParams.get('book');
    const chapter = searchParams.get('chapter');
    const verse = searchParams.get('verse');
    const version = searchParams.get('version') || 'KJV';

    if (!book || !chapter || !verse) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Map internal keys to bible-api.com keys
    let apiVersion = version.toLowerCase();

    // Map some common variations if needed
    if (apiVersion === 'kjv21') apiVersion = 'kjv';

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
