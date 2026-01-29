const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
// Load environment variables for local dev
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
// If dotenv fails (not installed), it throws. We might need to handle that or install it.
// Ideally usage: const OpenAI = require('openai');

let OpenAI;
try {
    OpenAI = require('openai');
} catch (e) {
    console.error("OpenAI package not found. Smart Detect will fail.");
}

// Disable Default Menu
Menu.setApplicationMenu(null);

let mainWindow;
let nextServer;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        backgroundColor: '#000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true // Hide default menu bar for premium look
    });

    // In production, we would load the static build or start a bundled server
    // For now, in dev, we wait for Next.js on port 3000
    // In production, we would load the startUrl

    if (app.isPackaged) {
        const indexPath = path.join(__dirname, '../out/index.html');
        // Ensure the file exists (for debugging)
        // console.log("Loading form:", indexPath);
        mainWindow.loadFile(indexPath);
    } else {
        const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
        mainWindow.loadURL(startUrl);
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
        // Close projector if main closes? Usually yes
        if (projectorWindow) projectorWindow.close();
    });
}

// Projector Window Management
let projectorWindow = null;

ipcMain.handle('open-projector-window', async () => {
    if (projectorWindow) {
        projectorWindow.focus();
        return { success: true, message: "Window already open" };
    }

    const { screen } = require('electron');
    const displays = screen.getAllDisplays();

    // Default to primary, but prefer secondary if available
    let targetDisplay = displays[0];
    if (displays.length > 1) {
        // Simple logic: pick the last display that isn't the primary one
        // or just the second one
        targetDisplay = displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0) || displays[1];
    }

    projectorWindow = new BrowserWindow({
        x: targetDisplay.bounds.x + 50,
        y: targetDisplay.bounds.y + 50,
        width: 1280,
        height: 720,
        backgroundColor: '#000000',
        frame: false, // Frameless for immersion? Or maybe standard for now
        fullscreen: true, // Start full screen
        autoHideMenuBar: true, // Absolutely ensure no menu on projector
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    if (app.isPackaged) {
        // We need to load a specific route in the static export.
        // Next.js export generates 'out/projector.html' if '/projector' is a page.
        const projectorPath = path.join(__dirname, '../out/projector.html');
        // Fallback: If your page is dynamic or hash routed, you might load index.html#projector
        // But since we use Next.js file based routing and 'export', it should create projector.html
        projectorWindow.loadFile(projectorPath);
    } else {
        const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
        projectorWindow.loadURL(`${startUrl}/projector`);
    }

    projectorWindow.on('closed', () => {
        projectorWindow = null;
    });

    return { success: true };
});

// Bible Data Management
// Bible Data Management
// Structure: { 'KJV': data, 'NIV': data, ... }
const bibleDataMap = {};
const RESOURCES_DIR = path.join(__dirname, 'resources');

function loadBibleData() {
    try {
        if (!fs.existsSync(RESOURCES_DIR)) {
            console.warn("Resources dir not found");
            return;
        }

        const files = fs.readdirSync(RESOURCES_DIR).filter(f => f.endsWith('.json'));
        console.log("Loading Bibles from:", RESOURCES_DIR);

        files.forEach(file => {
            try {
                // version key derived from filename: 'en_kjv.json' -> 'KJV', 'niv.json' -> 'NIV'
                // simplified approach: use upper case of the main name
                let versionKey = file.replace('.json', '').toUpperCase();
                // cleanup 'en_' prefix if present
                if (versionKey.startsWith('EN_')) versionKey = versionKey.replace('EN_', '');

                const filePath = path.join(RESOURCES_DIR, file);
                const raw = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(raw);

                bibleDataMap[versionKey] = data;
                console.log(`Loaded ${versionKey} (${data.length} books)`);
            } catch (err) {
                console.error(`Failed to load ${file}:`, err.message);
            }
        });

    } catch (e) {
        console.error("Failed to load Bible data:", e);
    }
}

// Book Name Mapping (Simple normalization)
const BOOK_MAP = {
    'gen': 'gn', 'genesis': 'gn',
    'exo': 'ex', 'exodus': 'ex',
    'lev': 'lv', 'leviticus': 'lv',
    'num': 'nm', 'numbers': 'nm',
    'deu': 'dt', 'deuteronomy': 'dt',
    'jos': 'js', 'joshua': 'js',
    'jdg': 'jud', 'judges': 'jud',
    'rut': 'rt', 'ruth': 'rt',
    '1sa': '1sm', '1 samuel': '1sm',
    '2sa': '2sm', '2 samuel': '2sm',
    '1ki': '1kgs', '1 kings': '1kgs',
    '2ki': '2kgs', '2 kings': '2kgs',
    '1ch': '1ch', '1 chronicles': '1ch',
    '2ch': '2ch', '2 chronicles': '2ch',
    'ezr': 'ezr', 'ezra': 'ezr',
    'neh': 'ne', 'nehemiah': 'ne',
    'est': 'et', 'esther': 'et',
    'job': 'job',
    'psa': 'ps', 'psalms': 'ps', 'psalm': 'ps',
    'pro': 'prv', 'proverbs': 'prv',
    'ecc': 'ec', 'ecclesiastes': 'ec',
    'son': 'so', 'song of solomon': 'so', 'songs': 'so',
    'isa': 'isa', 'isaiah': 'isa',
    'jer': 'jr', 'jeremiah': 'jr',
    'lam': 'lm', 'lamentations': 'lm',
    'eze': 'ez', 'ezekiel': 'ez',
    'dan': 'dn', 'daniel': 'dn',
    'hos': 'ho', 'hosea': 'ho',
    'joe': 'jl', 'joel': 'jl',
    'amo': 'am', 'amos': 'am',
    'oba': 'ob', 'obadiah': 'ob',
    'jon': 'jn', 'jonah': 'jn',
    'mic': 'mi', 'micah': 'mi',
    'nah': 'na', 'nahum': 'na',
    'hab': 'hb', 'habakkuk': 'hb',
    'zep': 'zp', 'zephaniah': 'zp',
    'hag': 'hg', 'haggai': 'hg',
    'zec': 'zc', 'zechariah': 'zc',
    'mal': 'ml', 'malachi': 'ml',
    'mat': 'mt', 'matthew': 'mt',
    'mar': 'mk', 'mark': 'mk',
    'luk': 'lk', 'luke': 'lk',
    'joh': 'jh', 'john': 'jh',
    'act': 'ac', 'acts': 'ac',
    'rom': 'rm', 'romans': 'rm',
    '1co': '1co', '1 corinthians': '1co',
    '2co': '2co', '2 corinthians': '2co',
    'gal': 'gl', 'galatians': 'gl',
    'eph': 'ep', 'ephesians': 'ep',
    'phi': 'ph', 'philippians': 'ph',
    'col': 'cl', 'colossians': 'cl',
    '1th': '1th', '1 thessalonians': '1th',
    '2th': '2th', '2 thessalonians': '2th',
    '1ti': '1tm', '1 timothy': '1tm',
    '2ti': '2tm', '2 timothy': '2tm',
    'tit': 'tt', 'titus': 'tt',
    'phi': 'phm', 'philemon': 'phm', // Conflict with philippians? Need better map
    'heb': 'hb', 'hebrews': 'hb',
    'jam': 'jm', 'james': 'jm',
    '1pe': '1pe', '1 peter': '1pe',
    '2pe': '2pe', '2 peter': '2pe',
    '1jo': '1j', '1 john': '1j',
    '2jo': '2j', '2 john': '2j',
    '3jo': '3j', '3 john': '3j',
    'jud': 'jd', 'jude': 'jd',
    'rev': 're', 'revelation': 're'
};

// Start Loading
loadBibleData();

ipcMain.handle('get-verse', async (event, { book, chapter, verse, version }) => {
    // Multi-Version Logic
    let targetVersion = version ? version.toUpperCase() : 'KJV';
    let bibleData = bibleDataMap[targetVersion];

    if (!bibleData) return { error: `Version ${targetVersion} not available locally.` };

    // Normalize Book
    const cleanBook = book.toLowerCase().trim();
    let targetAbbrev = BOOK_MAP[cleanBook];

    // Fallback: search partial match in abbrev
    if (!targetAbbrev) {
        // Try to find in the loaded data directly used in 'name' or existing logic
        // For now, simpler is better. If mapping fails, try direct search
        // But the JSON keys use specific abbrevs like 'gn', 'ex'
    }

    const bookObj = bibleData.find(b => b.abbrev === targetAbbrev || b.name?.toLowerCase() === cleanBook);

    if (!bookObj) return { error: `Book not found: ${book}` };

    const chapters = bookObj.chapters;
    if (!chapters || !chapters[chapter - 1]) return { error: `Chapter not found: ${chapter}` };

    const verseText = chapters[chapter - 1][verse - 1];
    if (!verseText) return { error: `Verse not found: ${verse}` };

    return {
        text: verseText,
        reference: `${book} ${chapter}:${verse}`,
        version: 'KJV'
    };
});


// Song Search & Lyrics (IPC)
ipcMain.handle('song-search', async (event, query) => {
    try {
        // iTunes API
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=20`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`iTunes API Error: ${response.statusText}`);
        const data = await response.json();

        // Map to our format
        const results = data.results.map(item => ({
            id: String(item.trackId),
            title: item.trackName,
            artist: item.artistName,
            album: item.collectionName,
            albumArt: item.artworkUrl100?.replace('100x100', '600x600'),
            source: 'itunes'
        }));
        return { results };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('song-lyrics', async (event, { title, artist }) => {
    try {
        // LrcLib API
        const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data.plainLyrics) return { lyrics: data.plainLyrics };
        }

        // Fallback: simple lyrics.ovh (often down, but good backup)
        try {
            const url2 = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
            const res2 = await fetch(url2);
            if (res2.ok) {
                const data2 = await res2.json();
                if (data2.lyrics) return { lyrics: data2.lyrics };
            }
        } catch (e2) { /* ignore */ }

        return { error: "Lyrics not found" };
    } catch (e) {
        return { error: e.message };
    }
});



// ----------------------------------------------------------------------
// Smart AI Detection (Migrated from Server-Side API)
// ----------------------------------------------------------------------

ipcMain.handle('smart-detect', async (event, payload) => {
    if (!OpenAI) return { error: "OpenAI module not loaded." };

    // Initialize OpenAI with key from env or fallback (bundled)
    const apiKey = process.env.OPENAI_API_KEY || "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";

    const openai = new OpenAI({
        apiKey: apiKey,
    });

    if (!apiKey) {
        return { error: "Missing OPENAI_API_KEY." };
    }

    try {
        const { text, context, pastorHints, currentVerse, chapterContext } = payload;

        // Basic logging (optional)
        // console.log(`[SmartDetect] Processing: "${text}"`);

        if (!text || text.trim().length < 3) {
            return {
                scriptures: [],
                commands: [],
                signal: 'WAIT',
                signalReason: 'Insufficient text'
            };
        }

        const systemPrompt = buildSystemPrompt(pastorHints, currentVerse, chapterContext);

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `Context: "${context || 'none'}"\n\nNew text: "${text}"\n\nAnalyze for scripture references and commands.`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0,
            max_tokens: 300,
        });

        const content = response.choices[0]?.message?.content || '{}';

        try {
            const parsed = JSON.parse(content);
            return validateAndNormalize(parsed);
        } catch (parseError) {
            console.error("Failed to parse AI response:", content);
            return {
                scriptures: [],
                commands: [],
                signal: 'WAIT',
                signalReason: 'Parse error'
            };
        }

    } catch (error) {
        console.error("Smart detection error:", error);
        return { error: error.message };
    }
});

// Helpers (Ported from route.ts)

function buildSystemPrompt(pastorHints, currentVerse, chapterContext) {
    let prompt = `You are a real-time scripture detection system for a church projector. You analyze small text windows (5-15 words) from live sermon transcription.

RESPOND with JSON:
{
  "scriptures": [
    {
      "book": "string",
      "chapter": number,
      "verse": number,
      "confidence": number,
      "matchType": "exact" | "partial" | "paraphrase",
      "reason": "string"
    }
  ],
  "commands": [],
  "signal": "SWITCH" | "HOLD" | "WAIT",
  "signalReason": "string",
  "verseCount": 1
}

STRICT RULE: You MUST ALWAYS include "verseCount" (1, 2, or 3) in the JSON response whenever "scriptures" or "commands" are not empty. Default to 1 if only one verse is mentioned or implied.

DETECTION TYPES:
- "exact": Direct verse reference like "John 3:16" or "John chapter 3 verse 16"
- "partial": Incomplete reference like "For God so loved..." (recognizable start of verse)
- "paraphrase": Sermon paraphrase type
- "exact": Direct reference

CONFIDENCE SCORING (0-100):
- 90-100: Direct reference
- 70-89: Strong match
- 50-69: Likely match
- Below 50: Don't include

SIGNALS:
- "SWITCH": High confidence (>=80)
- "HOLD": Currently displaying correct verse
- "WAIT": No detection

NAVIGATION COMMANDS:
- "next verse" -> {"type": "next_verse"}
- "previous verse" -> {"type": "prev_verse"}
- "verse [number]" -> {"type": "jump_to_verse", "verse": number}
- "next chapter" / "previous chapter"
- "clear"

RULES:
- "three" -> 3
- "Revelation" (singular)
- "Song of Solomon"`;

    if (pastorHints) prompt += `\n\nPASTOR CONTEXT:\n${pastorHints}`;
    if (currentVerse) prompt += `\n\nCURRENTLY DISPLAYING: ${currentVerse}`;
    if (chapterContext) prompt += `\n\nACTIVE CHAPTER CONTEXT: ${chapterContext}`;

    return prompt;
}

function validateAndNormalize(parsed) {
    const scriptures = (Array.isArray(parsed.scriptures) ? parsed.scriptures : [])
        .map(s => {
            return {
                book: normalizeBookName(s.book || ''),
                chapter: parseInt(s.chapter) || 1,
                verse: parseInt(s.verse) || 1,
                verseEnd: s.verseEnd ? parseInt(s.verseEnd) : undefined,
                confidence: Math.min(100, Math.max(0, parseInt(s.confidence) || 50)),
                matchType: ['exact', 'partial', 'paraphrase'].includes(s.matchType) ? s.matchType : 'exact',
                reason: s.reason || 'Detected',
            };
        })
        .filter(s => s && s.book && s.chapter && s.confidence >= 50)
        .sort((a, b) => b.confidence - a.confidence);

    const validCommands = ['next_verse', 'prev_verse', 'next_chapter', 'prev_chapter', 'clear', 'jump_to_verse', 'switch_translation'];

    let rawCommands = parsed.commands;
    if (rawCommands && !Array.isArray(rawCommands)) rawCommands = [rawCommands];

    const commands = (Array.isArray(rawCommands) ? rawCommands : [])
        .filter(c => c && c.type && validCommands.includes(c.type))
        .map(c => ({
            type: c.type,
            verse: c.verse ? parseInt(c.verse) : undefined,
            version: c.version?.toUpperCase()
        }));

    let signal = parsed.signal || 'WAIT';
    let signalReason = parsed.signalReason || '';

    if (scriptures.length > 0 && scriptures[0].confidence >= 80) signal = 'SWITCH';
    else if (commands.length > 0) signal = 'SWITCH';
    else if (!scriptures.length && !commands.length) signal = 'WAIT';

    let verseCount = parsed.verseCount ? Math.min(3, Math.max(1, parseInt(parsed.verseCount))) : undefined;
    if (!verseCount && (scriptures.length > 0 || commands.length > 0)) verseCount = 1;

    return { scriptures, commands: commands.map(c => ({ ...c, verseCount: c.verseCount || verseCount })), signal, signalReason, verseCount };
}

function normalizeBookName(book) {
    let result = book.trim();
    // Simplified normalization for brevity
    if (result.match(/^Song of/i) || result.match(/^Canticles/i)) return 'Song of Solomon';
    if (result.match(/^Rev/i)) return 'Revelation';
    if (result.match(/^Psalm/i)) return 'Psalm';
    // Uppercase first letter of words
    return result.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));
}

ipcMain.handle('atem-connect', async (event, ip) => {
    try {
        // Dynamically require to avoid crash if not installed yet
        const { Atem } = require('atem-connection');

        if (atem) {
            await atem.disconnect();
        }

        atem = new Atem();

        atem.on('connected', () => {
            console.log('ATEM Connected');
            mainWindow.webContents.send('atem-status', 'connected');
        });

        atem.on('disconnected', () => {
            console.log('ATEM Disconnected');
            mainWindow.webContents.send('atem-status', 'disconnected');
        });

        await atem.connect(ip);
        return { success: true, status: 'connecting' };
    } catch (e) {
        console.error('ATEM Error:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('atem-action', async (event, { action, input }) => {
    if (!atem || atem.status !== 'connected') return { success: false, error: 'Not connected' };

    try {
        if (action === 'cut') await atem.cut();
        if (action === 'auto') await atem.auto();
        if (action === 'preview' && typeof input === 'number') await atem.changePreviewInput(input);
        if (action === 'program' && typeof input === 'number') await atem.changeProgramInput(input);

        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// NDI Placeholder (requires native bindings like ndi-js or grandiot)
ipcMain.handle('ndi-start', async () => {
    // Implementing NDI in Node.js requires a native module (gyp build)
    // Example: const gr = require('grandiot');
    console.log('Starting NDI output is not yet fully implemented due to dependency requirements.');
    return { success: true, warning: 'NDI requires native compilation' };
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (nextServer) nextServer.kill();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
