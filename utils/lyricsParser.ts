import JSZip from 'jszip';
// pdfjs-dist import removed (using dynamic import)

/**
 * Smart Lyrics Parser
 * Takes raw lyrics text and splits it into projector-ready slides
 * based on natural breaks (double newlines, verse markers) and word limits.
 */

const MAX_WORDS_PER_SLIDE = 25; // Updated to 25 per user request
const MAX_LINES_PER_SLIDE = 4;

export type LyricSlide = {
    id: string;
    content: string;
    label: string; // "Verse 1", "Chorus", "Bridge", etc.
};

/**
 * Detects common verse/chorus/bridge markers in lyrics
 */
function detectSectionLabel(text: string): string | null {
    const patterns = [
        /^\s*\[?(verse|v)\s*(\d+)\]?/i,
        /^\s*\[?(chorus|ch)\]?/i,
        /^\s*\[?(bridge|br)\]?/i,
        /^\s*\[?(pre-?chorus)\]?/i,
        /^\s*\[?(outro)\]?/i,
        /^\s*\[?(intro)\]?/i,
        /^\s*\[?(tag)\]?/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            // Normalize the label
            const label = match[1].toLowerCase();
            if (label.startsWith('v')) return `Verse ${match[2] || ''}`.trim();
            if (label.startsWith('ch') || label === 'chorus') return 'Chorus';
            if (label.startsWith('br') || label === 'bridge') return 'Bridge';
            if (label === 'pre-chorus' || label === 'prechorus') return 'Pre-Chorus';
            if (label === 'outro') return 'Outro';
            if (label === 'intro') return 'Intro';
            if (label === 'tag') return 'Tag';
        }
    }
    return null;
}

/**
 * Splits a block of text into slides based on word/line limits
 */
function splitBlockIntoSlides(block: string, baseLabel: string): LyricSlide[] {
    const lines = block.split('\n').filter(l => l.trim());
    const slides: LyricSlide[] = [];

    let currentSlide: string[] = [];
    let wordCount = 0;
    let slideIndex = 1;

    for (const line of lines) {
        const lineWords = line.trim().split(/\s+/).length;

        // Check if adding this line would exceed limits
        if (currentSlide.length >= MAX_LINES_PER_SLIDE ||
            (wordCount + lineWords > MAX_WORDS_PER_SLIDE && currentSlide.length > 0)) {
            // Save current slide
            slides.push({
                id: `${baseLabel}-${slideIndex}-${Date.now()}`,
                content: currentSlide.join('\n'),
                label: slides.length === 0 ? baseLabel : `${baseLabel} (cont.)`
            });
            currentSlide = [];
            wordCount = 0;
            slideIndex++;
        }

        currentSlide.push(line.trim());
        wordCount += lineWords;
    }

    // Don't forget the last slide
    if (currentSlide.length > 0) {
        slides.push({
            id: `${baseLabel}-${slideIndex}-${Date.now()}`,
            content: currentSlide.join('\n'),
            label: slides.length === 0 ? baseLabel : `${baseLabel} (cont.)`
        });
    }

    return slides;
}

/**
 * Detects if text is a CCLI Copy block
 */
export function isCcliCopy(text: string): boolean {
    return text.includes("CCLI Song #") || text.includes("CCLI License #") || /©\s*\d{4}/.test(text);
}

/**
 * Parses CCLI / SongSelect copied text
 * Extracts metadata and structured lyrics
 */
export function parseCcliCopy(text: string): { slides: LyricSlide[], meta: any } {
    const lines = text.split(/\r?\n/).map(l => l.trim());
    const slides: LyricSlide[] = [];
    let meta: any = {};

    // Extract Metadata (usually at top or bottom)
    const title = lines[0]; // Assumption: First line is title if it's not a marker

    // Regex for metadata lines
    const metaPatterns = {
        ccliSong: /CCLI Song #\s*(\d+)/i,
        author: /Words|Music|Author|By\s+([A-Za-z\s,&]+)/i,
        copyright: /©|Copyright/i
    };

    let contentLines: string[] = [];
    let isMetadataBlock = true;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) {
            contentLines.push(''); // Preserve empty lines for structure
            continue;
        }

        // Check if metadata line
        if (metaPatterns.ccliSong.test(line) || metaPatterns.copyright.test(line) || line.startsWith('CCLI License')) {
            // It's metadata, ignore for content
            const match = line.match(metaPatterns.ccliSong);
            if (match) meta.ccliNumber = match[1];
            continue;
        }

        // Author extraction
        const authorMatch = line.match(metaPatterns.author);
        if (authorMatch && i < 10) { // usually near top
            meta.author = authorMatch[1];
            continue;
        }

        // If we hit a Verse/Chorus marker, we are definitely in content
        if (detectSectionLabel(line)) {
            isMetadataBlock = false;
        }

        // If we've passed the top few lines and it's not metadata, treat as content
        if (i > 3 && !isMetadataBlock) {
            // It's content
        }

        contentLines.push(line);
    }

    // Use the generic parser on the cleaned content
    // removing top lines that might be title if duplicate
    const cleanedText = contentLines.join('\n').trim();
    slides.push(...parseLyrics(cleanedText));

    // Ensure Title is set if missing
    if (!meta.title) meta.title = title;

    return { slides, meta };
}

