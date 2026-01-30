import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const artist = searchParams.get('artist');

    if (!title || !artist) {
        return NextResponse.json({ error: 'Title and Artist required' }, { status: 400 });
    }

    try {
        // 1. LrcLib
        const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data.plainLyrics) {
                return NextResponse.json({ lyrics: data.plainLyrics });
            }
        }

        // 2. Fallback: lyrics.ovh
        const url2 = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
        const res2 = await fetch(url2);
        if (res2.ok) {
            const data2 = await res2.json();
            if (data2.lyrics) {
                return NextResponse.json({ lyrics: data2.lyrics });
            }
        }

        return NextResponse.json({ lyrics: null });
    } catch (error: any) {
        console.error('Lyrics fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
