const { app, BrowserWindow, ipcMain, Menu, dialog, shell, desktopCapturer, session, systemPreferences } = require('electron');
// electron-updater loaded lazily after app ready to avoid getVersion() crash
let autoUpdater = null;
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const cheerio = require('cheerio');
const OpenAI = require('openai');
// Load environment variables for local dev
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { exec } = require('child_process');
const crypto = require('crypto');

// ==================== EULA / LICENSE AGREEMENT ====================
function getEulaAcceptedPath() {
    return path.join(app.getPath('userData'), 'eula-accepted.json');
}

function hasAcceptedEula() {
    try {
        const eulaPath = getEulaAcceptedPath();
        if (fs.existsSync(eulaPath)) {
            const data = JSON.parse(fs.readFileSync(eulaPath, 'utf-8'));
            return data.accepted === true;
        }
    } catch (error) {
        console.error('[EULA] Error checking acceptance:', error.message);
    }
    return false;
}

function saveEulaAcceptance() {
    try {
        const eulaPath = getEulaAcceptedPath();
        fs.writeFileSync(eulaPath, JSON.stringify({
            accepted: true,
            acceptedAt: new Date().toISOString(),
            version: app.getVersion()
        }));
        return true;
    } catch (error) {
        console.error('[EULA] Error saving acceptance:', error.message);
        return false;
    }
}

async function showEulaDialog() {
    const eulaText = `CREENLY END USER LICENSE AGREEMENT (EULA)

By using Creenly, you agree to the following terms:

1. LICENSE: You are granted a limited, non-exclusive license to use this software for personal or organizational use.

2. RESTRICTIONS - You agree NOT to:
   • Reverse engineer, decompile, or disassemble the software
   • Modify, adapt, or create derivative works
   • Sell, resell, rent, lease, or redistribute the software
   • Remove or alter any proprietary notices

3. INTELLECTUAL PROPERTY: The software and all copies are proprietary. All rights not granted are reserved.

4. DISCLAIMER: THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND.

5. LIMITATION OF LIABILITY: The licensor shall not be liable for any indirect, incidental, or consequential damages.

By clicking "I Accept", you acknowledge that you have read and agree to be bound by these terms.

Full license terms are available at: https://creenly.app/license`;

    const result = await dialog.showMessageBox({
        type: 'info',
        title: 'Creenly - License Agreement',
        message: 'End User License Agreement',
        detail: eulaText,
        buttons: ['I Accept', 'I Decline'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
    });

    return result.response === 0; // 0 = "I Accept"
}

// ==================== SEMANTIC BIBLE SEARCH ====================
// Bible verse embeddings for semantic paraphrase detection
let bibleEmbeddings = null;
let openaiClient = null;

// Hardware integration
let atem = null;

// Load embeddings on startup
function loadBibleEmbeddings() {
    try {
        const embeddingsPath = app.isPackaged
            ? path.join(process.resourcesPath, 'resources', 'bible-embeddings.json')
            : path.join(__dirname, 'resources', 'bible-embeddings.json');

        if (fs.existsSync(embeddingsPath)) {
            console.log('[Semantic] Loading Bible embeddings...');
            const data = fs.readFileSync(embeddingsPath, 'utf-8');
            bibleEmbeddings = JSON.parse(data);
            console.log(`[Semantic] SUCCESS: Loaded ${bibleEmbeddings.length} verse embeddings`);
        } else {
            console.warn('[Semantic] WARNING: Bible embeddings not found at:', embeddingsPath);
            console.warn('[Semantic] Paraphrase detection will be limited to regex mode.');
        }
    } catch (error) {
        console.error('[Semantic] Failed to load embeddings:', error.message);
    }
}

// Initialize OpenAI client
function initOpenAI() {
    // Check environment variable first (for development)
    let apiKey = process.env.OPENAI_API_KEY;

    // Then check bundled secrets file (for production build)
    if (!apiKey) {
        try {
            const secretsPath = app.isPackaged
                ? path.join(process.resourcesPath, 'resources', 'secrets.json')
                : path.join(__dirname, 'resources', 'secrets.json');

            if (fs.existsSync(secretsPath)) {
                const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));
                apiKey = secrets.OPENAI_API_KEY;
            }
        } catch (error) {
            console.error('[Semantic] Failed to load secrets:', error.message);
        }
    }

    if (apiKey) {
        openaiClient = new OpenAI({ apiKey });
        console.log('[Semantic] SUCCESS: OpenAI client initialized');
        return true;
    } else {
        console.error('[Semantic] ERROR: OPENAI_API_KEY not found.');
        console.error('[Semantic] Production Note: Ensure "electron/resources/secrets.json" exists with your key.');
        console.error('[Semantic] Semantic search (paraphrase detection) is DISABLED.');
        return false;
    }
}