/**
 * Main parser function
 * Takes raw lyrics and returns an array of slides
 */
export function parseLyrics(rawLyrics: string): LyricSlide[] {
    // Normalize line endings
    const text = rawLyrics.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split by double newlines (section breaks)
    // CCLI often uses double newlines between sections
    const sections = text.split(/\n\s*\n/).filter(s => s.trim());

    const allSlides: LyricSlide[] = [];
    let verseCounter = 1;

    for (const section of sections) {
        const lines = section.split('\n');
        const firstLine = lines[0] || '';

        // Check if the first line is a section marker
        let label = detectSectionLabel(firstLine);
        let contentLines = lines;

        if (label) {
            // Remove the marker line from content
            contentLines = lines.slice(1);
            if (label === 'Verse') {
                label = `Verse ${verseCounter}`;
                verseCounter++;
            }
        } else {
            // No explicit marker
            // If it's short and looks like Metadata (Copyright, CCLI), skip it
            if (isCcliCopy(section)) continue;

            // Auto-label
            label = `Verse ${verseCounter}`;
            verseCounter++;
        }

        const content = contentLines.join('\n').trim();
        if (content) {
            // If content is very long, split it. Otherwise keep as one slide (CCLI blocks are usually good)
            if (contentLines.length > MAX_LINES_PER_SLIDE + 2) {
                const sectionSlides = splitBlockIntoSlides(content, label);
                allSlides.push(...sectionSlides);
            } else {
                allSlides.push({
                    id: `${label}-${Date.now()}-${Math.random()}`,
                    content: content,
                    label: label
                });
            }
        }
    }

    // Re-number slides
    return allSlides.map((slide, idx) => ({
        ...slide,
        id: `slide-${idx + 1}-${Date.now()}`
    }));
}

/**
 * Detects if text looks like lyrics (has sections like [Verse] or distinct blocks)
 */
function isLyricsFormat(text: string): boolean {
    // Check for common markers
    if (detectSectionLabel(text)) return true;

    // Check for double newline structure with short lines
    const blocks = text.split(/\n\s*\n/);
    if (blocks.length > 2) {
        const avgLineLength = text.length / text.split('\n').length;
        if (avgLineLength < 50) return true; // Short lines likely indicate lyrics/poetry
    }

    return false;
}

/**
 * Extracts plain text from DOCX files
 */
async function extractTextFromDocx(file: File): Promise<string> {
    try {
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        const docXml = await content.file("word/document.xml")?.async("string");

        if (!docXml) return "";

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(docXml, "text/xml");

        // Extract text from <w:t> tags and preserve paragraph breaks
        const paragraphs = xmlDoc.getElementsByTagName("w:p");
        let fullText = "";

        for (let i = 0; i < paragraphs.length; i++) {
            const p = paragraphs[i];
            const texts = p.getElementsByTagName("w:t");
            let paraText = "";
            for (let j = 0; j < texts.length; j++) {
                paraText += texts[j].textContent;
            }
            if (paraText) fullText += paraText + "\n";
        }

        return fullText;
    } catch (e) {
        console.error("DOCX Parse Error", e);
        return "";
    }
}

/**
 * Extracts plain text from PDF files
 */
async function extractTextFromPdf(file: File): Promise<string> {
    try {
        const arrayBuffer = await file.arrayBuffer();

        // Load PDF.js (Dynamic)
        const pdfjsModule = await import('pdfjs-dist');
        const pdfjs = (pdfjsModule as any).default || pdfjsModule;

        // Use CDN worker for maximum stability in Electron/Next.js environment
        // This avoids 404s on local worker files and webpack bundling errors
        if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        }

        const pdf = await pdfjs.getDocument({
            data: arrayBuffer,
            useWorkerFetch: false,
            isEvalSupported: false,
            useSystemFonts: true
        }).promise;

        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n\n';
        }
        return fullText;
    } catch (e) {
        console.error("PDF Parse Error", e);
        return "";
    }
}

/**
 * Extracts slides from PPTX files preserving slide structure
 */
