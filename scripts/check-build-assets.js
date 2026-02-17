const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../out');
const criticalFiles = [
    'sql-wasm.wasm',
    'logo.png',
    'icon.png',
    'dashboard.html',
    'projector.html',
    'stage.html'
];

console.log('--- STARTING PRODUCTION ASSET VERIFICATION ---');

let missingFiles = [];

criticalFiles.forEach(file => {
    const filePath = path.join(outDir, file);
    if (fs.existsSync(filePath)) {
        console.log(`[OK] Found critical asset: ${file}`);
    } else {
        console.error(`[ERROR] Missing critical asset: ${file}`);
        missingFiles.push(file);
    }
});

if (missingFiles.length > 0) {
    console.error('\nFAIL: Critical assets are missing from the out/ directory.');
    process.exit(1);
} else {
    console.log('\nSUCCESS: All critical production assets are present.');
}
