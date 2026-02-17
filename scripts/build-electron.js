/**
 * Cross-platform Electron build script.
 *
 * `next build` with `output: 'export'` exits with code 1 when API routes
 * (verse-lookup, songs/search, songs/lyrics) can't be pre-rendered.
 * Those routes only work on Vercel — the Electron app uses IPC instead.
 *
 * This script swallows that expected error and continues with
 * path-hardening and asset verification.
 */

const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

// 1. Run Next.js build (may exit 1 due to API route prerender errors — that's OK)
console.log('=== Step 1: Next.js Build ===');
try {
    execSync('npx next build', { cwd: root, stdio: 'inherit' });
} catch {
    console.log('\n⚠  next build exited with errors (API route prerender — expected for Electron)\n');
}

// 2. Fix paths for Electron file:// protocol
console.log('=== Step 2: Path Hardening ===');
execSync('node scripts/fix-paths.js', { cwd: root, stdio: 'inherit' });

// 3. Verify critical assets exist in out/
console.log('\n=== Step 3: Asset Verification ===');
execSync('node scripts/check-build-assets.js', { cwd: root, stdio: 'inherit' });

console.log('\n✓ Electron build complete');