async function extractSlidesFromPptx(file: File): Promise<LyricSlide[]> {
    try {
        const zip = new JSZip();
        // Load the file
        const content = await zip.loadAsync(file);

        // Find slide files
        const slideFiles: { name: string, num: number }[] = [];
        content.forEach((relativePath) => {
            // Look for ppt/slides/slideX.xml
            // Regex: ppt\/slides\/slide(\d+)\.xml
            const match = relativePath.match(/ppt\/slides\/slide(\d+)\.xml$/);
            if (match) {
                slideFiles.push({
                    name: relativePath,
                    num: parseInt(match[1])
                });
            }
        });

        // Sort by slide number
        slideFiles.sort((a, b) => a.num - b.num);

        const slides: LyricSlide[] = [];
        const parser = new DOMParser();

        for (const slideFile of slideFiles) {
            const xmlStr = await content.file(slideFile.name)?.async("string");
            if (!xmlStr) continue;

            const xmlDoc = parser.parseFromString(xmlStr, "text/xml");

            // Extract text from paragraphs
            const paragraphs = xmlDoc.getElementsByTagName("a:p");
            let refinedText = "";
            for (let i = 0; i < paragraphs.length; i++) {
                const p = paragraphs[i];
                const tNodes = p.getElementsByTagName("a:t");
                if (tNodes.length > 0) {
                    let pText = "";
                    for (let j = 0; j < tNodes.length; j++) {
                        pText += tNodes[j].textContent;
                    }
                    if (pText.trim()) refinedText += pText + "\n";
                }
            }

            if (refinedText.trim()) {
                slides.push({
                    id: `slide-${slideFile.num}-${Date.now()}`,
                    content: refinedText.trim(),
                    label: `Slide ${slideFile.num}`
                });
            }
        }

        return slides;
    } catch (e) {
        console.error("PPTX Parse Error", e);
        return [];
    }
}

/**
 * Renders PDF pages to Image Slides (DataURL)
 */
async function renderPdfToSlides(file: File): Promise<LyricSlide[]> {
    try {
        console.log("[PDF] Starting renderPdfToSlides...");
        const arrayBuffer = await file.arrayBuffer();
        console.log(`[PDF] Loaded file buffer: ${arrayBuffer.byteLength} bytes`);

        // Use CDN worker for maximum stability in Electron/Next.js environment
        // This avoids 404s on local worker files and webpack bundling errors
        const pdfjs = await import('pdfjs-dist');
        if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        }

        console.log("[PDF] Calling getDocument...");
        const loadingTask = pdfjs.getDocument({
            data: arrayBuffer,
            useWorkerFetch: false,
            isEvalSupported: false,
            useSystemFonts: true,
            disableFontFace: false
        });

        const pdf = await loadingTask.promise;
        console.log(`[PDF] Document loaded. Pages: ${pdf.numPages}`);

        const slides: LyricSlide[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            // Yield to main thread to keep UI responsive
            await new Promise(resolve => setTimeout(resolve, 0));

            console.log(`[PDF] Rendering page ${i}/${pdf.numPages}...`);
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 }); // Good Quality

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const context = canvas.getContext('2d');

            if (context) {
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                await page.render(renderContext).promise;

                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                console.log(`[PDF] Page ${i} rendered. DataURL length: ${dataUrl.length}`);

                slides.push({
                    id: `slide-${i}-${Date.now()}`,
                    content: dataUrl,
                    label: `Page ${i}`
                });
            } else {
                console.error("[PDF] Failed to get canvas context");
            }
        }

        console.log(`[PDF] Finished rendering. Total slides: ${slides.length}`);
        return slides;
    } catch (e) {
        console.error("PDF Render Error:", e);
        // Fallback to text extraction if rendering fails
        try {
            const text = await extractTextFromPdf(file);
            if (text.trim()) {
                console.log("PDF render failed, falling back to text extraction");
                return parseLyrics(text);
            }
        } catch (textError) {
            console.error("PDF text extraction also failed:", textError);
        }
        return [];
    }
}

/**
 * Parses any file into slides.
 * For PPTX: Preserves structure (Text).
 * For PDF: Renders to Images.
 * For Others: Extracts text then chunks it.
 */
export async function parsePresentationFile(file: File): Promise<LyricSlide[]> {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'pdf') {
        const slides = await renderPdfToSlides(file);
        if (slides.length > 0) return slides;
    }

    if (ext === 'pptx') {
        return await extractSlidesFromPptx(file);
    }

    // Fallback to text extraction + smart chunking
    const text = await extractTextFromFile(file);
    return parseLyrics(text);
}

/**
 * Extracts plain text from common file formats
 */
export async function extractTextFromFile(file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'txt') {
        return await file.text();
    }
    else if (ext === 'docx') {
        return await extractTextFromDocx(file);
    }
    else if (ext === 'pdf') {
        return await extractTextFromPdf(file);
    }

    // Fallback
    return await file.text();
}
