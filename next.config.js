module.exports = {
    // output: 'export', // Removed to allow API routes on Vercel
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
