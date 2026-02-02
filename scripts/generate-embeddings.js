/**
 * Generate Bible Verse Embeddings using OpenAI
 *
 * Usage: node scripts/generate-embeddings.js
 *
 * Requires: OPENAI_API_KEY environment variable
 *
 * This script processes the KJV Bible and creates embeddings for each verse.
 * The embeddings are saved to electron/resources/bible-embeddings.json
 *
 * Cost estimate: ~31,000 verses × ~50 tokens avg = ~1.5M tokens
 * At $0.02/1M tokens = ~$0.03 total cost
 */

const path = require('path');
// Load from .env.local first, then .env
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs');
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Book name mapping from abbreviation to full name
const bookNames = {
    'gn': 'Genesis', 'ex': 'Exodus', 'lv': 'Leviticus', 'nm': 'Numbers', 'dt': 'Deuteronomy',
    'js': 'Joshua', 'jg': 'Judges', 'rt': 'Ruth', '1sm': '1 Samuel', '2sm': '2 Samuel',
    '1kn': '1 Kings', '2kn': '2 Kings', '1ch': '1 Chronicles', '2ch': '2 Chronicles',
    'ezr': 'Ezra', 'ne': 'Nehemiah', 'et': 'Esther', 'jb': 'Job', 'ps': 'Psalms',
    'prv': 'Proverbs', 'ec': 'Ecclesiastes', 'so': 'Song of Solomon', 'is': 'Isaiah',
    'jr': 'Jeremiah', 'lm': 'Lamentations', 'ez': 'Ezekiel', 'dn': 'Daniel',
    'hs': 'Hosea', 'jl': 'Joel', 'am': 'Amos', 'ob': 'Obadiah', 'jn': 'Jonah',
    'mc': 'Micah', 'na': 'Nahum', 'hk': 'Habakkuk', 'zp': 'Zephaniah', 'hg': 'Haggai',
    'zc': 'Zechariah', 'ml': 'Malachi',
    'mt': 'Matthew', 'mk': 'Mark', 'lk': 'Luke', 'jo': 'John', 'ac': 'Acts',
    'rm': 'Romans', '1co': '1 Corinthians', '2co': '2 Corinthians', 'gl': 'Galatians',
    'eph': 'Ephesians', 'ph': 'Philippians', 'cl': 'Colossians', '1th': '1 Thessalonians',
    '2th': '2 Thessalonians', '1tm': '1 Timothy', '2tm': '2 Timothy', 'tt': 'Titus',
    'phm': 'Philemon', 'hb': 'Hebrews', 'jm': 'James', '1pe': '1 Peter', '2pe': '2 Peter',
    '1jo': '1 John', '2jo': '2 John', '3jo': '3 John', 'jd': 'Jude', 'rv': 'Revelation'
};

async function generateEmbeddings() {
    console.log('Loading KJV Bible data...');

    const kjvPath = path.join(__dirname, '..', 'utils', 'kjv.json');
    // Remove BOM if present
    const kjvRaw = fs.readFileSync(kjvPath, 'utf-8').replace(/^\uFEFF/, '');
    const kjv = JSON.parse(kjvRaw);

    // Prepare verses array
    const verses = [];

    for (const book of kjv) {
        const bookName = bookNames[book.abbrev] || book.abbrev;

        for (let chapterIdx = 0; chapterIdx < book.chapters.length; chapterIdx++) {
            const chapter = book.chapters[chapterIdx];
            const chapterNum = chapterIdx + 1;

            for (let verseIdx = 0; verseIdx < chapter.length; verseIdx++) {
                const verseNum = verseIdx + 1;
                const text = chapter[verseIdx];

                // Clean up text (remove Hebrew/Greek annotations in curly braces)
                const cleanText = text.replace(/\{[^}]*\}/g, '').trim();

                verses.push({
                    ref: `${bookName} ${chapterNum}:${verseNum}`,
                    text: cleanText
                });
            }
        }
    }

    console.log(`Found ${verses.length} verses to process`);

    // Process in batches (OpenAI allows up to 2048 inputs per request)
    const BATCH_SIZE = 500;
    const embeddings = [];

    for (let i = 0; i < verses.length; i += BATCH_SIZE) {
        const batch = verses.slice(i, i + BATCH_SIZE);
        const batchTexts = batch.map(v => v.text);

        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(verses.length / BATCH_SIZE)}...`);

        try {
            const response = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: batchTexts,
                dimensions: 128 // Smaller dimensions = smaller file, still accurate
            });

            for (let j = 0; j < batch.length; j++) {
                // Quantize to 4 decimal places to reduce file size
                const quantizedEmb = response.data[j].embedding.map(v => Math.round(v * 10000) / 10000);
                embeddings.push({
                    ref: batch[j].ref,
                    text: batch[j].text.substring(0, 150), // Shorter text preview
                    emb: quantizedEmb
                });
            }

            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            console.error(`Error processing batch starting at ${i}:`, error.message);
            // Retry logic
            await new Promise(resolve => setTimeout(resolve, 5000));
            i -= BATCH_SIZE; // Retry this batch
        }
    }

    console.log(`Generated ${embeddings.length} embeddings`);

    // Save to file
    const outputDir = path.join(__dirname, '..', 'electron', 'resources');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'bible-embeddings.json');
    fs.writeFileSync(outputPath, JSON.stringify(embeddings));

    const stats = fs.statSync(outputPath);
    console.log(`\nSaved to ${outputPath}`);
    console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log('\nDone!');
}

generateEmbeddings().catch(console.error);