// Cosine similarity between two vectors
function cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Find similar Bible verses
async function findSimilarVerses(text, threshold = 0.45, maxResults = 5) {
    if (!bibleEmbeddings || !openaiClient) {
        return [];
    }

    try {
        // Get embedding for input text (must match dimensions used in bible-embeddings.json)
        const response = await openaiClient.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
            dimensions: 128
        });

        const queryEmbedding = response.data[0].embedding;

        // Calculate similarity with all verses
        const similarities = bibleEmbeddings.map(verse => ({
            ref: verse.ref,
            text: verse.text,
            similarity: cosineSimilarity(queryEmbedding, verse.emb)
        }));

        // Sort by similarity and filter above threshold
        const results = similarities
            .filter(v => v.similarity >= threshold)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, maxResults)
            .map(v => ({
                ref: v.ref,
                text: v.text,
                confidence: Math.round(v.similarity * 100)
            }));

        return results;

    } catch (error) {
        // Silent handling for offline/network errors
        const msg = error.message || '';
        if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ECONNRESET')) {
            console.warn('[Semantic] OpenAI unreachable (Offline)');
            return [];
        }
        console.error('[Semantic] Search error:', error.message);
        return [];
    }
}

// Security: Machine ID for Hardware Binding
async function getMachineId() {
    return new Promise((resolve) => {
        let command = '';
        if (process.platform === 'win32') {
            command = 'wmic csproduct get uuid';
        } else if (process.platform === 'darwin') {
            command = "ioreg -rd1 -c IOPlatformExpertDevice | grep -E '(IOPlatformUUID)'";
        } else {
            return resolve('fallback-id-' + process.platform);
        }

        exec(command, (err, stdout) => {
            if (err) return resolve('fallback-' + Date.now());
            // Extract the UUID/ID and hash it for privacy + consistency
            const raw = stdout.toString().replace(/IOPlatformUUID|uuid/gi, '').trim();
            const hash = crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16).toUpperCase();
            resolve('HW-' + hash);
        });
    });
}

// Disable Default Menu
Menu.setApplicationMenu(null);

let mainWindow;
let nextServer;
function createWindow() {
    const iconPath = path.join(__dirname, app.isPackaged ? '../out/logo.png' : '../public/logo.png');

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        backgroundColor: '#000000',
        show: false, // Don't show until ready
        title: 'Creenly',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true, // Hide default menu bar for premium look
        icon: iconPath
    });

    // Show window only after content is loaded (prevents "electron" flash)
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // In production, we would load the static build or start a bundled server
    // For now, in dev, we wait for Next.js on port 3000
    // In production, we would load the startUrl

    if (app.isPackaged) {
        const indexPath = path.join(__dirname, '../out/dashboard.html');
        // Ensure the file exists (for debugging)
        // console.log("Loading form:", indexPath);
        mainWindow.loadFile(indexPath);
    } else {
        const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
        mainWindow.loadURL(`${startUrl}/dashboard`);
    }

    // Handle popup windows (e.g., View Plans button) - open in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (projectorWindow) projectorWindow.close();
        if (stageWindow) stageWindow.close();
    });

    // PRODUCTION HARDENING: Disable DevTools and Context Menu
    if (app.isPackaged) {
        mainWindow.webContents.on('devtools-opened', () => {
            mainWindow.webContents.closeDevTools();
        });

        // Prevent right-click "Inspect"
        mainWindow.webContents.on('context-menu', (e) => {
            e.preventDefault();
        });

        // Block common shortcuts for devtools
        mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.control && input.shift && input.key.toLowerCase() === 'i') event.preventDefault();
            if (input.alt && input.control && input.key.toLowerCase() === 'i') event.preventDefault();
            if (input.key === 'F12') event.preventDefault();
        });
    }

    // FORCE OPEN DEVTOOLS FOR DEBUGGING (REMOVED)
    // mainWindow.webContents.openDevTools();
}

