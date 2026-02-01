const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '../app/api');
const backupDir = path.join(__dirname, '../.api-backup');

const action = process.argv[2]; // 'hide' or 'restore'

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

if (action === 'hide') {
    // Copy API folder to backup, then delete original
    if (fs.existsSync(apiDir)) {
        if (fs.existsSync(backupDir)) {
            fs.rmSync(backupDir, { recursive: true, force: true });
        }
        copyDir(apiDir, backupDir);
        fs.rmSync(apiDir, { recursive: true, force: true });
        console.log('API routes hidden for static export');
    }
} else if (action === 'restore') {
    // Restore API folder from backup
    if (fs.existsSync(backupDir)) {
        if (fs.existsSync(apiDir)) {
            fs.rmSync(apiDir, { recursive: true, force: true });
        }
        copyDir(backupDir, apiDir);
        fs.rmSync(backupDir, { recursive: true, force: true });
        console.log('API routes restored');
    }
} else {
    console.log('Usage: node prepare-electron-build.js [hide|restore]');
}
