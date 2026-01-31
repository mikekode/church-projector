const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../out');

function processFile(filePath, dir) {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Calculate relative path depth
    const relativeDepth = path.relative(path.dirname(filePath), outDir);
    const prefix = relativeDepth ? relativeDepth.replace(/\\/g, '/') + '/' : './';

    // 1. Fix absolute paths starting with / in HTML attributes
    // e.g. href="/_next/..." -> href="./_next/..."
    content = content.replace(/(href|src|srcset)="\/(_next|logo\.png|icon\.png|pastor-mike\.png|sarah-creative\.png|favicon\.ico|manifest\.json|vercel\.svg|next\.svg)/g, (match, attr, folder) => {
        return `${attr}="${prefix}${folder}`;
    });

    // 2. Fix JS dynamic imports/paths that use "/_next"
    // Next.js chunks often have hardcoded "/_next" strings
    if (filePath.endsWith('.js')) {
        content = content.split('"/_next').join('"' + prefix + '_next');
        content = content.split("'/_next").join("'" + prefix + "_next");
    }

    // 3. Fix CSS url() references if any are absolute (though they are usually relative)
    if (filePath.endsWith('.css')) {
        content = content.replace(/url\(\//g, `url(${prefix}`);
    }

    // 4. Remove potential double slashes created by Next.js assetPrefix: './'
    content = content.replace(/="\.\/\/+/g, '="./');
    content = content.replace(/'\.\/\/+/g, "'./");

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
                processFile(filePath, dir);
            }
        }
    });
}

if (fs.existsSync(outDir)) {
    console.log('--- Electron Path Hardening ---');
    console.log(`Processing: ${outDir}`);
    walkDir(outDir);
    console.log('Path hardening complete.');
} else {
    console.error(`Error: ${outDir} not found.`);
}