// Projector Window Management
let projectorWindow = null;
let stageWindow = null;
let identifyWindows = [];

function getIconPath() {
    return path.join(__dirname, app.isPackaged ? '../out/logo.png' : '../public/logo.png');
}

ipcMain.handle('identify-displays', async () => {
    const { screen, BrowserWindow } = require('electron');
    const displays = screen.getAllDisplays();

    // Close any existing identify windows
    identifyWindows.forEach(w => { if (!w.isDestroyed()) w.close(); });
    identifyWindows = [];

    displays.forEach((display, index) => {
        const win = new BrowserWindow({
            x: display.bounds.x,
            y: display.bounds.y,
            width: display.bounds.width,
            height: display.bounds.height,
            transparent: true,
            frame: false,
            alwaysOnTop: true,
            skipTaskbar: true,
            hasShadow: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        win.setIgnoreMouseEvents(true);
        win.loadURL(`data:text/html;charset=utf-8,
            <html>
                <body style="-webkit-app-region: drag; background: rgba(79, 70, 229, 0.1); color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; overflow: hidden; border: 10px solid rgba(79, 70, 229, 0.5);">
                    <div style="background: rgba(0,0,0,0.8); padding: 40px 80px; border-radius: 40px; text-align: center; border: 2px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                        <h1 style="font-size: 120px; margin: 0; line-height: 1;">${index + 1}</h1>
                        <p style="font-size: 24px; margin-top: 20px; font-weight: bold; opacity: 0.8; text-transform: uppercase; letter-spacing: 2px;">Screen Identification</p>
                    </div>
                </body>
            </html>
        `);

        identifyWindows.push(win);
    });

    setTimeout(() => {
        identifyWindows.forEach(w => { if (!w.isDestroyed()) w.close(); });
        identifyWindows = [];
    }, 5000);

    return { success: true };
});

ipcMain.handle('get-displays', async () => {
    const { screen } = require('electron');
    const displays = screen.getAllDisplays();
    return displays.map((d, i) => ({
        id: d.id,
        index: i + 1,
        label: `Display ${i + 1} (${d.bounds.width}x${d.bounds.height})`,
        bounds: d.bounds,
        isPrimary: d.id === screen.getPrimaryDisplay().id
    }));
});

ipcMain.handle('open-projector-window', async (event, { displayId } = {}) => {
    if (projectorWindow) {
        projectorWindow.focus();
        return { success: true, message: "Window already open" };
    }

    const { screen } = require('electron');
    const displays = screen.getAllDisplays();

    let targetDisplay = displays[0];
    if (displayId) {
        targetDisplay = displays.find(d => String(d.id) === String(displayId)) || targetDisplay;
    } else if (displays.length > 1) {
        // Fallback: use secondary screen if no ID provided
        targetDisplay = displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0) || displays[1];
    }

    projectorWindow = new BrowserWindow({
        x: targetDisplay.bounds.x,
        y: targetDisplay.bounds.y,
        width: targetDisplay.bounds.width,
        height: targetDisplay.bounds.height,
        fullscreen: false,
        backgroundColor: '#000000',
        show: false,
        title: 'Creenly - Projector',
        autoHideMenuBar: true,
        icon: getIconPath(),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    projectorWindow.once('ready-to-show', () => {
        projectorWindow.show();
    });

    if (app.isPackaged) {
        // Use file protocol with absolute path for predictability
        const projectorPath = path.join(__dirname, '../out/projector.html');
        const fileUrl = `file://${projectorPath.replace(/\\/g, '/')}`;

        console.log("Loading Projector from:", fileUrl);

        projectorWindow.loadURL(fileUrl).catch(err => {
            console.error("Failed to load projector URL:", err);
            // Emergency fallback
            projectorWindow.loadFile(path.join(__dirname, '../out/dashboard.html'));
        });
    } else {
        const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
        projectorWindow.loadURL(`${startUrl}/projector`);
    }

    projectorWindow.on('closed', () => {
        projectorWindow = null;
    });

    return { success: true };
});

ipcMain.handle('open-stage-window', async (event, { displayId } = {}) => {
    if (stageWindow) {
        stageWindow.focus();
        return { success: true, message: "Window already open" };
    }

    const { screen } = require('electron');
    const displays = screen.getAllDisplays();

    let targetDisplay = displays[0];
    if (displayId) {
        targetDisplay = displays.find(d => String(d.id) === String(displayId)) || targetDisplay;
    }

    stageWindow = new BrowserWindow({
        x: targetDisplay.bounds.x,
        y: targetDisplay.bounds.y,
        width: targetDisplay.bounds.width,
        height: targetDisplay.bounds.height,
        fullscreen: false,
        backgroundColor: '#000000',
        show: false,
        title: 'Creenly - Stage Monitor',
        autoHideMenuBar: true,
        icon: getIconPath(),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    stageWindow.once('ready-to-show', () => {
        stageWindow.show();
    });

    if (app.isPackaged) {
        const stagePath = path.join(__dirname, '../out/stage.html');
        const fileUrl = `file://${stagePath.replace(/\\/g, '/')}`;
        stageWindow.loadURL(fileUrl).catch(err => {
            console.error("Failed to load stage URL:", err);
        });
    } else {
        const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
        stageWindow.loadURL(`${startUrl}/stage`);
    }

    stageWindow.on('closed', () => {
        stageWindow = null;
    });

    // Mirror hardening for stage window
    if (app.isPackaged) {
        stageWindow.webContents.on('context-menu', (e) => e.preventDefault());
    }

    return { success: true };
});

ipcMain.handle('get-machine-id', async () => {
    return await getMachineId();
});

ipcMain.handle('get-desktop-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'], thumbnailSize: { width: 320, height: 180 } });
    return sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }));
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

