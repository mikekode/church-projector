const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../out');
const publicDir = path.join(__dirname, '../public');

// Ensure critical assets are present in out/ (Next.js sometimes misses binaries in export)
if (fs.existsSync(path.join(publicDir, 'sql-wasm.wasm'))) {
    console.log('Ensuring sql-wasm.wasm is in out/...');
    fs.copyFileSync(
        path.join(publicDir, 'sql-wasm.wasm'),
        path.join(outDir, 'sql-wasm.wasm')
    );
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    const relativeDepth = path.relative(path.dirname(filePath), outDir);
    const prefix = relativeDepth ? relativeDepth.replace(/\\/g, '/') + '/' : './';

    console.log(`Processing: ${path.relative(outDir, filePath)} (prefix: ${prefix})`);

    // 1. Fix absolute paths in HTML/JS/CSS
    // Replace href="/..." with href="./..." or equivalent depth-based relative path
    // We target common Next.js folders like _next and static assets
    const absolutePatterns = [
        '/_next',
        '/logo.png',
        '/icon.png',
        '/favicon.ico',
        '/pastor-mike.png',
        '/sarah-creative.png',
        '/manifest.json',
        '/sql-wasm.wasm'
    ];

    absolutePatterns.forEach(pattern => {
        // Match both ="pattern and ='pattern
        const escapedPattern = pattern.replace(/\./g, '\\.');
        const regexDouble = new RegExp(`="(${escapedPattern})`, 'g');
        const regexSingle = new RegExp(`='(${escapedPattern})`, 'g');

        content = content.replace(regexDouble, `="${prefix}${pattern.substring(1)}`);
        content = content.replace(regexSingle, `='${prefix}${pattern.substring(1)}`);
    });

    // 2. Fix JS specific strings that don't have = (like in fetch protocols)
    if (filePath.endsWith('.js')) {
        content = content.split('"/_next').join('"' + prefix + '_next');
        content = content.split("'/_next").join("'" + prefix + "_next");

        // Also handle /sql-wasm.wasm in fetch('/sql-wasm.wasm')
        content = content.split('"/sql-wasm.wasm').join('"' + prefix + 'sql-wasm.wasm');
        content = content.split("'/sql-wasm.wasm").join("'" + prefix + "sql-wasm.wasm");
    }

    // 3. Robust fix for double slashes which often cause issues in packaged apps
    // Replace .// with ./
    content = content.replace(/\.\/\/+/g, './');

    // 4. Special case: Next.js __next_f logic and other internal strings
    // Sometimes paths are in JSON-like strings
    content = content.replace(/\\"\/\_next/g, `\\"${prefix}_next`);

    fs.writeFileSync(filePath, content);
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walkDir(filePath);
        } else {
            const ext = path.extname(file);
            if (['.html', '.js', '.css', '.json'].includes(ext)) {
                processFile(filePath);
            }
        }
    });
}

if (fs.existsSync(outDir)) {
    console.log('--- STARTING ELECTRON PATH HARDENING v2 ---');
    walkDir(outDir);
    console.log('--- PATH HARDENING COMPLETE ---');
} else {
    console.error(`Error: ${outDir} not found.`);
}
