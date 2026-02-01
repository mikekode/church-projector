import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        console.log(`[API] Song Search Query: ${query}`);

        if (!query) {
            return NextResponse.json({ results: [] });
        }

        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=300`;

        const res = await fetch(url);

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`iTunes API error: ${res.status} ${res.statusText} - ${text}`);
        }

        const data = await res.json();

        const results = data.results.map((item: any) => ({
            id: String(item.trackId),
            title: item.trackName,
            artist: item.artistName,
            album: item.collectionName,
            albumArt: item.artworkUrl100?.replace('100x100', '600x600'),
            source: 'itunes'
        }));

        return NextResponse.json({ results });
    } catch (error: any) {
        console.error('Song search error:', error);
        return NextResponse.json({
            error: true,
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
