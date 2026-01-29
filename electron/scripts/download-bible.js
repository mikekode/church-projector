const fs = require('fs');
const path = require('path');
const https = require('https');

const RESOURCES_DIR = path.join(__dirname, '../resources');
if (!fs.existsSync(RESOURCES_DIR)) {
    fs.mkdirSync(RESOURCES_DIR, { recursive: true });
}

const BIBLE_URL = "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json";
const DEST_PATH = path.join(RESOURCES_DIR, 'en_kjv.json');

console.log("Downloading KJV Bible...", BIBLE_URL);

const file = fs.createWriteStream(DEST_PATH);

https.get(BIBLE_URL, (response) => {
    if (response.statusCode !== 200) {
        console.error("Failed to download:", response.statusCode);
        process.exit(1);
    }

    response.pipe(file);

    file.on('finish', () => {
        file.close();
        console.log("Download completed: " + DEST_PATH);
    });
}).on('error', (err) => {
    fs.unlink(DEST_PATH, () => { }); // Delete the file async. (But we don't check result)
    console.error("Error during download:", err.message);
    process.exit(1);
});
