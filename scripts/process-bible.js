const fs = require('fs');
const path = require('path');

// Target abbrevs required by Church Projector
const TARGET_CODES = {
    "genesis": "gn", "exodus": "ex", "leviticus": "lv", "numbers": "nm", "deuteronomy": "dt",
    "joshua": "js", "judges": "jud", "ruth": "rt", "1 samuel": "1sm", "2 samuel": "2sm",
    "1 kings": "1kgs", "2 kings": "2kgs", "1 chronicles": "1ch", "2 chronicles": "2ch",
    "ezra": "ezr", "nehemiah": "ne", "esther": "et", "job": "job", "psalms": "ps",
    "proverbs": "prv", "ecclesiastes": "ec", "song of solomon": "so", "isaiah": "is",
    "jeremiah": "jr", "lamentations": "lm", "ezekiel": "ez", "daniel": "dn",
    "hosea": "ho", "joel": "jl", "amos": "am", "obadiah": "ob", "jonah": "jn",
    "micah": "mi", "nahum": "na", "habakkuk": "hk", "zephaniah": "zp", "haggai": "hg",
    "zechariah": "zc", "malachi": "ml", "matthew": "mt", "mark": "mk", "luke": "lk",
    "john": "jo", "acts": "act", "romans": "rm", "1 corinthians": "1co", "2 corinthians": "2co",
    "galatians": "gl", "ephesians": "eph", "philippians": "ph", "colossians": "cl",
    "1 thessalonians": "1ts", "2 thessalonians": "2ts", "1 timothy": "1tm", "2 timothy": "2tm",
    "titus": "tt", "philemon": "phm", "hebrews": "hb", "james": "jm", "1 peter": "1pe",
    "2 peter": "2pe", "1 john": "1jo", "2 john": "2jo", "3 john": "3jo", "jude": "jd",
    "revelation": "re"
};

const inputFile = process.argv[2];
if (!inputFile) {
    console.log("Usage: node scripts/process-bible.js <downloaded_file.json>");
    console.log("Converts generic Bible JSONs to the format required by Church Projector.");
    process.exit(1);
}

try {
    const raw = fs.readFileSync(inputFile, 'utf-8');
    const data = JSON.parse(raw);

    // Handle { "books": [...] } wrapper if present
    const books = Array.isArray(data) ? data : (data.books || data.result || []);

    if (books.length === 0) {
        throw new Error("Could not find array of books in JSON.");
    }

    const converted = books.map(book => {
        // Handle various input keys (name, book_name, book)
        const nameRaw = book.name || book.book_name || book.book || "";
        const name = nameRaw.toLowerCase().trim();

        let code = TARGET_CODES[name];

        if (!code) {
            // Try to map known aliases (e.g. "Song of Songs" -> "so")
            if (name === "song of songs") code = "so";
            if (name === "psalm") code = "ps";
            // Fallback
            if (!code) {
                console.warn(`[WARN] Could not map '${nameRaw}'. Using original abbrev '${book.abbrev}' just in case.`);
                code = book.abbrev || name.substring(0, 2);
            }
        }

        return {
            abbrev: code,
            name: nameRaw,
            chapters: book.chapters
        };
    });

    const outPath = path.join(path.dirname(inputFile), 'processed_' + path.basename(inputFile));
    fs.writeFileSync(outPath, JSON.stringify(converted));

    console.log(`\n✅ Conversion Complete!`);
    console.log(`Input: ${books.length} books found.`);
    console.log(`Output: ${outPath}`);
    console.log(`\nNEXT STEP: Rename this file to 'en_niv.json' (or similar) and place it in 'electron/resources/'.`);

} catch (e) {
    console.error("Error:", e.message);
    console.error("Ensure the input JSON matches structure [{ name: 'Genesis', chapters: [['v1'],['v1']] }]");
}
