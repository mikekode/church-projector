import initSqlJs from 'sql.js';
import { parseLyrics, LyricSlide } from './lyricsParser';
import { ResourceItem } from './resourceLibrary';

// ---------- Types ----------

export interface EWRawSong {
    rowid: number;
    title: string;
    author: string;
    copyright: string;
    song_number: string;
}

export interface EWParsedSong {
    raw: EWRawSong;
    plainLyrics: string;
    slides: LyricSlide[];
}

export interface EWImportProgress {
    phase: 'loading' | 'parsing' | 'saving';
    current: number;
    total: number;
    currentTitle?: string;
}

// ---------- RTF Stripper ----------

/**
 * Strips RTF formatting from EasyWorship lyric content.
 * EW stores lyrics as RTF with \par for newlines, font/color tables, etc.
 */
export function stripRtf(rtf: string | any): string {
    if (!rtf) return '';
    let text = String(rtf);

    // If it doesn't have any RTF markers, just return it
    if (!text.includes('\\') && !text.includes('{')) return text;

    // 1. Remove common header blocks recursively (fonttbl, colortbl, etc.)
    // We look for anything starting with \followed by alpha and ending with }
    // which is common for RTF headers.
    const headerPatterns = [
        /\{\\fonttbl[^}]*\}/gi,
        /\{\\colortbl[^}]*\}/gi,
        /\{\\stylesheet[^}]*\}/gi,
        /\{\\info[^}]*\}/gi,
        /\{\\\*[^}]*\}/gi
    ];

    let lastText;
    do {
        lastText = text;
        headerPatterns.forEach(pattern => {
            text = text.replace(pattern, '');
        });
    } while (text !== lastText);

    // 2. Handle character escapes
    // Unicode: \u1234?
    text = text.replace(/\\u(\d+)\?/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
    // Hex: \'e9
    text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    // 3. Newlines (Crucial for parseLyrics to see sections)
    // We convert \par to a newline. If we see double \par, it becomes double newline (section break)
    text = text.replace(/\\par\b\s?/gi, '\n');
    text = text.replace(/\\line\b\s?/gi, '\n');
    text = text.replace(/\\tab\b\s?/gi, '\t');

    // 4. Nuclear Strike: Strip ALL other control words (\word, \word123, \*)
    // RTF control words always start with \ and a letter
    text = text.replace(/\\[a-z*][a-z0-9-]*\s?/gi, '');

    // 5. Remove any remaining backslash sequences (like \~ or \_)
    text = text.replace(/\\[^a-zA-Z0-9\s]/g, '');

    // 6. Final Brace Removal
    text = text.replace(/[{}]/g, '');

    // 7. Whitespace normalization
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
}

// ---------- Database Reader ----------

let sqlInstance: any = null;

async function getSqlJs(): Promise<any> {
    if (!sqlInstance) {
        // Try multiple paths for the wasm binary to handle different build environments
        const wasmPaths = [
            './sql-wasm.wasm',      // Relative (works in most Electron builds)
            '/sql-wasm.wasm',       // Absolute (works in development and Vercel)
            '../sql-wasm.wasm'      // Parent (fallback for deeper routes if needed)
        ];

        let loadedBinary: ArrayBuffer | null = null;
        let lastError: any = null;

        for (const wasmPath of wasmPaths) {
            try {
                console.log(`[EW] Attempting to load SQL WASM from: ${wasmPath}`);
                const response = await fetch(wasmPath);
                if (response.ok) {
                    loadedBinary = await response.arrayBuffer();
                    console.log(`[EW] Successfully loaded SQL WASM from: ${wasmPath}`);
                    break;
                }
            } catch (e) {
                lastError = e;
                console.warn(`[EW] Failed to load WASM from ${wasmPath}:`, e);
            }
        }

        try {
            if (loadedBinary) {
                sqlInstance = await initSqlJs({ wasmBinary: loadedBinary });
            } else {
                throw new Error("Could not find sql-wasm.wasm in any expected location.");
            }
        } catch (e) {
            console.warn("[EW] WASM path loading failed, falling back to CDN", e);
            // Fallback to CDN as last resort
            sqlInstance = await initSqlJs({
                locateFile: (file: string) => `https://sql.js.org/dist/${file}`
            });
        }
    }
    return sqlInstance;
}

/**
 * Reads Songs.db and SongWords.db and returns parsed songs.
 */
export async function parseEasyWorshipDb(
    songsDbBuffer: ArrayBuffer,
    songWordsDbBuffer: ArrayBuffer,
    onProgress?: (progress: EWImportProgress) => void
): Promise<EWParsedSong[]> {
    onProgress?.({ phase: 'loading', current: 0, total: 0 });

    const SQL = await getSqlJs();

    const songsDb = new SQL.Database(new Uint8Array(songsDbBuffer));
    const wordsDb = new SQL.Database(new Uint8Array(songWordsDbBuffer));

    try {
        // Query all songs
        const songsResult = songsDb.exec(
            "SELECT rowid, title, author, copyright, song_number FROM song"
        );

        if (!songsResult.length || !songsResult[0].values.length) {
            return [];
        }

        const songs: EWRawSong[] = songsResult[0].values.map((row: any[]) => ({
            rowid: row[0] as number,
            title: (row[1] as string) || 'Untitled',
            author: (row[2] as string) || '',
            copyright: (row[3] as string) || '',
            song_number: (row[4] as string) || '',
        }));

        // Query all words into a map for fast lookup
        const wordsResult = wordsDb.exec("SELECT song_id, words FROM word");
        const wordsMap = new Map<number, string>();
        if (wordsResult.length && wordsResult[0].values.length) {
            for (const row of wordsResult[0].values) {
                wordsMap.set(row[0] as number, row[1] as string);
            }
        }

        // Parse each song
        const parsed: EWParsedSong[] = [];
        const total = songs.length;

        for (let i = 0; i < songs.length; i++) {
            const song = songs[i];
            onProgress?.({
                phase: 'parsing',
                current: i + 1,
                total,
                currentTitle: song.title
            });

            const rtfWords = wordsMap.get(song.rowid) || '';
            const plainLyrics = stripRtf(rtfWords);
            const slides = plainLyrics.trim() ? parseLyrics(plainLyrics) : [];

            parsed.push({ raw: song, plainLyrics, slides });

            // Yield to main thread every 50 songs
            if (i % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        return parsed;
    } finally {
        songsDb.close();
        wordsDb.close();
    }
}

/**
 * Converts a parsed EW song to a Creenly ResourceItem.
 */
export function ewSongToResourceItem(song: EWParsedSong): ResourceItem {
    return {
        id: `ew-${song.raw.rowid}-${Date.now()}`,
        title: song.raw.title,
        type: 'song',
        category: 'song',
        activeSlideIndex: 0,
        slides: song.slides.length > 0
            ? song.slides
            : [{ id: 'empty-1', content: '(No lyrics)', label: 'Slide 1' }],
        meta: {
            author: song.raw.author || undefined,
            copyright: song.raw.copyright || undefined,
            ccli: song.raw.song_number || undefined,
        },
        tags: ['worship', 'easyworship-import'],
        dateAdded: Date.now(),
    };
}
