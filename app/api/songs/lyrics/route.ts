import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get('title');
    const artist = searchParams.get('artist');

    if (!title || !artist) {
        return NextResponse.json({ error: 'Missing title or artist' }, { status: 400 });
    }

    // Clean artist name (remove "feat." etc)
    const cleanArtist = artist.split(/ feat\.| ft\.|,|&/i)[0].trim();
    // Clean title (remove "Live", "Remix")
    const cleanTitle = title.replace(/\(Live\)|\[Live\]|\(Remix\)/i, '').trim();

    try {
        console.log(`[Lyrics] Fetching for: ${cleanArtist} - ${cleanTitle}`);

        // 1. Try LrcLib.net (More reliable, active)
        try {
            const lrcRes = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`, {
                headers: { 'User-Agent': 'ChurchProjector/1.0' }
            });

            if (lrcRes.ok) {
                const lrcData = await lrcRes.json();
                if (lrcData && (lrcData.plainLyrics || lrcData.syncedLyrics)) {
                    return NextResponse.json({
                        lyrics: lrcData.plainLyrics || lrcData.syncedLyrics, // Prefer plain
                        source: 'lrclib.net'
                    });
                }
            } else {
                // Try search endpoint if direct get fails
                const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanArtist + ' ' + cleanTitle)}`, {
                    headers: { 'User-Agent': 'ChurchProjector/1.0' }
                });
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (Array.isArray(searchData) && searchData.length > 0) {
                        const bestMatch = searchData[0];
                        if (bestMatch.plainLyrics || bestMatch.syncedLyrics) {
                            return NextResponse.json({
                                lyrics: bestMatch.plainLyrics || bestMatch.syncedLyrics,
                                source: 'lrclib.net (search)'
                            });
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[Lyrics] LrcLib failed:', e);
        }

        // 2. Fallback to Lyrics.ovh
        const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`);

        if (response.ok) {
            const data = await response.json();
            if (data.lyrics) {
                return NextResponse.json({
                    lyrics: data.lyrics,
                    source: 'lyrics.ovh'
                });
            }
        }

        console.log('[Lyrics] Not found on sources');
        return NextResponse.json({ error: 'Lyrics not found' }, { status: 404 });

    } catch (error) {
        console.error('Lyrics fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch lyrics' }, { status: 500 });
    }
}
