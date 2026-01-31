const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../out');

function fixHtmlFiles(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            fixHtmlFiles(filePath);
        } else if (file.endsWith('.html')) {
            let content = fs.readFileSync(filePath, 'utf-8');

            // Calculate depth to assets
            const relativePath = path.relative(dir, outDir);
            const prefix = relativePath ? relativePath.replace(/\\/g, '/') + '/' : './';

            console.log(`Fixing paths in: ${filePath} (Prefix: ${prefix})`);

            // Replace absolute paths with relative ones
            // Matches /_next/, /logo.png, /icon.png, etc.
            content = content.replace(/(href|src)="\/(_next|logo\.png|icon\.png|pastor-mike\.png|sarah-creative\.png|manifest\.json|favicon\.ico|vercel\.svg|next\.svg)/g, `$1="${prefix}$2`);

            // Fix double slashes if any (e.g. .//_next)
            content = content.replace(/="\.\/\/+/g, '="./');

            fs.writeFileSync(filePath, content);
        }
    });
}

if (fs.existsSync(outDir)) {
    console.log('Starting path fix for Electron compatibility...');
    fixHtmlFiles(outDir);
    console.log('Path fix complete.');
} else {
    console.error('Out directory not found at:', outDir);
}
