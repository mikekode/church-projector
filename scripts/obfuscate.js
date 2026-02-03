/**
 * Creenly Code Obfuscation Script
 *
 * Obfuscates JavaScript files in the electron/ folder before packaging.
 * Run this after `next build` and before `electron-builder`.
 *
 * Usage: node scripts/obfuscate.js
 */

const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const ELECTRON_DIR = path.join(__dirname, '../electron');
const FILES_TO_OBFUSCATE = ['main.js', 'preload.js'];

// HIGH SECURITY obfuscation settings - makes reverse engineering extremely difficult
const OBFUSCATION_OPTIONS = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75, // Increased from 0.5
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4, // Increased from 0.2
    debugProtection: false, // Keep false - causes issues in Electron
    disableConsoleOutput: false, // Keep for debugging in production
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false, // Keep false to avoid breaking require() calls
    selfDefending: true, // ENABLED: Breaks code if beautified/formatted
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 5, // Smaller chunks = harder to read
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.75, // Increased
    stringArrayEncoding: ['rc4'], // Stronger encoding than base64
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 3, // Increased from 2
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 5, // Increased
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.9, // Increased from 0.75
    transformObjectKeys: true,
    unicodeEscapeSequence: true // ENABLED: Makes strings unreadable
};

console.log('=== CREENLY CODE OBFUSCATION ===\n');

let filesProcessed = 0;
let errors = 0;

for (const fileName of FILES_TO_OBFUSCATE) {
    const filePath = path.join(ELECTRON_DIR, fileName);

    if (!fs.existsSync(filePath)) {
        console.log(`[SKIP] ${fileName} - file not found`);
        continue;
    }

    try {
        console.log(`[OBFUSCATING] ${fileName}...`);

        const originalCode = fs.readFileSync(filePath, 'utf8');
        const originalSize = Buffer.byteLength(originalCode, 'utf8');

        const obfuscationResult = JavaScriptObfuscator.obfuscate(originalCode, OBFUSCATION_OPTIONS);
        const obfuscatedCode = obfuscationResult.getObfuscatedCode();
        const newSize = Buffer.byteLength(obfuscatedCode, 'utf8');

        // Backup original (optional, can remove in production)
        // fs.writeFileSync(filePath + '.backup', originalCode);

        // Write obfuscated code
        fs.writeFileSync(filePath, obfuscatedCode);

        const sizeChange = ((newSize - originalSize) / originalSize * 100).toFixed(1);
        console.log(`[DONE] ${fileName} - ${(originalSize / 1024).toFixed(1)}KB -> ${(newSize / 1024).toFixed(1)}KB (${sizeChange > 0 ? '+' : ''}${sizeChange}%)`);

        filesProcessed++;
    } catch (error) {
        console.error(`[ERROR] ${fileName} - ${error.message}`);
        errors++;
    }
}

console.log(`\n=== OBFUSCATION COMPLETE ===`);
console.log(`Files processed: ${filesProcessed}`);
console.log(`Errors: ${errors}`);

if (errors > 0) {
    process.exit(1);
}
