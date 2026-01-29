import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json({ results: [] });
    }

    try {
        // iTunes Search API is free and robust for song metadata
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=20`);
        const data = await response.json();

        const results = data.results.map((item: any) => ({
            id: item.trackId,
            title: item.trackName,
            artist: item.artistName,
            album: item.collectionName,
            year: item.releaseDate ? item.releaseDate.split('-')[0] : '',
            thumbnail: item.artworkUrl60
        }));

        return NextResponse.json({ results });
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json({ error: 'Failed to search songs' }, { status: 500 });
    }
}