// Online Lookup (IPC)
ipcMain.handle('lookup-verse-online', async (event, { book, chapter, verse, version }) => {
    try {
        const v = version.toUpperCase();

        // 1. Try public API for public domain (WEB, ASV, YLT, BBE, KJV, DARBY)
        const publicVersions = ['WEB', 'ASV', 'YLT', 'BBE', 'KJV', 'DARBY'];

        if (publicVersions.includes(v)) {
            const url = `https://bible-api.com/${encodeURIComponent(book)}+${chapter}:${verse}?translation=${v.toLowerCase()}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const cleanText = data.text ? data.text.replace(/[\n\r]+/g, ' ').trim() : '';
                return { text: cleanText };
            }
        }

        // 2. BibleGateway Fallback (NIV, MSG, AMP, ESV, NKJV, KJV21, GW, TPT, etc)
        console.log(`Scraping BibleGateway for ${v}...`);

        // Version Mapping (Internal -> BibleGateway)
        const versionMap = {
            'KJV21': 'KJ21',
            'NASB': 'NASB',
            'CSB': 'CSB',
            'RSV': 'RSV',
            'AMPC': 'AMPC',
            'GW': 'GW',
            'TPT': 'TPT',  // The Passion Translation
            'MSG': 'MSG',
            'AMP': 'AMP',
            'NLT': 'NLT',
            'NIV': 'NIV',
            'NKJV': 'NKJV',
            'ESV': 'ESV',
            'TLB': 'TLB'
        };
        const searchVersion = versionMap[v] || v;

        // Use searchVersion in URL
        const bgUrl = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(book)}+${chapter}:${verse}&version=${searchVersion}`;
        console.log(`[BG] Fetching: ${bgUrl}`);

        // Add timeout to prevent stalling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const res = await fetch(bgUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`Gateway Error: ${res.status}`);

        const html = await res.text();
        const $ = cheerio.load(html);

        let text = '';

        // Build the verse class pattern (e.g., "John-3-16" for John 3:16)
        const bookSlug = book.replace(/\s+/g, '-');
        const verseClass = `${bookSlug}-${chapter}-${verse}`;
        console.log(`[BG] Looking for verse class: ${verseClass}, version: ${searchVersion}`);

        // Method 1: Try to find the SPECIFIC verse span by class (most accurate for most versions)
        const specificVerse = $(`.text.${verseClass}`);
        if (specificVerse.length > 0) {
            const verseClone = specificVerse.clone();
            verseClone.find('sup, a, .footnote, .crossreference').remove();
            text = verseClone.text();
            console.log(`[BG] Found via verse class: ${verseClass}`);
        }

        // Method 2: For TPT and poetic versions - get text from passage directly
        if (!text.trim()) {
            const passageBlock = $('.passage-text').first();
            if (passageBlock.length > 0) {
                // Clone to avoid modifying original
                const cleanBlock = passageBlock.clone();

                // Remove all unwanted elements
                cleanBlock.find('sup.versenum, sup.crossreference, sup.footnote, .chapternum, .crossrefs, .footnotes, .full-chap-link, .passage-other-trans, .publisher-info-bottom, h1, h2, h3, h4, h5, .dropdown').remove();
                cleanBlock.find('a').remove();

                // Get all text spans
                const textSpans = cleanBlock.find('span.text');
                if (textSpans.length > 0) {
                    // For single verse lookup (not a range), just get all text from spans
                    let allText = [];
                    textSpans.each((i, el) => {
                        const spanText = $(el).text().trim();
                        if (spanText) {
                            allText.push(spanText);
                        }
                    });
                    text = allText.join(' ');
                    console.log(`[BG] Found ${textSpans.length} text spans`);
                }

                // If no spans found, try paragraphs
                if (!text.trim()) {
                    const paragraphs = cleanBlock.find('p');
                    let allText = [];
                    paragraphs.each((i, el) => {
                        const pText = $(el).text().trim();
                        if (pText && !pText.includes('No results found')) {
                            allText.push(pText);
                        }
                    });
                    text = allText.join(' ');
                    console.log(`[BG] Found ${paragraphs.length} paragraphs`);
                }
            }
        }

        // Method 3: Try result-text-style-normal (alternate layout)
        if (!text.trim()) {
            const resultBlock = $('.result-text-style-normal').first();
            if (resultBlock.length > 0) {
                const cleanResult = resultBlock.clone();
                cleanResult.find('sup, .chapternum, .versenum, h3, h4, a, .footnote, .crossreference').remove();
                text = cleanResult.text();
                console.log(`[BG] Found via result-text-style-normal`);
            }
        }

        // Method 4: Last resort - passage-content div
        if (!text.trim()) {
            const content = $('.passage-content').first();
            if (content.length > 0) {
                const cleanContent = content.clone();
                cleanContent.find('sup, .chapternum, .versenum, h1, h2, h3, h4, a, .dropdown, .passage-other-trans, .footnote, .crossreference, .publisher-info-bottom').remove();
                const paragraphs = cleanContent.find('p');
                if (paragraphs.length > 0) {
                    text = paragraphs.first().text();
                } else {
                    text = cleanContent.text();
                }
                console.log(`[BG] Found via passage-content fallback`);
            }
        }

        // Clean up the text
        text = text
            .replace(/\[\w+\]/g, '')           // Remove bracketed references [a], [b]
            .replace(/&#\d+;/g, '')            // Remove HTML entities
            .replace(/\d+\s*(?=\w)/g, '')      // Remove verse numbers at start of text
            .replace(/\s+/g, ' ')              // Normalize whitespace
            .trim();

        console.log(`[BG] Final text (${text.length} chars): "${text.substring(0, 150)}..."`);

        // Filter out if it looks like copyright or error text
        if (text && text.length > 10 && !text.toLowerCase().includes('no results found')) {
            return { text };
        }

        return { error: 'Text not found in source' };

    } catch (e) {
        const msg = e.message || '';
        if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ECONNRESET')) {
            // Expected when offline, no need to log error
            return { error: 'OFFLINE' };
        }
        console.error("Online lookup failed:", e);
        if (e.name === 'AbortError') {
            return { error: 'Request timed out - please try again' };
        }
        return { error: e.message };
    }
});


// Song Search & Lyrics (IPC)
ipcMain.handle('song-search', async (event, query) => {
    try {
        // iTunes API
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=300`;
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
// Smart AI Detection (Via Secure API Proxy)
// ----------------------------------------------------------------------

// API Proxy URL - set in .env.local or defaults to localhost for dev
const API_PROXY_URL = process.env.API_PROXY_URL || 'http://localhost:3001';

ipcMain.handle('smart-detect', async (event, payload) => {
    try {
        const { text, context, pastorHints, currentVerse, chapterContext, suggestions, history } = payload;

        // Quick validation
        if (!text || text.trim().length < 3) {
            return {
                scriptures: [],
                commands: [],
                signal: 'WAIT',
                signalReason: 'Insufficient text'
            };
        }

        // Call the secure API proxy (keys are server-side)
        const response = await fetch(`${API_PROXY_URL}/api/openai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                context,
                pastorHints,
                currentVerse,
                chapterContext,
                suggestions,
                history
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API error: ${response.status}`);
        }

        return await response.json();

    } catch (error) {
        // Silent handling for connection errors (common when offline)
        const msg = error.message || '';
        if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ECONNRESET')) {
            return { error: 'OFFLINE', message: 'Smart detection unavailable offline' };
        }
        console.error("Smart detection error:", error);
        return { error: error.message };
    }
});

// Semantic Bible Verse Search - finds paraphrased scripture
ipcMain.handle('semantic-search', async (event, { text, threshold = 0.45, maxResults = 3 }) => {
    try {
        if (!text || text.trim().length < 20) {
            return { results: [], reason: 'Text too short for semantic analysis' };
        }

        if (!bibleEmbeddings) {
            return { results: [], reason: 'Bible embeddings not loaded' };
        }

        if (!openaiClient) {
            return { results: [], reason: 'OpenAI client not initialized' };
        }

        console.log(`[Semantic] Searching for: "${text.substring(0, 50)}..."`);

        const results = await findSimilarVerses(text, threshold, maxResults);

        console.log(`[Semantic] Found ${results.length} matches`);

        // Return results with semantic tag
        return {
            results: results.map(r => ({
                ref: r.ref,
                text: r.text,
                confidence: r.confidence,
                type: 'semantic' // Tag for frontend
            }))
        };

    } catch (error) {
        console.error("[Semantic] Search error:", error);
        return { results: [], error: error.message };
    }
});

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

// Auto-Update Logic - initialized lazily after app is ready
function initAutoUpdater() {
    if (autoUpdater) return;
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
        if (mainWindow) mainWindow.webContents.send('update-available', info);
    });

    autoUpdater.on('update-downloaded', (info) => {
        if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
    });

    autoUpdater.on('error', (err) => {
        console.error("Updater Error:", err);
        if (mainWindow) mainWindow.webContents.send('update-error', err.toString());
    });
}

ipcMain.handle('check-update', () => {
    if (!autoUpdater) initAutoUpdater();
    return autoUpdater.checkForUpdates();
});
ipcMain.handle('download-update', () => {
    if (!autoUpdater) initAutoUpdater();
    return autoUpdater.downloadUpdate();
});
ipcMain.handle('install-update', () => {
    if (!autoUpdater) initAutoUpdater();
    return autoUpdater.quitAndInstall(false, true);
});

app.on('ready', async () => {
    // Check EULA acceptance on first launch
    if (!hasAcceptedEula()) {
        const accepted = await showEulaDialog();
        if (!accepted) {
            app.quit();
            return;
        }
        saveEulaAcceptance();
    }

    // Initialize semantic Bible search
    initOpenAI();
    loadBibleEmbeddings();

    // macOS microphone permission handling
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media') {
            callback(true);
        } else {
            callback(true);
        }
    });

    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
        if (permission === 'media') return true;
        return true;
    });

    // Request microphone access on macOS
    if (process.platform === 'darwin') {
        systemPreferences.askForMediaAccess('microphone').then(granted => {
            console.log('[Audio] Microphone access:', granted ? 'granted' : 'denied');
        });
    }

    createWindow();
    if (app.isPackaged) {
        // Initialize and check for updates shortly after startup
        initAutoUpdater();
        setTimeout(() => autoUpdater.checkForUpdates(), 3000);
    }
});

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
