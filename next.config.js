module.exports = {
    // Enable static export for Electron builds, disable for Vercel
    output: process.env.BUILD_TARGET === 'electron' ? 'export' : undefined,
    images: {
        unoptimized: true
    },
    typescript: {
        ignoreBuildErrors: true
    },
    eslint: {
        ignoreDuringBuilds: true
    }
}
