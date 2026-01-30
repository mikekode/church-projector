const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const apiPath = 'app\\api';
const apiBackupPath = '.temp_api_backup';  // Outside app folder so Next.js doesn't pick it up

console.log('Building Electron app...');

try {
    // Backup API folder if it exists
    if (fs.existsSync(apiPath)) {
        console.log('Temporarily moving API folder outside app directory...');
        // Clean backup location
        if (fs.existsSync(apiBackupPath)) {
            execSync(`rmdir /s /q "${apiBackupPath}"`, { stdio: 'ignore' });
        }

        // Copy to backup location (outside app folder)
        execSync(`xcopy "${apiPath}" "${apiBackupPath}" /E /I /Q /Y`, { stdio: 'ignore' });
        execSync(`rmdir /s /q "${apiPath}"`, { stdio: 'ignore' });
        console.log('API folder moved to temporary location');
    }

    // Run Next.js build
    console.log('Running Next.js build...');
    execSync('cross-env BUILD_TARGET=electron next build', { stdio: 'inherit' });

    console.log('Build successful!');

} catch (error) {
    console.error('Build failed:', error.message);
    process.exitCode = 1;
} finally {
    // Restore API folder
    if (fs.existsSync(apiBackupPath)) {
        console.log('Restoring API folder...');
        if (fs.existsSync(apiPath)) {
            execSync(`rmdir /s /q "${apiPath}"`, { stdio: 'ignore' });
        }
        execSync(`xcopy "${apiBackupPath}" "${apiPath}" /E /I /Q /Y`, { stdio: 'ignore' });
        execSync(`rmdir /s /q "${apiBackupPath}"`, { stdio: 'ignore' });
        console.log('API folder restored');
    }
}
